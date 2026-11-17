-- 知行圖書館智慧座位系統：整份貼入 Supabase SQL Editor 後按 Run
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email) values(new.id,new.email)
  on conflict(id) do update set email=excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  space_id text not null check(space_id in ('pavilion','atrium','loft')),
  seat_no text not null unique,
  seat_no_order int not null,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

-- 初始建立 48 席（每個空間 16 席）；不會覆蓋既有席位或管理員鎖定狀態。
insert into public.seats(space_id,seat_no,seat_no_order)
select s.space_id, s.prefix || '-' || lpad(n::text,2,'0'), n
from (values ('pavilion','P'),('atrium','A'),('loft','L')) as s(space_id,prefix)
cross join generate_series(1,16) n
on conflict(seat_no) do nothing;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_id uuid not null references public.seats(id),
  reservation_date date not null,
  time_slot text not null check(time_slot in ('morning','afternoon','evening')),
  created_at timestamptz not null default now(),
  unique(seat_id,reservation_date,time_slot),
  unique(user_id,reservation_date,time_slot)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_id uuid not null references public.seats(id),
  description text not null check(length(trim(description)) between 3 and 1000),
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.seats enable row level security;
alter table public.reservations enable row level security;
alter table public.reports enable row level security;

drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles for select to authenticated using(id=auth.uid());
drop policy if exists "seats readable by everyone" on public.seats;
create policy "seats readable by everyone" on public.seats for select to anon,authenticated using(true);
drop policy if exists "admin update seats" on public.seats;
create policy "admin update seats" on public.seats for update to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "reservation owner read" on public.reservations;
create policy "reservation owner read" on public.reservations for select to authenticated using(user_id=auth.uid());
drop policy if exists "reservation owner delete" on public.reservations;
create policy "reservation owner delete" on public.reservations for delete to authenticated using(user_id=auth.uid() and reservation_date >= current_date);

drop policy if exists "reports submit authenticated" on public.reports;
create policy "reports submit authenticated" on public.reports for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "admin read reports" on public.reports;
create policy "admin read reports" on public.reports for select to authenticated using(public.is_admin());
drop policy if exists "admin update reports" on public.reports;
create policy "admin update reports" on public.reports for update to authenticated using(public.is_admin()) with check(public.is_admin());

-- 僅回傳占用中的 seat UUID，不暴露其他使用者的預約資料。
create or replace function public.get_reserved_seat_ids(p_date date,p_slot text)
returns table(seat_id uuid)
language sql stable security definer set search_path=public as $$
  select r.seat_id from public.reservations r
  where r.reservation_date=p_date and r.time_slot=p_slot;
$$;
grant execute on function public.get_reserved_seat_ids(date,text) to anon,authenticated;

-- 原子化預約：避免兩人同時搶到同一席，也限制同一帳號每時段一席。
create or replace function public.book_seat(p_seat_id uuid,p_date date,p_slot text)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception '請先登入'; end if;
  if p_date < current_date then raise exception '不可預約過去日期'; end if;
  if p_date > current_date + 13 then raise exception '目前僅開放未來 14 天內預約'; end if;
  if p_slot not in ('morning','afternoon','evening') then raise exception '無效時段'; end if;
  if not exists(select 1 from public.seats where id=p_seat_id and is_locked=false) then
    raise exception '此座位不存在或目前維護中';
  end if;
  insert into public.reservations(user_id,seat_id,reservation_date,time_slot)
  values(auth.uid(),p_seat_id,p_date,p_slot) returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception '此座位已被預約，或你在此日期時段已有其他預約';
end; $$;
grant execute on function public.book_seat(uuid,date,text) to authenticated;

-- Realtime 訂閱事件；前端收到變更後重新呼叫受權限保護的查詢。
do $$ begin
  alter publication supabase_realtime add table public.reservations;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.seats;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.reports;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

-- 完成首次註冊後，將該帳號設為管理員（請替換成自己的登入 Email）。
-- update public.profiles set role='admin' where email='your-email@example.com';
