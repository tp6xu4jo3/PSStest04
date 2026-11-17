import { createInitialSeats, createInitialReports, LIBRARY_SPACES, CURRENT_STUDENT } from './data.js';
import { computeSeatStatus, SEAT_STATUS_META, seatMatchesFilter, findAlternativeSeats, TIME_SLOTS, EQUIPMENT_LABELS, ISSUE_TYPE_LABELS } from './logic.js';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = x => structuredClone(x);
const today = () => {const fields=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${fields.year}-${fields.month}-${fields.day}`};
const hhmm = () => new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false});
const slotKeys = { [TIME_SLOTS[0]]:'morning',[TIME_SLOTS[1]]:'afternoon',[TIME_SLOTS[2]]:'evening' };
const keySlots = {morning:TIME_SLOTS[0],afternoon:TIME_SLOTS[1],evening:TIME_SLOTS[2]};
const spaceIds = Object.keys(LIBRARY_SPACES);
const equipmentOptions = [['powerOutlet','電源插座','⌁'],['dualMonitor','雙螢幕','▣'],['deskLamp','護眼檯燈','◉'],['windowView','靠窗採光','☼'],['ultraQuiet','極靜專注','◌'],['ergonomicChair','人體工學椅','◇']];
const DEMO_HISTORY = [
  {id:'HIS-108',date:'2026-11-15',timeSlot:'13:00 – 17:00',spaceName:'星空階梯沉浸閣',seatCode:'L-14',outcome:'正常完讀離席（3小時48分）'},
  {id:'HIS-102',date:'2026-11-12',timeSlot:'08:00 – 12:00',spaceName:'晨光木質靜讀室',seatCode:'P-04',outcome:'正常完讀離席（3小時20分）'}
];
const scenarios = [
  {id:'unbooked_occupation',title:'情境 01：系統無預約，現場卻有人／物品佔位',tag:'攝影機視覺自動偵測（模擬）',desc:'將 P-01 設為無預約但有人員與背包，2.5D座位轉紅色異常，開啟攝影機視野圖層。'},
  {id:'conflict_and_swap',title:'情境 02：預約者到場發現被佔用 → 回報與一鍵換位',tag:'透明回報與替代席位推薦',desc:'定位到 P-06，模擬預約座位被佔用，凍結並推薦最多3個替代席位，體驗一鍵換位。'},
  {id:'temp_away_preserve',title:'情境 03：學生暫離，背包留桌保留席位',tag:'暫離不自動取消預約',desc:'將 P-02 切換為人已離開、書包與書本仍在桌上；人物模型消失但預約持續保留。'},
  {id:'reset_baseline',title:'情境 04：重設為初始標準營運狀態',tag:'恢復基準資料',desc:'示範模式恢復原始48席與異常回報；正式連線模式退出本地情境預覽，不修改資料庫。'}
];
const state = {
  seats:createInitialSeats(), reports:createInitialReports(), view:'explore',spaceId:'pavilion', selected:'P-06',
  recommended:[],layer:'status',camera:'isometric',hovered:null,dockCollapsed:false,reportForm:false,simLab:false,
  issueType:'seat_occupied_by_other',recordTab:'bookings',adminTab:'anomalies',
  filter:{date:today(),timeSlot:TIME_SLOTS[1],onlyAvailable:false,searchQuery:'',equipment:{powerOutlet:false,dualMonitor:false,deskLamp:false,windowView:false,ergonomicChair:false,ultraQuiet:false}},
  live:false,preview:false,client:null,user:null,isAdmin:false,profile:null,myBookings:[],snapshot:[],loading:false,channel:null,loadCounter:0,
  modal:null,authMode:'login',engine:null,toastTimeout:null,activityLog:[],adminSpaceFilter:'all',adminStatusFilter:'all',adminSearch:''
};
const activeSeats = () => state.seats.filter(s=>s.spaceId===state.spaceId);
const seat = id => state.seats.find(s=>s.id===id);
const stats = id=>{const arr=state.seats.filter(s=>s.spaceId===id);return {total:arr.length,available:arr.filter(s=>computeSeatStatus(s)==='available').length,anomalies:arr.filter(s=>SEAT_STATUS_META[computeSeatStatus(s)].isAnomaly).length}};
const inDemo = () => !state.live || state.preview;
const currentUserLabel = () => state.live ? (state.user?.email?.split('@')[0] || '學生') : CURRENT_STUDENT.name;
function toast(msg,error=false){if(!error&&state.activityLog&&state.activityLog[0]?.msg!==msg)state.activityLog.unshift({msg,date:new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})});const el=$('toast');el.textContent=(error?'操作失敗：':'✓ ')+msg;el.classList.toggle('error',error);el.hidden=false;clearTimeout(state.toastTimeout);state.toastTimeout=setTimeout(()=>el.hidden=true,4400)}
function datesInRange(v){const d=Date.parse(v+'T00:00:00Z'),t=Date.parse(today()+'T00:00:00Z');return Number.isFinite(d)&&((d-t)/86400000)>=0&&((d-t)/86400000)<=13}
function serverStatusSeat(base){
  return {...base,reservation:null,vision:{...base.vision,hasPerson:false,hasBackpack:false,hasBooks:false,lastUpdated:'尚未偵測'},hasActiveAnomalyReport:false,isLockedByAdmin:false,lockReason:undefined};
}
function sessionSeatMerge(){
  const db=state.rawSeats||[];
  const data=new Map(db.map(s=>[s.id,s]));
  const bookings=new Map(state.snapshot.map(x=>[x.seat_id,x]));
  return createInitialSeats().map(base=>{
    const row=data.get(base.id)||{}, snap=bookings.get(base.id);
    const s=serverStatusSeat(base);
    s.isLockedByAdmin=!!row.is_locked;
    s.lockReason=row.lock_reason||undefined;
    s.hasActiveAnomalyReport=!!row.has_active_anomaly_report;
    if(snap){
      const own=!!snap.is_mine;
      const mine=own?state.myBookings.find(r=>r.seat_id===base.id&&r.reservation_date===state.filter.date&&r.time_slot===slotKeys[state.filter.timeSlot]):null;
      s.reservation={id:mine?.id||`PUBLIC-${base.id}`,studentName:own?currentUserLabel():'已預約（隱藏個資）',studentId:own?'本人':'—',isCurrentUser:own,date:state.filter.date,timeSlot:state.filter.timeSlot,...(snap.booking_state==='checked_in'?{checkedInAt:'已到席'}:{}),...(snap.booking_state==='temp_away'?{tempAwaySince:'暫離中'}:{})};
      s.vision.hasPerson=snap.booking_state==='checked_in';
      s.vision.hasBackpack=snap.booking_state==='checked_in'||snap.booking_state==='temp_away';
      s.vision.hasBooks=snap.booking_state==='checked_in'||snap.booking_state==='temp_away';
    }
    // 模擬鏡頭的管理員調整紀錄不會洩露其他人的預約者身份
    if(state.filter.date===today()){
      s.vision.hasPerson ||= !!row.has_person;
      s.vision.hasBackpack ||= !!row.has_backpack;
      s.vision.hasBooks ||= !!row.has_books;
    }
    s.vision.lastUpdated=row.updated_at?new Date(row.updated_at).toLocaleString('zh-TW'):'—';
    return s;
  });
}
async function init(){
  // 預設展示可離線操作核心UI；Three.js等原始視覺模組仍需首次從CDN載入。
  render();
  const config=window.APP_CONFIG||{};
  if(!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY){toast('目前使用完整情境展示模式。設定 config.js 後可連線 Supabase。');return}
  if(!window.supabase?.createClient){
    try {const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');window.supabase={createClient:sdk.createClient}}
    catch(err){toast('Supabase SDK載入失敗；目前留在本機展示模式。請確認網路連線。',true);return}
  }
  if(/service_role|sb_secret_/i.test(config.SUPABASE_PUBLISHABLE_KEY)){toast('前端不可使用Secret或service_role Key。',true);return}
  try{
    state.client=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY);
    state.live=true;
    const {data:{user},error}=await state.client.auth.getUser();
    if(error && !/Auth session missing/i.test(error.message))console.warn(error);
    state.user=user;
    state.client.auth.onAuthStateChange((_evt,session)=>{
      // 避免在auth callback同步呼叫其他auth API
      setTimeout(async()=>{const id=state.user?.id;state.user=session?.user||null;if(state.user?.id!==id){await loadProfile();await loadLive()}},0)
    });
    await loadProfile(); await loadLive();
    state.channel=state.client.channel('psst-public-seat-event-v1')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'seat_events'},()=>{if(!state.preview)loadLive(true)})
      .subscribe(status=>{if(status==='CHANNEL_ERROR')console.warn('Realtime unavailable; polling fallback remains enabled.')});
    // Realtime 無法訂閱或瀏覽器閒置時的備援
    setInterval(()=>{if(state.live&&!state.preview&&document.visibilityState==='visible')loadLive(true)},30000);
    toast('已連線 Supabase；座位預約採資料庫即時狀態。');
  }catch(e){state.live=false;state.client=null;toast(e.message||'Supabase初始化失敗，保留展示模式',true);render()}
}
async function loadProfile(){
  if(!state.user){state.isAdmin=false;state.profile=null;return}
  const {data,error}=await state.client.from('profiles').select('role,email').eq('id',state.user.id).maybeSingle();
  if(error){console.warn(error);state.isAdmin=false}else{state.profile=data;state.isAdmin=data?.role==='admin'}
}
async function loadLive(quiet=false){
  if(!state.client)return;
  const n=++state.loadCounter;
  const pDate=state.filter.date,pSlot=slotKeys[state.filter.timeSlot];
  const [seatsResponse,occupiedResponse,mineResponse,reportsResponse]=await Promise.all([
    state.client.from('seats').select('id,space_id,is_locked,lock_reason,has_active_anomaly_report,has_person,has_backpack,has_books,updated_at'),
    state.client.rpc('get_seat_snapshot',{p_date:pDate,p_slot:pSlot}),
    state.user?state.client.from('reservations').select('id,seat_id,reservation_date,time_slot,state,checked_in_at,away_since,created_at').gte('reservation_date',today()).order('reservation_date',{ascending:true}):Promise.resolve({data:[],error:null}),
    state.user?state.client.from('reports').select('id,user_id,seat_id,issue_type,description,stage,librarian_note,replacement_seat_code,created_at,resolved_at').order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
  ]);
  if(n!==state.loadCounter)return;
  const errors=[seatsResponse,occupiedResponse,mineResponse,reportsResponse].filter(x=>x.error).map(x=>x.error.message);
  if(errors.length){if(!quiet)toast(errors.join('；'),true);return}
  state.rawSeats=seatsResponse.data||[];
  state.snapshot=occupiedResponse.data||[];
  state.myBookings=mineResponse.data||[];
  state.reports=(reportsResponse.data||[]).map(r=>{
    const base=seat(r.seat_id)||createInitialSeats().find(s=>s.id===r.seat_id);
    const space=LIBRARY_SPACES[base?.spaceId]||LIBRARY_SPACES.pavilion;
    return {id:r.id,seatId:r.seat_id,seatCode:r.seat_id,spaceId:space.id,spaceName:space.name,reporterName:r.user_id===state.user?.id?currentUserLabel():'其他使用者',reporterId:'—',isCurrentUser:r.user_id===state.user?.id,issueType:r.issue_type,description:r.description,createdAt:new Date(r.created_at).toLocaleString('zh-TW'),stage:r.stage,librarianNote:r.librarian_note,replacementSeatCode:r.replacement_seat_code,timeline:[{stage:'submitted',label:'異常回報已受理',time:new Date(r.created_at).toLocaleString('zh-TW'),detail:r.description},...(r.stage!=='submitted'?[{stage:r.stage,label:r.stage==='resolved'?'館員已結案':'館員查驗中',time:r.resolved_at?new Date(r.resolved_at).toLocaleString('zh-TW'):'—',detail:r.librarian_note||''}]:[])]};
  });
  if(!state.preview){state.seats=sessionSeatMerge();if(state.selected&&!seat(state.selected))state.selected=null;render()}
}
async function rpc(name,args){
  const {data,error}=await state.client.rpc(name,args);
  if(error)throw new Error(error.message);
  return data;
}
async function cloudAction(fn,success){
  try {await fn();await loadLive();if(success)toast(success)} catch(e){toast(e.message||'操作失敗',true);console.error(e)}
}
function updateSeat(id,updater){state.seats=state.seats.map(s=>s.id===id?updater(s):s)}
function patchVision(id,patch){updateSeat(id,s=>({...s,vision:{...s.vision,...patch,lastUpdated:hhmm()}}))}
function selectSeat(id,focus=true){state.selected=id;state.reportForm=false;state.simLab=false;render();if(focus&&id)state.engine?.fly(id)}
function focusSeat(id,spaceId,layer){state.view='explore';state.spaceId=spaceId||seat(id)?.spaceId||'pavilion';state.selected=id;state.recommended=[];if(layer)state.layer=layer;render();state.engine?.fly(id)}
function selectSpace(id){state.spaceId=id;state.selected=null;state.recommended=[];render();state.engine?.preset(state.camera)}
function smartFind(){
  let pool=activeSeats().filter(s=>computeSeatStatus(s)==='available'&&seatMatchesFilter(s,{...state.filter,onlyAvailable:true}));
  if(!pool.length)pool=state.seats.filter(s=>computeSeatStatus(s)==='available'&&seatMatchesFilter(s,{...state.filter,onlyAvailable:true}));
  if(!pool.length)return toast('目前條件下沒有可預約座位；請放寬篩選。',true);
  // 與原版相同：先滿足篩選，再以鄰近及設備差異產出替代推薦
  const best=pool[0],alternatives=findAlternativeSeats(best,pool,state.filter.equipment,2);
  state.recommended=[best.id,...alternatives.map(r=>r.seat.id)];
  state.spaceId=best.spaceId;state.selected=best.id;
  render();state.engine?.fly(best.id);
  toast(`已找到符合條件的 ${best.code}（${LIBRARY_SPACES[best.spaceId].name}）`);
}
async function bookSeat(id){
  const s=seat(id);if(!s||computeSeatStatus(s)!=='available')return toast('這個座位目前不可預約',true);
  if(state.live&&!state.preview){if(!state.user)return openAuth();if(!datesInRange(state.filter.date))return toast('請選擇今日起14日內的日期',true);
    return cloudAction(()=>rpc('book_seat',{p_seat_id:id,p_date:state.filter.date,p_slot:slotKeys[state.filter.timeSlot]}),`已成功預約 ${id}（${state.filter.date}）`);
  }
  if(state.seats.some(x=>x.reservation?.isCurrentUser&&x.reservation?.date===state.filter.date&&x.reservation?.timeSlot===state.filter.timeSlot))return toast('同日期、同時段僅可預約一席',true);
  updateSeat(id,x=>({...x,reservation:{id:`DEMO-${Date.now()}`,studentName:currentUserLabel(),studentId:CURRENT_STUDENT.studentId,isCurrentUser:true,date:state.filter.date,timeSlot:state.filter.timeSlot}}));
  state.recommended=[];render();toast(`已${state.preview?'模擬':''}預約 ${id}`);
}
async function cancelSeat(id,booking){
  const s=seat(id);const target=booking||s?.reservation;
  if(!target)return toast('找不到預約',true);
  if(state.live&&!state.preview){if(!state.user)return openAuth();return cloudAction(()=>rpc('cancel_booking',{p_seat_id:id,p_date:target.date||target.reservation_date,p_slot:target.time_slot||slotKeys[target.timeSlot]}),`已取消 ${id} 預約`)}
  updateSeat(id,x=>({...x,reservation:null,vision:{...x.vision,hasPerson:false,hasBackpack:false,hasBooks:false}}));
  render();toast(`已退訂並釋出 ${id}`);
}
async function changeCheckIn(id,action,booking){
  if(state.live&&!state.preview){const target=booking||seat(id)?.reservation;if(!target)return;
    return cloudAction(()=>rpc('change_booking_state',{p_seat_id:id,p_date:target.date||target.reservation_date,p_slot:target.time_slot||slotKeys[target.timeSlot],p_action:action}),`已更新 ${id} 入座狀態`);
  }
  const now=hhmm();updateSeat(id,s=>({...s,reservation:s.reservation?{...s.reservation,...(action==='check_in'?{checkedInAt:now,tempAwaySince:undefined}:action==='away'?{tempAwaySince:now}:{tempAwaySince:undefined})}:null,vision:{...s.vision,hasPerson:action!=='away',hasBackpack:true,hasBooks:true,lastUpdated:now}}));
  render();toast(action==='away'?`${id} 已切換暫離保留`:`${id} 已更新模擬到席狀態`);
}
async function swapSeat(from,to,booking){
  const source=seat(from),target=seat(to);if(!target||computeSeatStatus(target)!=='available')return toast('替代座位不可預約',true);
  const b=booking||source?.reservation;if(!b)return toast('沒有可換位的預約',true);
  if(state.live&&!state.preview){return cloudAction(async()=>{await rpc('swap_booking',{p_from:from,p_to:to,p_date:b.date||b.reservation_date,p_slot:b.time_slot||slotKeys[b.timeSlot]});state.spaceId=target.spaceId;state.selected=to;state.recommended=[]},`已換位至 ${to}`)}
  updateSeat(from,s=>({...s,reservation:null}));updateSeat(to,s=>({...s,reservation:{...b,tempAwaySince:undefined}}));
  state.reports=state.reports.map(r=>r.seatId===from&&r.stage!=='resolved'?{...r,replacementSeatCode:to,timeline:[...r.timeline,{stage:r.stage,label:`已一鍵換位至 ${to}`,time:hhmm(),detail:'原衝突席維持凍結'}]}:r);
  state.recommended=[];focusSeat(to,target.spaceId);toast(`已一鍵換位至 ${to}`);
}
async function submitReport(id,issue,description){
  const target=seat(id),text=description?.trim()||ISSUE_TYPE_LABELS[issue];
  if(!target)return;
  if(state.live&&!state.preview){if(!state.user)return openAuth();return cloudAction(()=>rpc('submit_report',{p_seat_id:id,p_issue_type:issue,p_description:text}),`異常回報已送出，${id} 暫停新預約`)}
  const report={id:`DEMO-RPT-${Date.now()}`,seatId:id,seatCode:id,spaceId:target.spaceId,spaceName:LIBRARY_SPACES[target.spaceId].name,reporterName:currentUserLabel(),reporterId:CURRENT_STUDENT.studentId,isCurrentUser:true,issueType:issue,description:text,createdAt:hhmm(),stage:'submitted',timeline:[{stage:'submitted',label:'異常回報已受理・席位暫停新預約',time:hhmm(),detail:`${id} 已凍結並推薦替代席位。`}]};
  state.reports=[report,...state.reports];state.recommended=findAlternativeSeats(target,state.seats,state.filter.equipment,3).map(r=>r.seat.id);
  updateSeat(id,s=>({...s,hasActiveAnomalyReport:true}));state.reportForm=false;render();toast(`已回報 ${id} 並推薦替代席位`);
}
async function updateVision(id,patch){
  const s=seat(id);if(!s)return;
  if(state.live&&!state.preview){if(!state.isAdmin)return toast('僅管理員可更改正式資料',true);
    const v={...s.vision,...patch};return cloudAction(()=>rpc('admin_set_vision',{p_seat_id:id,p_person:v.hasPerson,p_backpack:v.hasBackpack,p_books:v.hasBooks}),`已更新 ${id} 模擬偵測狀態`)}
  patchVision(id,patch);render();toast(`${id} 模擬偵測資料已更新`);
}
async function toggleLock(id){
  if(state.live&&!state.preview){if(!state.isAdmin)return toast('需要館員管理員權限',true);return cloudAction(()=>rpc('admin_toggle_lock',{p_seat_id:id}),`${id} 已更新維護狀態`)}
  updateSeat(id,s=>({...s,isLockedByAdmin:!s.isLockedByAdmin,lockReason:!s.isLockedByAdmin?'館員手動暫停開放檢修':undefined}));render();toast(`${id} 已更新維護狀態`);
}
async function advanceReport(reportId,action){
  const r=state.reports.find(x=>x.id===reportId);if(!r)return;
  if(state.live&&!state.preview){if(!state.isAdmin)return toast('需要館員權限',true);return cloudAction(()=>rpc('admin_advance_report',{p_report_id:reportId,p_action:action}),`已更新 ${r.seatCode} 回報狀態`)}
  if(action==='inspect'){r.stage='inspecting';r.timeline.push({stage:'inspecting',label:'館員現場查驗中',time:hhmm(),detail:`已前往 ${r.seatCode} 核對現場狀態`})}
  else {r.stage='resolved';r.librarianNote=action==='clear_and_unlock'?'館員清離占位並解除鎖定':'館員確認預約本人使用';r.timeline.push({stage:'resolved',label:'館員處理完畢',time:hhmm(),detail:r.librarianNote});updateSeat(r.seatId,s=>({...s,hasActiveAnomalyReport:false,vision:action==='clear_and_unlock'?{...s.vision,hasPerson:false,hasBackpack:false,hasBooks:false}:s.vision,reservation:action==='clear_and_unlock'?null:s.reservation}))}
  render();toast(`${r.seatCode} 已更新處理進度`);
}
async function clearSeat(id){
  if(state.live&&!state.preview){if(!state.isAdmin)return toast('僅管理員有權處理',true);return cloudAction(()=>rpc('admin_clear_anomaly',{p_seat_id:id}),`已解除 ${id} 的占位異常`)}
  updateSeat(id,s=>({...s,reservation:null,hasActiveAnomalyReport:false,vision:{...s.vision,hasPerson:false,hasBackpack:false,hasBooks:false}}));
  state.reports=state.reports.map(r=>r.seatId===id&&r.stage!=='resolved'?{...r,stage:'resolved',librarianNote:'館員清離並解除鎖定',timeline:[...r.timeline,{stage:'resolved',label:'館員處理完畢',time:hhmm(),detail:'現場已清空'}]}:r);render();toast(`已解除 ${id} 異常`);
}
function triggerScenario(id){
  closeModal();
  if(state.live&&!state.preview&&id!=='reset_baseline'){
    state.preview=true;state.seats=clone(state.seats);state.reports=clone(state.reports);
  }
  if(id==='reset_baseline'){
    if(state.live){state.preview=false;state.recommended=[];state.layer='status';state.spaceId='pavilion';state.selected='P-06';state.view='explore';loadLive();toast('已退出本地預覽，恢復 Supabase 真實資料');return}
    state.seats=createInitialSeats();state.reports=createInitialReports();state.recommended=[];
    state.layer='status';state.spaceId='pavilion';state.selected='P-06';state.view='explore';render();state.engine?.fly('P-06');toast('已還原原版模擬初始狀態');return;
  }
  if(id==='unbooked_occupation'){
    updateSeat('P-01',s=>({...s,reservation:null,hasActiveAnomalyReport:false,vision:{...s.vision,hasPerson:true,hasBackpack:true,hasBooks:false,lastUpdated:hhmm()}}));
    state.spaceId='pavilion';state.selected='P-01';state.layer='vision';state.view='explore';
  }else if(id==='temp_away_preserve'){
    updateSeat('P-02',s=>({...s,reservation:s.reservation||{id:'SCENE-P02',studentName:CURRENT_STUDENT.name,studentId:CURRENT_STUDENT.studentId,isCurrentUser:true,date:state.filter.date,timeSlot:state.filter.timeSlot},vision:{...s.vision,hasPerson:false,hasBackpack:true,hasBooks:true,lastUpdated:hhmm()}}));
    state.spaceId='pavilion';state.selected='P-02';state.layer='status';state.view='explore';
  }else if(id==='conflict_and_swap'){
    const target=seat('P-06');
    if(!target.reservation)updateSeat('P-06',s=>({...s,reservation:{id:'SCENE-P06',studentName:CURRENT_STUDENT.name,studentId:CURRENT_STUDENT.studentId,isCurrentUser:true,date:state.filter.date,timeSlot:state.filter.timeSlot}}));
    state.recommended=findAlternativeSeats(seat('P-06'),state.seats,state.filter.equipment,3).map(x=>x.seat.id);
    updateSeat('P-06',s=>({...s,hasActiveAnomalyReport:true,vision:{...s.vision,hasPerson:true,hasBackpack:true,hasBooks:false,lastUpdated:hhmm()}}));
    state.spaceId='pavilion';state.selected='P-06';state.layer='status';state.view='explore';
  }
  render();state.engine?.fly(state.selected);toast(`已啟動 ${id==='unbooked_occupation'?'無預約占用':id==='temp_away_preserve'?'暫離保留':'衝突與一鍵換位'}${state.preview?'（僅本機預覽，不影響雲端）':''}`);
}

function render(){
  $('mode-indicator').textContent=state.preview?'雲端連線 · 本地預覽':state.live?'Supabase 已連線':'本機模擬';
  $('mode-indicator').classList.toggle('live',state.live&&!state.preview);
  $('auth-button').textContent=state.live?(state.user?`登出 · ${state.user.email.split('@')[0]}`:'登入／註冊'):'設定雲端';
  document.querySelectorAll('[data-action="view"][data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  const myCount=state.live&&!state.preview?state.myBookings.length:state.seats.filter(x=>x.reservation?.isCurrentUser).length;
  const reportCount=state.reports.filter(r=>r.stage!=='resolved').length+state.seats.filter(s=>computeSeatStatus(s)==='anomaly_unbooked_occupied').length;
  $('booking-badge').textContent=myCount?`（${myCount}）`:'';
  $('report-badge').textContent=reportCount?`（${reportCount}）`:'';
  for(const mode of ['explore','records','librarian'])$(`${mode}-view`).hidden=state.view!==mode;
  if(state.view==='explore'){renderSwitcher();renderLayers();renderDock();renderPins();renderDrawer();updateEngine()}
  else if(state.view==='records')renderRecords();
  else renderLibrarian();
}
function showSceneFallback(error){
  if(error)console.warn('WebGL fallback:',error);$('seat-pins').hidden=true;const host=$('scene-fallback');host.hidden=false;
  refreshFallback();
}
function refreshFallback(){
  const host=$('scene-fallback');
  host.innerHTML=`<h3>平面席位檢視</h3><p class="muted small">此瀏覽器環境沒有可用的WebGL，已切換為可點選的2D席位介面。</p><div class="mini-seat-grid">${activeSeats().map(s=>`<button class="mini-seat ${computeSeatStatus(s)}" data-action="seat" data-id="${s.id}">${s.code}</button>`).join('')}</div>`;
}
function renderSwitcher(){
  $('space-switcher').innerHTML=spaceIds.map(id=>{
    const sp=LIBRARY_SPACES[id],v=stats(id);
    return `<button type="button" data-action="space" data-id="${id}" class="${state.spaceId===id?'active':''}">${esc(sp.name)} <span class="counts">${v.available}/${v.total}</span>${v.anomalies?` <span class="warn">· ${v.anomalies}異常</span>`:''}</button>`
  }).join('');
  const sp=LIBRARY_SPACES[state.spaceId];
  $('space-meta').innerHTML=`<b>${esc(sp.englishSubtitle)}</b> · ${esc(sp.floorAreaLabel)} · ${sp.ambientDb} dB · ${esc(sp.lightingProfile)}`;
}
function renderLayers(){
  $('layer-controls').innerHTML=[['status','▤','狀態圖層'],['environment','◌','採光聲學'],['vision','◎','攝影機視野']].map(([id,ico,label])=>`<button data-action="layer" data-layer="${id}" class="${state.layer===id?'active':''}">${ico} ${label}</button>`).join('');
  $('camera-controls').innerHTML=[['isometric','↻','等角微縮'],['cutaway','▱','剖面透視'],['top','▣','俯視平面']].map(([id,ico,label])=>`<button data-action="camera" data-camera="${id}" class="${state.camera===id?'active':''}">${ico} ${label}</button>`).join('');
}
function renderPins(){
  $('seat-pins').innerHTML=activeSeats().map(s=>{
    const status=computeSeatStatus(s),meta=SEAT_STATUS_META[status];
    const selected=s.id===state.selected,recommended=state.recommended.includes(s.id),matches=seatMatchesFilter(s,state.filter);
    const extra=state.layer==='environment'?`<span class="pin-extra">${s.specs.noiseDb}dB</span>`:state.layer==='vision'?`<span class="pin-extra">${s.vision.hasPerson?'人':'—'}/${s.vision.hasBackpack||s.vision.hasBooks?'物':'—'}</span>`:'';
    const icon=status==='available'?'✓':status==='occupied_checked_in'?'●':status==='anomaly_unbooked_occupied'||status==='anomaly_reported'?'!':status==='maintenance'?'×':'◷';
    return `<button type="button" data-action="seat" data-id="${s.id}" data-pin="${s.id}" class="seat-pin ${selected?'selected':recommended?'recommended':''}" aria-label="座位 ${s.code} ${meta.label}" style="opacity:${matches||selected||recommended?1:.33}"><span class="pin-symbol" style="color:${meta.colorHex};background:${meta.colorHex}18">${icon}</span><span class="num">${s.code}</span>${extra}${recommended&&!selected?'<span class="pin-extra">推薦</span>':''}</button>`;
  }).join('');
  if(state.engine&&!state.engine.failed)state.engine.updatePins();
  if(state.engine?.failed)showSceneFallback();
  else if(!$('scene-fallback').hidden)refreshFallback();
}
function renderDock(){
  const f=state.filter,matching=activeSeats().filter(s=>seatMatchesFilter(s,f)).length;
  const isFiltering=!!(f.searchQuery||f.onlyAvailable||Object.values(f.equipment).some(Boolean));
  const body=state.dockCollapsed?'':`<div class="dock-body">
    <div class="dock-row"><div class="dock-options"><label>▦ <input id="dock-date" type="date" aria-label="預約日期" value="${f.date}" ${state.live?`min="${today()}"`:''}></label>
      <label><select id="dock-slot" aria-label="預約時段">${TIME_SLOTS.map(s=>`<option value="${esc(s)}" ${s===f.timeSlot?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
      <span class="dock-middle num">符合條件 ${matching}/${activeSeats().length} 席</span></div>
    <div class="dock-options">${isFiltering?'<button class="btn ghost xs" data-action="reset-filters">↻ 清除篩選</button>':''}<button class="btn blue sm" data-action="smart-find">⌖ 動態智慧找位</button></div></div>
    <div class="dock-filters"><div class="dock-options">${equipmentOptions.map(([k,label,icon])=>`<button class="chip ${f.equipment[k]?'active':''}" data-action="toggle-equip" data-key="${k}" aria-pressed="${!!f.equipment[k]}">${icon} ${label}</button>`).join('')}</div>
    <div class="dock-options"><label class="only-toggle"><input id="only-available" type="checkbox" ${f.onlyAvailable?'checked':''}/> 僅看空位</label><input id="seat-search" class="search-input" placeholder="搜尋座位／區域" aria-label="搜尋座位" value="${esc(f.searchQuery)}" /></div></div>
    </div>`;
  $('control-dock').innerHTML=`<button class="dock-handle" data-action="dock-collapse">${state.dockCollapsed?'⌃ 展開選位與篩選列':'⌄ 收合控制列檢視全景'}</button>${body}`;
}
function reportSummary(r){return `${esc(ISSUE_TYPE_LABELS[r.issueType]||r.issueType)} · ${esc(r.description)}`}
function recommendationCard(rec,currentId){
  const s=rec.seat,own=seat(currentId)?.reservation?.isCurrentUser;
  return `<div class="recommendation"><div><b class="num">${s.code}</b> <span class="score">${rec.score} 分</span><small>${esc(LIBRARY_SPACES[s.spaceId].name)}<br>${rec.reasons.map(esc).join(' · ')}</small></div>
  <div class="record-actions"><button class="btn xs" data-action="focus" data-id="${s.id}" data-space="${s.spaceId}">查看</button>${own?`<button class="btn green xs" data-action="swap" data-from="${currentId}" data-to="${s.id}">換位</button>`:''}</div></div>`;
}
function renderDrawer(){
  const host=$('seat-drawer');const s=seat(state.selected);
  if(!s){host.hidden=true;host.innerHTML='';return}
  host.hidden=false;
  const st=computeSeatStatus(s),meta=SEAT_STATUS_META[st],my=!!s.reservation?.isCurrentUser;
  const sp=LIBRARY_SPACES[s.spaceId],report=state.reports.find(r=>r.seatId===s.id&&r.stage!=='resolved');
  const recs=findAlternativeSeats(s,state.seats,state.filter.equipment,3);
  const w3=state.recommended.filter(id=>id!==s.id);
  const highlightedRecs=w3.length?w3.map(id=>recs.find(r=>r.seat.id===id)||findAlternativeSeats(s,state.seats,state.filter.equipment,48).find(r=>r.seat.id===id)).filter(Boolean):recs;
  const specs=equipmentOptions.map(([key,label])=>`<div class="spec-item"><span class="${s.specs[key]?'tick':'cross'}">${s.specs[key]?'✓':'—'}</span>${label}</div>`).join('');
  const reservInfo=s.reservation?`<div class="inside-card"><div class="small strong">${my?'您的預約資訊':'已有預約'}</div><p class="subtitle" style="margin:6px 0 0">${esc(s.reservation.studentName)} ${my?`· ${esc(s.reservation.studentId)}`:''}<br>${esc(s.reservation.date)} · ${esc(s.reservation.timeSlot)}</p></div>`:'';
  let act='';
  if(st==='available')act=`<button class="btn green wide" data-action="book" data-id="${s.id}">✓ 確認預約 ${s.code}（${esc(state.filter.date)}）</button>`;
  if(my&&!s.hasActiveAnomalyReport){
    act=`<div class="inside-card"><b class="small">這是您目前的預約席位</b><div class="drawer-actions" style="margin-top:10px">
    ${st==='reserved_waiting'?`<button class="btn green sm" data-action="check-in" data-id="${s.id}">現場入座（報到）</button>`:''}
    ${st==='occupied_checked_in'?`<button class="btn amber sm" data-action="away" data-id="${s.id}">暫離保留座位</button>`:''}
    ${st==='temp_away'?`<button class="btn green sm" data-action="return" data-id="${s.id}">返回座位</button>`:''}
    <button class="btn ghost sm ${st==='reserved_waiting'?'':'wide'}" data-action="cancel" data-id="${s.id}">退訂釋出座位</button></div></div>`;
  }
  const reportForm=state.reportForm?`<form id="report-form" class="inside-card blue"><label class="form-label" for="report-type">問題類型</label>
    <select id="report-type" class="field">${Object.entries(ISSUE_TYPE_LABELS).map(([id,label])=>`<option value="${id}" ${id===state.issueType?'selected':''}>${esc(label)}</option>`).join('')}</select>
    <label class="form-label" for="report-description">補充說明</label><textarea id="report-description" class="field" maxlength="1000" placeholder="描述現場狀況（選填；預設使用問題類型）"></textarea>
    <button class="btn blue wide sm" type="submit">送出異常回報</button></form>`:'';
  const liveUserAdmin=state.live&&!state.preview?state.isAdmin:true;
  const canVision=liveUserAdmin||inDemo();
  const simLab=state.simLab?`<div class="inside-card blue"><div class="small strong">攝影機模擬偵測（非真實AI）</div><p class="tiny muted">切換後立即更新3D人物／背包／書本及座位狀態。${state.preview?'本地預覽不寫入資料庫。':state.live?'僅管理員可修改。':'僅展示資料。'}</p>
    <div class="switches">${[['hasPerson','人物'],['hasBackpack','背包'],['hasBooks','書本']].map(([key,label])=>`<label><input type="checkbox" data-vision="${key}" data-id="${s.id}" ${s.vision[key]?'checked':''} ${canVision?'':'disabled'}>${label}</label>`).join('')}</div></div>`:'';
  const anomaly=st==='anomaly_unbooked_occupied'||st==='anomaly_reported';
  host.innerHTML=`<div class="drawer-head"><div><div class="small muted">${esc(sp.name)} · ${esc(s.specs.zoneLabel)}</div><h2 class="num">${esc(s.code)} <span class="pill ${st}">${esc(meta.shortLabel)}</span></h2></div><button class="btn icon-btn" data-action="close-drawer" aria-label="關閉座位詳情">×</button></div>
  <div class="drawer-scroll">
    ${state.preview?'<div class="inside-card alert tiny">這是本地情境預覽，所有操作不會寫入 Supabase。按「情境模擬 → 重設」返回正式資料。</div>':''}
    <p class="subtitle">${esc(meta.description)}</p>
    <div class="drawer-section"><div class="stat-grid">
      <div class="mini-stat"><span class="tiny muted">環境聲量</span><b class="num">${s.specs.noiseDb}<small class="tiny"> dB</small></b></div>
      <div class="mini-stat"><span class="tiny muted">工作照度</span><b class="num">${s.specs.illuminanceLux}<small class="tiny"> lx</small></b></div>
      <div class="mini-stat"><span class="tiny muted">桌面寬度</span><b class="num">${s.specs.deskWidthCm}<small class="tiny"> cm</small></b></div>
    </div></div>
    <div class="drawer-section"><h3>座位設備與環境</h3><div class="spec-list">${specs}</div><p class="tiny muted">插座規格：${esc(s.specs.outletType)}</p></div>
    <div class="divider"></div>
    <div class="drawer-section"><h3>座位狀態與操作</h3>${reservInfo}${act}
      ${anomaly?`<div class="inside-card alert"><b class="small">⚠ 此座位已觸發異常保護</b><p class="tiny muted">系統暫時停止新預約。${report?'已收到使用者回報，館員正在處理。':'偵測到無預約人員或物品。'}</p>${liveUserAdmin?`<button class="btn red xs" data-action="clear-anomaly" data-id="${s.id}">館員清除占位並解鎖</button>`:''}</div>`:''}
      ${!s.hasActiveAnomalyReport&&st!=='maintenance'?`<button class="btn wide sm" data-action="toggle-report">△ 回報此席位異常（占位／設備／噪音）</button>`:''}
      ${reportForm}
    </div>
    <div class="drawer-section"><h3>攝影機模擬辨識結果</h3><div class="inside-card"><div class="small">◎ ${esc(s.vision.cameraId||'CAM-SIM')} <span class="muted tiny">更新：${esc(s.vision.lastUpdated||'—')}</span></div><p class="tiny muted" style="margin:8px 0">人物：${s.vision.hasPerson?'有':'無'}　背包：${s.vision.hasBackpack?'有':'無'}　書本：${s.vision.hasBooks?'有':'無'}</p><button class="btn xs" data-action="toggle-simlab">${state.simLab?'收合模擬設定':'開啟物件／人物偵測模擬'}</button></div>${simLab}</div>
    <div class="drawer-section"><h3>智慧替代席位推薦</h3><p class="tiny muted">依同區域、聲量、空間距離及設備需求計分，最多顯示3席。</p>${highlightedRecs.length?highlightedRecs.slice(0,3).map(r=>recommendationCard(r,s.id)).join(''):'<div class="empty">目前沒有符合狀態的替代座位。</div>'}</div>
    ${liveUserAdmin?`<div class="drawer-section"><div class="divider"></div><h3>館員座位管制</h3><button class="btn wide sm" data-action="lock" data-id="${s.id}">${s.isLockedByAdmin?'解除維護鎖定':'館員暫停開放檢修'}</button></div>`:''}
    ${report?`<div class="drawer-section"><h3>異常處理進度</h3>${report.timeline.map(t=>`<div class="timeline-item"><b>${esc(t.label)}</b><small>${esc(t.time)} · ${esc(t.detail)}</small></div>`).join('')}</div>`:''}
  </div>`;
}
function resolveMyBooking(s){
  if(!s?.reservation?.isCurrentUser)return false;
  return true;
}
function recordsBookings(){
  const mine=state.live&&!state.preview?state.myBookings.map(r=>{
    const s=seat(r.seat_id)||createInitialSeats().find(x=>x.id===r.seat_id);
    return {seatId:r.seat_id,date:r.reservation_date,slot:keySlots[r.time_slot]||r.time_slot,spaceId:s?.spaceId||'pavilion',state:r.state,booking:r}
  }):state.seats.filter(s=>s.reservation?.isCurrentUser).map(s=>({seatId:s.id,date:s.reservation.date,slot:s.reservation.timeSlot,spaceId:s.spaceId,state:computeSeatStatus(s),booking:s.reservation}));
  if(!mine.length)return '<div class="empty">目前沒有有效預約。您可以到「空間探索」挑選可預約席位。</div>';
  return mine.map(item=>{
    const st=item.state,display=st==='waiting'?'已預約待入座':st==='checked_in'?'使用中':st==='temp_away'?'暫離保留中':SEAT_STATUS_META[st]?.label||st;
    return `<div class="record-row"><div><b class="num">${item.seatId}</b> <span class="pill ${st==='waiting'?'reserved_waiting':st==='checked_in'?'occupied_checked_in':st}">${esc(display)}</span><p>${esc(LIBRARY_SPACES[item.spaceId].name)}</p></div>
       <div class="record-time"><span class="small">${esc(item.date)} · ${esc(item.slot)}</span><p>座位使用狀態可於場景同步確認。</p></div>
       <div class="record-actions"><button class="btn xs" data-action="focus" data-id="${item.seatId}" data-space="${item.spaceId}">3D定位</button>
       ${['waiting','reserved_waiting'].includes(st)?`<button class="btn green xs" data-action="check-in" data-id="${item.seatId}" data-date="${item.date}" data-slot="${slotKeys[item.slot]}">入座報到</button>`:''}
       ${['checked_in','occupied_checked_in'].includes(st)?`<button class="btn amber xs" data-action="away" data-id="${item.seatId}" data-date="${item.date}" data-slot="${slotKeys[item.slot]}">暫離</button>`:''}
       ${st==='temp_away'?`<button class="btn green xs" data-action="return" data-id="${item.seatId}" data-date="${item.date}" data-slot="${slotKeys[item.slot]}">返回</button>`:''}
       <button class="btn red xs" data-action="cancel" data-id="${item.seatId}" data-date="${item.date}" data-slot="${slotKeys[item.slot]}">取消</button></div></div>`;
  }).join('');
}
function renderRecords(){
  const mine=state.live&&!state.preview?state.myBookings.length:state.seats.filter(s=>s.reservation?.isCurrentUser).length;
  const mineReports=state.reports.filter(r=>r.isCurrentUser),open=mineReports.filter(r=>r.stage!=='resolved').length;
  $('records-view').innerHTML=`<div class="page-head"><div><div class="kicker">STUDENT SPACE / RESERVATION TRACKING</div><h1>我的預約與追蹤</h1><p>查看已預約座位、到席／暫離紀錄、異常回報與處理流程。</p></div><button class="btn dark sm" data-action="view" data-view="explore">⌖ 返回空間探索</button></div>
    ${state.live&&!state.user?'<div class="panel"><p class="muted">您可以瀏覽座位，但要查看與操作個人預約必須登入帳號。</p><button class="btn blue sm" data-action="open-auth">登入／註冊</button></div>':''}
    <div class="page-stats"><div class="stat-card"><div class="label">有效預約</div><strong class="num">${mine}</strong></div><div class="stat-card"><div class="label">我的異常回報</div><strong class="num">${mineReports.length}</strong></div><div class="stat-card"><div class="label">尚未結案</div><strong class="num">${open}</strong></div><div class="stat-card"><div class="label">開放空位</div><strong class="num">${state.seats.filter(s=>computeSeatStatus(s)==='available').length}</strong></div></div>
    <div class="page-tabs"><button data-action="record-tab" data-id="bookings" class="${state.recordTab==='bookings'?'active':''}">我的座位預約</button><button data-action="record-tab" data-id="reports" class="${state.recordTab==='reports'?'active':''}">異常追蹤 (${mineReports.length})</button><button data-action="record-tab" data-id="history" class="${state.recordTab==='history'?'active':''}">系統操作紀錄</button></div>
    <div class="panel">${state.recordTab==='bookings'?`<div class="panel-head"><h2>預約中的席位</h2><span class="small muted">同日期、同時段僅能預約一席</span></div>${recordsBookings()}`:
      state.recordTab==='reports'?`<div class="panel-head"><h2>異常回報進度</h2></div>${mineReports.length?mineReports.map(r=>`<div class="record-row"><div><b class="num">${r.seatCode}</b> <span class="pill ${r.stage==='resolved'?'available':'anomaly_reported'}">${r.stage==='submitted'?'已受理':r.stage==='inspecting'?'查驗中':'已結案'}</span><p>${esc(ISSUE_TYPE_LABELS[r.issueType])}</p></div><div class="record-time"><div class="small">${esc(r.description)}</div><div class="timeline">${r.timeline.map(t=>`<div class="timeline-item"><b>${esc(t.label)}</b><small>${esc(t.time)} · ${esc(t.detail)}</small></div>`).join('')}</div></div><div class="record-actions"><button class="btn xs" data-action="focus" data-id="${r.seatId}" data-space="${r.spaceId}">定位</button></div></div>`).join(''):'<div class="empty">目前沒有異常回報紀錄。</div>'}`:
      `<div class="panel-head"><h2>歷史預約／本次操作紀錄</h2></div>${!state.live?DEMO_HISTORY.map(h=>`<div class="record-row"><div><b class="num">${h.seatCode}</b><p>${esc(h.spaceName)}</p></div><div class="record-time"><span class="small">${h.date} · ${h.timeSlot}</span><p>${esc(h.outcome)} · 原版示範紀錄</p></div></div>`).join(''):''}${state.activityLog.map(h=>`<div class="record-row"><div><b>操作紀錄</b><p>${esc(h.date)}</p></div><div class="record-time">${esc(h.msg)}</div></div>`).join('')}${state.live?'<p class="small muted">本次操作紀錄僅保存在目前分頁；正式稽核需額外設置資料庫紀錄表。</p>':''}`}</div>`;
}
function renderLibrarian(){
  if(state.live&&!state.preview&&!state.isAdmin){
    $('librarian-view').innerHTML=`<div class="page-head"><div><div class="kicker">LIBRARIAN CONSOLE</div><h1>館員監控台</h1></div></div><div class="panel"><h2>需要管理員權限</h2><p class="muted">此頁僅供館員管理員使用。請先登入，並在Supabase SQL Editor中由專案擁有者設定角色（不可在前端自行提權）。</p><button class="btn dark sm" data-action="open-auth">登入或切換帳號</button></div>`;
    return;
  }
  const a=state.seats,open=state.reports.filter(r=>r.stage!=='resolved');
  const unbooked=a.filter(s=>computeSeatStatus(s)==='anomaly_unbooked_occupied');
  const anomalies=[...new Set([...open.map(r=>r.seatId),...unbooked.map(s=>s.id)])];
  const counts={free:a.filter(s=>computeSeatStatus(s)==='available').length,occupied:a.filter(s=>computeSeatStatus(s)==='occupied_checked_in').length,away:a.filter(s=>computeSeatStatus(s)==='temp_away').length,anomaly:anomalies.length};
  const tabs=`<div class="page-tabs"><button data-action="admin-tab" data-id="anomalies" class="${state.adminTab==='anomalies'?'active':''}">異常事件與回報 (${anomalies.length})</button><button data-action="admin-tab" data-id="seats" class="${state.adminTab==='seats'?'active':''}">全部座位控管</button><button data-action="admin-tab" data-id="cameras" class="${state.adminTab==='cameras'?'active':''}">攝影機模擬面板</button></div>`;
  let content='';
  if(state.adminTab==='anomalies'){
    content=`<div class="admin-grid"><section class="panel"><div class="panel-head"><h2>待處理回報</h2><span class="pill anomaly_reported">${open.length} 件</span></div>
      ${open.length?open.map(r=>`<article class="admin-item"><div><b class="num">${r.seatCode}</b> <span class="pill ${r.stage==='inspecting'?'temp_away':'anomaly_reported'}">${r.stage==='inspecting'?'館員查驗中':'已受理'}</span><div class="description">${reportSummary(r)}<br>${esc(r.createdAt)} · ${esc(r.reporterName)}</div></div>
      <div class="record-actions"><button class="btn xs" data-action="focus" data-id="${r.seatId}" data-space="${r.spaceId}">定位</button>${r.stage==='submitted'?`<button class="btn xs" data-action="report-advance" data-id="${r.id}" data-mode="inspect">開始查驗</button>`:''}
      <button class="btn green xs" data-action="report-advance" data-id="${r.id}" data-mode="confirm_valid_occupant">核對解鎖</button><button class="btn red xs" data-action="report-advance" data-id="${r.id}" data-mode="clear_and_unlock">清離結案</button></div></article>`).join(''):'<div class="empty">目前沒有待處理異常回報。</div>'}</section>
      <section class="panel"><div class="panel-head"><h2>無預約卻占用</h2></div>${unbooked.length?unbooked.map(s=>`<div class="admin-item"><div><b class="num">${s.code}</b><div class="description">偵測到${s.vision.hasPerson?'人員 ':''}${s.vision.hasBackpack?'背包 ':''}${s.vision.hasBooks?'書籍 ':''}</div></div><div class="record-actions"><button class="btn xs" data-action="focus" data-id="${s.id}" data-space="${s.spaceId}" data-layer="vision">定位</button><button class="btn red xs" data-action="clear-anomaly" data-id="${s.id}">清除異常</button></div></div>`).join(''):'<div class="empty">未偵測到無預約占用。</div>'}</section></div>`;
  }else if(state.adminTab==='seats'){
    const options=spaceIds.map(id=>`<option value="${id}" ${id===state.adminSpaceFilter?'selected':''}>${esc(LIBRARY_SPACES[id].name)}</option>`).join('');
    const filters=`<section class="panel"><div class="dock-options"><label class="form-label" for="admin-space" style="margin:0">空間</label><select id="admin-space" class="field" style="width:200px"><option value="all">全部空間</option>${options}</select>
      <label class="form-label" for="admin-status" style="margin:0">狀態</label><select id="admin-status" class="field" style="width:160px"><option value="all">全部狀態</option><option value="available" ${state.adminStatusFilter==='available'?'selected':''}>可預約</option><option value="anomaly" ${state.adminStatusFilter==='anomaly'?'selected':''}>異常</option><option value="away" ${state.adminStatusFilter==='away'?'selected':''}>暫離保留</option><option value="maintenance" ${state.adminStatusFilter==='maintenance'?'selected':''}>維護中</option></select>
      <input id="admin-search" class="field" style="width:170px" placeholder="搜尋座位／攝影機" value="${esc(state.adminSearch)}"/></div></section>`;
    const filtered=a.filter(s=>{
      const st=computeSeatStatus(s);
      if(state.adminSpaceFilter!=='all'&&s.spaceId!==state.adminSpaceFilter)return false;
      if(state.adminStatusFilter==='anomaly'&&!SEAT_STATUS_META[st].isAnomaly)return false;
      if(state.adminStatusFilter==='away'&&st!=='temp_away')return false;
      if(['available','maintenance'].includes(state.adminStatusFilter)&&st!==state.adminStatusFilter)return false;
      if(state.adminSearch&&!(`${s.code} ${s.vision.cameraId}`.toLowerCase().includes(state.adminSearch.toLowerCase())))return false;
      return true;
    });
    content=filters+spaceIds.filter(id=>filtered.some(s=>s.spaceId===id)).map(id=>`<section class="panel"><div class="panel-head"><h2>${LIBRARY_SPACES[id].name}</h2><span class="small muted">符合條件 ${filtered.filter(s=>s.spaceId===id).length} 席</span></div>
    <div class="mini-seat-grid">${filtered.filter(s=>s.spaceId===id).map(s=>`<button title="${SEAT_STATUS_META[computeSeatStatus(s)].label}" class="mini-seat ${computeSeatStatus(s)}" data-action="focus" data-id="${s.id}" data-space="${id}">${s.code}</button>`).join('')}</div><div class="divider"></div>
    ${filtered.filter(s=>s.spaceId===id).map(s=>`<div class="admin-item"><span class="num">${s.code}</span><span class="pill ${computeSeatStatus(s)}">${SEAT_STATUS_META[computeSeatStatus(s)].shortLabel}</span><div class="record-actions"><button class="btn xs" data-action="focus" data-id="${s.id}" data-space="${id}">3D</button><button class="btn xs" data-action="lock" data-id="${s.id}">${s.isLockedByAdmin?'解除維護':'暫停開放'}</button></div></div>`).join('')}</section>`).join('') || filters+'<div class="empty">目前沒有符合篩選條件的座位。</div>';
  }else{
    content=`<div class="panel"><div class="panel-head"><h2>攝影機辨識模擬控制</h2><span class="pill reserved_waiting">非真實AI／無實體影像</span></div><p class="small muted">針對每個座位手動模擬人物、背包、書本；修改立即反映到3D模型及異常規則。${state.live&&!state.preview?'管理員調整將儲存到Supabase。':'展示資料僅供測試。'}</p>
    ${a.map(s=>`<div class="admin-item"><div><b class="num">${s.code}</b> <span class="muted tiny">${esc(LIBRARY_SPACES[s.spaceId].name)}</span><div class="description">攝影機 ${esc(s.vision.cameraId)}</div></div><div class="record-actions">
      ${[['hasPerson','人物'],['hasBackpack','背包'],['hasBooks','書籍']].map(([key,label])=>`<label class="chip ${s.vision[key]?'active':''}"><input type="checkbox" data-vision="${key}" data-id="${s.id}" ${s.vision[key]?'checked':''}> ${label}</label>`).join('')}
      <button class="btn xs" data-action="focus" data-id="${s.id}" data-space="${s.spaceId}" data-layer="vision">場景</button></div></div>`).join('')}</div>`;
  }
  $('librarian-view').innerHTML=`<div class="page-head"><div><div class="kicker">OPERATIONS / LIBRARIAN CONSOLE</div><h1>館員監控台</h1><p>三個空間・座位狀態、攝影機模擬偵測、異常工單與人工維護鎖定。</p></div><button class="btn ghost sm" data-action="view" data-view="explore">返回2.5D場景</button></div>
  <div class="page-stats"><div class="stat-card"><div class="label">可預約空位</div><strong class="num">${counts.free}</strong></div><div class="stat-card"><div class="label">已到席</div><strong class="num">${counts.occupied}</strong></div><div class="stat-card"><div class="label">暫離保留</div><strong class="num">${counts.away}</strong></div><div class="stat-card"><div class="label">異常座位</div><strong class="num" style="color:var(--red)">${counts.anomaly}</strong></div></div>${tabs}${content}`;
}
function openModal(type){
  state.modal=type;
  const el=$('modal-backdrop');el.hidden=false;
  if(type==='scenario'){
    el.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="智慧圖書館核心情境模擬"><div class="modal-header"><h2>✦ 智慧圖書館核心情境模擬</h2><button class="btn icon-btn" data-action="close-modal" aria-label="關閉">×</button></div>
      <div class="modal-body"><p class="muted small">選擇情境，系統會即時更新2.5D模型中的人物、背包、書本、攝影機視野、座位狀態與推薦。${state.live?'<b>正式資料庫連線時，情境僅在本機預覽、不會寫入雲端。</b>':''}</p>
      ${scenarios.map(s=>`<button class="scenario-button" data-action="scenario" data-id="${s.id}"><span><span class="kicker">${esc(s.tag)}</span><strong>${esc(s.title)}</strong><small>${esc(s.desc)}</small></span><span>↗</span></button>`).join('')}</div></div>`;
  }else if(type==='auth'){
    const live=state.live;
    el.innerHTML=`<div class="modal narrow" role="dialog" aria-modal="true" aria-label="雲端帳號登入"><div class="modal-header"><h2>${live?'雲端帳號':'啟用 Supabase 雲端資料'}</h2><button class="btn icon-btn" data-action="close-modal">×</button></div><div class="modal-body">
    ${!live?'<p class="small muted">目前沒有設定 Supabase。預設可完整體驗原版情境、2.5D場景及座位操作，所有變更只存在目前分頁。若要跨裝置登入及正式預約，請依README設定config.js和setup.sql。</p><button class="btn dark wide" data-action="close-modal">繼續使用情境展示</button>':
    state.user?`<p class="small muted">目前登入：${esc(state.user.email)}<br>權限：${state.isAdmin?'館員管理員':'學生'}</p><button class="btn red wide" data-action="logout">登出此帳號</button>`:
    `<p class="small muted">使用Supabase Email／密碼帳號。註冊若需驗證Email，請先完成信箱驗證再登入。</p><form id="auth-form"><label class="form-label">Email</label><input id="auth-email" class="field" required type="email" autocomplete="email" placeholder="you@example.com" /><label class="form-label">密碼（至少6字元）</label><input id="auth-password" class="field" required type="password" minlength="6" autocomplete="current-password" /><button type="submit" class="btn blue wide" style="margin-top:14px">${state.authMode==='login'?'登入':'建立帳號'}</button></form><button class="btn ghost wide" data-action="switch-auth" style="margin-top:10px">${state.authMode==='login'?'還沒有帳號？建立帳號':'已有帳號？返回登入'}</button>`}
    </div></div>`;
  }
}
function closeModal(){state.modal=null;$('modal-backdrop').hidden=true;$('modal-backdrop').innerHTML=''}
function openAuth(){openModal('auth')}

// Global event delegation keeps buttons working after a panel re-renders.
document.addEventListener('click',async e=>{
  const trigger=e.target.closest('button[data-action]');
  if(!trigger){if(e.target.id==='modal-backdrop')closeModal();return}
  const a=trigger.dataset.action,id=trigger.dataset.id;
  if(['book','cancel','check-in','away','return','swap','lock','clear-anomaly','report-advance','scenario','logout','smart-find'].includes(a))trigger.disabled=true;
  try{
    switch(a){
      case 'view': state.view=trigger.dataset.view;render();break;
      case 'space': selectSpace(id);break;
      case 'layer': state.layer=trigger.dataset.layer;render();break;
      case 'camera': state.camera=trigger.dataset.camera;renderLayers();state.engine?.preset(state.camera);break;
      case 'seat': selectSeat(id);break;
      case 'focus': focusSeat(id,trigger.dataset.space,trigger.dataset.layer);break;
      case 'close-drawer':state.selected=null;state.recommended=[];render();break;
      case 'dock-collapse':state.dockCollapsed=!state.dockCollapsed;renderDock();break;
      case 'toggle-equip':{const k=trigger.dataset.key;state.filter.equipment[k]=!state.filter.equipment[k];render();break}
      case 'reset-filters':state.filter.equipment=Object.fromEntries(Object.keys(state.filter.equipment).map(k=>[k,false]));state.filter.searchQuery='';state.filter.onlyAvailable=false;render();break;
      case 'smart-find':smartFind();break;
      case 'book':await bookSeat(id);break;
      case 'cancel':if(!confirm(`確定取消 ${id} 預約？`))break;await cancelSeat(id,trigger.dataset.date?{reservation_date:trigger.dataset.date,time_slot:trigger.dataset.slot}:null);break;
      case 'check-in':await changeCheckIn(id,'check_in',trigger.dataset.date?{reservation_date:trigger.dataset.date,time_slot:trigger.dataset.slot}:null);break;
      case 'away':await changeCheckIn(id,'away',trigger.dataset.date?{reservation_date:trigger.dataset.date,time_slot:trigger.dataset.slot}:null);break;
      case 'return':await changeCheckIn(id,'return',trigger.dataset.date?{reservation_date:trigger.dataset.date,time_slot:trigger.dataset.slot}:null);break;
      case 'swap':await swapSeat(trigger.dataset.from,trigger.dataset.to);break;
      case 'toggle-report':state.reportForm=!state.reportForm;renderDrawer();break;
      case 'toggle-simlab':state.simLab=!state.simLab;renderDrawer();break;
      case 'clear-anomaly':await clearSeat(id);break;
      case 'lock':await toggleLock(id);break;
      case 'report-advance':await advanceReport(id,trigger.dataset.mode);break;
      case 'record-tab':state.recordTab=id;renderRecords();break;
      case 'admin-tab':state.adminTab=id;renderLibrarian();break;
      case 'open-scenario':openModal('scenario');break;
      case 'open-auth':openAuth();break;
      case 'close-modal':closeModal();break;
      case 'scenario':triggerScenario(id);break;
      case 'switch-auth':state.authMode=state.authMode==='login'?'signup':'login';openAuth();break;
      case 'logout':if(!state.client)return;await state.client.auth.signOut();state.user=null;state.isAdmin=false;closeModal();await loadLive();toast('已登出');break;
    }
  }catch(err){console.error(err);toast(err.message||'操作失敗',true)}finally{if(trigger.isConnected)trigger.disabled=false}
});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='admin-space'){state.adminSpaceFilter=t.value;renderLibrarian();return}
  if(t.id==='admin-status'){state.adminStatusFilter=t.value;renderLibrarian();return}
  if(t.id==='dock-date'){
    if(state.live&&!datesInRange(t.value)){toast('雲端預約僅開放今日起14日內',true);t.value=state.filter.date;return}
    state.filter.date=t.value;state.recommended=[];
    if(state.live&&!state.preview)await loadLive();else render();
  }else if(t.id==='dock-slot'){
    state.filter.timeSlot=t.value;state.recommended=[];
    if(state.live&&!state.preview)await loadLive();else render();
  }else if(t.id==='only-available'){state.filter.onlyAvailable=t.checked;render();}
  else if(t.dataset.vision){await updateVision(t.dataset.id,{[t.dataset.vision]:t.checked})}
});
document.addEventListener('input',e=>{
  if(e.target.id==='admin-search'){state.adminSearch=e.target.value;const pos=e.target.selectionStart;renderLibrarian();const field=$('admin-search');field?.focus();field?.setSelectionRange(pos,pos);return}
  if(e.target.id==='seat-search'){
    state.filter.searchQuery=e.target.value;
    renderPins();
    if(state.engine&&!state.engine.failed)state.engine.sync(activeSeats(),state.layer,state.selected,state.recommended);
  }
});
document.addEventListener('submit',async e=>{
  const form=e.target;
  if(form.id==='report-form'){
    e.preventDefault();const id=state.selected;
    await submitReport(id,$('report-type').value,$('report-description').value);
  }else if(form.id==='auth-form'){
    e.preventDefault();if(!state.client)return;
    const email=$('auth-email').value.trim(),password=$('auth-password').value;
    const submitBtn=form.querySelector('[type=submit]');submitBtn.disabled=true;
    try{
      const r=state.authMode==='login'?await state.client.auth.signInWithPassword({email,password}):await state.client.auth.signUp({email,password});
      if(r.error)throw r.error;
      if(r.data.user&&r.data.session){state.user=r.data.user;await loadProfile();await loadLive();toast(state.authMode==='login'?'登入成功':'帳號建立成功')}else toast('註冊請求已送出；請至Email完成驗證後再登入。');
      closeModal();
    }catch(err){toast(err.message,true)}finally{submitBtn.disabled=false}
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(state.modal)closeModal();else if(state.selected){state.selected=null;render()}}
});

// The 3D library is lazy-loaded so the complete UI and 2D fallback also work
// when external CDNs or WebGL are blocked.
let SceneEngineClass=null;
let sceneImportPending=false;
function updateEngine(){
  if(!SceneEngineClass){
    if(!sceneImportPending){
      sceneImportPending=true;
      import('./scene.js').then(m=>{SceneEngineClass=m.SceneEngine;const fallback=$('scene-fallback');fallback.hidden=true;$('seat-pins').hidden=false;updateEngine()}).catch(err=>{console.warn('Three.js unavailable, using 2D fallback',err);showSceneFallback(err)});
    }
    return;
  }
  if(!state.engine){
    state.engine=new SceneEngineClass($('scene-mount'),$('seat-pins'),id=>selectSeat(id),id=>{
      if(state.hovered!==id){state.hovered=id;document.querySelectorAll('.seat-pin').forEach(x=>x.classList.toggle('hovered',x.dataset.pin===id))}
    },err=>showSceneFallback(err));
    if(state.engine.failed){showSceneFallback(new Error('WebGL不可用'));return}
  }
  if(state.engine.spaceId!==state.spaceId){state.engine.rebuild(LIBRARY_SPACES[state.spaceId],activeSeats());state.engine.preset(state.camera)}
  else state.engine.sync(activeSeats(),state.layer,state.selected,state.recommended);
  state.engine.updatePins();
}

init().catch(e=>{console.error(e);toast('程式初始化失敗：'+e.message,true)});
