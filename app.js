(() => {
const cfg=window.APP_CONFIG||{}, $=id=>document.getElementById(id);
let client=null,user=null,isAdmin=false,seats=[],reservations=[],reports=[],authMode='login',channel=null;
const spaces={pavilion:'晨光木質靜讀室',atrium:'玻璃中庭協作廳',loft:'空中夾層研究區'};
const slots={morning:'08:00–12:00 上午',afternoon:'13:00–17:00 下午',evening:'17:30–21:30 夜間'};
const today=()=>new Date().toLocaleDateString('en-CA');
$('date-filter').innerHTML=Array.from({length:14},(_,i)=>{let d=new Date();d.setDate(d.getDate()+i);let v=d.toLocaleDateString('en-CA');return `<option value="${v}">${v}${i===0?'（今天）':''}</option>`}).join('');
function notice(msg,error=false){$('notice').textContent=msg;$('notice').classList.remove('hidden','error');if(error)$('notice').classList.add('error');}
function clearNotice(){$('notice').classList.add('hidden')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function status(seat){return seat.is_locked?'locked':reservations.some(r=>r.seat_id===seat.id)?'booked':'free'}
async function init(){
 if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){notice('請先編輯 config.js，填入 Supabase URL 與 Publishable Key，並完成 README 的資料庫初始化。',true);$('spaces').innerHTML='<div class="empty">尚未設定 Supabase，完成設定後重新整理頁面。</div>';return;}
 client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
 const {data:{session}}=await client.auth.getSession();await setUser(session?.user||null);
 client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>setUser(session?.user||null),0)});
 await load();
}
async function setUser(u){user=u;$('user-label').textContent=u?u.email:'尚未登入';$('auth-open').classList.toggle('hidden',!!u);$('logout').classList.toggle('hidden',!u);if(!u){isAdmin=false;$('admin-tab').hidden=true;}else{const {data}=await client.from('profiles').select('role').eq('id',u.id).maybeSingle();isAdmin=data?.role==='admin';$('admin-tab').hidden=!isAdmin;}render();}
async function load(){
 if(!client)return;
 const [{data:s,error:se},{data:r,error:re},{data:p,error:pe}]=await Promise.all([
 client.from('seats').select('*').order('space_id').order('seat_no'),
 client.rpc('get_reserved_seat_ids',{p_date:$('date-filter').value,p_slot:$('slot-filter').value}),
 client.from('reports').select('*').order('created_at',{ascending:false})
 ]);
 if(se) return notice('讀取座位失敗：'+se.message,true);
 if(re) return notice('讀取預約狀態失敗：'+re.message,true);
 seats=s||[];reservations=(r||[]).map(x=>({seat_id:x.seat_id}));reports=p||[];
 await loadMine();render();
 if(!channel)channel=client.channel('public-seat-updates').on('postgres_changes',{event:'*',schema:'public',table:'reservations'},()=>load()).on('postgres_changes',{event:'*',schema:'public',table:'seats'},()=>load()).on('postgres_changes',{event:'*',schema:'public',table:'reports'},()=>load()).subscribe();
}
async function loadMine(){if(!user){window.myReservations=[];return;}const {data,error}=await client.from('reservations').select('id,seat_id,reservation_date,time_slot,created_at,seats(seat_no,space_id)').eq('user_id',user.id).gte('reservation_date',today()).order('reservation_date');window.myReservations=data||[];if(error)notice(error.message,true);}
function render(){
 if(!client)return;
 const search=$('seat-search').value.toLowerCase(),space=$('space-filter').value;
 $('available-count').textContent=seats.filter(s=>status(s)==='free').length;
 $('spaces').innerHTML=Object.entries(spaces).filter(([id])=>space==='all'||space===id).map(([id,name])=>{
 const arr=seats.filter(s=>s.space_id===id&&String(s.seat_no).toLowerCase().includes(search));
 return `<article class="space"><div class="space-head"><div><h3>${name}</h3><small>${id.toUpperCase()} · ${seats.filter(s=>s.space_id===id).length} 個席位</small></div><span class="count">${arr.filter(s=>status(s)==='free').length} 可預約</span></div><div class="seat-grid">${arr.map(s=>{let st=status(s);return `<button class="seat ${st}" data-seat="${s.id}" ${st==='locked'?'disabled':''} title="${st==='free'?'點選預約':'目前不可預約'}">${esc(s.seat_no)}</button>`}).join('')}</div></article>`;
 }).join('')||'<div class="empty">找不到符合條件的座位。</div>';
 document.querySelectorAll('[data-seat]').forEach(b=>b.addEventListener('click',()=>openSeat(b.dataset.seat)));
 renderRecords();if(isAdmin)renderAdmin();
}
async function openSeat(id){const s=seats.find(x=>x.id===id);if(!s)return;const date=$('date-filter').value,slot=$('slot-filter').value;
 $('seat-detail').innerHTML=`<div class="eyebrow">SEAT RESERVATION</div><h2>${esc(spaces[s.space_id])} · ${esc(s.seat_no)}</h2><p class="muted small">${date}　${slots[slot]}</p><div class="detail-meta"><div><b>設備</b>電源插座 · 檯燈 · 人體工學椅</div><div><b>區域</b>${esc(spaces[s.space_id])}</div></div><p class="small muted">預約成功後此席位會同步顯示為已預約。每位使用者每個時段限預約一席。</p>${status(s)==='free'?'<button id="confirm-book" class="btn primary wide">確認預約</button>':'<p class="muted small">此座位目前不可預約。</p>'}<button id="report-seat" class="btn light wide">回報座位問題</button>`;
 $('seat-dialog').showModal();
 $('report-seat').onclick=async()=>{if(!user){$('seat-dialog').close();$('auth-dialog').showModal();return;}const description=prompt('請描述座位問題（至少 3 個字）：');if(!description)return;const {error}=await client.from('reports').insert({user_id:user.id,seat_id:id,description});if(error)notice('回報失敗：'+error.message,true);else{notice('已送出座位問題回報，館員可於管理頁面查看。');$('seat-dialog').close();}};
 if($('confirm-book'))$('confirm-book').onclick=async()=>{if(!user){$('seat-dialog').close();$('auth-dialog').showModal();return;}const b=$('confirm-book');b.disabled=true;b.textContent='預約中…';const {error}=await client.rpc('book_seat',{p_seat_id:id,p_date:date,p_slot:slot});b.disabled=false;b.textContent='確認預約';if(error){notice('預約失敗：'+error.message,true);return;} $('seat-dialog').close();notice('預約成功！座位狀態已更新。');await load();};
}
function renderRecords(){const list=window.myReservations||[];$('my-records').innerHTML=!user?'<div class="empty">請先登入以查看個人預約。</div>':!list.length?'<div class="empty">目前沒有未結束的預約。</div>':list.map(r=>`<div class="record"><div><b>${esc(r.seats?.seat_no||'座位')}</b>　${esc(spaces[r.seats?.space_id]||'')}<div class="muted small">${r.reservation_date} · ${slots[r.time_slot]||r.time_slot}</div></div><button class="btn danger" data-cancel="${r.id}">取消預約</button></div>`).join('');
 document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{if(!confirm('確定取消這筆預約？'))return;const {error}=await client.from('reservations').delete().eq('id',b.dataset.cancel);if(error)notice(error.message,true);else{notice('預約已取消。');await load();}});
}
function renderAdmin(){const open=reports.filter(r=>r.status!=='resolved');$('admin-content').innerHTML=`<h3>異常回報（${open.length} 件待處理）</h3><div class="admin-list">${open.map(r=>`<div class="admin-row"><div><b>${esc(r.seat_id)}</b><div class="muted small">${esc(r.description)} · ${new Date(r.created_at).toLocaleString()}</div></div><button class="btn primary" data-resolve="${r.id}">標記結案</button></div>`).join('')||'<div class="empty">目前沒有待處理回報。</div>'}</div><h3 style="margin-top:28px">座位維護管理</h3><div class="admin-list">${seats.map(s=>`<div class="admin-row"><span>${esc(spaces[s.space_id])} · ${esc(s.seat_no)} <small class="muted">${s.is_locked?'維護中':'開放'}</small></span><button class="btn light" data-lock="${s.id}" data-state="${s.is_locked}">${s.is_locked?'解除維護':'暫停開放'}</button></div>`).join('')}</div>`;
 document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{const {error}=await client.from('reports').update({status:'resolved'}).eq('id',b.dataset.resolve);if(error)notice(error.message,true);else await load();});
 document.querySelectorAll('[data-lock]').forEach(b=>b.onclick=async()=>{const {error}=await client.from('seats').update({is_locked:b.dataset.state!=='true'}).eq('id',b.dataset.lock);if(error)notice(error.message,true);else await load();});
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));['seats','records','admin'].forEach(v=>$(`${v}-view`).classList.toggle('hidden',v!==b.dataset.view));});
$('auth-open').onclick=()=>$('auth-dialog').showModal();
$('auth-switch').onclick=()=>{authMode=authMode==='login'?'signup':'login';$('auth-title').textContent=authMode==='login'?'登入帳號':'建立帳號';$('auth-submit').textContent=authMode==='login'?'登入':'註冊';$('auth-switch-text').textContent=authMode==='login'?'還沒有帳號？':'已經有帳號？';$('auth-switch').textContent=authMode==='login'?'建立帳號':'返回登入';};
$('auth-form').onsubmit=async e=>{e.preventDefault();const email=$('email').value,password=$('password').value;const res=authMode==='login'?await client.auth.signInWithPassword({email,password}):await client.auth.signUp({email,password});if(res.error)notice(res.error.message,true);else{$('auth-dialog').close();notice(authMode==='signup'?'註冊請求已送出；若啟用 Email Confirmation，請先收信驗證。':'登入成功。');await setUser(res.data.user);await load();}};
$('logout').onclick=async()=>{await client.auth.signOut();notice('已登出。');await setUser(null);await load();};
['date-filter','slot-filter'].forEach(id=>$(id).onchange=()=>load());['space-filter','seat-search'].forEach(id=>$(id).oninput=render);
setInterval(()=>{if(client)load();},20000);
init();
})();