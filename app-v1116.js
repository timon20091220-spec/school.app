const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const KEYS={session:'bm_session_v5',today:'bm_today_v5',festivals:'bm_festivals_v5',notices:'bm_notices_v5',notifications:'bm_notifications_v5',notifyEnabled:'bm_notify_enabled_v5',reservations:'bm_reservations_v5',migration:'bm_migration_v6',community:'bm_community_v7',reports:'bm_reports_v7',accounts:'bm_accounts_v7',guestAccess:'bm_guest_access_v7',meals:'bm_meals_v10'};
const state={screen:'home',loginRole:'student',currentFestivalId:null,managerFestivalId:null,editingFestivalId:null,editingBoothId:null,editingMenuId:null,editingRestaurantId:null,editingFoodItemId:null,foodRestaurantId:null,editingEventId:null,editingNoticeId:null,editingTodayId:null,editingMealId:null,adminDirty:false,lastDayKey:null,pendingImage:{notice:'',booth:'',menu:'',community:''},reservationBoothId:null,currentReservationId:null,messageReservationId:null,communityCategory:'전체',communitySearch:'',currentPostId:null,pendingStudentSession:null,deferredPrompt:null};
const read=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}};const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));const id=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove('show'),2200)}
function firebaseFriendlyMessage(error){
  const code=String(error?.code||'');
  const text=String(error?.message||'');
  if(code.includes('permission-denied')||text.includes('permission-denied'))return 'Firestore 규칙이 최신 버전인지 확인해주세요.';
  if(code.includes('unavailable')||code.includes('network')||text.includes('network'))return '인터넷 연결 또는 Firebase 접속 상태를 확인해주세요.';
  if(code.includes('resource-exhausted')||text.includes('larger than')||text.includes('maximum size'))return '축제 사진이 많아 Firestore 문서 용량을 초과했습니다.';
  return text||'알 수 없는 Firebase 오류가 발생했습니다.';
}
function setFirebaseStatus(status,title,detail){
  const dot=$('#firebaseSyncDot'),titleEl=$('#firebaseSyncTitle'),detailEl=$('#firebaseSyncDetail');
  if(!dot||!titleEl||!detailEl)return;
  dot.className=`firebase-sync-dot ${status}`;
  titleEl.textContent=title;
  detailEl.textContent=detail;
}
function markAdminDirty(message='저장하지 않은 관리자 변경사항이 있습니다.'){
  state.adminDirty=true;
  const el=$('#adminSaveState');
  if(el){el.className='admin-save-state';el.textContent=message}
}
function markAdminSaved(message='모든 관리자 변경사항이 Firebase에 저장되었습니다.'){
  state.adminDirty=false;
  const el=$('#adminSaveState');
  if(el){el.className='admin-save-state success';el.textContent=message}
}
function markAdminSaveError(message){
  const el=$('#adminSaveState');
  if(el){el.className='admin-save-state error';el.textContent=message}
}
function session(){return read(KEYS.session,null)}function isAdmin(){return session()?.role==='admin'}function isStudent(){return session()?.role==='student'}function isGuest(){return session()?.role==='guest'}
function openOverlay(id){document.getElementById(id).classList.add('open')}function closeOverlay(id){document.getElementById(id).classList.remove('open')}
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeOverlay(b.dataset.close)));$$('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o&&o.id!=='passwordChangeModal')o.classList.remove('open')}));
function formatDate(d){if(!d)return'';return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${d}T00:00:00`))}function dday(d){if(!d)return'';const t=new Date(`${d}T00:00:00`);const n=new Date();n.setHours(0,0,0,0);const x=Math.ceil((t-n)/86400000);return x>0?`D-${x}`:x===0?'D-DAY':`D+${Math.abs(x)}`}
function guestAccess(){
  const value=window.firebaseCache?.guestAccess??read(KEYS.guestAccess,{festivals:true,meals:false});
  return {festivals:value?.festivals!==false,meals:value?.meals===true};
}
function renderGuestSettings(){
  const access=guestAccess();
  $$('[data-guest-setting]').forEach(input=>{
    input.checked=!!access[input.dataset.guestSetting];
    input.onchange=async()=>{
      const previous=!input.checked;
      const next={...guestAccess(),[input.dataset.guestSetting]:input.checked};
      try{
        if(!window.baemoonFirebase?.saveGuestAccess){
          throw new Error('Firebase 관리자 기능을 아직 불러오는 중입니다.');
        }
        await window.baemoonFirebase.saveGuestAccess(next);
        if(window.firebaseCache)window.firebaseCache.guestAccess=next;
        write(KEYS.guestAccess,next);
        markAdminSaved('게스트 공개 범위가 Firebase에 저장되었습니다.');
        applyRoleVisibility();
        renderHome();
        toast('게스트 공개 범위를 저장했습니다.');
      }catch(error){
        input.checked=previous;
        toast(firebaseFriendlyMessage(error));
      }
    };
  });
}
function applyRoleVisibility(){
  const guest=isGuest();
  const access=guestAccess();

  const todayHeading=$('#todayHomeHeading');
  const todayCard=$('#todayCard');
  const mealSection=$('#mealHomeSection');
  const festivalSection=$('#festivalHomeSection');
  const noticeSection=$('#schoolNoticeSection');

  if(todayHeading)todayHeading.hidden=guest;
  if(todayCard)todayCard.hidden=guest;
  if(mealSection)mealSection.hidden=guest&&!access.meals;
  if(festivalSection)festivalSection.hidden=guest&&!access.festivals;
  if(noticeSection)noticeSection.hidden=guest;

  $$('[data-guest-nav="guide"],[data-guest-nav="community"]').forEach(button=>{
    button.hidden=guest;
  });
  $$('[data-guest-nav="festivals"]').forEach(button=>{
    button.hidden=guest&&!access.festivals;
  });

  if(guest&&(state.screen==='guide'||state.screen==='community')){
    state.screen='home';
    $$('.screen').forEach(screen=>screen.classList.toggle('active',screen.dataset.screen==='home'));
    $$('#bottomNav [data-go]').forEach(button=>button.classList.toggle('active',button.dataset.go==='home'));
  }
}
function imageSrc(value){if(!value)return'';if(String(value).startsWith('media://'))return window.firebaseCache?.media?.[String(value).slice(8)]?.dataUrl||'';return value}
function route(screen,opts={}){
  if(!session()){showAuthGate();return}
  if(isAdmin()&&screen==='home'&&!opts.preview)screen='admin';
  const access=guestAccess();
  if(isGuest()&&(screen==='guide'||screen==='community')){
    toast('학교 내부 메뉴는 학생만 이용할 수 있습니다.');
    screen='home';
  }
  if(isGuest()&&screen==='festival'&&!access.festivals){
    toast('현재 게스트에게 축제가 공개되지 않았습니다.');
    screen='home';
  }
  state.screen=screen;$$('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===screen));$$('#bottomNav [data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===screen));
  $('#appShell').classList.toggle('admin-mode',screen==='admin'&&isAdmin());
  if(screen==='admin')renderAdmin();if(screen==='festival')renderFestival();if(screen==='community')renderCommunity();if(screen==='my')renderMy();
  applyRoleVisibility();window.scrollTo({top:0,behavior:'smooth'})
}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.go)));$('#brandButton').addEventListener('click',()=>route('home'));
let serviceWorkerRegistrationPromise=null;
function ensureServiceWorker(){
  if(!('serviceWorker'in navigator))return Promise.resolve(null);
  if(!serviceWorkerRegistrationPromise){
    serviceWorkerRegistrationPromise=navigator.serviceWorker
      .register('./sw-v1116.js',{scope:'./',updateViaCache:'none'})
      .then(async registration=>{
        try{await registration.update()}catch{}
        return navigator.serviceWorker.ready;
      })
      .catch(error=>{
        console.error('Service worker registration failed:',error);
        return null;
      });
  }
  return serviceWorkerRegistrationPromise;
}
ensureServiceWorker();

function isInstalledPwa(){
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone===true;
}
function setInstallButtonsReady(ready){
  ['#installButton','#authInstallButton'].forEach(selector=>{
    const button=$(selector);
    if(!button)return;
    button.classList.toggle('install-ready',ready);
    button.disabled=false;
  });
}
function showInstallFallback(){
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari=/safari/i.test(navigator.userAgent)&&!/chrome|crios|android|edg/i.test(navigator.userAgent);
  $('#installHelpText').textContent=isIOS||isSafari
    ?'Safari의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하면 일반 앱처럼 설치됩니다.'
    :'주소창의 설치 아이콘 또는 브라우저 메뉴의 ‘앱 설치’를 선택해주세요. 설치 조건이 준비되면 이 버튼에서 설치창이 바로 열립니다.';
  openOverlay('installHelpModal');
}
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  state.deferredPrompt=event;
  setInstallButtonsReady(true);
});
window.addEventListener('appinstalled',()=>{
  state.deferredPrompt=null;
  ['#installButton','#authInstallButton'].forEach(selector=>{
    const button=$(selector);
    if(button)button.hidden=true;
  });
  toast('배문고 앱이 설치되었습니다.');
});
async function triggerPwaInstall(){
  if(isInstalledPwa()){
    toast('이미 배문고 앱으로 설치되어 있습니다.');
    return;
  }

  const buttons=['#installButton','#authInstallButton'].map(selector=>$(selector)).filter(Boolean);
  buttons.forEach(button=>{
    button.disabled=true;
    button.classList.add('install-waiting');
  });

  try{
    await ensureServiceWorker();
    const promptEvent=state.deferredPrompt;
    if(!promptEvent){
      showInstallFallback();
      return;
    }

    await promptEvent.prompt();
    const result=await promptEvent.userChoice;
    if(result.outcome==='accepted')toast('앱 설치를 시작했습니다.');
    state.deferredPrompt=null;
    setInstallButtonsReady(false);
  }catch(error){
    console.error('PWA install failed:',error);
    showInstallFallback();
  }finally{
    buttons.forEach(button=>{
      button.disabled=false;
      button.classList.remove('install-waiting');
    });
  }
}
$('#installButton').addEventListener('click',triggerPwaInstall);
$('#authInstallButton').addEventListener('click',triggerPwaInstall);
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
  const cleaned=read(KEYS.festivals,[]).map(f=>({...f,
    booths:(f.booths||[]).filter(x=>!demoBooths.has(x.name)),
    menus:(f.menus||[]).filter(x=>!demoMenus.has(x.name)),
    events:(f.events||[]).filter(x=>!demoEvents.has(x.name))
  }));
  write(KEYS.festivals,cleaned);
  write(KEYS.migration,true);
}
function seed(){
  if(!localStorage.getItem(KEYS.today))write(KEYS.today,[]);
  if(!localStorage.getItem(KEYS.festivals)){
    write(KEYS.festivals,[{id:id(),name:'연봉제',year:new Date().getFullYear(),short:'YEONBONG',tagline:'학교 전체가 하나의 무대가 되는 날.',description:'관리자가 등록한 부스, 먹거리와 행사 일정을 확인하세요.',start:'',end:'',color:'#ff6038',visible:true,featured:true,booths:[],menus:[],foodVendors:[],events:[]}]);
  }
  if(!localStorage.getItem(KEYS.notices)){
    const d=new Date();d.setDate(d.getDate()+18);
    write(KEYS.notices,[{id:id(),category:'시험',audience:'2학년',title:'2학기 기말고사 안내',summary:'시험 시간표와 과목별 범위가 등록되었습니다.',body:'2학기 기말고사 시간표와 과목별 시험 범위를 확인해주세요.\n\n변경 사항이 생기면 이 공지를 통해 다시 안내합니다.',eventDate:localDateKey(d),pinned:true,image:'',createdAt:Date.now()}]);
  }
  if(!localStorage.getItem(KEYS.notifications))write(KEYS.notifications,[]);
  if(!localStorage.getItem(KEYS.reservations))write(KEYS.reservations,[]);
  if(!localStorage.getItem(KEYS.notifyEnabled))write(KEYS.notifyEnabled,true);
  if(!localStorage.getItem(KEYS.accounts))write(KEYS.accounts,[]);
  if(!localStorage.getItem(KEYS.guestAccess))write(KEYS.guestAccess,{festivals:true,meals:false});
  if(!localStorage.getItem(KEYS.reports))write(KEYS.reports,[]);if(!localStorage.getItem(KEYS.meals))write(KEYS.meals,[]);
  if(!localStorage.getItem(KEYS.community))write(KEYS.community,[{id:id(),category:'공지',title:'배문 커뮤니티 이용 안내',body:'서로를 존중하고 개인정보가 드러나는 글은 작성하지 말아주세요. 신고된 게시글은 관리자가 확인합니다.',image:'',authorKey:'admin',authorName:'관리자',authorGrade:0,anonymous:false,pinned:true,hidden:false,likes:[],comments:[],reportCount:0,createdAt:Date.now()}]);
  migrateV6();
}
function festivals(){return window.firebaseCache?.festivals??[]}
async function saveFestivals(v){
  if(!isAdmin()||!window.baemoonFirebase?.saveFestivals)throw new Error('Firebase 관리자 연결이 준비되지 않았습니다.');
  setFirebaseStatus('saving','Firebase에 저장 중','축제 변경 내용을 서버에 전송하고 있습니다.');
  try{
    const saved=await window.baemoonFirebase.saveFestivals(v);
    write(KEYS.festivals,saved);
    if(window.firebaseCache)window.firebaseCache.festivals=saved;
    setFirebaseStatus('connected','Firebase 연결됨','축제 변경 내용이 서버에 저장되었습니다.');
    return true;
  }catch(error){
    setFirebaseStatus('error','Firebase 저장 실패',firebaseFriendlyMessage(error));
    throw error;
  }
}function normalizeFoodVendors(festival){
  if(Array.isArray(festival?.foodVendors)){
    return festival.foodVendors.map(vendor=>({
      ...vendor,
      foods:Array.isArray(vendor.foods)?vendor.foods:[]
    }));
  }

  const groups=new Map();
  for(const legacy of festival?.menus||[]){
    const restaurantName=legacy.seller||'축제 먹거리';
    const location=legacy.location||'위치 미정';
    const key=`${restaurantName}__${location}`;
    if(!groups.has(key)){
      groups.set(key,{
        id:`legacy-${key.replace(/[^a-zA-Z0-9가-힣]/g,'-')}`,
        name:restaurantName,
        operator:legacy.seller||'',
        location,
        foods:[]
      });
    }
    groups.get(key).foods.push({
      id:legacy.id||id(),
      name:legacy.name||'메뉴',
      price:Number(legacy.price||0),
      category:legacy.category||'식사',
      description:legacy.description||'',
      image:legacy.image||''
    });
  }
  return [...groups.values()];
}
function totalFoodItems(festival){
  return normalizeFoodVendors(festival).reduce((sum,vendor)=>sum+vendor.foods.length,0);
}
function selectedFestival(){const fs=festivals();return fs.find(f=>f.id===state.currentFestivalId)||fs.find(f=>f.featured&&f.visible)||fs.find(f=>f.visible)||null}

function meals(){return window.firebaseCache?.meals??[]}
async function saveMeals(v){
  if(!isAdmin()||!window.baemoonFirebase?.saveMeals)throw new Error('Firebase 관리자 연결이 준비되지 않았습니다.');
  setFirebaseStatus('saving','Firebase에 저장 중','급식 변경 내용을 서버에 전송하고 있습니다.');
  try{
    const saved=await window.baemoonFirebase.saveMeals(v);
    write(KEYS.meals,saved);
    if(window.firebaseCache)window.firebaseCache.meals=saved;
    setFirebaseStatus('connected','Firebase 연결됨','급식 변경 내용이 서버에 저장되었습니다.');
    return true;
  }catch(error){
    setFirebaseStatus('error','Firebase 저장 실패',firebaseFriendlyMessage(error));
    throw error;
  }
}
function currentMeal(){return meals().find(m=>m.date===localDateKey())||null}
function renderMealCard(){
  if(isGuest()&&!guestAccess().meals){
    $('#mealHomeSection').hidden=true;
    return;
  }
  $('#mealHomeSection').hidden=false;
  const meal=currentMeal();
  $('#mealDateChip').textContent=new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',weekday:'short'}).format(new Date());
  if(!meal){
    $('#mealServingTime').textContent='중식';
    $('#mealStatus').textContent='정보 없음';
    $('#mealTitle').textContent='급식 정보가 없습니다.';
    $('#mealMenuList').innerHTML='<span>관리자가 오늘의 급식을 등록하면 여기에 표시됩니다.</span>';
    $('#mealNote').textContent='';
    return;
  }
  $('#mealServingTime').textContent=meal.type||'중식';
  $('#mealStatus').textContent=meal.time||'제공 시간 확인';
  $('#mealTitle').textContent=`${meal.date} 급식`;
  $('#mealMenuList').innerHTML=(meal.menus||[]).length
    ?meal.menus.map(menu=>`<span>${esc(menu)}</span>`).join('')
    :'<span>등록된 메뉴가 없습니다.</span>';
  $('#mealNote').textContent=meal.note||'';
}
function renderAdminMeals(){
  const today=currentMeal();
  $('#adminMealStatus').textContent=today?'등록됨':'미등록';
  $('#adminMealTitle').textContent=today?`${today.type||'중식'} · ${(today.menus||[]).slice(0,2).join(', ')}`:'급식 정보가 없습니다.';
  $('#adminMealSummary').textContent=today?(today.menus||[]).join(' · '):'오늘 등록된 메뉴가 없습니다.';
  $('#adminMealMeta').textContent=today?`${today.date} · ${today.time||'시간 미정'}`:'날짜별로 미리 등록할 수 있습니다.';
  const list=[...meals()].sort((a,b)=>a.date.localeCompare(b.date));
  $('#adminMealList').innerHTML=list.length?list.map(m=>{
    const date=new Date(`${m.date}T00:00:00`);
    return `<article class="daily-schedule-item"><div class="daily-date-box"><b>${date.getDate()}</b><span>${date.getMonth()+1}월</span></div><div><h3>${esc(m.type||'중식')} · ${esc((m.menus||[]).slice(0,2).join(', ')||'메뉴 미등록')}</h3><p>${esc(m.time||'시간 미정')} · ${(m.menus||[]).length}개 메뉴</p></div><button data-edit-meal="${m.id}">관리</button></article>`;
  }).join(''):'<div class="admin-empty">등록된 급식 일정이 없습니다.</div>';
  $$('[data-edit-meal]').forEach(button=>button.addEventListener('click',()=>openMealEditor(button.dataset.editMeal)));
}
function resetMealEditor(){
  state.editingMealId=null;
  $('#mealEditorTitle').textContent='날짜별 급식 추가';
  $('#mealEditDate').value=localDateKey();
  $('#mealEditType').value='중식';
  $('#mealEditTime').value='12:10–13:10';
  $('#mealEditMenus').value='';
  $('#mealEditNote').value='';
  $('#deleteMealButton').hidden=true;
}
function openMealEditor(mealId=null){
  resetMealEditor();
  if(mealId){
    const meal=meals().find(item=>item.id===mealId);
    if(!meal)return;
    state.editingMealId=mealId;
    $('#mealEditorTitle').textContent='급식 정보 수정';
    $('#mealEditDate').value=meal.date;
    $('#mealEditType').value=meal.type||'중식';
    $('#mealEditTime').value=meal.time||'';
    $('#mealEditMenus').value=(meal.menus||[]).join('\\n');
    $('#mealEditNote').value=meal.note||'';
    $('#deleteMealButton').hidden=false;
  }
  openOverlay('mealEditor');
}

function todaySchedules(){const v=window.firebaseCache?.dailySchedules??[];return Array.isArray(v)?v:[]}
async function saveTodaySchedules(v){
  if(!isAdmin()||!window.baemoonFirebase?.saveDailySchedules)throw new Error('Firebase 관리자 연결이 준비되지 않았습니다.');
  const saved=await window.baemoonFirebase.saveDailySchedules(v);
  write(KEYS.today,saved);if(window.firebaseCache)window.firebaseCache.dailySchedules=saved;
  markAdminSaved('오늘의 배문이 Firebase에 저장되었습니다.');return saved;
}
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
  renderTodayCard();
  renderMealCard();
  const fs=(isGuest()&&!access.festivals)?[]:festivals().filter(f=>f.visible);
  $('#festivalHomeCount').textContent=`${fs.length}개`;
  $('#festivalHomeList').innerHTML=fs.length?fs.map(f=>`<button class="festival-home-card" data-open-festival="${f.id}" style="background:linear-gradient(135deg,${f.color},#111827)"><div class="festival-card-top"><span class="card-tag">${dday(f.start)||'FESTIVAL'}</span><b>${esc(f.year)}</b></div><h3>${esc(f.name)}</h3><p>${esc(f.tagline)}</p></button>`).join(''):'<div class="festival-empty">관리자가 공개한 축제가 없습니다.</div>';
  $$('[data-open-festival]').forEach(b=>b.addEventListener('click',()=>{state.currentFestivalId=b.dataset.openFestival;route('festival')}));
  renderHomeReservations();renderNotices();updateFestivalNav();applyRoleVisibility();
}
function updateFestivalNav(){const f=festivals().find(x=>x.featured&&x.visible)||festivals().find(x=>x.visible);const b=$('#festivalNavButton');if(!f){b.style.setProperty('display','none','important');$('#bottomNav').classList.add('three')}else{b.style.removeProperty('display');$('#bottomNav').classList.remove('three');$('#festivalNavLabel').textContent=f.name;$('#festivalNavIcon').textContent=f.name.slice(0,1);b.onclick=()=>{state.currentFestivalId=f.id;route('festival')}}}
function renderFestival(){
  const festival=selectedFestival();
  if(!festival){toast('공개된 축제가 없습니다.');route('home');return}
  state.currentFestivalId=festival.id;
  $('#festivalHero').style.setProperty('--festival-color',festival.color||'#ff6038');
  $('#festivalKicker').textContent=`BAEMOON FESTIVAL ${festival.year||''}`;
  $('#festivalTitle').textContent=festival.name;
  $('#festivalTagline').textContent=festival.tagline||'';
  $('#festivalBadgeText').textContent=(festival.short||festival.name).toUpperCase();
  $('#festivalYearBadge').textContent=String(festival.year||'').slice(-2);
  $('#festivalDday').textContent=dday(festival.start)||'FESTIVAL';
  $('#festivalOverviewTitle').textContent=`${festival.name} 안내`;
  $('#festivalDescription').textContent=festival.description||'';
  $('#festivalBoothCount').textContent=(festival.booths||[]).length;
  $('#festivalMenuCount').textContent=totalFoodItems(festival);
  $('#festivalEventCount').textContent=(festival.events||[]).length;
  renderBooths(festival);
  renderMenus(festival);
  renderEvents(festival);
}
$$('#festivalTabs button').forEach(b=>b.addEventListener('click',()=>{$$('#festivalTabs button').forEach(x=>x.classList.toggle('active',x===b));$$('.festival-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===b.dataset.tab))}));
function renderBooths(f){
  f.booths=f.booths||[];
  $('#reservationList').innerHTML=f.booths.length
    ?f.booths.map(b=>`<article class="reservation-card">
      <div class="reservation-image ${b.image?'zoomable-image':''}" data-image="${imageSrc(b.image)}" style="${imageSrc(b.image)?`background-image:url('${imageSrc(b.image)}')`:''}"><span>${esc(b.owner||'BOOTH')}</span></div>
      <div class="reservation-body">
        <div><span class="card-tag">${esc(b.owner||'부스')}</span><span class="notice-dday">${b.times?.length?`${b.times.length}회차`:'즉시 예약'}</span></div>
        <h3>${esc(b.name)}</h3>
        <p>${esc(b.description)}</p>
        <div class="reservation-meta">
          <span>${esc(b.location)}</span><span>${b.duration||0}분</span>
          <span>회차 정원 ${b.capacity||1}명</span><span>최소 ${b.minPeople||1}명</span>
        </div>
        <button class="reserve-button" data-reserve-booth="${b.id}">${b.times?.length?'시간 선택 후 예약':'바로 예약'}</button>
      </div>
    </article>`).join('')
    :'<div class="festival-empty">등록된 체험 부스가 없습니다.</div>';
  $$('[data-reserve-booth]').forEach(button=>button.addEventListener('click',()=>openReservation(button.dataset.reserveBooth)));
  bindZoomables();
}
function renderMenus(festival){
  const vendors=normalizeFoodVendors(festival);
  $('#foodList').innerHTML=vendors.length
    ?vendors.map(vendor=>`<article class="food-vendor-card">
      <header>
        <div><span class="card-tag">FOOD STORE</span><h3>${esc(vendor.name)}</h3></div>
        <p>${esc(vendor.operator||'운영 주체 미등록')} · ${esc(vendor.location||'위치 미정')}</p>
      </header>
      <div class="food-vendor-items">
        ${vendor.foods.length
          ?vendor.foods.map(food=>`<div class="food-vendor-item">
            <div class="food-thumb ${food.image?'zoomable-image':''}" data-image="${imageSrc(food.image)}" style="${imageSrc(food.image)?`background-image:url('${imageSrc(food.image)}')`:''}">${food.image?'':esc((food.name||'?').slice(0,1))}</div>
            <div><span>${esc(food.category||'메뉴')}</span><h4>${esc(food.name)}</h4><p>${Number(food.price||0).toLocaleString()}원${food.description?` · ${esc(food.description)}`:''}</p></div>
          </div>`).join('')
          :'<div class="festival-empty compact">등록된 음식이 없습니다.</div>'}
      </div>
    </article>`).join('')
    :'<div class="festival-empty">등록된 식당이 없습니다.</div>';
  bindZoomables();
}
function renderEvents(f){f.events=f.events||[];const ev=[...f.events].sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));$('#eventTimeline').innerHTML=ev.length?ev.map(e=>`<article class="timeline-item"><time>${esc(e.time||'--:--')}</time><i></i><div><span>${esc(e.location)} · ${formatDate(e.date)}</span><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p></div><button class="bell-mini" data-event-alert="${e.id}">알림</button></article>`).join(''):'<div class="festival-empty">등록된 일정이 없습니다.</div>';$$('[data-event-alert]').forEach(b=>b.addEventListener('click',()=>{const e=ev.find(x=>x.id===b.dataset.eventAlert);addNotification({title:`${f.name} · ${e.name}`,body:`${formatDate(e.date)} ${e.time} · ${e.location}`,type:'event',personal:true}).then(()=>toast('개인 일정 알림을 Firebase에 저장했습니다.')).catch(error=>toast(firebaseFriendlyMessage(error)))}))}
function openReservation(boothId){
  const current=session();
  if(!['student','guest'].includes(current?.role)){
    return toast('학생 또는 게스트로 로그인한 뒤 예약할 수 있습니다.');
  }
  if(current.role==='guest'&&!guestAccess().festivals){
    return toast('현재 게스트 예약이 공개되지 않았습니다.');
  }

  const festival=selectedFestival();
  const booth=festival?.booths?.find(item=>item.id===boothId);
  if(!booth)return;

  state.reservationBoothId=boothId;
  $('#reservationModalTitle').textContent=booth.name;
  $('#reservationModeText').textContent=booth.times?.length
    ?'원하는 예약 시간을 선택하세요.'
    :'예약 시간이 설정되지 않은 부스입니다. 바로 예약됩니다.';
  $('#reservationTimeGrid').innerHTML=booth.times?.length
    ?booth.times.map((time,index)=>`<button class="${index===0?'selected':''}" data-time="${time}">${time}</button>`).join('')
    :'';
  $$('#reservationTimeGrid button').forEach(button=>button.addEventListener('click',()=>{
    $$('#reservationTimeGrid button').forEach(item=>item.classList.remove('selected'));
    button.classList.add('selected');
  }));

  $('#reservationUserLabel').firstChild.textContent=current.role==='student'?'학생 예약자':'게스트 예약자';
  $('#reservationUser').value=current.role==='student'
    ?`${studentDisplayId(current)} ${current.name}`
    :`${current.school} · ${current.name}`;

  const minPeople=Math.max(1,Number(booth.minPeople||1));
  const capacity=Math.max(minPeople,Number(booth.capacity||minPeople));
  $('#reservationPartySize').min=String(minPeople);
  $('#reservationPartySize').max=String(capacity);
  $('#reservationPartySize').value=String(minPeople);
  $('#reservationPartySizeHint').textContent=`최소 ${minPeople}명 · 한 예약 최대 ${capacity}명`;
  openOverlay('reservationModal');
}
$('#confirmReservation').addEventListener('click',async()=>{
  const festival=selectedFestival();
  const booth=festival?.booths?.find(item=>item.id===state.reservationBoothId);
  const user=$('#reservationUser').value.trim();
  if(!booth||!user)return toast('예약자 정보를 확인해주세요.');

  const time=$('#reservationTimeGrid .selected')?.dataset.time||'즉시 예약';
  const minPeople=Math.max(1,Number(booth.minPeople||1));
  const capacity=Math.max(minPeople,Number(booth.capacity||minPeople));
  const groupSize=Number($('#reservationPartySize').value||0);

  if(!Number.isInteger(groupSize)||groupSize<minPeople||groupSize>capacity){
    return toast(`예약 인원은 ${minPeople}명 이상 ${capacity}명 이하여야 합니다.`);
  }

  try{
    await createReservation({
      festivalId:festival.id,festivalName:festival.name,festivalStart:festival.start||'',
      boothId:booth.id,boothName:booth.name,location:booth.location||'',
      duration:Number(booth.duration||0),capacity,minPeople,groupSize,user,time
    });
    closeOverlay('reservationModal');
    toast(`${booth.name} ${groupSize}명 예약이 Firebase에 저장되었습니다.`);
    if(navigator.vibrate)navigator.vibrate([60,40,80]);
    renderMy();renderHomeReservations();
  }catch(error){toast(firebaseFriendlyMessage(error))}
});

function reservations(){return window.firebaseCache?.reservations??[]}
function reservationById(reservationId){return reservations().find(item=>item.id===reservationId)}
function resolvedReservationInfo(reservation){
  const festival=festivals().find(item=>item.id===reservation?.festivalId);
  const booth=festival?.booths?.find(item=>item.id===reservation?.boothId);
  return {
    festivalName:reservation?.festivalName||festival?.name||'축제',
    boothName:reservation?.boothName||booth?.name||'체험 부스',
    location:reservation?.location||booth?.location||'장소 미정',
    duration:reservation?.duration||booth?.duration||'',
    time:reservation?.time||'즉시 예약',
    user:reservation?.user||`${reservation?.studentKey||''} ${reservation?.name||''}`.trim(),
    groupSize:Math.max(1,Number(reservation?.groupSize||1)),
    createdAt:Number(reservation?.createdAt||Date.now())
  };
}
function openReservationDetail(reservationId){
  const reservation=reservationById(reservationId);
  if(!reservation)return toast('예약 정보를 찾지 못했습니다.');
  const current=session();
  if(current?.role!=='admin'&&reservation.userUid!==current?.uid&&reservation.studentKey!==current?.studentKey){
    return toast('본인의 예약만 확인할 수 있습니다.');
  }

  state.currentReservationId=reservationId;
  const info=resolvedReservationInfo(reservation);
  $('#reservationDetailTitle').textContent=`${info.boothName} 예약`;
  $('#reservationDetailGrid').innerHTML=[
    ['축제',info.festivalName],
    ['체험 부스',info.boothName],
    ['예약 시간',info.time],
    ['예약 인원',`${info.groupSize}명`],
    ['장소',info.location],
    ['체험 시간',info.duration?`${info.duration}분`:'정보 없음'],
    ['예약자',info.user],
    ['예약한 시각',new Date(info.createdAt).toLocaleString('ko-KR')]
  ].map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('');
  $('#cancelReservationButton').hidden=!['student','guest'].includes(current?.role);
  openOverlay('reservationDetailModal');
}
function renderHomeReservations(){
  const section=$('#homeReservationSection');
  const current=session();
  if(!section)return;
  if(!['student','guest'].includes(current?.role)){
    section.hidden=true;
    $('#homeReservationList').innerHTML='';
    return;
  }

  section.hidden=false;
  const mine=reservations()
    .filter(item=>item.userUid===current.uid||item.studentKey===current.studentKey)
    .sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
  $('#homeReservationCount').textContent=`${mine.length}건`;
  $('#homeReservationList').innerHTML=mine.length
    ?mine.map(item=>{
      const info=resolvedReservationInfo(item);
      return `<button class="home-reservation-card" data-open-reservation="${item.id}">
        <span>${esc(info.time)}</span>
        <div><b>${esc(info.boothName)}</b><small>${esc(info.festivalName)} · ${esc(info.location)} · ${info.groupSize}명</small></div>
        <i>상세 보기</i>
      </button>`;
    }).join('')
    :'<div class="festival-empty">현재 예약한 체험이 없습니다.</div>';
  $$('[data-open-reservation]').forEach(button=>button.addEventListener('click',()=>openReservationDetail(button.dataset.openReservation)));
}
async function createReservation(payload){
  if(!window.baemoonFirebase?.createReservation)throw new Error('Firebase 예약 연결이 준비되지 않았습니다.');
  return window.baemoonFirebase.createReservation(payload);
}
function accounts(){return window.firebaseCache?.users??[]}function saveAccounts(){toast('학생 계정은 Firebase에서만 관리됩니다.')}
function studentKey(grade,classNo,number){return `${new Date().getFullYear()}-${grade}-${String(classNo).padStart(2,'0')}-${String(number).padStart(2,'0')}`}
function studentDisplayId(s){return `${s.grade}${String(s.classNo).padStart(2,'0')}${String(s.number).padStart(2,'0')}`}
function renderMy(){
  const s=session();
  if(!s){showAuthGate();return}

  if(s.role==='guest'){
    $('#profileRole').textContent=`외부 방문자 · ${s.school||'소속 학교 미등록'}`;
    $('#profileName').textContent=s.name||'게스트';
    $('#profileDetail').textContent='공개된 축제·급식과 본인 예약만 이용할 수 있습니다.';
    $('#profileAvatar').textContent=(s.name||'G').slice(0,1);
    $('#profileLoginButton').hidden=true;
    $('#logoutButton').hidden=false;
  }else if(s.role==='admin'){
    $('#profileRole').textContent='배문고 관리자';
    $('#profileName').textContent='관리자';
    $('#profileDetail').textContent='관리자 홈에서 콘텐츠를 관리합니다.';
    $('#profileAvatar').textContent='AD';
    $('#profileLoginButton').hidden=true;
    $('#logoutButton').hidden=false;
  }else{
    $('#profileRole').textContent=`${s.grade}학년 ${s.classNo}반 ${s.number}번`;
    $('#profileName').textContent=s.name;
    $('#profileDetail').textContent=`학생 ID ${studentDisplayId(s)}`;
    $('#profileAvatar').textContent=s.name.slice(0,1);
    $('#profileLoginButton').hidden=true;
    $('#logoutButton').hidden=false;
  }

  const mine=['student','guest'].includes(s.role)
    ?reservations().filter(item=>item.userUid===s.uid||(s.studentKey&&item.studentKey===s.studentKey))
    :[];
  $('#reservationCount').textContent=`${mine.length}건`;
  $('#myReservationList').innerHTML=mine.length
    ?mine.sort((a,b)=>Number(a.createdAt)-Number(b.createdAt)).map(item=>{
      const info=resolvedReservationInfo(item);
      return `<button class="my-reservation-card" data-open-reservation="${item.id}">
        <h3>${esc(info.festivalName)} · ${esc(info.boothName)}</h3>
        <p>${esc(info.time)} · ${esc(info.location)} · ${info.groupSize}명</p>
        <small>눌러서 상세 확인 및 취소</small>
      </button>`;
    }).join('')
    :['student','guest'].includes(s.role)
      ?'<div class="festival-empty">현재 예약한 체험이 없습니다.</div>'
      :'';
  $$('[data-open-reservation]').forEach(button=>button.addEventListener('click',()=>openReservationDetail(button.dataset.openReservation)));
  renderHomeReservations();
}
function showAuthGate(){closeAllOverlays();$('#appShell').hidden=true;$('#appShell').style.display='none';$('#authGate').hidden=false;$('#authGate').style.display='grid';document.body.classList.add('auth-open')}
function enterApp(defaultScreen='home'){
  closeAllOverlays();
  $('#authGate').hidden=true;
  $('#authGate').style.display='none';
  $('#appShell').hidden=false;
  $('#appShell').style.display='block';
  document.body.classList.remove('auth-open');
  renderHome();
  renderMy();
  renderNotifications();
  route(defaultScreen,{preview:defaultScreen==='home'});

  const params=new URLSearchParams(location.search);
  if(params.get('open')==='notifications'){
    setTimeout(()=>{renderNotifications();openOverlay('notificationCenter')},250);
    params.delete('open');
    const query=params.toString();
    history.replaceState({},'',`${location.pathname}${query?`?${query}`:''}${location.hash}`);
  }
}
function closeAllOverlays(){$$('.overlay.open').forEach(x=>x.classList.remove('open'))}
function showAuthError(id,message){const el=$(id);el.textContent=message;el.hidden=false}
function firebaseLoadMessage(error){
  const raw=String(error?.message||error||'');
  if(raw.includes('FIREBASE_LOAD_TIMEOUT'))return 'Firebase 연결 준비가 오래 걸리고 있습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.';
  if(raw.includes('Failed to fetch dynamically imported module')||raw.includes('Importing a module script failed'))return 'Firebase 파일을 불러오지 못했습니다. 페이지를 한 번 새로고침해주세요.';
  return raw?`Firebase 연결 오류: ${raw}`:'Firebase 연결을 준비하지 못했습니다.';
}
async function waitForFirebaseRuntime(timeoutMs=30000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(window.__firebaseRuntimeReady===true&&window.baemoonAuth)return window.baemoonAuth;
    if(window.__firebaseRuntimeState==='error'){
      throw window.__firebaseRuntimeError||new Error('Firebase 모듈 로딩 실패');
    }
    await new Promise(resolve=>setTimeout(resolve,80));
  }
  throw new Error('FIREBASE_LOAD_TIMEOUT');
}
function clearAuthErrors(){$$('.auth-inline-error').forEach(x=>{x.hidden=true;x.textContent=''})}
function populateStudentSelectors(){const fill=(el,max,suffix)=>{el.innerHTML=Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1}${suffix}</option>`).join('')};fill($('#studentGrade'),3,'학년');fill($('#studentClass'),10,'반');fill($('#studentNumber'),30,'번')}
$('#openStudentLogin').addEventListener('click',()=>{
  clearAuthErrors();
  $('#studentPassword').value='';
  openOverlay('studentLoginModal');
  requestAnimationFrame(()=>setTimeout(()=>{
    const nameInput=$('#studentName');
    if(nameInput){
      nameInput.removeAttribute('readonly');
      nameInput.focus({preventScroll:true});
      const end=nameInput.value.length;
      try{nameInput.setSelectionRange(end,end)}catch{}
    }
  },330));
});
$('#studentName').addEventListener('keydown',event=>{
  if(event.key==='Enter'){
    event.preventDefault();
    $('#studentPassword').focus();
  }
});
$('#openAdminLogin').addEventListener('click',()=>{clearAuthErrors();$('#adminLoginId').value='admin';$('#adminLoginPassword').value='';openOverlay('adminLoginModal');setTimeout(()=>$('#adminLoginPassword').focus(),50)});
$('#openGuestConfirm').addEventListener('click',()=>{
  $('#guestSchool').value='';
  $('#guestName').value='';
  $('#guestLoginError').hidden=true;
  openOverlay('guestConfirmModal');
  requestAnimationFrame(()=>setTimeout(()=>$('#guestSchool').focus(),220));
});
$('#confirmGuestEntry').addEventListener('click',async()=>{
  if(window.__firebaseRuntimeReady)return;
  const button=$('#confirmGuestEntry');
  const errorBox=$('#guestLoginError');
  button.disabled=true;
  const original=button.textContent;
  button.textContent='Firebase 연결 중…';
  errorBox.hidden=true;
  try{
    const authApi=await waitForFirebaseRuntime();
    await authApi.submitGuestLogin();
  }catch(error){
    errorBox.textContent=firebaseLoadMessage(error);
    errorBox.hidden=false;
  }finally{
    button.disabled=false;
    button.textContent=original;
  }
});
$('#guestName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('#confirmGuestEntry').click()}});
$('#studentLoginSubmit').addEventListener('click',async()=>{
  if(window.__firebaseRuntimeReady)return;
  const button=$('#studentLoginSubmit');
  const original=button.textContent;
  button.disabled=true;
  button.textContent='Firebase 연결 중…';
  showAuthError('#studentLoginError','Firebase 연결을 준비하고 있습니다. 잠시만 기다려주세요.');
  try{
    const authApi=await waitForFirebaseRuntime();
    $('#studentLoginError').hidden=true;
    await authApi.submitStudentLogin();
  }catch(error){
    showAuthError('#studentLoginError',firebaseLoadMessage(error));
  }finally{
    button.disabled=false;
    if(button.textContent==='Firebase 연결 중…')button.textContent=original;
  }
});

$('#saveStudentPassword').addEventListener('click',async()=>{
  const button=$('#saveStudentPassword');
  const errorBox=$('#passwordChangeError');
  errorBox.hidden=true;
  button.disabled=true;
  button.textContent='변경 중…';
  try{
    if(!window.baemoonAuth?.changeStudentPassword){
      throw new Error('Firebase 비밀번호 변경 기능을 아직 불러오는 중입니다.');
    }
    await window.baemoonAuth.changeStudentPassword();
  }catch(error){
    errorBox.textContent=firebaseFriendlyMessage(error);
    errorBox.hidden=false;
  }finally{
    button.disabled=false;
    button.textContent='비밀번호 변경 후 시작';
  }
});
async function submitAdminLogin(){
  if(window.__firebaseRuntimeReady)return;
  const button=$('#adminLoginSubmit');
  const original=button.textContent;
  button.disabled=true;
  button.textContent='Firebase 연결 중…';
  showAuthError('#adminLoginError','Firebase 연결을 준비하고 있습니다. 잠시만 기다려주세요.');
  try{
    const authApi=await waitForFirebaseRuntime();
    $('#adminLoginError').hidden=true;
    await authApi.submitAdminLogin();
  }catch(error){
    showAuthError('#adminLoginError',firebaseLoadMessage(error));
  }finally{
    button.disabled=false;
    if(button.textContent==='Firebase 연결 중…')button.textContent=original;
  }
}
$('#adminLoginSubmit').addEventListener('click',submitAdminLogin);
$('#adminLoginId').addEventListener('keydown',e=>{if(e.key==='Enter')submitAdminLogin()});
$('#adminLoginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')submitAdminLogin()});
$('#profileLoginButton').addEventListener('click',showAuthGate);$('#accountButton').addEventListener('click',()=>{if(isAdmin())route('admin');else route('my')});
$('#myReservationsButton').addEventListener('click',()=>{
  route('my');
  setTimeout(()=>$('#myReservationList')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
});
$('#cancelReservationButton').addEventListener('click',async()=>{
  const reservationId=state.currentReservationId;
  if(!reservationId)return;
  if(!confirm('이 예약을 취소하시겠습니까?'))return;
  const button=$('#cancelReservationButton');
  button.disabled=true;
  button.textContent='취소 중…';
  try{
    await window.baemoonFirebase.cancelReservation(reservationId);
    closeOverlay('reservationDetailModal');
    state.currentReservationId=null;
    toast('예약을 취소했습니다.');
  }catch(error){
    toast(firebaseFriendlyMessage(error));
  }finally{
    button.disabled=false;
    button.textContent='예약 취소';
  }
});
function logoutToWelcome(){localStorage.removeItem(KEYS.session);state.currentPostId=null;showAuthGate();toast('로그아웃되었습니다.')}
$('#logoutButton').addEventListener('click',logoutToWelcome);
function notices(){return window.firebaseCache?.notices??[]}
async function saveNotices(v){
  if(!isAdmin()||!window.baemoonFirebase?.saveNotices)throw new Error('Firebase 관리자 연결이 준비되지 않았습니다.');
  const saved=await window.baemoonFirebase.saveNotices(v);
  write(KEYS.notices,saved);if(window.firebaseCache)window.firebaseCache.notices=saved;
  markAdminSaved('학교 공지가 Firebase에 저장되었습니다.');return saved;
}function renderNotices(){
  if(isGuest()){
    $('#homeNoticeCount').textContent='학생 전용';
    $('#homeNoticeList').innerHTML='';
    return;
  }
  const ns=[...notices()].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt);
  $('#homeNoticeCount').textContent=`${ns.length}건`;
  $('#homeNoticeList').innerHTML=ns.length
    ?ns.map(n=>`<article class="home-notice-card ${n.pinned?'pinned':''}" data-notice="${n.id}"><div class="notice-card-top"><div class="notice-card-tags"><span class="notice-category">${esc(n.category)}</span><span class="notice-category">${esc(n.audience)}</span></div><b class="notice-dday">${dday(n.eventDate)}</b></div><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><div class="notice-open-hint"><span>세부 내용 보기</span><b>→</b></div></article>`).join('')
    :'<div class="notice-empty">등록된 공지가 없습니다.</div>';
  $$('[data-notice]').forEach(card=>card.addEventListener('click',()=>openNoticeDetail(card.dataset.notice)));
}
function openNoticeDetail(nid){const n=notices().find(x=>x.id===nid);if(!n)return;$('#noticeDetailTags').innerHTML=`<span class="notice-category">${esc(n.category)}</span><span class="notice-category">${esc(n.audience)}</span>`;$('#noticeDetailTitle').textContent=n.title;$('#noticeDetailDday').textContent=dday(n.eventDate);$('#noticeDetailMeta').textContent=`등록 ${new Date(n.createdAt).toLocaleString('ko-KR')}${n.eventDate?` · 관련일 ${formatDate(n.eventDate)}`:''}`;$('#noticeDetailBody').innerHTML=esc(n.body).replace(/\n/g,'<br>');const noticeImage=imageSrc(n.image);if(noticeImage){$('#noticeDetailImage').src=noticeImage;$('#noticeDetailImageWrap').hidden=false}else $('#noticeDetailImageWrap').hidden=true;openOverlay('noticeDetailModal');bindZoomables()}
function resetNotice(){state.editingNoticeId=null;state.pendingImage.notice='';$('#noticeComposerTitle').textContent='새 공지 등록';['noticeTitle','noticeSummary','noticeBody','noticeEventDate','noticeImage'].forEach(x=>$('#'+x).value='');$('#noticePinned').checked=false;$('#noticePush').checked=false;previewImage('notice','')}
function openNoticeEditor(nid=null){resetNotice();if(nid){const n=notices().find(x=>x.id===nid);state.editingNoticeId=nid;state.pendingImage.notice=n.image||'';$('#noticeComposerTitle').textContent='공지 수정';$('#noticeCategory').value=n.category;$('#noticeAudience').value=n.audience;$('#noticeTitle').value=n.title;$('#noticeSummary').value=n.summary;$('#noticeBody').value=n.body;$('#noticeEventDate').value=n.eventDate||'';$('#noticePinned').checked=!!n.pinned;previewImage('notice',n.image)}openOverlay('noticeComposer')}
$('#openNoticeComposer').addEventListener('click',()=>openNoticeEditor());$('#saveNoticeButton').addEventListener('click',async()=>{const p={category:$('#noticeCategory').value,audience:$('#noticeAudience').value,title:$('#noticeTitle').value.trim(),summary:$('#noticeSummary').value.trim(),body:$('#noticeBody').value.trim(),eventDate:$('#noticeEventDate').value,pinned:$('#noticePinned').checked,image:state.pendingImage.notice};if(!p.title||!p.summary||!p.body)return toast('제목, 요약, 상세 내용을 입력해주세요.');let ns=notices();if(state.editingNoticeId)ns=ns.map(n=>n.id===state.editingNoticeId?{...n,...p}:n);else ns.push({id:id(),...p,createdAt:Date.now()});try{await saveNotices(ns);if($('#noticePush').checked)await addNotification({title:`학교 공지 · ${p.title}`,body:p.summary,type:'notice',audience:p.audience});closeOverlay('noticeComposer');renderHome();renderAdmin();toast('공지가 Firebase에 저장되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});
function communityPosts(){return window.firebaseCache?.communityPosts??[]}function saveCommunityPosts(){toast('커뮤니티는 Firebase 연결 상태에서만 변경할 수 있습니다.')}function reports(){return window.firebaseCache?.reports??[]}function saveReports(){toast('신고 내역은 Firebase에서만 관리됩니다.')}

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
function renderCommunity(){const access=guestAccess(),banner=$('#communityAccessBanner'),writeButton=$('#openCommunityComposer');banner.hidden=true;writeButton.hidden=!isStudent();if(isGuest()){banner.hidden=false;banner.textContent='학생 커뮤니티는 배문고 학생 전용입니다.';$('#communityFeed').innerHTML='<div class="community-locked">게스트는 학교 내부 커뮤니티를 이용할 수 없습니다.</div>';$('#communitySearch').disabled=true;return}$('#communitySearch').disabled=false;const q=state.communitySearch.toLowerCase(),posts=[...visibleCommunityPosts()].filter(p=>(state.communityCategory==='전체'||p.category===state.communityCategory)&&(!q||`${p.title} ${p.body}`.toLowerCase().includes(q))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt);$('#communityFeed').innerHTML=posts.length?posts.map(p=>`<article class="community-post-card ${p.pinned?'pinned':''}" data-community-post="${p.id}"><div class="community-post-top"><div class="community-post-author"><span class="community-avatar">${p.authorKey==='admin'?'A':esc((p.authorName||'학').slice(0,1))}</span><div class="community-author-copy"><b>${esc(communityAuthorLabel(p))}</b><span>${esc(p.category)}${p.pinned?' · 상단 고정':''}</span></div></div><span class="community-post-time">${new Date(p.createdAt).toLocaleDateString('ko-KR')}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><div class="community-post-footer"><span>♡ ${(p.likes||[]).length}</span><span>댓글 ${(p.comments||[]).length}</span>${p.reportCount?`<span>신고 ${p.reportCount}</span>`:''}</div></article>`).join(''):'<div class="community-empty">등록된 게시글이 없습니다.</div>';$$('[data-community-post]').forEach(c=>c.addEventListener('click',()=>openCommunityDetail(c.dataset.communityPost)))}
$('#communityCategories').addEventListener('click',e=>{const b=e.target.closest('[data-community-category]');if(!b)return;$$('[data-community-category]').forEach(x=>x.classList.toggle('active',x===b));state.communityCategory=b.dataset.communityCategory;renderCommunity()});
$('#communitySearch').addEventListener('input',e=>{state.communitySearch=e.target.value.trim();renderCommunity()});
function resetCommunityComposer(){state.pendingImage.community='';$('#communityPostCategory').value='자유';$('#communityPostTitle').value='';$('#communityPostBody').value='';$('#communityPostImage').value='';previewCommunityImage('')}
function previewCommunityImage(data){state.pendingImage.community=data||'';const src=imageSrc(data);if(src){$('#communityImagePreviewImg').src=src;$('#communityImagePreview').hidden=false}else{$('#communityImagePreview').hidden=true;$('#communityImagePreviewImg').removeAttribute('src')}}
$('#openCommunityComposer').addEventListener('click',()=>{if(!isStudent())return toast('학생 로그인 후 글을 작성할 수 있습니다.');resetCommunityComposer();openOverlay('communityComposer')});
$('#communityPostImage').addEventListener('change',async e=>{try{previewCommunityImage(await compressImage(e.target.files[0]));toast('사진을 추가했습니다.')}catch(err){toast(err.message)}});$('#removeCommunityImage').addEventListener('click',()=>previewCommunityImage(''));
$('#saveCommunityPost').addEventListener('click',()=>{const s=session(),title=$('#communityPostTitle').value.trim(),body=$('#communityPostBody').value.trim();if(!isStudent())return toast('학생 로그인 후 이용할 수 있습니다.');if(!title||!body)return toast('제목과 내용을 입력해주세요.');const ps=communityPosts();ps.push({id:id(),category:$('#communityPostCategory').value,title,body,image:state.pendingImage.community,authorKey:s.studentKey,authorName:s.name,authorGrade:s.grade,authorClass:s.classNo,authorNumber:s.number,anonymous:false,pinned:false,hidden:false,likes:[],comments:[],reportCount:0,createdAt:Date.now()});saveCommunityPosts(ps);closeOverlay('communityComposer');renderCommunity();toast('게시글을 등록했습니다.')});
function openCommunityDetail(postId){const p=communityPosts().find(x=>x.id===postId);if(!p||p.hidden&&!isAdmin())return;state.currentPostId=postId;$('#communityDetailTags').innerHTML=`<span class="notice-category">${esc(p.category)}</span>${p.pinned?'<span class="notice-category">상단 고정</span>':''}`;$('#communityDetailTitle').textContent=p.title;$('#communityDetailMeta').textContent=`${communityAuthorLabel(p)} · ${new Date(p.createdAt).toLocaleString('ko-KR')}`;$('#communityDetailBody').innerHTML=esc(p.body).replace(/\n/g,'<br>');const postImage=imageSrc(p.image);if(postImage){$('#communityDetailImage').src=postImage;$('#communityDetailImageWrap').hidden=false}else $('#communityDetailImageWrap').hidden=true;const key=session()?.studentKey||session()?.role||'guest';$('#communityDetailLike').disabled=isGuest();$('#communityDetailLike').classList.toggle('liked',(p.likes||[]).includes(key));$('#communityDetailLikeCount').textContent=(p.likes||[]).length;$('#communityDetailReport').hidden=isAdmin()||isGuest();$('#communityCommentForm').hidden=!isStudent();renderCommunityComments(p);openOverlay('communityDetailModal');bindZoomables()}
function renderCommunityComments(p){$('#communityCommentCount').textContent=(p.comments||[]).length;$('#communityCommentList').innerHTML=(p.comments||[]).length?p.comments.map(c=>`<article class="community-comment"><div class="community-comment-head"><b>${esc(c.authorLabel)}</b><span>${new Date(c.createdAt).toLocaleString('ko-KR')}</span></div><p>${esc(c.body)}</p></article>`).join(''):'<div class="community-empty">첫 댓글을 남겨보세요.</div>'}
$('#communityDetailLike').addEventListener('click',()=>{if(!isStudent())return toast('학생만 좋아요를 누를 수 있습니다.');const key=session().studentKey;saveCommunityPosts(communityPosts().map(p=>{if(p.id!==state.currentPostId)return p;const likes=p.likes||[];return {...p,likes:likes.includes(key)?likes.filter(x=>x!==key):[...likes,key]}}));openCommunityDetail(state.currentPostId);renderCommunity()});
$('#saveCommunityComment').addEventListener('click',()=>{if(!isStudent())return toast('학생 로그인 후 댓글을 작성할 수 있습니다.');const body=$('#communityCommentInput').value.trim();if(!body)return;const s=session();saveCommunityPosts(communityPosts().map(p=>p.id===state.currentPostId?{...p,comments:[...(p.comments||[]),{id:id(),authorKey:s.studentKey,authorLabel:`${s.grade}학년 ${s.classNo}반 ${s.number}번 ${s.name}`,body,createdAt:Date.now()}]}:p));$('#communityCommentInput').value='';openCommunityDetail(state.currentPostId);renderCommunity()});
$('#communityDetailReport').addEventListener('click',()=>openOverlay('communityReportModal'));$('#communityReportReasons').addEventListener('click',e=>{const b=e.target.closest('[data-report-reason]');if(!b)return;const key=session()?.studentKey;if(!key)return;const existing=reports().some(r=>r.postId===state.currentPostId&&r.reporterKey===key);if(existing){closeOverlay('communityReportModal');return toast('이미 신고한 게시글입니다.')}const rs=reports();rs.push({id:id(),postId:state.currentPostId,reporterKey:key,reason:b.dataset.reportReason,createdAt:Date.now()});saveReports(rs);saveCommunityPosts(communityPosts().map(p=>p.id===state.currentPostId?{...p,reportCount:(p.reportCount||0)+1}:p));closeOverlay('communityReportModal');closeOverlay('communityDetailModal');renderCommunity();toast('신고가 관리자 검토 목록에 전달되었습니다.')});
function renderAdminCommunity(){const ps=[...communityPosts()].sort((a,b)=>(b.reportCount||0)-(a.reportCount||0)||b.createdAt-a.createdAt);$('#adminCommunityCount').textContent=`${ps.length}개`;$('#adminCommunityList').innerHTML=ps.length?ps.map(p=>`<article class="admin-community-card"><div><div class="admin-community-meta"><span class="notice-category">${esc(p.category)}</span>${p.reportCount?`<span class="notice-category">신고 ${p.reportCount}</span>`:''}${p.hidden?'<span class="notice-category">숨김</span>':''}</div><h3>${esc(p.title)}</h3><p>작성자: ${esc(p.authorName)} · ${esc(p.authorKey)} · ${new Date(p.createdAt).toLocaleString('ko-KR')}</p></div><div class="moderation-actions"><button data-admin-view-post="${p.id}">상세</button><button data-admin-pin-post="${p.id}">${p.pinned?'고정 해제':'상단 고정'}</button><button data-admin-hide-post="${p.id}">${p.hidden?'다시 공개':'숨기기'}</button><button class="danger" data-admin-delete-post="${p.id}">삭제</button></div></article>`).join(''):'<div class="admin-empty">게시글이 없습니다.</div>';$$('[data-admin-view-post]').forEach(b=>b.addEventListener('click',()=>openCommunityDetail(b.dataset.adminViewPost)));$$('[data-admin-pin-post]').forEach(b=>b.addEventListener('click',()=>{saveCommunityPosts(communityPosts().map(p=>p.id===b.dataset.adminPinPost?{...p,pinned:!p.pinned}:p));renderAdminCommunity();renderCommunity()}));$$('[data-admin-hide-post]').forEach(b=>b.addEventListener('click',()=>{saveCommunityPosts(communityPosts().map(p=>p.id===b.dataset.adminHidePost?{...p,hidden:!p.hidden}:p));renderAdminCommunity();renderCommunity()}));$$('[data-admin-delete-post]').forEach(b=>b.addEventListener('click',()=>{saveCommunityPosts(communityPosts().filter(p=>p.id!==b.dataset.adminDeletePost));saveReports(reports().filter(r=>r.postId!==b.dataset.adminDeletePost));renderAdminCommunity();renderCommunity();toast('게시글을 삭제했습니다.')}))}
function renderAdminStudents(){
  const list=[...accounts()].sort((a,b)=>a.grade-b.grade||a.classNo-b.classNo||a.number-b.number);
  $('#adminStudentCount').textContent=`${list.length}명`;
  $('#adminStudentList').innerHTML=list.length
    ?list.map(a=>`<article class="admin-student-card"><div><span class="student-status">${a.active===false?'정지':'활성'}</span><h3>${a.grade}학년 ${a.classNo}반 ${a.number}번 ${esc(a.name)}</h3><p>${esc(a.studentKey)} · 마지막 로그인 ${a.lastLoginAt?new Date(a.lastLoginAt).toLocaleString('ko-KR'):'없음'}</p></div><div class="moderation-actions"><button data-toggle-student="${a.studentKey}">${a.active===false?'계정 복구':'계정 정지'}</button><button data-reset-student="${a.studentKey}">초기화 안내</button></div></article>`).join('')
    :'<div class="admin-empty"><b>학생 문서가 없습니다.</b><p>학생이 같은 정보로 다시 로그인하면 users 컬렉션과 학생 문서가 자동으로 다시 생성됩니다.</p></div>';
  $$('[data-toggle-student]').forEach(b=>b.addEventListener('click',()=>{}));
  $$('[data-reset-student]').forEach(b=>b.addEventListener('click',()=>{}));
}
function notificationMatchesAudience(item){
  const audience=String(item?.audience||'전체').trim();
  const current=session();

  if(audience==='개인')return true;
  if(current?.role==='admin')return true;
  if(current?.role==='guest')return audience==='게스트';
  if(current?.role!=='student')return false;
  if(audience==='전체')return true;

  return audience===`${current.grade}학년`
    || audience===String(current.grade)
    || audience===`grade-${current.grade}`;
}
function notificationSeenStorageKey(){
  const current=session();
  return `bm_device_seen_notifications_v13_${current?.uid||current?.studentKey||current?.role||'anonymous'}`;
}
function getDeviceSeenNotificationIds(){
  try{return new Set(JSON.parse(localStorage.getItem(notificationSeenStorageKey())||'[]'))}
  catch{return new Set()}
}
function saveDeviceSeenNotificationIds(ids){
  localStorage.setItem(notificationSeenStorageKey(),JSON.stringify([...ids].slice(-500)));
}
async function showDeviceNotification(item){
  if(!item||!notifyEnabled()||!notificationMatchesAudience(item))return;

  const title=String(item.title||'배문고 알림');
  const body=String(item.body||'');

  toast(`${title}${body?` · ${body}`:''}`);
  if(navigator.vibrate)try{navigator.vibrate([70,40,90])}catch{}

  if(!('Notification'in window)||Notification.permission!=='granted')return;

  try{
    if('serviceWorker'in navigator){
      const registration=await ensureServiceWorker();
      const readyRegistration=registration||await navigator.serviceWorker.ready;
      await readyRegistration.showNotification(title,{
        body,
        icon:'./icons/icon-192.png',
        badge:'./icons/icon-192.png',
        tag:`baemoon-${item.id||Date.now()}`,
        renotify:true,
        data:{url:'./?open=notifications'}
      });
    }else{
      new Notification(title,{body,icon:'./icons/icon-192.png'});
    }
  }catch(error){
    console.warn('Device notification display failed:',error);
  }
}
function syncIncomingNotifications(cacheKey,items){
  const normalized=Array.isArray(items)?items:[];
  window.firebaseCache=window.firebaseCache||{};
  window.firebaseCache[cacheKey]=normalized;
  renderNotifications();

  const seen=getDeviceSeenNotificationIds();
  const recentCutoff=Date.now()-(15*60*1000);
  const incoming=normalized
    .filter(notificationMatchesAudience)
    .filter(item=>item?.id&&!seen.has(item.id))
    .filter(item=>Number(item.createdAt||0)>=recentCutoff)
    .sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));

  normalized.forEach(item=>{if(item?.id)seen.add(item.id)});
  saveDeviceSeenNotificationIds(seen);
  incoming.forEach(item=>showDeviceNotification(item));
}
function handleBroadcastNotifications(items){
  syncIncomingNotifications('notifications',items);
}
function handlePersonalNotifications(items){
  syncIncomingNotifications('personalNotifications',items);
}
function notifications(){
  const broadcasts=window.firebaseCache?.notifications??[],personal=window.firebaseCache?.personalNotifications??[],states=window.firebaseCache?.notificationStates??{};
  return [...broadcasts,...personal].filter(notificationMatchesAudience).map(item=>({...item,read:!!states[item.id]?.read,hidden:!!states[item.id]?.hidden})).filter(item=>!item.hidden);
}
function notifyEnabled(){return window.firebaseCache?.notificationPreference?.enabled??true}
async function toggleNotify(v){
  if(v&&'Notification'in window&&Notification.permission==='default'){
    const p=await Notification.requestPermission();if(p!=='granted')v=false;
  }
  try{await window.baemoonFirebase.setNotificationPreference(v);renderNotifications();toast(v?'앱 알림을 켰습니다.':'앱 알림을 껐습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}
}
async function addNotification({title,body,type='event',audience='전체',personal=false}){
  if(!title||!body)return;
  const saved=personal
    ?await window.baemoonFirebase.createPersonalNotification({title,body,type,audience})
    :await window.baemoonFirebase.createBroadcastNotification({title,body,type,audience});

  const cacheKey=personal?'personalNotifications':'notifications';
  const current=window.firebaseCache?.[cacheKey]||[];
  if(!current.some(item=>item.id===saved.id)){
    window.firebaseCache[cacheKey]=[...current,saved];
    renderNotifications();
  }
  return saved;
}
function renderNotifications(){
  const ns=[...notifications()].sort((a,b)=>b.createdAt-a.createdAt),unread=ns.filter(n=>!n.read).length;
  $('#notificationBadge').hidden=!unread;$('#notificationBadge').textContent=unread>99?'99+':unread;
  $('#notificationList').innerHTML=ns.length?ns.map(n=>`<article class="notification-item ${n.read?'':'unread'}" data-notification="${n.id}"><div class="notification-symbol">${n.type==='notice'?'N':'!'}</div><div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notification-item-meta">${esc(n.audience||'개인')} · ${new Date(n.createdAt).toLocaleString('ko-KR')}</div></div></article>`).join(''):'<div class="notification-empty">새로운 알림이 없습니다.</div>';
  const permission='Notification'in window?Notification.permission:'unsupported';
  $('#notificationToggle').checked=notifyEnabled();
  $('#myNotificationStatus').textContent=!notifyEnabled()?'꺼짐':permission==='granted'?'켜짐':permission==='denied'?'차단됨':'허용 필요';
  $('#notificationSettingDescription').textContent=!notifyEnabled()
    ?'알림함에는 저장되지만 기기 알림은 울리지 않습니다.'
    :permission==='granted'
      ?'다른 기기에서 전송된 공지와 행사 알림을 받습니다.'
      :permission==='denied'
        ?'브라우저 또는 휴대폰 설정에서 알림 권한을 허용해주세요.'
        :'알림함을 열거나 스위치를 누르면 기기 알림 권한을 요청합니다.';
  $$('[data-notification]').forEach(c=>c.addEventListener('click',async()=>{await window.baemoonFirebase.markNotificationRead(c.dataset.notification);renderNotifications()}));
}
function closeNotificationManageMenu(){$('#notificationManageMenu').hidden=true;$('#notificationManageButton').setAttribute('aria-expanded','false')}
$('#notificationButton').addEventListener('click',async()=>{
  if(notifyEnabled()&&'Notification'in window&&Notification.permission==='default'){
    try{await Notification.requestPermission()}catch{}
  }
  renderNotifications();
  openOverlay('notificationCenter');
});
$('#myNotificationButton').addEventListener('click',()=>{renderNotifications();openOverlay('notificationCenter')});
$('#notificationToggle').addEventListener('change',e=>toggleNotify(e.target.checked));
$('#notificationManageButton').addEventListener('click',()=>{const menu=$('#notificationManageMenu');menu.hidden=!menu.hidden;$('#notificationManageButton').setAttribute('aria-expanded',String(!menu.hidden))});
$('#markAllNotificationsRead').addEventListener('click',async()=>{await window.baemoonFirebase.markAllNotificationsRead(notifications().map(n=>n.id));renderNotifications();closeNotificationManageMenu();toast('모든 알림을 읽음 처리했습니다.')});
$('#deleteReadNotifications').addEventListener('click',async()=>{const ids=notifications().filter(n=>n.read).map(n=>n.id);await window.baemoonFirebase.hideNotifications(ids);renderNotifications();closeNotificationManageMenu();toast(ids.length?'읽은 알림을 정리했습니다.':'정리할 읽은 알림이 없습니다.')});
$('#requestClearNotifications').addEventListener('click',()=>{closeNotificationManageMenu();openOverlay('notificationClearConfirm')});
$('#cancelClearNotifications').addEventListener('click',()=>closeOverlay('notificationClearConfirm'));
$('#confirmClearNotifications').addEventListener('click',async()=>{await window.baemoonFirebase.hideNotifications(notifications().map(n=>n.id));renderNotifications();closeOverlay('notificationClearConfirm');toast('이 계정의 알림함을 비웠습니다.')});
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
  const fs=festivals(),rs=reservations();
  $('#adminReservationTotal').textContent=rs.length;$('#adminFestivalTotal').textContent=fs.filter(f=>f.visible).length;$('#adminNoticeCount').textContent=notices().length;
  renderAdminToday();renderAdminMeals();
  $('#adminFestivalList').innerHTML=fs.length?fs.map(f=>`<article class="admin-festival-card"><div><span class="notice-category">${f.visible?'공개':'숨김'}${f.featured?' · 대표':''}</span><h3>${esc(f.name)} ${esc(f.year)}</h3><p>${formatDate(f.start)||'날짜 미정'} · 부스 ${(f.booths||[]).length} · 식당 ${normalizeFoodVendors(f).length} · 음식 ${totalFoodItems(f)} · 일정 ${(f.events||[]).length}</p></div><div class="item-actions"><button data-manage-festival="${f.id}">운영 관리</button><button data-toggle-festival="${f.id}">${f.visible?'숨기기':'공개하기'}</button><button class="danger" data-delete-festival="${f.id}">삭제</button></div></article>`).join(''):'<div class="admin-empty">축제를 새로 만들어주세요.</div>';
  $$('[data-manage-festival]').forEach(b=>b.addEventListener('click',()=>selectManagerFestival(b.dataset.manageFestival)));
  $$('[data-toggle-festival]').forEach(b=>b.addEventListener('click',async()=>{try{await saveFestivals(festivals().map(f=>f.id===b.dataset.toggleFestival?{...f,visible:!f.visible}:f));renderAdmin();renderHome();toast('축제 공개 상태가 Firebase에 저장되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}}));
  $$('[data-delete-festival]').forEach(b=>b.addEventListener('click',async()=>{try{await saveFestivals(festivals().filter(f=>f.id!==b.dataset.deleteFestival));if(state.managerFestivalId===b.dataset.deleteFestival)state.managerFestivalId=null;renderAdmin();renderHome();toast('축제가 Firebase에서 삭제되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}}));
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
$('#saveTodayButton').addEventListener('click',async()=>{
  const p={date:$('#todayEditDate').value,startTime:$('#todayEditStart').value,endTime:$('#todayEditEnd').value,badge:$('#todayEditBadge').value.trim()||'TODAY',title:$('#todayEditTitle').value.trim(),summary:$('#todayEditSummary').value.trim()};
  if(!p.date||!p.title||!p.summary)return toast('날짜, 제목과 설명을 입력해주세요.');
  if(p.endTime<=p.startTime)return toast('종료 시간은 시작 시간보다 늦어야 합니다.');
  let list=todaySchedules();
  const duplicate=list.find(x=>x.date===p.date&&x.id!==state.editingTodayId);if(duplicate)return toast('해당 날짜에는 이미 일정이 등록되어 있습니다.');
  list=state.editingTodayId?list.map(x=>x.id===state.editingTodayId?{...x,...p}:x):[...list,{id:id(),...p}];
  try{await saveTodaySchedules(list);closeOverlay('todayEditor');renderHome();renderAdmin();toast('날짜별 일정이 Firebase에 저장되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))};
});
$('#deleteTodayButton').addEventListener('click',async()=>{if(!state.editingTodayId)return;try{await saveTodaySchedules(todaySchedules().filter(x=>x.id!==state.editingTodayId));closeOverlay('todayEditor');renderHome();renderAdmin();toast('날짜별 일정이 Firebase에서 삭제되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});
function resetFestivalEditor(){state.editingFestivalId=null;$('#festivalEditorTitle').textContent='새 축제 만들기';['festivalEditName','festivalEditYear','festivalEditShort','festivalEditTagline','festivalEditDescription','festivalEditStart','festivalEditEnd'].forEach(x=>$('#'+x).value='');$('#festivalEditColor').value='#ff6038';$('#festivalEditVisible').checked=true;$('#festivalEditFeatured').checked=false}
function openFestivalEditor(fid=null){resetFestivalEditor();if(fid){const f=festivals().find(x=>x.id===fid);state.editingFestivalId=fid;$('#festivalEditorTitle').textContent='축제 기본 정보 수정';$('#festivalEditName').value=f.name;$('#festivalEditYear').value=f.year;$('#festivalEditShort').value=f.short;$('#festivalEditTagline').value=f.tagline;$('#festivalEditDescription').value=f.description;$('#festivalEditStart').value=f.start;$('#festivalEditEnd').value=f.end;$('#festivalEditColor').value=f.color;$('#festivalEditVisible').checked=f.visible;$('#festivalEditFeatured').checked=f.featured}openOverlay('festivalEditor')}

$('#addMealButton').addEventListener('click',()=>openMealEditor());
$('#saveMealButton').addEventListener('click',async()=>{
  const date=$('#mealEditDate').value;
  const menus=$('#mealEditMenus').value.split(/[,\n]/).map(value=>value.trim()).filter(Boolean);
  const payload={date,type:$('#mealEditType').value,time:$('#mealEditTime').value.trim(),menus,note:$('#mealEditNote').value.trim()};
  if(!date)return toast('급식 날짜를 선택해주세요.');
  if(!menus.length)return toast('메뉴를 한 개 이상 입력해주세요.');
  let list=meals();
  const duplicate=list.find(item=>item.date===date&&item.id!==state.editingMealId);
  if(duplicate)return toast('해당 날짜에는 이미 급식이 등록되어 있습니다.');
  if(state.editingMealId){
    list=list.map(item=>item.id===state.editingMealId?{...item,...payload}:item);
  }else{
    list=[...list,{id:date,...payload}];
  }
  try{
    await saveMeals(list);
    closeOverlay('mealEditor');
    renderMealCard();
    renderAdminMeals();
    toast('급식 정보가 Firebase에 저장되었습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error));}
});
$('#deleteMealButton').addEventListener('click',async()=>{
  if(!state.editingMealId)return;
  try{
    await saveMeals(meals().filter(item=>item.id!==state.editingMealId));
    closeOverlay('mealEditor');
    renderMealCard();
    renderAdminMeals();
    toast('급식 정보가 Firebase에서 삭제되었습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error));}
});

$('#addFestivalButton').addEventListener('click',()=>openFestivalEditor());$('#editFestivalButton').addEventListener('click',()=>openFestivalEditor(state.managerFestivalId));$('#saveFestivalButton').addEventListener('click',async()=>{const p={name:$('#festivalEditName').value.trim(),year:+$('#festivalEditYear').value||new Date().getFullYear(),short:$('#festivalEditShort').value.trim(),tagline:$('#festivalEditTagline').value.trim(),description:$('#festivalEditDescription').value.trim(),start:$('#festivalEditStart').value,end:$('#festivalEditEnd').value,color:$('#festivalEditColor').value,visible:$('#festivalEditVisible').checked,featured:$('#festivalEditFeatured').checked};if(!p.name)return toast('축제 이름을 입력해주세요.');let fs=festivals();if(p.featured)fs=fs.map(f=>({...f,featured:false}));if(state.editingFestivalId)fs=fs.map(f=>f.id===state.editingFestivalId?{...f,...p}:f);else{const n={id:id(),...p,booths:[],menus:[],foodVendors:[],events:[]};fs.push(n);state.managerFestivalId=n.id}try{await saveFestivals(fs);closeOverlay('festivalEditor');renderAdmin();renderHome();toast('축제가 Firebase에 저장되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});
function selectManagerFestival(fid,scroll=true){state.managerFestivalId=fid;const f=festivals().find(x=>x.id===fid);if(!f){$('#festivalManager').hidden=true;return}$('#festivalManager').hidden=false;$('#managerFestivalTitle').textContent=`${f.name} 운영 관리`;$('#managerFestivalMeta').textContent=`${f.year} · ${f.visible?'학생 공개':'학생 숨김'} · ${formatDate(f.start)}`;$('#managerFestivalStatus').textContent=f.featured?'대표 축제':'관리 중';renderManagerLists();if(scroll)$('#festivalManager').scrollIntoView({behavior:'smooth',block:'start'})}
$$('#managerTabs button').forEach(b=>b.addEventListener('click',()=>{$$('#managerTabs button').forEach(x=>x.classList.toggle('active',x===b));$$('.manager-panel').forEach(p=>p.classList.toggle('active',p.dataset.managerPanel===b.dataset.managerTab))}));
function managerFestival(){return festivals().find(f=>f.id===state.managerFestivalId)}
async function updateManagerFestival(mutator){
  const next=festivals().map(f=>f.id===state.managerFestivalId?mutator(f):f);
  await saveFestivals(next);
  renderAdmin();renderHome();
  if(state.currentFestivalId===state.managerFestivalId)renderFestival();
}
function renderManagerLists(){
  const festival=managerFestival();
  if(!festival)return;
  festival.booths=festival.booths||[];
  festival.events=festival.events||[];
  const vendors=normalizeFoodVendors(festival);

  $('#adminBoothList').innerHTML=festival.booths.length
    ?festival.booths.map(booth=>`<article class="manager-item"><div><span class="notice-category">${booth.times?.length?`${booth.times.length}개 시간`:'즉시 예약'}</span><h3>${esc(booth.name)}</h3><p>${esc(booth.location)} · 정원 ${booth.capacity}명 · 최소 ${booth.minPeople||1}명 · ${booth.duration}분</p></div><div class="item-actions"><button data-edit-booth="${booth.id}">수정</button><button class="danger" data-delete-booth="${booth.id}">삭제</button></div></article>`).join('')
    :'<div class="manager-empty">등록된 부스가 없습니다.</div>';

  $('#adminMenuList').innerHTML=vendors.length
    ?vendors.map(vendor=>`<article class="restaurant-manager-card">
      <div class="restaurant-manager-head">
        <div><span class="notice-category">${vendor.foods.length}개 음식</span><h3>${esc(vendor.name)}</h3><p>${esc(vendor.operator||'운영 주체 미등록')} · ${esc(vendor.location||'위치 미정')}</p></div>
        <div class="item-actions"><button data-add-food="${vendor.id}">음식 추가</button><button data-edit-restaurant="${vendor.id}">식당 수정</button><button class="danger" data-delete-restaurant="${vendor.id}">삭제</button></div>
      </div>
      <div class="restaurant-food-admin-list">
        ${vendor.foods.length
          ?vendor.foods.map(food=>`<div class="restaurant-food-admin-item"><div><b>${esc(food.name)}</b><small>${Number(food.price||0).toLocaleString()}원 · ${esc(food.category||'메뉴')}</small></div><div class="item-actions"><button data-edit-food="${vendor.id}:${food.id}">수정</button><button class="danger" data-delete-food="${vendor.id}:${food.id}">삭제</button></div></div>`).join('')
          :'<div class="manager-empty compact">아직 등록된 음식이 없습니다.</div>'}
      </div>
    </article>`).join('')
    :'<div class="manager-empty">식당을 먼저 추가해주세요.</div>';

  $('#adminEventList').innerHTML=festival.events.length
    ?festival.events.map(event=>`<article class="manager-item"><div><span class="notice-category">${formatDate(event.date)} ${esc(event.time)}</span><h3>${esc(event.name)}</h3><p>${esc(event.location)} · ${esc(event.description)}</p></div><div class="item-actions"><button data-edit-event="${event.id}">수정</button><button class="danger" data-delete-event="${event.id}">삭제</button></div></article>`).join('')
    :'<div class="manager-empty">등록된 일정이 없습니다.</div>';

  $$('[data-edit-booth]').forEach(button=>button.addEventListener('click',()=>openBoothEditor(button.dataset.editBooth)));
  $$('[data-delete-booth]').forEach(button=>button.addEventListener('click',async()=>{
    try{
      await updateManagerFestival(item=>({...item,booths:item.booths.filter(booth=>booth.id!==button.dataset.deleteBooth)}));
      toast('부스를 삭제했습니다.');
    }catch(error){toast(firebaseFriendlyMessage(error))}
  }));

  $$('[data-add-food]').forEach(button=>button.addEventListener('click',()=>openFoodItemEditor(button.dataset.addFood)));
  $$('[data-edit-restaurant]').forEach(button=>button.addEventListener('click',()=>openRestaurantEditor(button.dataset.editRestaurant)));
  $$('[data-delete-restaurant]').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm('식당과 그 아래 모든 음식을 삭제하시겠습니까?'))return;
    try{
      await updateManagerFestival(item=>({...item,foodVendors:normalizeFoodVendors(item).filter(vendor=>vendor.id!==button.dataset.deleteRestaurant)}));
      toast('식당을 삭제했습니다.');
    }catch(error){toast(firebaseFriendlyMessage(error))}
  }));

  $$('[data-edit-food]').forEach(button=>button.addEventListener('click',()=>{
    const [vendorId,foodId]=button.dataset.editFood.split(':');
    openFoodItemEditor(vendorId,foodId);
  }));
  $$('[data-delete-food]').forEach(button=>button.addEventListener('click',async()=>{
    const [vendorId,foodId]=button.dataset.deleteFood.split(':');
    try{
      await updateManagerFestival(item=>({...item,foodVendors:normalizeFoodVendors(item).map(vendor=>vendor.id===vendorId?{...vendor,foods:vendor.foods.filter(food=>food.id!==foodId)}:vendor)}));
      toast('음식을 삭제했습니다.');
    }catch(error){toast(firebaseFriendlyMessage(error))}
  }));

  $$('[data-edit-event]').forEach(button=>button.addEventListener('click',()=>openEventEditor(button.dataset.editEvent)));
  $$('[data-delete-event]').forEach(button=>button.addEventListener('click',async()=>{
    try{
      await updateManagerFestival(item=>({...item,events:item.events.filter(event=>event.id!==button.dataset.deleteEvent)}));
      toast('행사 일정을 삭제했습니다.');
    }catch(error){toast(firebaseFriendlyMessage(error))}
  }));
}

function previewImage(type,data){state.pendingImage[type]=data||'';const p=$(`#${type}ImagePreview`),i=$(`#${type}ImagePreviewImg`),src=imageSrc(data);if(src){i.src=src;p.hidden=false}else{p.hidden=true;i.removeAttribute('src')}}async function compressImage(file){
  if(!file?.type.startsWith('image/'))throw Error('이미지 파일을 선택해주세요.');
  const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
  let scale=Math.min(1,1280/img.width,960/img.height),quality=.82,result='';
  for(let attempt=0;attempt<7;attempt++){
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);result=c.toDataURL('image/jpeg',quality);
    if(result.length<=600000)return result;
    quality=Math.max(.48,quality-.08);scale*=.88;
  }
  if(result.length>780000)throw Error('사진 용량을 충분히 줄이지 못했습니다. 더 작은 사진을 선택해주세요.');
  return result;
}
['notice','booth','menu'].forEach(type=>{$(`#${type}Image`).addEventListener('change',async e=>{try{previewImage(type,await compressImage(e.target.files[0]));toast('사진을 추가했습니다.')}catch(err){toast(err.message)}});$(`#remove${type[0].toUpperCase()+type.slice(1)}Image`).addEventListener('click',()=>previewImage(type,''))});
function openBoothEditor(bid=null){const f=managerFestival();state.editingBoothId=bid;state.pendingImage.booth='';$('#boothEditorTitle').textContent=bid?'체험 부스 수정':'체험 부스 추가';['boothName','boothOwner','boothLocation','boothDescription','boothTimes','boothImage'].forEach(x=>$('#'+x).value='');$('#boothCapacity').value=5;$('#boothMinPeople').value=1;$('#boothDuration').value=15;previewImage('booth','');if(bid){const b=f.booths.find(x=>x.id===bid);$('#boothName').value=b.name;$('#boothOwner').value=b.owner;$('#boothLocation').value=b.location;$('#boothDescription').value=b.description;$('#boothCapacity').value=b.capacity;$('#boothMinPeople').value=b.minPeople||1;$('#boothDuration').value=b.duration;$('#boothTimes').value=(b.times||[]).join(', ');previewImage('booth',b.image)}openOverlay('boothEditor')}
$('#addBoothButton').addEventListener('click',()=>openBoothEditor());
$('#saveBoothButton').addEventListener('click',async()=>{
  const capacity=Number($('#boothCapacity').value||1);
  const minPeople=Number($('#boothMinPeople').value||1);
  const payload={
    name:$('#boothName').value.trim(),owner:$('#boothOwner').value.trim(),
    location:$('#boothLocation').value.trim(),description:$('#boothDescription').value.trim(),
    capacity,minPeople,duration:Number($('#boothDuration').value||1),
    times:$('#boothTimes').value.split(/[,\n]/).map(value=>value.trim()).filter(Boolean),
    image:state.pendingImage.booth
  };
  if(!payload.name)return toast('부스 이름을 입력해주세요.');
  if(!Number.isInteger(capacity)||capacity<1)return toast('회차 정원은 1명 이상이어야 합니다.');
  if(!Number.isInteger(minPeople)||minPeople<1||minPeople>capacity){
    return toast('최소 예약 인원은 1명 이상이며 회차 정원보다 클 수 없습니다.');
  }

  try{
    await updateManagerFestival(festival=>({
      ...festival,
      booths:state.editingBoothId
        ?festival.booths.map(booth=>booth.id===state.editingBoothId?{...booth,...payload}:booth)
        :[...festival.booths,{id:id(),...payload}]
    }));
    closeOverlay('boothEditor');
    toast(payload.times.length?'시간 예약 부스가 Firebase에 저장되었습니다.':'즉시 예약 부스가 Firebase에 저장되었습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error))}
});
function openRestaurantEditor(restaurantId=null){
  const festival=managerFestival();
  state.editingRestaurantId=restaurantId;
  $('#restaurantEditorTitle').textContent=restaurantId?'식당 수정':'식당 추가';
  $('#restaurantName').value='';
  $('#restaurantOperator').value='';
  $('#restaurantLocation').value='';

  if(restaurantId){
    const vendor=normalizeFoodVendors(festival).find(item=>item.id===restaurantId);
    if(!vendor)return;
    $('#restaurantName').value=vendor.name||'';
    $('#restaurantOperator').value=vendor.operator||'';
    $('#restaurantLocation').value=vendor.location||'';
  }
  openOverlay('restaurantEditor');
  setTimeout(()=>$('#restaurantName').focus(),160);
}
$('#addRestaurantButton').addEventListener('click',()=>openRestaurantEditor());
$('#saveRestaurantButton').addEventListener('click',async()=>{
  const payload={
    name:$('#restaurantName').value.trim(),
    operator:$('#restaurantOperator').value.trim(),
    location:$('#restaurantLocation').value.trim()
  };
  if(!payload.name)return toast('식당 이름을 입력해주세요.');
  if(!payload.location)return toast('판매 위치를 입력해주세요.');

  try{
    await updateManagerFestival(festival=>{
      const vendors=normalizeFoodVendors(festival);
      const foodVendors=state.editingRestaurantId
        ?vendors.map(vendor=>vendor.id===state.editingRestaurantId?{...vendor,...payload}:vendor)
        :[...vendors,{id:id(),...payload,foods:[]}];
      return {...festival,foodVendors};
    });
    closeOverlay('restaurantEditor');
    toast('식당이 Firebase에 저장되었습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error))}
});

function openFoodItemEditor(restaurantId,foodId=null){
  const festival=managerFestival();
  const vendor=normalizeFoodVendors(festival).find(item=>item.id===restaurantId);
  if(!vendor)return toast('식당 정보를 찾지 못했습니다.');

  state.foodRestaurantId=restaurantId;
  state.editingFoodItemId=foodId;
  state.pendingImage.menu='';
  $('#foodItemEditorTitle').textContent=foodId?'음식 수정':'음식 추가';
  $('#foodItemRestaurantName').textContent=`${vendor.name} · ${vendor.location||'위치 미정'}`;
  $('#foodItemName').value='';
  $('#foodItemPrice').value='';
  $('#foodItemCategory').value='식사';
  $('#foodItemDescription').value='';
  $('#menuImage').value='';
  previewImage('menu','');

  if(foodId){
    const food=vendor.foods.find(item=>item.id===foodId);
    if(!food)return;
    $('#foodItemName').value=food.name||'';
    $('#foodItemPrice').value=food.price||0;
    $('#foodItemCategory').value=food.category||'식사';
    $('#foodItemDescription').value=food.description||'';
    previewImage('menu',food.image||'');
  }

  openOverlay('foodItemEditor');
  setTimeout(()=>$('#foodItemName').focus(),160);
}
$('#saveFoodItemButton').addEventListener('click',async()=>{
  const payload={
    name:$('#foodItemName').value.trim(),
    price:Number($('#foodItemPrice').value||0),
    category:$('#foodItemCategory').value,
    description:$('#foodItemDescription').value.trim(),
    image:state.pendingImage.menu
  };
  if(!payload.name)return toast('음식 이름을 입력해주세요.');

  try{
    await updateManagerFestival(festival=>{
      const foodVendors=normalizeFoodVendors(festival).map(vendor=>{
        if(vendor.id!==state.foodRestaurantId)return vendor;
        const foods=state.editingFoodItemId
          ?vendor.foods.map(food=>food.id===state.editingFoodItemId?{...food,...payload}:food)
          :[...vendor.foods,{id:id(),...payload}];
        return {...vendor,foods};
      });
      return {...festival,foodVendors};
    });
    closeOverlay('foodItemEditor');
    toast('음식이 Firebase에 저장되었습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error))}
});

function openEventEditor(eid=null){const f=managerFestival();state.editingEventId=eid;['eventName','eventDate','eventTime','eventLocation','eventDescription'].forEach(x=>$('#'+x).value='');$('#eventEditorTitle').textContent=eid?'행사 일정 수정':'행사 일정 추가';if(eid){const e=f.events.find(x=>x.id===eid);$('#eventName').value=e.name;$('#eventDate').value=e.date;$('#eventTime').value=e.time;$('#eventLocation').value=e.location;$('#eventDescription').value=e.description}openOverlay('eventEditor')}
$('#addEventButton').addEventListener('click',()=>openEventEditor());$('#saveEventButton').addEventListener('click',async()=>{const p={name:$('#eventName').value.trim(),date:$('#eventDate').value,time:$('#eventTime').value,location:$('#eventLocation').value.trim(),description:$('#eventDescription').value.trim()};if(!p.name)return toast('행사 이름을 입력해주세요.');try{await updateManagerFestival(f=>({...f,events:state.editingEventId?f.events.map(e=>e.id===state.editingEventId?{...e,...p}:e):[...f.events,{id:id(),...p}]}));closeOverlay('eventEditor');toast('행사 일정이 Firebase에 저장되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});
function renderAdminNotices(){const ns=notices();$('#adminNoticeList').innerHTML=ns.length?ns.map(n=>`<article class="admin-notice-card"><div><span class="notice-category">${esc(n.category)} · ${esc(n.audience)}</span><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p></div><div class="item-actions"><button data-view-notice="${n.id}">상세</button><button data-edit-notice="${n.id}">수정</button><button class="danger" data-delete-notice="${n.id}">삭제</button></div></article>`).join(''):'<div class="admin-empty">공지 없음</div>';$$('[data-view-notice]').forEach(b=>b.addEventListener('click',()=>openNoticeDetail(b.dataset.viewNotice)));$$('[data-edit-notice]').forEach(b=>b.addEventListener('click',()=>openNoticeEditor(b.dataset.editNotice)));$$('[data-delete-notice]').forEach(b=>b.addEventListener('click',async()=>{try{await saveNotices(notices().filter(n=>n.id!==b.dataset.deleteNotice));renderAdmin();renderHome();toast('공지가 Firebase에서 삭제되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}}))}
function openReservationMessage(reservationId){
  const reservation=reservationById(reservationId);
  if(!reservation)return toast('예약 정보를 찾지 못했습니다.');
  state.messageReservationId=reservationId;
  const info=resolvedReservationInfo(reservation);
  $('#reservationMessageTarget').textContent=`${info.user} · ${info.boothName} · ${info.time} · ${info.groupSize}명`;
  $('#reservationMessageTitle').value='예약 안내';
  $('#reservationMessageBody').value='';
  $('#reservationMessageError').hidden=true;
  openOverlay('reservationMessageModal');
  setTimeout(()=>$('#reservationMessageBody').focus(),180);
}
function renderAdminReservations(){
  const items=[...reservations()].sort((a,b)=>Number(b.createdAt)-Number(a.createdAt));
  $('#adminReservationList').innerHTML=items.length
    ?items.map(item=>{
      const info=resolvedReservationInfo(item);
      return `<article class="admin-reservation-card">
        <div class="admin-reservation-main"><b>${esc(info.festivalName)} · ${esc(info.boothName)}</b><small>${esc(info.user)} · ${esc(info.location)}</small></div>
        <div class="admin-reservation-chip"><span>시간</span><b>${esc(info.time)}</b></div>
        <div class="admin-reservation-chip"><span>인원</span><b>${info.groupSize}명</b></div>
        <time>${new Date(info.createdAt).toLocaleString('ko-KR')}</time>
        <div class="reservation-admin-actions">
          <button data-admin-reservation-detail="${item.id}">상세</button>
          <button data-message-reservation="${item.id}">메시지</button>
        </div>
      </article>`;
    }).join('')
    :'<div class="admin-empty">아직 예약이 없습니다.</div>';
  $$('[data-admin-reservation-detail]').forEach(button=>button.addEventListener('click',()=>openReservationDetail(button.dataset.adminReservationDetail)));
  $$('[data-message-reservation]').forEach(button=>button.addEventListener('click',()=>openReservationMessage(button.dataset.messageReservation)));
}

$('#sendReservationMessage').addEventListener('click',async()=>{
  const reservationId=state.messageReservationId;
  const title=$('#reservationMessageTitle').value.trim();
  const body=$('#reservationMessageBody').value.trim();
  const errorBox=$('#reservationMessageError');
  errorBox.hidden=true;
  if(!reservationId||!title||!body){
    errorBox.textContent='제목과 내용을 모두 입력해주세요.';
    errorBox.hidden=false;
    return;
  }

  const button=$('#sendReservationMessage');
  button.disabled=true;
  button.textContent='전송 중…';
  try{
    await window.baemoonFirebase.sendReservationMessage(reservationId,{title,body});
    closeOverlay('reservationMessageModal');
    state.messageReservationId=null;
    toast('예약자에게 개인 메시지를 보냈습니다.');
  }catch(error){
    errorBox.textContent=firebaseFriendlyMessage(error);
    errorBox.hidden=false;
  }finally{
    button.disabled=false;
    button.textContent='개인 메시지 보내기';
  }
});
$('#clearReservations').addEventListener('click',async()=>{try{await window.baemoonFirebase.clearReservations();renderAdmin();toast('Firebase 예약 명단을 초기화했습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});$('#downloadAdminCsv').addEventListener('click',()=>{const rs=reservations(),safe=v=>`"${String(v??'').replaceAll('"','""')}"`,csv=['축제,부스,예약자,시간,예약인원,등록시각',...rs.map(r=>[r.festivalName,r.boothName,r.user,r.time,Number(r.groupSize||1),new Date(r.createdAt).toLocaleString('ko-KR')].map(safe).join(','))].join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='baemoon-reservations.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('#eventControlButton').addEventListener('click',()=>openOverlay('alertComposer'));$('#sendAlertButton').addEventListener('click',async()=>{const title=$('#alertTitle').value.trim(),body=$('#alertBody').value.trim();if(!title||!body)return toast('제목과 내용을 입력해주세요.');try{await addNotification({title,body,audience:$('#alertAudience').value,type:'event'});closeOverlay('alertComposer');$('#alertTitle').value='';$('#alertBody').value='';toast('Firebase 알림을 전송했습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});
$('#previewStudentHome').addEventListener('click',()=>route('home',{preview:true}));$('#adminLogout').addEventListener('click',logoutToWelcome);
$('#findRoute').addEventListener('click',()=>{$('#routeResult').innerHTML=`<span class="route-number">1</span><div><b>${esc($('#routeStart').value)} → ${esc($('#routeEnd').value)}</b><small>추천 경로를 지도에 표시했습니다.</small></div>`;toast('경로를 찾았습니다.')});$$('#floorTabs button').forEach(b=>b.addEventListener('click',()=>{$$('#floorTabs button').forEach(x=>x.classList.toggle('active',x===b));$('#floorTitle').textContent=`${b.dataset.floor}층 안내도`}));
function bindZoomables(){$$('.zoomable-image').forEach(el=>{el.onclick=()=>{const src=el.tagName==='IMG'?el.src:el.dataset.image;if(!src)return;$('#lightboxImage').src=src;openOverlay('imageLightbox')}})}


function jumpToAdminSection(targetId){
  const target=document.getElementById(targetId);
  if(!target)return;
  target.scrollIntoView({behavior:'smooth',block:'start'});
  target.classList.remove('admin-jump-highlight');
  requestAnimationFrame(()=>target.classList.add('admin-jump-highlight'));
  setTimeout(()=>target.classList.remove('admin-jump-highlight'),1300);
}
$$('[data-admin-jump]').forEach(item=>{
  const run=()=>jumpToAdminSection(item.dataset.adminJump);
  item.addEventListener('click',run);
  item.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      run();
    }
  });
});

$('#checkFirebaseConnection').addEventListener('click',async()=>{
  setFirebaseStatus('checking','Firebase 전체 연결 확인 중','앱의 모든 Firestore 컬렉션을 확인하고 있습니다.');
  try{
    const result=await window.baemoonFirebase.checkConnection();
    setFirebaseStatus('connected','Firebase 전체 연결됨',`게시글 ${result.posts} · 축제 ${result.festivals} · 급식 ${result.meals} · 예약 ${result.reservations} · 알림 ${result.notifications} · 사진 ${result.media}`);$$('[data-sync-item]').forEach(el=>el.className='');
    toast('Firebase 연결이 정상입니다.');
  }catch(error){
    setFirebaseStatus('error','Firebase 연결 실패',firebaseFriendlyMessage(error));
    toast(firebaseFriendlyMessage(error));
  }
});


$('#adminSaveAll').addEventListener('click',async()=>{
  const button=$('#adminSaveAll');
  button.classList.add('saving');
  button.textContent='저장 중…';
  setFirebaseStatus('saving','관리자 전체 저장 중','공지·일정·축제·급식·게스트 설정과 사진을 서버에 저장합니다.');
  try{
    const result=await window.baemoonFirebase.saveAllAdminData({
      festivals:festivals(),
      meals:meals(),
      notices:notices(),
      dailySchedules:todaySchedules(),
      guestAccess:guestAccess()
    });
    if(result.data){window.firebaseCache.festivals=result.data.festivals;window.firebaseCache.meals=result.data.meals;window.firebaseCache.notices=result.data.notices;window.firebaseCache.dailySchedules=result.data.dailySchedules;window.firebaseCache.guestAccess=result.data.guestAccess}markAdminSaved(`전체 저장 완료 · 축제 ${result.festivals}개 · 공지 ${result.notices}개 · 급식 ${result.meals}개 · 사진 ${result.media}개`);
    setFirebaseStatus('connected','Firebase 연결됨','관리자 변경사항이 모두 서버에 저장되었습니다.');
    toast('관리자 변경사항을 모두 저장했습니다.');
  }catch(error){
    const message=firebaseFriendlyMessage(error);
    markAdminSaveError(message);
    setFirebaseStatus('error','관리자 전체 저장 실패',message);
    toast(message);
  }finally{
    button.classList.remove('saving');
    button.textContent='전체 저장';
  }
});
$('#refreshAdminCommunity').addEventListener('click',async()=>{
  const button=$('#refreshAdminCommunity');
  button.disabled=true;
  button.textContent='불러오는 중…';
  try{
    const count=await window.baemoonFirebase.refreshAdminCommunity();
    renderAdminCommunity();
    toast(`Firebase에서 게시글 ${count}개를 불러왔습니다.`);
  }catch(error){
    toast(firebaseFriendlyMessage(error));
  }finally{
    button.disabled=false;
    button.textContent='새로고침';
  }
});


$('#openAccountGuide').addEventListener('click',()=>openOverlay('accountGuideModal'));
$('#refreshAdminStudents').addEventListener('click',async()=>{
  const button=$('#refreshAdminStudents');
  button.disabled=true;
  button.textContent='불러오는 중…';
  try{
    const count=await window.baemoonFirebase.refreshAdminStudents();
    renderAdminStudents();
    toast(`학생 문서 ${count}개를 Firebase에서 불러왔습니다.`);
  }catch(error){
    toast(firebaseFriendlyMessage(error));
  }finally{
    button.disabled=false;
    button.textContent='새로고침';
  }
});

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
  renderMealCard,
  renderAdminMeals,
  renderFestival,
  renderMy,
  renderHomeReservations,
  renderCommunity,
  renderAdmin,
  renderAdminCommunity,
  renderAdminStudents,
  renderNotices,
  renderTodayCard,
  renderAdminNotices,
  renderAdminToday,
  renderAdminReservations,
  renderNotifications,
  handleBroadcastNotifications,
  handlePersonalNotifications,
  renderGuestSettings,
  applyRoleVisibility,
  imageSrc,
  markAdminSaved,
  openCommunityDetail,
  openOverlay,
  closeOverlay,
  closeAllOverlays,
  toast,
  studentKey,
  studentDisplayId,
  setSession(value){write(KEYS.session,value)},
  setFirebaseStatus,
  clearSession(){localStorage.removeItem(KEYS.session)}
};

window.__baemoonAppReady=true;
window.dispatchEvent(new Event('baemoon:app-ready'));

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

