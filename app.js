const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const KEYS={session:'bm_session_v5',today:'bm_today_v5',festivals:'bm_festivals_v5',notices:'bm_notices_v5',notifications:'bm_notifications_v5',notifyEnabled:'bm_notify_enabled_v5',reservations:'bm_reservations_v5',migration:'bm_migration_v6',community:'bm_community_v7',reports:'bm_reports_v7',accounts:'bm_accounts_v7',guestAccess:'bm_guest_access_v7'};
const state={screen:'home',loginRole:'student',currentFestivalId:null,managerFestivalId:null,editingFestivalId:null,editingBoothId:null,editingMenuId:null,editingEventId:null,editingNoticeId:null,editingTodayId:null,lastDayKey:null,pendingImage:{notice:'',booth:'',menu:'',community:''},reservationBoothId:null,communityCategory:'전체',communitySearch:'',currentPostId:null,pendingStudentSession:null,deferredPrompt:null};
const read=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}};const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));const id=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove('show'),2200)}
function session(){return read(KEYS.session,null)}function isAdmin(){return session()?.role==='admin'}function isStudent(){return session()?.role==='student'}function isGuest(){return session()?.role==='guest'}
function openOverlay(id){document.getElementById(id).classList.add('open')}function closeOverlay(id){document.getElementById(id).classList.remove('open')}
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeOverlay(b.dataset.close)));$$('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}));
function formatDate(d){if(!d)return'';return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${d}T00:00:00`))}function dday(d){if(!d)return'';const t=new Date(`${d}T00:00:00`);const n=new Date();n.setHours(0,0,0,0);const x=Math.ceil((t-n)/86400000);return x>0?`D-${x}`:x===0?'D-DAY':`D+${Math.abs(x)}`}
function guestAccess(){return read(KEYS.guestAccess,{today:false,notices:false,festivals:true,guide:true,community:false})}
function route(screen,opts={}){
  if(!session()){showAuthGate();return}
  if(isAdmin()&&screen==='home'&&!opts.preview)screen='admin';
  const access=guestAccess();
  if(isGuest()&&screen==='guide'&&!access.guide){toast('게스트에게 공개되지 않은 메뉴입니다.');screen='home'}
  if(isGuest()&&screen==='festival'&&!access.festivals){toast('게스트에게 공개되지 않은 메뉴입니다.');screen='home'}
  state.screen=screen;$$('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===screen));$$('#bottomNav [data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===screen));
  $('#appShell').classList.toggle('admin-mode',screen==='admin'&&isAdmin());
  if(screen==='admin')renderAdmin();if(screen==='festival')renderFestival();if(screen==='community')renderCommunity();if(screen==='my')renderMy();
  applyRoleVisibility();window.scrollTo({top:0,behavior:'smooth'})
}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.go)));$('#brandButton').addEventListener('click',()=>route('home'));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredPrompt=e});$('#installButton').addEventListener('click',async()=>{if(state.deferredPrompt){state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null}else toast('브라우저 메뉴에서 홈 화면에 추가를 선택하세요.')});
function localDateKey(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function migrateV6(){
  if(localStorage.getItem(KEYS.migration))return;
  const rawToday=read(KEYS.today,[]);
  if(!Array.isArray(rawToday)){
    const isSeeded=rawToday?.title==='오늘 주요 일정'&&rawToday?.summary==='12:30 버스킹 · 14:00 동아리 공연';
    write(KEYS.today,isSeeded?[]:[{id:id(),date:localDateKey(),badge:rawToday.badge||'TODAY',title:rawToday.title||'',summary:rawToday.summary||'',startTime:'08:00',endTime:'17:00'}]);
  }
  const demoBooths=new Set(['미스터리 랩','배문 오락실']);
  const demoMenus=new Set(['매콤 떡볶이','연봉 에이드']);
  const demoEvents=new Set(['점심 버스킹','동아리 공연']);
  saveFestivals(festivals().map(f=>({...f,
    booths:(f.booths||[]).filter(x=>!demoBooths.has(x.name)),
    menus:(f.menus||[]).filter(x=>!demoMenus.has(x.name)),
    events:(f.events||[]).filter(x=>!demoEvents.has(x.name))
  })));
  write(KEYS.migration,true);
}
function seed(){
  if(!localStorage.getItem(KEYS.today))write(KEYS.today,[]);
  if(!localStorage.getItem(KEYS.festivals)){
    write(KEYS.festivals,[{id:id(),name:'연봉제',year:new Date().getFullYear(),short:'YEONBONG',tagline:'학교 전체가 하나의 무대가 되는 날.',description:'관리자가 등록한 부스, 먹거리와 행사 일정을 확인하세요.',start:'',end:'',color:'#ff6038',visible:true,featured:true,booths:[],menus:[],events:[]}]);
  }
  if(!localStorage.getItem(KEYS.notices)){
    const d=new Date();d.setDate(d.getDate()+18);
    write(KEYS.notices,[{id:id(),category:'시험',audience:'2학년',title:'2학기 기말고사 안내',summary:'시험 시간표와 과목별 범위가 등록되었습니다.',body:'2학기 기말고사 시간표와 과목별 시험 범위를 확인해주세요.\n\n변경 사항이 생기면 이 공지를 통해 다시 안내합니다.',eventDate:localDateKey(d),pinned:true,image:'',createdAt:Date.now()}]);
  }
  if(!localStorage.getItem(KEYS.notifications))write(KEYS.notifications,[]);
  if(!localStorage.getItem(KEYS.reservations))write(KEYS.reservations,[]);
  if(!localStorage.getItem(KEYS.notifyEnabled))write(KEYS.notifyEnabled,true);
  if(!localStorage.getItem(KEYS.accounts))write(KEYS.accounts,[]);
  if(!localStorage.getItem(KEYS.guestAccess))write(KEYS.guestAccess,{today:false,notices:false,festivals:true,guide:true,community:false});
  if(!localStorage.getItem(KEYS.reports))write(KEYS.reports,[]);
  if(!localStorage.getItem(KEYS.community))write(KEYS.community,[{id:id(),category:'공지',title:'배문 커뮤니티 이용 안내',body:'서로를 존중하고 개인정보가 드러나는 글은 작성하지 말아주세요. 신고된 게시글은 관리자가 확인합니다.',image:'',authorKey:'admin',authorName:'관리자',authorGrade:0,anonymous:false,pinned:true,hidden:false,likes:[],comments:[],reportCount:0,createdAt:Date.now()}]);
  migrateV6();
}
function festivals(){return read(KEYS.festivals,[])}function saveFestivals(v){write(KEYS.festivals,v)}function selectedFestival(){const fs=festivals();return fs.find(f=>f.id===state.currentFestivalId)||fs.find(f=>f.featured&&f.visible)||fs.find(f=>f.visible)||null}
function todaySchedules(){const v=read(KEYS.today,[]);return Array.isArray(v)?v:[]}
function saveTodaySchedules(v){write(KEYS.today,v)}
function currentTodayEntry(){return todaySchedules().find(x=>x.date===localDateKey())||null}
function progressForEntry(entry,now=new Date()){
  if(!entry){
    return Math.max(0,Math.min(100,((now.getHours()*60+now.getMinutes()+now.getSeconds()/60)/1440)*100));
  }
  const toMinutes=t=>{const [h,m]=String(t||'').split(':').map(Number);return h*60+m};
  const start=toMinutes(entry.startTime||'08:00'),end=toMinutes(entry.endTime||'17:00'),cur=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0;
  if(cur<=start)return 0;if(cur>=end)return 100;
  return ((cur-start)/(end-start))*100;
}
function renderTodayCard(){
  const entry=currentTodayEntry(),progress=progressForEntry(entry),pct=Math.round(progress);
  const fallback={badge:'TODAY',title:'주요 일정 없음',summary:'오늘 등록된 주요 일정이 없습니다.',startTime:'00:00',endTime:'24:00'};
  const t=entry||fallback;
  $('#todayBadge').textContent=t.badge||'TODAY';
  $('#todayTitle').textContent=t.title||'주요 일정 없음';
  $('#todaySummary').textContent=t.summary||'오늘 등록된 주요 일정이 없습니다.';
  $('#todayProgress').style.width=`${progress}%`;
  $('#todayProgressLabel').textContent=`${pct}%`;
  $('#todayTimeRange').textContent=entry?`${t.startTime||'08:00'}–${t.endTime||'17:00'}`:'오늘 하루';
  $('#todayLiveStatus').textContent=!entry?'하루 진행 중':progress<=0?'시작 전':progress>=100?'일정 종료':'일정 진행 중';
  $('#todayDate').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date());
}
function renderHome(){
  const access=guestAccess();
  $('#todayCard').hidden=isGuest()&&!access.today;
  renderTodayCard();
  const fs=(isGuest()&&!access.festivals)?[]:festivals().filter(f=>f.visible);
  $('#festivalHomeCount').textContent=`${fs.length}개`;
  $('#festivalHomeList').innerHTML=fs.length?fs.map(f=>`<button class="festival-home-card" data-open-festival="${f.id}" style="background:linear-gradient(135deg,${f.color},#111827)"><div class="festival-card-top"><span class="card-tag">${dday(f.start)||'FESTIVAL'}</span><b>${esc(f.year)}</b></div><h3>${esc(f.name)}</h3><p>${esc(f.tagline)}</p></button>`).join(''):'<div class="festival-empty">관리자가 공개한 축제가 없습니다.</div>';
  $$('[data-open-festival]').forEach(b=>b.addEventListener('click',()=>{state.currentFestivalId=b.dataset.openFestival;route('festival')}));
  renderNotices();updateFestivalNav();applyRoleVisibility();
}
function updateFestivalNav(){const f=festivals().find(x=>x.featured&&x.visible)||festivals().find(x=>x.visible);const b=$('#festivalNavButton');if(!f){b.style.setProperty('display','none','important');$('#bottomNav').classList.add('three')}else{b.style.removeProperty('display');$('#bottomNav').classList.remove('three');$('#festivalNavLabel').textContent=f.name;$('#festivalNavIcon').textContent=f.name.slice(0,1);b.onclick=()=>{state.currentFestivalId=f.id;route('festival')}}}
function renderFestival(){const f=selectedFestival();if(!f){toast('공개된 축제가 없습니다.');route('home');return}state.currentFestivalId=f.id;$('#festivalHero').style.setProperty('--festival-color',f.color||'#ff6038');$('#festivalKicker').textContent=`BAEMOON FESTIVAL ${f.year||''}`;$('#festivalTitle').textContent=f.name;$('#festivalTagline').textContent=f.tagline||'';$('#festivalBadgeText').textContent=(f.short||f.name).toUpperCase();$('#festivalYearBadge').textContent=String(f.year||'').slice(-2);$('#festivalDday').textContent=dday(f.start)||'FESTIVAL';$('#festivalOverviewTitle').textContent=`${f.name} 안내`;$('#festivalDescription').textContent=f.description||'';$('#festivalBoothCount').textContent=(f.booths||[]).length;$('#festivalMenuCount').textContent=(f.menus||[]).length;$('#festivalEventCount').textContent=(f.events||[]).length;renderBooths(f);renderMenus(f);renderEvents(f)}
$$('#festivalTabs button').forEach(b=>b.addEventListener('click',()=>{$$('#festivalTabs button').forEach(x=>x.classList.toggle('active',x===b));$$('.festival-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===b.dataset.tab))}));
function renderBooths(f){f.booths=f.booths||[];$('#reservationList').innerHTML=f.booths.length?f.booths.map(b=>`<article class="reservation-card"><div class="reservation-image ${b.image?'zoomable-image':''}" data-image="${b.image||''}" style="${b.image?`background-image:url('${b.image}')`:''}"><span>${esc(b.owner||'BOOTH')}</span></div><div class="reservation-body"><div><span class="card-tag">${esc(b.owner||'부스')}</span><span class="notice-dday">${b.times?.length?`${b.times.length}회차`:'즉시 예약'}</span></div><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p><div class="reservation-meta"><span>${esc(b.location)}</span><span>${b.duration||0}분</span><span>정원 ${b.capacity||1}명</span></div><button class="reserve-button" data-reserve-booth="${b.id}">${b.times?.length?'시간 선택 후 예약':'바로 예약'}</button></div></article>`).join(''):'<div class="festival-empty">등록된 체험 부스가 없습니다.</div>';$$('[data-reserve-booth]').forEach(x=>x.addEventListener('click',()=>openReservation(x.dataset.reserveBooth)));bindZoomables()}
function renderMenus(f){f.menus=f.menus||[];$('#foodList').innerHTML=f.menus.length?f.menus.map(m=>`<article class="food-card"><div class="food-thumb ${m.image?'zoomable-image':''}" data-image="${m.image||''}" style="${m.image?`background-image:url('${m.image}')`:''}">${m.image?'':esc(m.name.slice(0,1))}</div><div><span>${esc(m.seller)} · ${esc(m.location)}</span><h3>${esc(m.name)}</h3><p>${Number(m.price).toLocaleString()}원 · ${esc(m.category)}</p></div></article>`).join(''):'<div class="festival-empty">등록된 메뉴가 없습니다.</div>';bindZoomables()}
function renderEvents(f){f.events=f.events||[];const ev=[...f.events].sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));$('#eventTimeline').innerHTML=ev.length?ev.map(e=>`<article class="timeline-item"><time>${esc(e.time||'--:--')}</time><i></i><div><span>${esc(e.location)} · ${formatDate(e.date)}</span><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p></div><button class="bell-mini" data-event-alert="${e.id}">알림</button></article>`).join(''):'<div class="festival-empty">등록된 일정이 없습니다.</div>';$$('[data-event-alert]').forEach(b=>b.addEventListener('click',()=>{const e=ev.find(x=>x.id===b.dataset.eventAlert);addNotification({title:`${f.name} · ${e.name}`,body:`${formatDate(e.date)} ${e.time} · ${e.location}`,type:'event'});toast('일정 알림을 저장했습니다.')}))}
function openReservation(boothId){if(!isStudent())return toast('체험 예약은 학생 로그인 후 이용할 수 있습니다.');const f=selectedFestival(),b=f.booths.find(x=>x.id===boothId);if(!b)return;state.reservationBoothId=boothId;$('#reservationModalTitle').textContent=b.name;$('#reservationModeText').textContent=b.times?.length?'원하는 예약 시간을 선택하세요.':'예약 시간이 설정되지 않은 부스입니다. 바로 예약됩니다.';$('#reservationTimeGrid').innerHTML=b.times?.length?b.times.map((t,i)=>`<button class="${i===0?'selected':''}" data-time="${t}">${t}</button>`).join(''):'';$$('#reservationTimeGrid button').forEach(x=>x.addEventListener('click',()=>{$$('#reservationTimeGrid button').forEach(y=>y.classList.remove('selected'));x.classList.add('selected')}));const s=session();$('#reservationUser').value=s?.role==='student'?`${s.id} ${s.name}`:'';openOverlay('reservationModal')}
$('#confirmReservation').addEventListener('click',()=>{const f=selectedFestival(),b=f?.booths.find(x=>x.id===state.reservationBoothId),user=$('#reservationUser').value.trim();if(!b||!user)return toast('예약자 정보를 입력해주세요.');const time=$('#reservationTimeGrid .selected')?.dataset.time||'즉시 예약';const rs=read(KEYS.reservations,[]);rs.push({id:id(),studentKey:session()?.studentKey||'',festivalId:f.id,festivalName:f.name,boothId:b.id,boothName:b.name,user,time,createdAt:Date.now()});write(KEYS.reservations,rs);closeOverlay('reservationModal');toast(`${b.name} 예약이 완료되었습니다.`);if(navigator.vibrate)navigator.vibrate([60,40,80]);renderMy()});
function accounts(){return window.firebaseCache?.users??read(KEYS.accounts,[])}function saveAccounts(v){write(KEYS.accounts,v)}
function studentKey(grade,classNo,number){return `${new Date().getFullYear()}-${grade}-${String(classNo).padStart(2,'0')}-${String(number).padStart(2,'0')}`}
function studentDisplayId(s){return `${s.grade}${String(s.classNo).padStart(2,'0')}${String(s.number).padStart(2,'0')}`}
function renderMy(){const s=session();if(!s){showAuthGate();return}if(s.role==='guest'){$('#profileRole').textContent='외부 방문자';$('#profileName').textContent='게스트';$('#profileDetail').textContent='관리자가 공개한 정보만 확인할 수 있습니다.';$('#profileAvatar').textContent='G';$('#profileLoginButton').hidden=true;$('#logoutButton').hidden=false}else if(s.role==='admin'){$('#profileRole').textContent='배문고 관리자';$('#profileName').textContent='관리자';$('#profileDetail').textContent='관리자 홈에서 콘텐츠를 관리합니다.';$('#profileAvatar').textContent='AD';$('#profileLoginButton').hidden=true;$('#logoutButton').hidden=false}else{$('#profileRole').textContent=`${s.grade}학년 ${s.classNo}반 ${s.number}번`;$('#profileName').textContent=s.name;$('#profileDetail').textContent=`학생 ID ${studentDisplayId(s)}`;$('#profileAvatar').textContent=s.name.slice(0,1);$('#profileLoginButton').hidden=true;$('#logoutButton').hidden=false}const rs=read(KEYS.reservations,[]);const mine=s.role==='student'?rs.filter(r=>r.studentKey===s.studentKey||r.user?.startsWith(studentDisplayId(s))):[];$('#reservationCount').textContent=`${mine.length}건`;$('#myReservationList').innerHTML=mine.map(r=>`<article class="my-reservation-card"><h3>${esc(r.festivalName)} · ${esc(r.boothName)}</h3><p>${esc(r.time)} · ${new Date(r.createdAt).toLocaleString('ko-KR')}</p></article>`).join('')}
function showAuthGate(){closeAllOverlays();$('#appShell').hidden=true;$('#appShell').style.display='none';$('#authGate').hidden=false;$('#authGate').style.display='grid';document.body.classList.add('auth-open')}
function enterApp(defaultScreen='home'){closeAllOverlays();$('#authGate').hidden=true;$('#authGate').style.display='none';$('#appShell').hidden=false;$('#appShell').style.display='block';document.body.classList.remove('auth-open');renderHome();renderMy();renderNotifications();route(defaultScreen,{preview:defaultScreen==='home'})}
function closeAllOverlays(){$$('.overlay.open').forEach(x=>x.classList.remove('open'))}
function showAuthError(id,message){const el=$(id);el.textContent=message;el.hidden=false}
function clearAuthErrors(){$$('.auth-inline-error').forEach(x=>{x.hidden=true;x.textContent=''})}
function populateStudentSelectors(){const fill=(el,max,suffix)=>{el.innerHTML=Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1}${suffix}</option>`).join('')};fill($('#studentGrade'),3,'학년');fill($('#studentClass'),10,'반');fill($('#studentNumber'),30,'번')}
$('#openStudentLogin').addEventListener('click',()=>{clearAuthErrors();$('#studentPassword').value='';openOverlay('studentLoginModal')});
$('#openAdminLogin').addEventListener('click',()=>{clearAuthErrors();$('#adminLoginId').value='admin';$('#adminLoginPassword').value='';openOverlay('adminLoginModal');setTimeout(()=>$('#adminLoginPassword').focus(),50)});
$('#openGuestConfirm').addEventListener('click',()=>openOverlay('guestConfirmModal'));
$('#confirmGuestEntry').addEventListener('click',()=>{write(KEYS.session,{role:'guest',name:'게스트'});enterApp('home');toast('게스트로 입장했습니다.')});
$('#studentLoginSubmit').addEventListener('click',()=>{
  clearAuthErrors();
  const grade=Number($('#studentGrade').value);
  const classNo=Number($('#studentClass').value);
  const number=Number($('#studentNumber').value);
  const name=$('#studentName').value.trim();
  const password=$('#studentPassword').value.trim();

  if(!name||!password){
    return showAuthError('#studentLoginError','이름과 비밀번호를 입력해주세요.');
  }
  if(password!=='baemoon2026'){
    return showAuthError('#studentLoginError','비밀번호가 올바르지 않습니다.');
  }

  const key=studentKey(grade,classNo,number);
  let list=accounts();
  const existing=list.find(a=>a.studentKey===key);

  if(existing&&existing.name!==name){
    return showAuthError('#studentLoginError','학년·반·번호와 이름이 일치하지 않습니다.');
  }
  if(existing&&existing.active===false){
    return showAuthError('#studentLoginError','관리자에 의해 정지된 계정입니다.');
  }

  if(existing){
    list=list.map(a=>a.studentKey===key?{
      ...a,
      grade,classNo,number,name,
      password:'baemoon2026',
      mustChangePassword:false,
      lastLoginAt:Date.now()
    }:a);
  }else{
    list.push({
      id:id(),
      studentKey:key,
      grade,classNo,number,name,
      password:'baemoon2026',
      mustChangePassword:false,
      active:true,
      createdAt:Date.now(),
      lastLoginAt:Date.now()
    });
  }

  saveAccounts(list);
  write(KEYS.session,{role:'student',studentKey:key,grade,classNo,number,name});
  $('#studentPassword').value='';
  enterApp('home');
  toast(`${name}님, 환영합니다.`);
});

$('#saveStudentPassword').addEventListener('click',()=>{
  closeOverlay('passwordChangeModal');
  toast('시제품에서는 공통 비밀번호로 바로 로그인합니다.');
});
function submitAdminLogin(){
  clearAuthErrors();
  const uid=$('#adminLoginId').value.trim().toLowerCase();
  const password=$('#adminLoginPassword').value.trim();

  if(uid!=='admin'||password!=='rlarkdals'){
    return showAuthError('#adminLoginError','관리자 ID 또는 비밀번호가 올바르지 않습니다.');
  }

  write(KEYS.session,{role:'admin',id:'admin',name:'관리자'});
  $('#adminLoginPassword').value='';
  closeOverlay('adminLoginModal');
  enterApp('admin');
  toast('관리자 홈으로 로그인했습니다.');
}
$('#adminLoginSubmit').addEventListener('click',submitAdminLogin);
$('#adminLoginId').addEventListener('keydown',e=>{if(e.key==='Enter')submitAdminLogin()});
$('#adminLoginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')submitAdminLogin()});
$('#profileLoginButton').addEventListener('click',showAuthGate);$('#accountButton').addEventListener('click',()=>{if(isAdmin())route('admin');else route('my')});
function logoutToWelcome(){localStorage.removeItem(KEYS.session);state.currentPostId=null;showAuthGate();toast('로그아웃되었습니다.')}
$('#logoutButton').addEventListener('click',logoutToWelcome);
function notices(){return read(KEYS.notices,[])}function saveNotices(v){write(KEYS.notices,v)}function renderNotices(){if(isGuest()&&!guestAccess().notices){$('#homeNoticeCount').textContent='비공개';$('#homeNoticeList').innerHTML='<div class="community-locked">학교 내부 공지는 로그인한 학생에게만 공개됩니다.</div>';return}const ns=[...notices()].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt);$('#homeNoticeCount').textContent=`${ns.length}건`;$('#homeNoticeList').innerHTML=ns.length?ns.map(n=>`<article class="home-notice-card ${n.pinned?'pinned':''}" data-notice="${n.id}"><div class="notice-card-top"><div class="notice-card-tags"><span class="notice-category">${esc(n.category)}</span><span class="notice-category">${esc(n.audience)}</span></div><b class="notice-dday">${dday(n.eventDate)}</b></div><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><div class="notice-open-hint"><span>세부 내용 보기</span><b>→</b></div></article>`).join(''):'<div class="notice-empty">등록된 공지가 없습니다.</div>';$$('[data-notice]').forEach(c=>c.addEventListener('click',()=>openNoticeDetail(c.dataset.notice)))}
function openNoticeDetail(nid){const n=notices().find(x=>x.id===nid);if(!n)return;$('#noticeDetailTags').innerHTML=`<span class="notice-category">${esc(n.category)}</span><span class="notice-category">${esc(n.audience)}</span>`;$('#noticeDetailTitle').textContent=n.title;$('#noticeDetailDday').textContent=dday(n.eventDate);$('#noticeDetailMeta').textContent=`등록 ${new Date(n.createdAt).toLocaleString('ko-KR')}${n.eventDate?` · 관련일 ${formatDate(n.eventDate)}`:''}`;$('#noticeDetailBody').innerHTML=esc(n.body).replace(/\n/g,'<br>');if(n.image){$('#noticeDetailImage').src=n.image;$('#noticeDetailImageWrap').hidden=false}else $('#noticeDetailImageWrap').hidden=true;openOverlay('noticeDetailModal');bindZoomables()}
function resetNotice(){state.editingNoticeId=null;state.pendingImage.notice='';$('#noticeComposerTitle').textContent='새 공지 등록';['noticeTitle','noticeSummary','noticeBody','noticeEventDate','noticeImage'].forEach(x=>$('#'+x).value='');$('#noticePinned').checked=false;$('#noticePush').checked=false;previewImage('notice','')}
function openNoticeEditor(nid=null){resetNotice();if(nid){const n=notices().find(x=>x.id===nid);state.editingNoticeId=nid;state.pendingImage.notice=n.image||'';$('#noticeComposerTitle').textContent='공지 수정';$('#noticeCategory').value=n.category;$('#noticeAudience').value=n.audience;$('#noticeTitle').value=n.title;$('#noticeSummary').value=n.summary;$('#noticeBody').value=n.body;$('#noticeEventDate').value=n.eventDate||'';$('#noticePinned').checked=!!n.pinned;previewImage('notice',n.image)}openOverlay('noticeComposer')}
$('#openNoticeComposer').addEventListener('click',()=>openNoticeEditor());$('#saveNoticeButton').addEventListener('click',async()=>{const p={category:$('#noticeCategory').value,audience:$('#noticeAudience').value,title:$('#noticeTitle').value.trim(),summary:$('#noticeSummary').value.trim(),body:$('#noticeBody').value.trim(),eventDate:$('#noticeEventDate').value,pinned:$('#noticePinned').checked,image:state.pendingImage.notice};if(!p.title||!p.summary||!p.body)return toast('제목, 요약, 상세 내용을 입력해주세요.');let ns=notices();if(state.editingNoticeId)ns=ns.map(n=>n.id===state.editingNoticeId?{...n,...p}:n);else ns.push({id:id(),...p,createdAt:Date.now()});saveNotices(ns);if($('#noticePush').checked)addNotification({title:`학교 공지 · ${p.title}`,body:p.summary,type:'notice'});closeOverlay('noticeComposer');renderHome();renderAdmin();toast('공지를 저장했습니다.')});
function communityPosts(){return window.firebaseCache?.communityPosts??read(KEYS.community,[])}function saveCommunityPosts(v){write(KEYS.community,v)}function reports(){return window.firebaseCache?.reports??read(KEYS.reports,[])}function saveReports(v){write(KEYS.reports,v)}

function migrateCommunityToNamed(){
  const list=communityPosts();
  let changed=false;
  const next=list.map(post=>{
    let updated=post;
    if(post.authorKey!=='admin'&&(post.anonymous||!post.authorClass||!post.authorNumber)){
      const account=accounts().find(a=>a.studentKey===post.authorKey);
      const parts=String(post.authorKey||'').split('-');
      updated={
        ...updated,
        anonymous:false,
        authorGrade:(account?.grade??post.authorGrade??Number(parts[1])??0),
        authorClass:(account?.classNo??Number(parts[2])??0),
        authorNumber:(account?.number??Number(parts[3])??0),
        authorName:account?.name??post.authorName??'학생'
      };
      changed=true;
    }
    const comments=(updated.comments||[]).map(comment=>{
      if(comment.authorKey&&String(comment.authorLabel||'').includes('익명')){
        changed=true;
        return {...comment,authorLabel:studentIdentityFromKey(comment.authorKey,'학생')};
      }
      return comment;
    });
    return {...updated,comments};
  });
  if(changed)saveCommunityPosts(next);
}

function visibleCommunityPosts(){return communityPosts().filter(p=>!p.hidden||isAdmin())}
function studentIdentityFromKey(key,name='학생'){
  const account=accounts().find(a=>a.studentKey===key);
  if(account)return `${account.grade}학년 ${account.classNo}반 ${account.number}번 ${account.name}`;
  const parts=String(key||'').split('-');
  if(parts.length>=4)return `${Number(parts[1])}학년 ${Number(parts[2])}반 ${Number(parts[3])}번 ${name}`;
  return name;
}
function communityAuthorLabel(post){
  if(post.authorKey==='admin')return '학교 관리자';
  if(post.authorGrade&&post.authorClass&&post.authorNumber){
    return `${post.authorGrade}학년 ${post.authorClass}반 ${post.authorNumber}번 ${post.authorName}`;
  }
  return studentIdentityFromKey(post.authorKey,post.authorName);
}
function renderCommunity(){const access=guestAccess(),banner=$('#communityAccessBanner'),writeButton=$('#openCommunityComposer');banner.hidden=true;writeButton.hidden=!isStudent();if(isGuest()&&!access.community){banner.hidden=false;banner.textContent='관리자가 게스트의 학생 커뮤니티 열람을 허용하지 않았습니다.';$('#communityFeed').innerHTML='<div class="community-locked">학생 커뮤니티는 배문고 학생 로그인 후 이용할 수 있습니다.</div>';$('#communitySearch').disabled=true;return}$('#communitySearch').disabled=false;const q=state.communitySearch.toLowerCase(),posts=[...visibleCommunityPosts()].filter(p=>(state.communityCategory==='전체'||p.category===state.communityCategory)&&(!q||`${p.title} ${p.body}`.toLowerCase().includes(q))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt);$('#communityFeed').innerHTML=posts.length?posts.map(p=>`<article class="community-post-card ${p.pinned?'pinned':''}" data-community-post="${p.id}"><div class="community-post-top"><div class="community-post-author"><span class="community-avatar">${p.authorKey==='admin'?'A':esc((p.authorName||'학').slice(0,1))}</span><div class="community-author-copy"><b>${esc(communityAuthorLabel(p))}</b><span>${esc(p.category)}${p.pinned?' · 상단 고정':''}</span></div></div><span class="community-post-time">${new Date(p.createdAt).toLocaleDateString('ko-KR')}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><div class="community-post-footer"><span>♡ ${(p.likes||[]).length}</span><span>댓글 ${(p.comments||[]).length}</span>${p.reportCount?`<span>신고 ${p.reportCount}</span>`:''}</div></article>`).join(''):'<div class="community-empty">등록된 게시글이 없습니다.</div>';$$('[data-community-post]').forEach(c=>c.addEventListener('click',()=>openCommunityDetail(c.dataset.communityPost)))}
$('#communityCategories').addEventListener('click',e=>{const b=e.target.closest('[data-community-category]');if(!b)return;$$('[data-community-category]').forEach(x=>x.classList.toggle('active',x===b));state.communityCategory=b.dataset.communityCategory;renderCommunity()});
$('#communitySearch').addEventListener('input',e=>{state.communitySearch=e.target.value.trim();renderCommunity()});
function resetCommunityComposer(){state.pendingImage.community='';$('#communityPostCategory').value='자유';$('#communityPostTitle').value='';$('#communityPostBody').value='';$('#communityPostImage').value='';previewCommunityImage('')}
function previewCommunityImage(data){state.pendingImage.community=data||'';if(data){$('#communityImagePreviewImg').src=data;$('#communityImagePreview').hidden=false}else{$('#communityImagePreview').hidden=true;$('#communityImagePreviewImg').removeAttribute('src')}}
$('#openCommunityComposer').addEventListener('click',()=>{if(!isStudent())return toast('학생 로그인 후 글을 작성할 수 있습니다.');resetCommunityComposer();openOverlay('communityComposer')});
$('#communityPostImage').addEventListener('change',async e=>{try{previewCommunityImage(await compressImage(e.target.files[0]));toast('사진을 추가했습니다.')}catch(err){toast(err.message)}});$('#removeCommunityImage').addEventListener('click',()=>previewCommunityImage(''));
$('#saveCommunityPost').addEventListener('click',()=>{const s=session(),title=$('#communityPostTitle').value.trim(),body=$('#communityPostBody').value.trim();if(!isStudent())return toast('학생 로그인 후 이용할 수 있습니다.');if(!title||!body)return toast('제목과 내용을 입력해주세요.');const ps=communityPosts();ps.push({id:id(),category:$('#communityPostCategory').value,title,body,image:state.pendingImage.community,authorKey:s.studentKey,authorName:s.name,authorGrade:s.grade,authorClass:s.classNo,authorNumber:s.number,anonymous:false,pinned:false,hidden:false,likes:[],comments:[],reportCount:0,createdAt:Date.now()});saveCommunityPosts(ps);closeOverlay('communityComposer');renderCommunity();toast('게시글을 등록했습니다.')});
function openCommunityDetail(postId){const p=communityPosts().find(x=>x.id===postId);if(!p||p.hidden&&!isAdmin())return;state.currentPostId=postId;$('#communityDetailTags').innerHTML=`<span class="notice-category">${esc(p.category)}</span>${p.pinned?'<span class="notice-category">상단 고정</span>':''}`;$('#communityDetailTitle').textContent=p.title;$('#communityDetailMeta').textContent=`${communityAuthorLabel(p)} · ${new Date(p.createdAt).toLocaleString('ko-KR')}`;$('#communityDetailBody').innerHTML=esc(p.body).replace(/\n/g,'<br>');if(p.image){$('#communityDetailImage').src=p.image;$('#communityDetailImageWrap').hidden=false}else $('#communityDetailImageWrap').hidden=true;const key=session()?.studentKey||session()?.role||'guest';$('#communityDetailLike').disabled=isGuest();$('#communityDetailLike').classList.toggle('liked',(p.likes||[]).includes(key));$('#communityDetailLikeCount').textContent=(p.likes||[]).length;$('#communityDetailReport').hidden=isAdmin()||isGuest();$('#communityCommentForm').hidden=!isStudent();renderCommunityComments(p);openOverlay('communityDetailModal');bindZoomables()}
function renderCommunityComments(p){$('#communityCommentCount').textContent=(p.comments||[]).length;$('#communityCommentList').innerHTML=(p.comments||[]).length?p.comments.map(c=>`<article class="community-comment"><div class="community-comment-head"><b>${esc(c.authorLabel)}</b><span>${new Date(c.createdAt).toLocaleString('ko-KR')}</span></div><p>${esc(c.body)}</p></article>`).join(''):'<div class="community-empty">첫 댓글을 남겨보세요.</div>'}
$('#communityDetailLike').addEventListener('click',()=>{if(!isStudent())return toast('학생만 좋아요를 누를 수 있습니다.');const key=session().studentKey;saveCommunityPosts(communityPosts().map(p=>{if(p.id!==state.currentPostId)return p;const likes=p.likes||[];return {...p,likes:likes.includes(key)?likes.filter(x=>x!==key):[...likes,key]}}));openCommunityDetail(state.currentPostId);renderCommunity()});
$('#saveCommunityComment').addEventListener('click',()=>{if(!isStudent())return toast('학생 로그인 후 댓글을 작성할 수 있습니다.');const body=$('#communityCommentInput').value.trim();if(!body)return;const s=session();saveCommunityPosts(communityPosts().map(p=>p.id===state.currentPostId?{...p,comments:[...(p.comments||[]),{id:id(),authorKey:s.studentKey,authorLabel:`${s.grade}학년 ${s.classNo}반 ${s.number}번 ${s.name}`,body,createdAt:Date.now()}]}:p));$('#communityCommentInput').value='';openCommunityDetail(state.currentPostId);renderCommunity()});
$('#communityDetailReport').addEventListener('click',()=>openOverlay('communityReportModal'));$('#communityReportReasons').addEventListener('click',e=>{const b=e.target.closest('[data-report-reason]');if(!b)return;const key=session()?.studentKey;if(!key)return;const existing=reports().some(r=>r.postId===state.currentPostId&&r.reporterKey===key);if(existing){closeOverlay('communityReportModal');return toast('이미 신고한 게시글입니다.')}const rs=reports();rs.push({id:id(),postId:state.currentPostId,reporterKey:key,reason:b.dataset.reportReason,createdAt:Date.now()});saveReports(rs);saveCommunityPosts(communityPosts().map(p=>p.id===state.currentPostId?{...p,reportCount:(p.reportCount||0)+1}:p));closeOverlay('communityReportModal');closeOverlay('communityDetailModal');renderCommunity();toast('신고가 관리자 검토 목록에 전달되었습니다.')});
function renderAdminCommunity(){const ps=[...communityPosts()].sort((a,b)=>(b.reportCount||0)-(a.reportCount||0)||b.createdAt-a.createdAt);$('#adminCommunityCount').textContent=`${ps.length}개`;$('#adminCommunityList').innerHTML=ps.length?ps.map(p=>`<article class="admin-community-card"><div><div class="admin-community-meta"><span class="notice-category">${esc(p.category)}</span>${p.reportCount?`<span class="notice-category">신고 ${p.reportCount}</span>`:''}${p.hidden?'<span class="notice-category">숨김</span>':''}</div><h3>${esc(p.title)}</h3><p>작성자: ${esc(p.authorName)} · ${esc(p.authorKey)} · ${new Date(p.createdAt).toLocaleString('ko-KR')}</p></div><div class="moderation-actions"><button data-admin-view-post="${p.id}">상세</button><button data-admin-pin-post="${p.id}">${p.pinned?'고정 해제':'상단 고정'}</button><button data-admin-hide-post="${p.id}">${p.hidden?'다시 공개':'숨기기'}</button><button class="danger" data-admin-delete-post="${p.id}">삭제</button></div></article>`).join(''):'<div class="admin-empty">게시글이 없습니다.</div>';$$('[data-admin-view-post]').forEach(b=>b.addEventListener('click',()=>openCommunityDetail(b.dataset.adminViewPost)));$$('[data-admin-pin-post]').forEach(b=>b.addEventListener('click',()=>{saveCommunityPosts(communityPosts().map(p=>p.id===b.dataset.adminPinPost?{...p,pinned:!p.pinned}:p));renderAdminCommunity();renderCommunity()}));$$('[data-admin-hide-post]').forEach(b=>b.addEventListener('click',()=>{saveCommunityPosts(communityPosts().map(p=>p.id===b.dataset.adminHidePost?{...p,hidden:!p.hidden}:p));renderAdminCommunity();renderCommunity()}));$$('[data-admin-delete-post]').forEach(b=>b.addEventListener('click',()=>{saveCommunityPosts(communityPosts().filter(p=>p.id!==b.dataset.adminDeletePost));saveReports(reports().filter(r=>r.postId!==b.dataset.adminDeletePost));renderAdminCommunity();renderCommunity();toast('게시글을 삭제했습니다.')}))}
function renderAdminStudents(){const list=[...accounts()].sort((a,b)=>a.grade-b.grade||a.classNo-b.classNo||a.number-b.number);$('#adminStudentCount').textContent=`${list.length}명`;$('#adminStudentList').innerHTML=list.length?list.map(a=>`<article class="admin-student-card"><div><span class="student-status ${a.mustChangePassword?'initial':''}">${a.active===false?'정지':a.mustChangePassword?'초기 비밀번호':'활성'}</span><h3>${a.grade}학년 ${a.classNo}반 ${a.number}번 ${esc(a.name)}</h3><p>${esc(a.studentKey)} · 마지막 로그인 ${a.lastLoginAt?new Date(a.lastLoginAt).toLocaleString('ko-KR'):'없음'}</p></div><div class="moderation-actions"><button data-toggle-student="${a.studentKey}">${a.active===false?'계정 복구':'계정 정지'}</button><button data-reset-student="${a.studentKey}">비밀번호 초기화</button></div></article>`).join(''):'<div class="admin-empty">아직 로그인한 학생 계정이 없습니다.</div>';$$('[data-toggle-student]').forEach(b=>b.addEventListener('click',()=>{saveAccounts(accounts().map(a=>a.studentKey===b.dataset.toggleStudent?{...a,active:a.active===false}:a));renderAdminStudents();toast('학생 계정 상태를 변경했습니다.')}));$$('[data-reset-student]').forEach(b=>b.addEventListener('click',()=>{saveAccounts(accounts().map(a=>a.studentKey===b.dataset.resetStudent?{...a,password:'baemoon2026',mustChangePassword:true}:a));renderAdminStudents();toast('정식 비밀번호 초기화는 서버 관리자 기능 연결 후 사용할 수 있습니다.')}))}
function renderGuestSettings(){const access=guestAccess();$$('[data-guest-setting]').forEach(i=>{i.checked=!!access[i.dataset.guestSetting];i.onchange=()=>{const next={...guestAccess(),[i.dataset.guestSetting]:i.checked};write(KEYS.guestAccess,next);applyRoleVisibility();renderHome();toast('게스트 공개 범위를 변경했습니다.')}})}
function applyRoleVisibility(){const s=session(),access=guestAccess();$('#notificationButton').hidden=s?.role==='guest';$('#festivalHomeSection').hidden=s?.role==='guest'&&!access.festivals;$$('[data-guest-nav]').forEach(b=>{b.hidden=s?.role==='guest'&&!access[b.dataset.guestNav]});const visible=$$('#bottomNav>button:not([hidden])').length;$('#bottomNav').classList.toggle('four',visible===4);$('#bottomNav').classList.toggle('three',visible===3)}
function notifications(){return read(KEYS.notifications,[])}
function saveNotifications(v){write(KEYS.notifications,v)}
function notifyEnabled(){return read(KEYS.notifyEnabled,true)}
async function toggleNotify(v){
  if(v&&'Notification'in window&&Notification.permission==='default'){
    const p=await Notification.requestPermission();if(p!=='granted')v=false;
  }
  write(KEYS.notifyEnabled,v);renderNotifications();toast(v?'앱 알림을 켰습니다.':'앱 알림을 껐습니다.');
}
function addNotification({title,body,type='event',audience='전체'}){
  const ns=notifications();ns.push({id:id(),title,body,type,audience,read:false,createdAt:Date.now()});saveNotifications(ns);
  if(notifyEnabled()&&navigator.vibrate)navigator.vibrate([70,40,90]);
  if(notifyEnabled()&&'Notification'in window&&Notification.permission==='granted')try{new Notification(title,{body,icon:'./icons/icon-192.png'})}catch{}
  renderNotifications();
}
function renderNotifications(){
  const ns=[...notifications()].reverse(),unread=ns.filter(n=>!n.read).length;
  $('#notificationBadge').hidden=!unread;$('#notificationBadge').textContent=unread>99?'99+':unread;
  $('#notificationList').innerHTML=ns.length?ns.map(n=>`<article class="notification-item ${n.read?'':'unread'}" data-notification="${n.id}"><div class="notification-symbol">${n.type==='notice'?'N':'!'}</div><div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notification-item-meta">${esc(n.audience)} · ${new Date(n.createdAt).toLocaleString('ko-KR')}</div></div></article>`).join(''):'<div class="notification-empty">새로운 알림이 없습니다.</div>';
  $('#notificationToggle').checked=notifyEnabled();$('#myNotificationStatus').textContent=notifyEnabled()?'켜짐':'꺼짐';
  $('#notificationSettingDescription').textContent=notifyEnabled()?'공지와 행사 알림을 받습니다.':'알림함에는 저장되지만 진동은 울리지 않습니다.';
  $$('[data-notification]').forEach(c=>c.addEventListener('click',()=>{saveNotifications(notifications().map(n=>n.id===c.dataset.notification?{...n,read:true}:n));renderNotifications()}));
}
function closeNotificationManageMenu(){$('#notificationManageMenu').hidden=true;$('#notificationManageButton').setAttribute('aria-expanded','false')}
$('#notificationButton').addEventListener('click',()=>{openOverlay('notificationCenter');saveNotifications(notifications().map(n=>({...n,read:true})));renderNotifications()});
$('#myNotificationButton').addEventListener('click',()=>openOverlay('notificationCenter'));
$('#notificationToggle').addEventListener('change',e=>toggleNotify(e.target.checked));
$('#notificationManageButton').addEventListener('click',()=>{const menu=$('#notificationManageMenu');menu.hidden=!menu.hidden;$('#notificationManageButton').setAttribute('aria-expanded',String(!menu.hidden))});
$('#markAllNotificationsRead').addEventListener('click',()=>{saveNotifications(notifications().map(n=>({...n,read:true})));renderNotifications();closeNotificationManageMenu();toast('모든 알림을 읽음 처리했습니다.')});
$('#deleteReadNotifications').addEventListener('click',()=>{const before=notifications(),next=before.filter(n=>!n.read);saveNotifications(next);renderNotifications();closeNotificationManageMenu();toast(before.length===next.length?'정리할 읽은 알림이 없습니다.':'읽은 알림을 정리했습니다.')});
$('#requestClearNotifications').addEventListener('click',()=>{closeNotificationManageMenu();openOverlay('notificationClearConfirm')});
$('#cancelClearNotifications').addEventListener('click',()=>closeOverlay('notificationClearConfirm'));
$('#confirmClearNotifications').addEventListener('click',()=>{saveNotifications([]);renderNotifications();closeOverlay('notificationClearConfirm');toast('알림함을 깨끗하게 비웠습니다.')});
$('#subscribeEvents').addEventListener('click',()=>toggleNotify(true));
function renderAdminToday(){
  const entry=currentTodayEntry(),progress=Math.round(progressForEntry(entry)),fallback={badge:'TODAY',title:'주요 일정 없음',summary:'오늘 등록된 주요 일정이 없습니다.'},t=entry||fallback;
  $('#adminTodayBadge').textContent=t.badge||'TODAY';$('#adminTodayTitle').textContent=t.title;$('#adminTodaySummary').textContent=t.summary;
  $('#adminTodayProgress').textContent=`${progress}%`;$('#adminTodayTime').textContent=entry?`${formatDate(entry.date)} · ${entry.startTime}–${entry.endTime}`:'오늘은 설정된 주요 일정이 없습니다.';
  const list=[...todaySchedules()].sort((a,b)=>a.date.localeCompare(b.date));
  $('#dailyScheduleList').innerHTML=list.length?list.map(x=>{const d=new Date(`${x.date}T00:00:00`);return `<article class="daily-schedule-item"><div class="daily-date-box"><b>${d.getDate()}</b><span>${d.getMonth()+1}월</span></div><div><h3>${esc(x.title)}</h3><p>${esc(x.badge||'TODAY')} · ${esc(x.startTime)}–${esc(x.endTime)}</p></div><button data-edit-today="${x.id}">관리</button></article>`}).join(''):'<div class="admin-empty">미리 등록한 날짜별 일정이 없습니다. 일정이 없는 날에는 자동으로 ‘주요 일정 없음’이 표시됩니다.</div>';
  $$('[data-edit-today]').forEach(b=>b.addEventListener('click',()=>openTodayEditor(b.dataset.editToday)));
}
function renderAdmin(){
  const fs=festivals(),rs=read(KEYS.reservations,[]);
  $('#adminReservationTotal').textContent=rs.length;$('#adminFestivalTotal').textContent=fs.filter(f=>f.visible).length;$('#adminNoticeCount').textContent=notices().length;
  renderAdminToday();
  $('#adminFestivalList').innerHTML=fs.length?fs.map(f=>`<article class="admin-festival-card"><div><span class="notice-category">${f.visible?'공개':'숨김'}${f.featured?' · 대표':''}</span><h3>${esc(f.name)} ${esc(f.year)}</h3><p>${formatDate(f.start)||'날짜 미정'} · 부스 ${(f.booths||[]).length} · 메뉴 ${(f.menus||[]).length} · 일정 ${(f.events||[]).length}</p></div><div class="item-actions"><button data-manage-festival="${f.id}">운영 관리</button><button data-toggle-festival="${f.id}">${f.visible?'숨기기':'공개하기'}</button><button class="danger" data-delete-festival="${f.id}">삭제</button></div></article>`).join(''):'<div class="admin-empty">축제를 새로 만들어주세요.</div>';
  $$('[data-manage-festival]').forEach(b=>b.addEventListener('click',()=>selectManagerFestival(b.dataset.manageFestival)));
  $$('[data-toggle-festival]').forEach(b=>b.addEventListener('click',()=>{saveFestivals(festivals().map(f=>f.id===b.dataset.toggleFestival?{...f,visible:!f.visible}:f));renderAdmin();renderHome();toast('축제 공개 상태를 변경했습니다.')}));
  $$('[data-delete-festival]').forEach(b=>b.addEventListener('click',()=>{saveFestivals(festivals().filter(f=>f.id!==b.dataset.deleteFestival));if(state.managerFestivalId===b.dataset.deleteFestival)state.managerFestivalId=null;renderAdmin();renderHome();toast('축제를 삭제했습니다.')}));
  renderAdminNotices();renderAdminCommunity();renderAdminStudents();renderGuestSettings();renderAdminReservations();if(state.managerFestivalId)selectManagerFestival(state.managerFestivalId,false);
}
function resetTodayEditor(){
  state.editingTodayId=null;$('#todayEditorTitle').textContent='날짜별 일정 추가';$('#todayEditDate').value=localDateKey();
  $('#todayEditStart').value='08:00';$('#todayEditEnd').value='17:00';$('#todayEditBadge').value='';$('#todayEditTitle').value='';$('#todayEditSummary').value='';$('#deleteTodayButton').hidden=true;
}
function openTodayEditor(entryId=null){
  resetTodayEditor();
  if(entryId){const t=todaySchedules().find(x=>x.id===entryId);if(!t)return;state.editingTodayId=entryId;$('#todayEditorTitle').textContent='날짜별 일정 수정';$('#todayEditDate').value=t.date;$('#todayEditStart').value=t.startTime;$('#todayEditEnd').value=t.endTime;$('#todayEditBadge').value=t.badge;$('#todayEditTitle').value=t.title;$('#todayEditSummary').value=t.summary;$('#deleteTodayButton').hidden=false}
  openOverlay('todayEditor');
}
$('#editTodayButton').addEventListener('click',()=>openTodayEditor());
$('#saveTodayButton').addEventListener('click',()=>{
  const p={date:$('#todayEditDate').value,startTime:$('#todayEditStart').value,endTime:$('#todayEditEnd').value,badge:$('#todayEditBadge').value.trim()||'TODAY',title:$('#todayEditTitle').value.trim(),summary:$('#todayEditSummary').value.trim()};
  if(!p.date||!p.title||!p.summary)return toast('날짜, 제목과 설명을 입력해주세요.');
  if(p.endTime<=p.startTime)return toast('종료 시간은 시작 시간보다 늦어야 합니다.');
  let list=todaySchedules();
  const duplicate=list.find(x=>x.date===p.date&&x.id!==state.editingTodayId);if(duplicate)return toast('해당 날짜에는 이미 일정이 등록되어 있습니다.');
  list=state.editingTodayId?list.map(x=>x.id===state.editingTodayId?{...x,...p}:x):[...list,{id:id(),...p}];
  saveTodaySchedules(list);closeOverlay('todayEditor');renderHome();renderAdmin();toast('날짜별 일정을 저장했습니다.');
});
$('#deleteTodayButton').addEventListener('click',()=>{if(!state.editingTodayId)return;saveTodaySchedules(todaySchedules().filter(x=>x.id!==state.editingTodayId));closeOverlay('todayEditor');renderHome();renderAdmin();toast('날짜별 일정을 삭제했습니다.')});
function resetFestivalEditor(){state.editingFestivalId=null;$('#festivalEditorTitle').textContent='새 축제 만들기';['festivalEditName','festivalEditYear','festivalEditShort','festivalEditTagline','festivalEditDescription','festivalEditStart','festivalEditEnd'].forEach(x=>$('#'+x).value='');$('#festivalEditColor').value='#ff6038';$('#festivalEditVisible').checked=true;$('#festivalEditFeatured').checked=false}
function openFestivalEditor(fid=null){resetFestivalEditor();if(fid){const f=festivals().find(x=>x.id===fid);state.editingFestivalId=fid;$('#festivalEditorTitle').textContent='축제 기본 정보 수정';$('#festivalEditName').value=f.name;$('#festivalEditYear').value=f.year;$('#festivalEditShort').value=f.short;$('#festivalEditTagline').value=f.tagline;$('#festivalEditDescription').value=f.description;$('#festivalEditStart').value=f.start;$('#festivalEditEnd').value=f.end;$('#festivalEditColor').value=f.color;$('#festivalEditVisible').checked=f.visible;$('#festivalEditFeatured').checked=f.featured}openOverlay('festivalEditor')}
$('#addFestivalButton').addEventListener('click',()=>openFestivalEditor());$('#editFestivalButton').addEventListener('click',()=>openFestivalEditor(state.managerFestivalId));$('#saveFestivalButton').addEventListener('click',()=>{const p={name:$('#festivalEditName').value.trim(),year:+$('#festivalEditYear').value||new Date().getFullYear(),short:$('#festivalEditShort').value.trim(),tagline:$('#festivalEditTagline').value.trim(),description:$('#festivalEditDescription').value.trim(),start:$('#festivalEditStart').value,end:$('#festivalEditEnd').value,color:$('#festivalEditColor').value,visible:$('#festivalEditVisible').checked,featured:$('#festivalEditFeatured').checked};if(!p.name)return toast('축제 이름을 입력해주세요.');let fs=festivals();if(p.featured)fs=fs.map(f=>({...f,featured:false}));if(state.editingFestivalId)fs=fs.map(f=>f.id===state.editingFestivalId?{...f,...p}:f);else{const n={id:id(),...p,booths:[],menus:[],events:[]};fs.push(n);state.managerFestivalId=n.id}saveFestivals(fs);closeOverlay('festivalEditor');renderAdmin();renderHome();toast('축제를 저장했습니다.')});
function selectManagerFestival(fid,scroll=true){state.managerFestivalId=fid;const f=festivals().find(x=>x.id===fid);if(!f){$('#festivalManager').hidden=true;return}$('#festivalManager').hidden=false;$('#managerFestivalTitle').textContent=`${f.name} 운영 관리`;$('#managerFestivalMeta').textContent=`${f.year} · ${f.visible?'학생 공개':'학생 숨김'} · ${formatDate(f.start)}`;$('#managerFestivalStatus').textContent=f.featured?'대표 축제':'관리 중';renderManagerLists();if(scroll)$('#festivalManager').scrollIntoView({behavior:'smooth',block:'start'})}
$$('#managerTabs button').forEach(b=>b.addEventListener('click',()=>{$$('#managerTabs button').forEach(x=>x.classList.toggle('active',x===b));$$('.manager-panel').forEach(p=>p.classList.toggle('active',p.dataset.managerPanel===b.dataset.managerTab))}));
function managerFestival(){return festivals().find(f=>f.id===state.managerFestivalId)}function updateManagerFestival(mutator){saveFestivals(festivals().map(f=>f.id===state.managerFestivalId?mutator(f):f));renderAdmin();renderHome();if(state.currentFestivalId===state.managerFestivalId)renderFestival()}
function renderManagerLists(){const f=managerFestival();if(!f)return;f.booths=f.booths||[];f.menus=f.menus||[];f.events=f.events||[];$('#adminBoothList').innerHTML=f.booths.length?f.booths.map(b=>`<article class="manager-item"><div><span class="notice-category">${b.times?.length?`${b.times.length}개 시간`:'즉시 예약'}</span><h3>${esc(b.name)}</h3><p>${esc(b.location)} · 정원 ${b.capacity}명 · ${b.duration}분</p></div><div class="item-actions"><button data-edit-booth="${b.id}">수정</button><button class="danger" data-delete-booth="${b.id}">삭제</button></div></article>`).join(''):'<div class="manager-empty">등록된 부스가 없습니다.</div>';$('#adminMenuList').innerHTML=f.menus.length?f.menus.map(m=>`<article class="manager-item"><div><span class="notice-category">${esc(m.category)}</span><h3>${esc(m.name)} · ${Number(m.price).toLocaleString()}원</h3><p>${esc(m.seller)} · ${esc(m.location)}</p></div><div class="item-actions"><button data-edit-menu="${m.id}">수정</button><button class="danger" data-delete-menu="${m.id}">삭제</button></div></article>`).join(''):'<div class="manager-empty">등록된 메뉴가 없습니다.</div>';$('#adminEventList').innerHTML=f.events.length?f.events.map(e=>`<article class="manager-item"><div><span class="notice-category">${formatDate(e.date)} ${esc(e.time)}</span><h3>${esc(e.name)}</h3><p>${esc(e.location)} · ${esc(e.description)}</p></div><div class="item-actions"><button data-edit-event="${e.id}">수정</button><button class="danger" data-delete-event="${e.id}">삭제</button></div></article>`).join(''):'<div class="manager-empty">등록된 일정이 없습니다.</div>';$$('[data-edit-booth]').forEach(b=>b.addEventListener('click',()=>openBoothEditor(b.dataset.editBooth)));$$('[data-delete-booth]').forEach(b=>b.addEventListener('click',()=>updateManagerFestival(f=>({...f,booths:f.booths.filter(x=>x.id!==b.dataset.deleteBooth)}))));$$('[data-edit-menu]').forEach(b=>b.addEventListener('click',()=>openMenuEditor(b.dataset.editMenu)));$$('[data-delete-menu]').forEach(b=>b.addEventListener('click',()=>updateManagerFestival(f=>({...f,menus:f.menus.filter(x=>x.id!==b.dataset.deleteMenu)}))));$$('[data-edit-event]').forEach(b=>b.addEventListener('click',()=>openEventEditor(b.dataset.editEvent)));$$('[data-delete-event]').forEach(b=>b.addEventListener('click',()=>updateManagerFestival(f=>({...f,events:f.events.filter(x=>x.id!==b.dataset.deleteEvent)}))))}
function previewImage(type,data){state.pendingImage[type]=data||'';const p=$(`#${type}ImagePreview`),i=$(`#${type}ImagePreviewImg`);if(data){i.src=data;p.hidden=false}else{p.hidden=true;i.removeAttribute('src')}}async function compressImage(file){if(!file?.type.startsWith('image/'))throw Error('이미지 파일을 선택해주세요.');const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});const scale=Math.min(1,1200/img.width,900/img.height),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8)}
['notice','booth','menu'].forEach(type=>{$(`#${type}Image`).addEventListener('change',async e=>{try{previewImage(type,await compressImage(e.target.files[0]));toast('사진을 추가했습니다.')}catch(err){toast(err.message)}});$(`#remove${type[0].toUpperCase()+type.slice(1)}Image`).addEventListener('click',()=>previewImage(type,''))});
function openBoothEditor(bid=null){const f=managerFestival();state.editingBoothId=bid;state.pendingImage.booth='';$('#boothEditorTitle').textContent=bid?'체험 부스 수정':'체험 부스 추가';['boothName','boothOwner','boothLocation','boothDescription','boothTimes','boothImage'].forEach(x=>$('#'+x).value='');$('#boothCapacity').value=5;$('#boothDuration').value=15;previewImage('booth','');if(bid){const b=f.booths.find(x=>x.id===bid);$('#boothName').value=b.name;$('#boothOwner').value=b.owner;$('#boothLocation').value=b.location;$('#boothDescription').value=b.description;$('#boothCapacity').value=b.capacity;$('#boothDuration').value=b.duration;$('#boothTimes').value=(b.times||[]).join(', ');previewImage('booth',b.image)}openOverlay('boothEditor')}
$('#addBoothButton').addEventListener('click',()=>openBoothEditor());$('#saveBoothButton').addEventListener('click',()=>{const p={name:$('#boothName').value.trim(),owner:$('#boothOwner').value.trim(),location:$('#boothLocation').value.trim(),description:$('#boothDescription').value.trim(),capacity:+$('#boothCapacity').value||1,duration:+$('#boothDuration').value||1,times:$('#boothTimes').value.split(/[,\n]/).map(x=>x.trim()).filter(Boolean),image:state.pendingImage.booth};if(!p.name)return toast('부스 이름을 입력해주세요.');updateManagerFestival(f=>({...f,booths:state.editingBoothId?f.booths.map(b=>b.id===state.editingBoothId?{...b,...p}:b):[...f.booths,{id:id(),...p}]}));closeOverlay('boothEditor');toast(p.times.length?'시간 예약 부스로 저장했습니다.':'즉시 예약 부스로 저장했습니다.')});
function openMenuEditor(mid=null){const f=managerFestival();state.editingMenuId=mid;['menuName','menuSeller','menuLocation','menuPrice','menuImage'].forEach(x=>$('#'+x).value='');$('#menuCategory').value='식사';previewImage('menu','');$('#menuEditorTitle').textContent=mid?'메뉴 수정':'메뉴 추가';if(mid){const m=f.menus.find(x=>x.id===mid);$('#menuName').value=m.name;$('#menuSeller').value=m.seller;$('#menuLocation').value=m.location;$('#menuPrice').value=m.price;$('#menuCategory').value=m.category;previewImage('menu',m.image)}openOverlay('menuEditor')}
$('#addMenuButton').addEventListener('click',()=>openMenuEditor());$('#saveMenuButton').addEventListener('click',()=>{const p={name:$('#menuName').value.trim(),seller:$('#menuSeller').value.trim(),location:$('#menuLocation').value.trim(),price:+$('#menuPrice').value||0,category:$('#menuCategory').value,image:state.pendingImage.menu};if(!p.name)return toast('메뉴 이름을 입력해주세요.');updateManagerFestival(f=>({...f,menus:state.editingMenuId?f.menus.map(m=>m.id===state.editingMenuId?{...m,...p}:m):[...f.menus,{id:id(),...p}]}));closeOverlay('menuEditor');toast('메뉴를 저장했습니다.')});
function openEventEditor(eid=null){const f=managerFestival();state.editingEventId=eid;['eventName','eventDate','eventTime','eventLocation','eventDescription'].forEach(x=>$('#'+x).value='');$('#eventEditorTitle').textContent=eid?'행사 일정 수정':'행사 일정 추가';if(eid){const e=f.events.find(x=>x.id===eid);$('#eventName').value=e.name;$('#eventDate').value=e.date;$('#eventTime').value=e.time;$('#eventLocation').value=e.location;$('#eventDescription').value=e.description}openOverlay('eventEditor')}
$('#addEventButton').addEventListener('click',()=>openEventEditor());$('#saveEventButton').addEventListener('click',()=>{const p={name:$('#eventName').value.trim(),date:$('#eventDate').value,time:$('#eventTime').value,location:$('#eventLocation').value.trim(),description:$('#eventDescription').value.trim()};if(!p.name)return toast('행사 이름을 입력해주세요.');updateManagerFestival(f=>({...f,events:state.editingEventId?f.events.map(e=>e.id===state.editingEventId?{...e,...p}:e):[...f.events,{id:id(),...p}]}));closeOverlay('eventEditor');toast('행사 일정을 저장했습니다.')});
function renderAdminNotices(){const ns=notices();$('#adminNoticeList').innerHTML=ns.length?ns.map(n=>`<article class="admin-notice-card"><div><span class="notice-category">${esc(n.category)} · ${esc(n.audience)}</span><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p></div><div class="item-actions"><button data-view-notice="${n.id}">상세</button><button data-edit-notice="${n.id}">수정</button><button class="danger" data-delete-notice="${n.id}">삭제</button></div></article>`).join(''):'<div class="admin-empty">공지 없음</div>';$$('[data-view-notice]').forEach(b=>b.addEventListener('click',()=>openNoticeDetail(b.dataset.viewNotice)));$$('[data-edit-notice]').forEach(b=>b.addEventListener('click',()=>openNoticeEditor(b.dataset.editNotice)));$$('[data-delete-notice]').forEach(b=>b.addEventListener('click',()=>{saveNotices(notices().filter(n=>n.id!==b.dataset.deleteNotice));renderAdmin();renderHome()}))}
function renderAdminReservations(){const rs=[...read(KEYS.reservations,[])].reverse();$('#adminReservationList').innerHTML=rs.length?rs.map(r=>`<div class="admin-row"><div><b>${esc(r.festivalName)} · ${esc(r.boothName)}</b><small>${esc(r.user)}</small></div><span>${esc(r.time)}</span><small>${new Date(r.createdAt).toLocaleString('ko-KR')}</small></div>`).join(''):'<div class="admin-empty">아직 예약이 없습니다.</div>'}
$('#clearReservations').addEventListener('click',()=>{write(KEYS.reservations,[]);renderAdmin();toast('예약 명단을 초기화했습니다.')});$('#downloadAdminCsv').addEventListener('click',()=>{const rs=read(KEYS.reservations,[]),csv=['축제,부스,예약자,시간,등록시각',...rs.map(r=>`${r.festivalName},${r.boothName},${r.user},${r.time},${new Date(r.createdAt).toLocaleString('ko-KR')}`)].join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='baemoon-reservations.csv';a.click();URL.revokeObjectURL(url)});
$('#eventControlButton').addEventListener('click',()=>openOverlay('alertComposer'));$('#sendAlertButton').addEventListener('click',()=>{const title=$('#alertTitle').value.trim(),body=$('#alertBody').value.trim();if(!title||!body)return toast('제목과 내용을 입력해주세요.');addNotification({title,body,audience:$('#alertAudience').value,type:'event'});closeOverlay('alertComposer');$('#alertTitle').value='';$('#alertBody').value='';toast('알림함에 메시지를 보냈습니다.')});
$('#previewStudentHome').addEventListener('click',()=>route('home',{preview:true}));$('#adminLogout').addEventListener('click',logoutToWelcome);
$('#findRoute').addEventListener('click',()=>{$('#routeResult').innerHTML=`<span class="route-number">1</span><div><b>${esc($('#routeStart').value)} → ${esc($('#routeEnd').value)}</b><small>추천 경로를 지도에 표시했습니다.</small></div>`;toast('경로를 찾았습니다.')});$$('#floorTabs button').forEach(b=>b.addEventListener('click',()=>{$$('#floorTabs button').forEach(x=>x.classList.toggle('active',x===b));$('#floorTitle').textContent=`${b.dataset.floor}층 안내도`}));
function bindZoomables(){$$('.zoomable-image').forEach(el=>{el.onclick=()=>{const src=el.tagName==='IMG'?el.src:el.dataset.image;if(!src)return;$('#lightboxImage').src=src;openOverlay('imageLightbox')}})}
seed();
populateStudentSelectors();
state.lastDayKey=localDateKey();
showAuthGate();

window.baemoonApp={
  state,
  session,
  enterApp,
  showAuthGate,
  renderHome,
  renderMy,
  renderCommunity,
  renderAdmin,
  renderAdminCommunity,
  renderAdminStudents,
  openCommunityDetail,
  openOverlay,
  closeOverlay,
  closeAllOverlays,
  toast,
  studentKey,
  studentDisplayId,
  setSession(value){write(KEYS.session,value)},
  clearSession(){localStorage.removeItem(KEYS.session)}
};

setInterval(()=>{
  const key=localDateKey();
  if(key!==state.lastDayKey){
    state.lastDayKey=key;
    renderHome();
    if(isAdmin())renderAdmin();
  }else{
    renderTodayCard();
    if(isAdmin()&&state.screen==='admin')renderAdminToday();
  }
},30000);

if('serviceWorker'in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}