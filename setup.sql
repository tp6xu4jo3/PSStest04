-- PSST / 北科圖書館智慧座位系統
-- 執行平台：Supabase SQL Editor；建議在全新專案執行。
-- 與舊版 PSStest04-main/setup.sql 表格欄位不相容，請勿在已有資料的舊資料庫直接覆蓋。
-- 所有權限由資料庫檢查，前端 Publishable Key 並非管理權限。
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,email,role) values (new.id,new.email,'student')
  on conflict (id) do update set email=excluded.email;
  return new;
end $$;
drop trigger if exists psst_new_user on auth.users;
create trigger psst_new_user after insert on auth.users
for each row execute function public.handle_new_user();
-- 補建早於本版SQL註冊的帳號；絕不覆蓋既有的管理角色
insert into public.profiles(id,email) select id,email from auth.users on conflict (id) do nothing;

create table if not exists public.seats (
  id text primary key check(id ~ '^(P|A|L)-[0-9]{2}$'),
  space_id text not null check(space_id in ('pavilion','atrium','loft')),
  is_locked boolean not null default false,
  lock_reason text,
  has_active_anomaly_report boolean not null default false,
  has_person boolean not null default false,
  has_backpack boolean not null default false,
  has_books boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.seats (id,space_id)
select s.prefix||'-'||lpad(n::text,2,'0'), s.space_id
from (values ('pavilion','P',12),('atrium','A',16),('loft','L',20)) as s(space_id,prefix,nmax)
cross join lateral generate_series(1,s.nmax) as nums(n)
on conflict(id) do nothing;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_id text not null references public.seats(id) on delete restrict,
  reservation_date date not null,
  time_slot text not null check(time_slot in ('morning','afternoon','evening')),
  state text not null default 'waiting' check(state in ('waiting','checked_in','temp_away')),
  checked_in_at timestamptz,
  away_since timestamptz,
  created_at timestamptz not null default now(),
  constraint only_one_booking_per_seat_slot unique(seat_id,reservation_date,time_slot),
  constraint only_one_booking_per_student_slot unique(user_id,reservation_date,time_slot)
);
create index if not exists reservations_user_date on public.reservations(user_id,reservation_date);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_id text not null references public.seats(id) on delete restrict,
  issue_type text not null check(issue_type in ('seat_occupied_by_other','items_left_unbooked','equipment_fault','noise_disturbance')),
  description text not null check(char_length(trim(description)) between 3 and 1000),
  stage text not null default 'submitted' check(stage in ('submitted','inspecting','resolved')),
  librarian_note text,
  replacement_seat_code text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- 同座位只能有一筆未結案異常，避免重複回報占位
create unique index if not exists report_one_active_per_seat on public.reports(seat_id) where(stage <> 'resolved');

-- 對外只公布座位代碼的變更通知；不廣播預約者ID/信箱。
create table if not exists public.seat_events (
 id bigint generated always as identity primary key,
 seat_id text not null,
 created_at timestamptz not null default now()
);
create or replace function public.emit_seat_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p text;
begin
  if tg_table_name='seats' then
    p := case when tg_op='DELETE' then old.id else new.id end;
  else
    p := case when tg_op='DELETE' then old.seat_id else new.seat_id end;
  end if;
  insert into public.seat_events(seat_id) values(p);
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists psst_seats_event on public.seats;
create trigger psst_seats_event after update on public.seats for each row execute function public.emit_seat_event();
drop trigger if exists psst_reservations_event on public.reservations;
create trigger psst_reservations_event after insert or update or delete on public.reservations for each row execute function public.emit_seat_event();
drop trigger if exists psst_reports_event on public.reports;
create trigger psst_reports_event after insert or update on public.reports for each row execute function public.emit_seat_event();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.seats enable row level security;
alter table public.reservations enable row level security;
alter table public.reports enable row level security;
alter table public.seat_events enable row level security;

-- PostgREST 預設API只准必要的讀取；寫入透過RPC。
revoke all on public.profiles, public.seats, public.reservations, public.reports, public.seat_events from anon, authenticated;
grant select on public.seats to anon,authenticated;
grant select on public.seat_events to anon,authenticated;
grant select on public.profiles, public.reservations, public.reports to authenticated;

-- 若此SQL重複執行，先重新建立政策
DROP POLICY IF EXISTS psst_profiles_self ON public.profiles;
CREATE POLICY psst_profiles_self ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
DROP POLICY IF EXISTS psst_seats_public ON public.seats;
CREATE POLICY psst_seats_public ON public.seats FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS psst_res_owner ON public.reservations;
CREATE POLICY psst_res_owner ON public.reservations FOR SELECT TO authenticated USING (user_id=auth.uid());
DROP POLICY IF EXISTS psst_reports_owner_or_admin ON public.reports;
CREATE POLICY psst_reports_owner_or_admin ON public.reports FOR SELECT TO authenticated USING (user_id=auth.uid() or public.is_admin());
DROP POLICY IF EXISTS psst_events_public ON public.seat_events;
CREATE POLICY psst_events_public ON public.seat_events FOR SELECT TO anon,authenticated USING (true);

-- 封鎖 public 既有RPC的PUBLIC預設EXECUTE並只授予必要角色
create or replace function public.get_seat_snapshot(p_date date,p_slot text)
returns table(seat_id text,booking_state text,is_mine boolean)
language sql stable security definer set search_path = '' as $$
  select r.seat_id,r.state,(r.user_id=auth.uid()) as is_mine
  from public.reservations r
  where r.reservation_date=p_date and r.time_slot=p_slot and p_slot in('morning','afternoon','evening');
$$;
revoke all on function public.get_seat_snapshot(date,text) from public;
grant execute on function public.get_seat_snapshot(date,text) to anon,authenticated;

create or replace function public.book_seat(p_seat_id text,p_date date,p_slot text)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; st record; d date := (now() at time zone 'Asia/Taipei')::date;
begin
  if auth.uid() is null then raise exception '請先登入'; end if;
  if p_date < d or p_date > d+13 then raise exception '預約日期僅開放今日起14日內'; end if;
  if p_slot not in ('morning','afternoon','evening') then raise exception '時段無效'; end if;
  select * into st from public.seats where id=p_seat_id for update;
  if not found or st.is_locked or st.has_active_anomaly_report or
     (p_date=d and (st.has_person or st.has_backpack or st.has_books)) then
    raise exception '此座位暫時無法預約';
  end if;
  insert into public.reservations (user_id,seat_id,reservation_date,time_slot)
  values(auth.uid(),p_seat_id,p_date,p_slot) returning id into new_id;
  return new_id;
exception when unique_violation then raise exception '座位已被預約，或您同日期時段已有預約';
end $$;
revoke all on function public.book_seat(text,date,text) from public;
grant execute on function public.book_seat(text,date,text) to authenticated;

create or replace function public.cancel_booking(p_seat_id text,p_date date,p_slot text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 delete from public.reservations where seat_id=p_seat_id and reservation_date=p_date
   and time_slot=p_slot and user_id=auth.uid();
 if not found then raise exception '找不到您在該時段的預約'; end if;
end $$;
revoke all on function public.cancel_booking(text,date,text) from public;
grant execute on function public.cancel_booking(text,date,text) to authenticated;

create or replace function public.change_booking_state(p_seat_id text,p_date date,p_slot text,p_action text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 if p_action='check_in' then
   update public.reservations set state='checked_in',checked_in_at=now(),away_since=null
   where seat_id=p_seat_id and reservation_date=p_date and time_slot=p_slot and user_id=auth.uid() and state='waiting';
 elsif p_action='away' then
   update public.reservations set state='temp_away',away_since=now()
   where seat_id=p_seat_id and reservation_date=p_date and time_slot=p_slot and user_id=auth.uid() and state='checked_in';
 elsif p_action='return' then
   update public.reservations set state='checked_in',away_since=null
   where seat_id=p_seat_id and reservation_date=p_date and time_slot=p_slot and user_id=auth.uid() and state='temp_away';
 else raise exception '無效的入座動作'; end if;
 if not found then raise exception '狀態已變更或沒有操作權限'; end if;
end $$;
revoke all on function public.change_booking_state(text,date,text,text) from public;
grant execute on function public.change_booking_state(text,date,text,text) to authenticated;

create or replace function public.swap_booking(p_from text,p_to text,p_date date,p_slot text)
returns void language plpgsql security definer set search_path='' as $$
declare seat_ok boolean;
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 if p_from=p_to then raise exception '不能換到原座位'; end if;
 perform 1 from public.seats where id in(p_from,p_to) order by id for update;
 select not(is_locked or has_active_anomaly_report or has_person or has_backpack or has_books)
   into seat_ok from public.seats where id=p_to;
 if seat_ok is distinct from true then raise exception '替代座位不可預約'; end if;
 update public.reservations set seat_id=p_to,state='waiting',checked_in_at=null,away_since=null
   where seat_id=p_from and user_id=auth.uid() and reservation_date=p_date and time_slot=p_slot;
 if not found then raise exception '無法找到原預約'; end if;
 update public.reports set replacement_seat_code=p_to
   where user_id=auth.uid() and seat_id=p_from and stage<>'resolved';
exception when unique_violation then raise exception '替代座位已被預約';
end $$;
revoke all on function public.swap_booking(text,text,date,text) from public;
grant execute on function public.swap_booking(text,text,date,text) to authenticated;

create or replace function public.submit_report(p_seat_id text,p_issue_type text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if auth.uid() is null then raise exception '請先登入'; end if;
 if p_issue_type not in ('seat_occupied_by_other','items_left_unbooked','equipment_fault','noise_disturbance') then raise exception '異常類型無效'; end if;
 if char_length(trim(p_description)) not between 3 and 1000 then raise exception '描述應介於3至1000字'; end if;
 perform 1 from public.seats where id=p_seat_id for update;
 if not found then raise exception '座位不存在'; end if;
 insert into public.reports(user_id,seat_id,issue_type,description)
 values(auth.uid(),p_seat_id,p_issue_type,trim(p_description)) returning id into rid;
 update public.seats set has_active_anomaly_report=true,updated_at=now() where id=p_seat_id;
 return rid;
exception when unique_violation then raise exception '此座位已有未結案回報';
end $$;
revoke all on function public.submit_report(text,text,text) from public;
grant execute on function public.submit_report(text,text,text) to authenticated;

create or replace function public.admin_set_vision(p_seat_id text,p_person boolean,p_backpack boolean,p_books boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception '僅限管理員'; end if;
 update public.seats set has_person=p_person,has_backpack=p_backpack,has_books=p_books,updated_at=now() where id=p_seat_id;
 if not found then raise exception '找不到座位'; end if;
end $$;
revoke all on function public.admin_set_vision(text,boolean,boolean,boolean) from public;
grant execute on function public.admin_set_vision(text,boolean,boolean,boolean) to authenticated;

create or replace function public.admin_toggle_lock(p_seat_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception '僅限管理員'; end if;
 update public.seats set is_locked=not is_locked,lock_reason=case when not is_locked then '館員手動檢修' else null end,updated_at=now() where id=p_seat_id;
 if not found then raise exception '找不到座位'; end if;
end $$;
revoke all on function public.admin_toggle_lock(text) from public;
grant execute on function public.admin_toggle_lock(text) to authenticated;

create or replace function public.admin_advance_report(p_report_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare target text;
begin
 if not public.is_admin() then raise exception '僅限管理員'; end if;
 select seat_id into target from public.reports where id=p_report_id for update;
 if not found then raise exception '回報不存在'; end if;
 if p_action='inspect' then
  update public.reports set stage='inspecting' where id=p_report_id and stage='submitted';
 elsif p_action in ('clear_and_unlock','confirm_valid_occupant') then
  update public.reports set stage='resolved',resolved_at=now(),librarian_note=case when p_action='clear_and_unlock' then '館員現場清離並重新開放' else '館員確認合法使用者' end
   where id=p_report_id and stage<>'resolved';
  update public.seats set has_active_anomaly_report=false, updated_at=now(),
    has_person=case when p_action='clear_and_unlock' then false else has_person end,
    has_backpack=case when p_action='clear_and_unlock' then false else has_backpack end,
    has_books=case when p_action='clear_and_unlock' then false else has_books end
   where id=target;
 else raise exception '處理動作無效'; end if;
end $$;
revoke all on function public.admin_advance_report(uuid,text) from public;
grant execute on function public.admin_advance_report(uuid,text) to authenticated;

create or replace function public.admin_clear_anomaly(p_seat_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception '僅限管理員'; end if;
 update public.reports set stage='resolved',resolved_at=now(),librarian_note='館員人工清除異常'
   where seat_id=p_seat_id and stage<>'resolved';
 update public.seats set has_active_anomaly_report=false,has_person=false,has_backpack=false,has_books=false,updated_at=now()
   where id=p_seat_id;
 if not found then raise exception '找不到座位'; end if;
end $$;
revoke all on function public.admin_clear_anomaly(text) from public;
grant execute on function public.admin_clear_anomaly(text) to authenticated;

-- Realtime僅透過 seat_events 提醒客戶端重新讀取，不包含其他學生個資。
do $$ begin
 alter publication supabase_realtime add table public.seat_events;
exception when duplicate_object then null; when undefined_object then null;
end $$;
-- 可定期在SQL Editor清掉舊通知，避免資料表無限增長：
-- delete from public.seat_events where created_at < now()-interval '7 days';
-- 設定管理員：先註冊，再由SQL Editor執行，勿在前端開放此權限：
-- update public.profiles set role='admin' where email='your-email@example.com';
