const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const KEYS={session:'bm_session_v5',today:'bm_today_v5',festivals:'bm_festivals_v5',notices:'bm_notices_v5',notifications:'bm_notifications_v5',notifyEnabled:'bm_notify_enabled_v5',reservations:'bm_reservations_v5',migration:'bm_migration_v6',community:'bm_community_v7',reports:'bm_reports_v7',accounts:'bm_accounts_v7',guestAccess:'bm_guest_access_v7',meals:'bm_meals_v10'};
const state={
  screen:'home',loginRole:'student',currentFestivalId:null,managerFestivalId:null,
  editingFestivalId:null,editingBoothId:null,editingMenuId:null,editingRestaurantId:null,
  editingFoodItemId:null,foodRestaurantId:null,editingEventId:null,editingNoticeId:null,
  editingTodayId:null,editingMealId:null,adminDirty:false,lastDayKey:null,
  pendingImage:{notice:'',booth:'',menu:'',community:'',classChat:'',mapFloor:'',mapPoint:''},
  reservationBoothId:null,currentReservationId:null,messageReservationId:null,
  adminReservationBoothKey:null,boothSlotsDraft:[],
  timetableDay:Math.min(4,Math.max(0,new Date().getDay()-1)),
  communityCategory:'전체',communitySearch:'',currentPostId:null,pendingStudentSession:null,
  deferredPrompt:null,currentMapFloor:1,adminMapFloor:1,adminMapDrafts:{},
  editingMapPointId:null,mapPointDraftPosition:null,currentRoutePath:[],
  suggestionMode:'public',currentSuggestionId:null,loginStatusGroup:'1',
  classChatUnread:0,classChatInitialized:false
};
const read=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}};const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));const id=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove('show'),2200)}
function firebaseFriendlyMessage(error){
  const code=String(error?.code||'');
  const text=String(error?.message||'');
  if(code.includes('permission-denied')||text.includes('permission-denied'))return 'Firestore 규칙이 최신 버전인지 확인해주세요.';
  if(code.includes('unavailable')||code.includes('network')||text.includes('network'))return '인터넷 연결 또는 Firebase 접속 상태를 확인해주세요.';
  if(code.includes('resource-exhausted')||text.includes('larger than')||text.includes('maximum size'))return '행사 사진이 많아 Firestore 문서 용량을 초과했습니다.';
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
function openOverlay(id){
  const overlay=document.getElementById(id);
  if(!overlay)return;
  document.body.appendChild(overlay);
  const opened=$$('.overlay.open').filter(item=>item!==overlay);
  overlay.style.zIndex=String(1200+opened.length*20);
  overlay.classList.add('open');
}
function closeOverlay(id){
  const overlay=document.getElementById(id);
  if(!overlay)return;
  overlay.classList.remove('open');
  overlay.style.removeProperty('z-index');
}
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeOverlay(b.dataset.close)));$$('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o&&o.id!=='passwordChangeModal')o.classList.remove('open')}));
document.addEventListener('click',event=>{
  const closeButton=event.target.closest('[data-close]');
  if(!closeButton)return;
  event.preventDefault();
  event.stopPropagation();
  closeOverlay(closeButton.dataset.close);
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const opened=$$('.overlay.open');
  const top=opened.at(-1);
  if(top&&top.id!=='passwordChangeModal')closeOverlay(top.id);
});

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
    toast('현재 게스트에게 행사가 공개되지 않았습니다.');
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
      .register('./sw-v1121.js',{scope:'./',updateViaCache:'none'})
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
  setFirebaseStatus('saving','Firebase에 저장 중','행사 변경 내용을 서버에 전송하고 있습니다.');
  try{
    const saved=await window.baemoonFirebase.saveFestivals(v);
    write(KEYS.festivals,saved);
    if(window.firebaseCache)window.firebaseCache.festivals=saved;
    setFirebaseStatus('connected','Firebase 연결됨','행사 변경 내용이 서버에 저장되었습니다.');
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
    const restaurantName=legacy.seller||'행사 먹거리';
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
  $('#festivalHomeList').innerHTML=fs.length?fs.map(f=>`<button class="festival-home-card" data-open-festival="${f.id}" style="background:linear-gradient(135deg,${f.color},#111827)"><div class="festival-card-top"><span class="card-tag">${dday(f.start)||'FESTIVAL'}</span><b>${esc(f.year)}</b></div><h3>${esc(f.name)}</h3><p>${esc(f.tagline)}</p></button>`).join(''):'<div class="festival-empty">관리자가 공개한 행사가 없습니다.</div>';
  $$('[data-open-festival]').forEach(b=>b.addEventListener('click',()=>{state.currentFestivalId=b.dataset.openFestival;route('festival')}));
  renderHomeReservations();renderNotices();updateFestivalNav();applyRoleVisibility();
}
function updateFestivalNav(){const f=festivals().find(x=>x.featured&&x.visible)||festivals().find(x=>x.visible);const b=$('#festivalNavButton');if(!f){b.style.setProperty('display','none','important');$('#bottomNav').classList.add('three')}else{b.style.removeProperty('display');$('#bottomNav').classList.remove('three');$('#festivalNavLabel').textContent=f.name;$('#festivalNavIcon').textContent=f.name.slice(0,1);b.onclick=()=>{state.currentFestivalId=f.id;route('festival')}}}
function renderFestival(){
  const festival=selectedFestival();
  if(!festival){toast('공개된 행사가 없습니다.');route('home');return}
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
    ?'시간별 현재 예약 인원을 확인하고 원하는 시간을 선택하세요.'
    :'예약 인원을 선택한 뒤 바로 예약합니다.';

  const times=booth.times?.length?booth.times:['즉시 예약'];
  $('#reservationTimeGrid').innerHTML=times.map((time,index)=>{
    const availability=slotAvailability(festival,booth,time);
    const unavailable=availability.maxForCurrentUser<availability.minPeople;
    return `<button class="${index===0?'selected':''} ${unavailable?'slot-full':''}"
      data-time="${esc(time)}" ${unavailable?'disabled':''}>
      <b>${esc(time)}</b><small>${availability.reserved}/${availability.capacity}명</small>
    </button>`;
  }).join('');

  const firstAvailable=$$('#reservationTimeGrid button').find(button=>!button.disabled);
  $$('#reservationTimeGrid button').forEach(button=>button.classList.remove('selected'));
  if(firstAvailable)firstAvailable.classList.add('selected');

  $$('#reservationTimeGrid button').forEach(button=>button.addEventListener('click',()=>{
    $$('#reservationTimeGrid button').forEach(item=>item.classList.remove('selected'));
    button.classList.add('selected');
    updateReservationPartyAvailability(festival,booth,button.dataset.time);
  }));

  $('#reservationUserLabel').firstChild.textContent=current.role==='student'?'학생 예약자':'게스트 예약자';
  $('#reservationUser').value=current.role==='student'
    ?`${studentDisplayId(current)} ${current.name}`
    :`${current.school} · ${current.name}`;

  const selectedTime=firstAvailable?.dataset.time||times[0];
  updateReservationPartyAvailability(festival,booth,selectedTime);
  openOverlay('reservationModal');
}
$('#confirmReservation').addEventListener('click',async()=>{
  const festival=selectedFestival();
  const booth=festival?.booths?.find(item=>item.id===state.reservationBoothId);
  const user=$('#reservationUser').value.trim();
  if(!booth||!user)return toast('예약자 정보를 확인해주세요.');

  const time=$('#reservationTimeGrid .selected')?.dataset.time||'즉시 예약';
  const availability=slotAvailability(festival,booth,time);
  const groupSize=Number($('#reservationPartySize').value||0);

  if(
    !Number.isInteger(groupSize)
    ||groupSize<availability.minPeople
    ||groupSize>availability.maxForCurrentUser
  ){
    return toast(`이 시간에는 ${availability.minPeople}명 이상 ${availability.maxForCurrentUser}명 이하로 예약할 수 있습니다.`);
  }

  const button=$('#confirmReservation');
  button.disabled=true;
  button.textContent='자리 확인 중…';
  try{
    const result=await createReservation({
      festivalId:festival.id,
      festivalName:festival.name,
      festivalStart:festival.start||'',
      boothId:booth.id,
      boothName:booth.name,
      location:booth.location||'',
      duration:Number(booth.duration||0),
      capacity:availability.capacity,
      minPeople:availability.minPeople,
      groupSize,
      user,
      time
    });

    closeOverlay('reservationModal');
    toast(result?.updated
      ?`${booth.name} 예약 인원을 ${groupSize}명으로 변경했습니다.`
      :`${booth.name} ${groupSize}명 예약이 저장되었습니다.`);
    if(navigator.vibrate)navigator.vibrate([60,40,80]);
    renderMy();
    renderHomeReservations();
  }catch(error){
    toast(firebaseFriendlyMessage(error));
  }finally{
    button.disabled=false;
    button.textContent='예약 확정';
  }
});

function reservations(){return window.firebaseCache?.reservations??[]}
function reservationSlots(){return window.firebaseCache?.reservationSlots??[]}
function reservationSlotId(festivalId,boothId,time){
  return `${festivalId}_${boothId}_${encodeURIComponent(time||'즉시 예약')}`;
}
function reservationSlotRecord(festivalId,boothId,time){
  const slotId=reservationSlotId(festivalId,boothId,time);
  return reservationSlots().find(slot=>slot.id===slotId)||null;
}
function ownReservationForSlot(boothId,time){
  const current=session();
  if(!current)return null;
  return reservations().find(item=>
    item.userUid===current.uid
    &&item.boothId===boothId
    &&String(item.time||'즉시 예약')===String(time||'즉시 예약')
  )||null;
}
function slotAvailability(festival,booth,time){
  const capacity=Math.max(1,Number(booth.capacity||1));
  const minPeople=Math.max(1,Math.min(capacity,Number(booth.minPeople||1)));
  const slot=reservationSlotRecord(festival.id,booth.id,time);
  const reserved=Math.max(0,Number(slot?.reservedPeople||0));
  const ownSize=Math.max(0,Number(ownReservationForSlot(booth.id,time)?.groupSize||0));
  const maxForCurrentUser=Math.max(0,capacity-reserved+ownSize);
  return {capacity,minPeople,reserved,ownSize,maxForCurrentUser,remaining:Math.max(0,capacity-reserved)};
}
function updateReservationPartyAvailability(festival,booth,time){
  const availability=slotAvailability(festival,booth,time);
  const input=$('#reservationPartySize');
  input.min=String(availability.minPeople);
  input.max=String(Math.max(availability.minPeople,availability.maxForCurrentUser));

  const preferred=availability.ownSize||availability.minPeople;
  input.value=String(Math.min(
    Math.max(preferred,availability.minPeople),
    Math.max(availability.minPeople,availability.maxForCurrentUser)
  ));

  const fullForNew=availability.maxForCurrentUser<availability.minPeople;
  input.disabled=fullForNew;
  $('#confirmReservation').disabled=fullForNew;
  $('#reservationPartySizeHint').textContent=fullForNew
    ?`현재 ${availability.reserved}/${availability.capacity}명 · 남은 자리가 부족합니다.`
    :`현재 ${availability.reserved}/${availability.capacity}명 · 예약 가능 최대 ${availability.maxForCurrentUser}명`;
  return availability;
}
function reservationById(reservationId){return reservations().find(item=>item.id===reservationId)}
function resolvedReservationInfo(reservation){
  const festival=festivals().find(item=>item.id===reservation?.festivalId);
  const booth=festival?.booths?.find(item=>item.id===reservation?.boothId);
  return {
    festivalName:reservation?.festivalName||festival?.name||'행사',
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
    ['행사',info.festivalName],
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
    $('#profileDetail').textContent='공개된 행사·급식과 본인 예약만 이용할 수 있습니다.';
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

function guestAccounts(){return window.firebaseCache?.guestProfiles||[]}
function compactStudentCode(account){
  return `${Number(account.grade)}${Number(account.classNo)}${String(Number(account.number)).padStart(2,'0')}`;
}
function sortedStudentAccounts(){
  return [...accounts()].sort((a,b)=>
    Number(a.grade)-Number(b.grade)
    ||Number(a.classNo)-Number(b.classNo)
    ||Number(a.number)-Number(b.number)
    ||String(a.name||'').localeCompare(String(b.name||''),'ko')
  );
}
function loginGroupItems(group=state.loginStatusGroup){
  if(group==='guest'){
    return [...guestAccounts()].sort((a,b)=>
      String(a.school||'').localeCompare(String(b.school||''),'ko')
      ||String(a.name||'').localeCompare(String(b.name||''),'ko')
    );
  }
  return sortedStudentAccounts().filter(account=>String(account.grade)===String(group));
}
function renderLoginStatusGrid(){
  const group=state.loginStatusGroup;
  $$('#loginStatusTabs [data-login-group]').forEach(button=>button.classList.toggle(
    'active',button.dataset.loginGroup===group
  ));
  const items=loginGroupItems(group);
  $('#loginStatusGrid').innerHTML=items.length?items.map(item=>{
    if(group==='guest'){
      return `<article class="login-status-cell guest">
        <b>${esc(item.name||'게스트')}</b>
        <span>${esc(item.school||'소속 학교 미입력')}</span>
      </article>`;
    }
    return `<article class="login-status-cell">
      <b>${compactStudentCode(item)} ${esc(item.name||'학생')}</b>
    </article>`;
  }).join(''):'<div class="admin-empty">해당 그룹의 로그인 기록이 없습니다.</div>';
}
renderAdminStudents=function(){
  const students=sortedStudentAccounts();
  const guests=guestAccounts();
  const counts={
    1:students.filter(item=>Number(item.grade)===1).length,
    2:students.filter(item=>Number(item.grade)===2).length,
    3:students.filter(item=>Number(item.grade)===3).length,
    guest:guests.length
  };
  $('#adminStudentCount').textContent=`${students.length+guests.length}명`;
  $('#adminGrade1Count').textContent=`${counts[1]}명`;
  $('#adminGrade2Count').textContent=`${counts[2]}명`;
  $('#adminGrade3Count').textContent=`${counts[3]}명`;
  $('#adminGuestLoginCount').textContent=`${counts.guest}명`;
  $('#loginTabGrade1Count').textContent=counts[1];
  $('#loginTabGrade2Count').textContent=counts[2];
  $('#loginTabGrade3Count').textContent=counts[3];
  $('#loginTabGuestCount').textContent=counts.guest;
  renderLoginStatusGrid();
};
$('#openLoginStatusDetail').addEventListener('click',()=>{
  state.loginStatusGroup='1';
  renderLoginStatusGrid();
  openOverlay('adminLoginStatusModal');
});
$('#loginStatusTabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-login-group]');
  if(!button)return;
  state.loginStatusGroup=button.dataset.loginGroup;
  renderLoginStatusGrid();
});

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
  $('#adminReservationTotal').textContent=rs.reduce((sum,item)=>sum+Math.max(1,Number(item.groupSize||1)),0);$('#adminFestivalTotal').textContent=fs.filter(f=>f.visible).length;$('#adminNoticeCount').textContent=notices().length;
  renderAdminToday();renderAdminMeals();renderAdminTimetable();
  $('#adminFestivalList').innerHTML=fs.length?fs.map(f=>`<article class="admin-festival-card"><div><span class="notice-category">${f.visible?'공개':'숨김'}${f.featured?' · 대표':''}</span><h3>${esc(f.name)} ${esc(f.year)}</h3><p>${formatDate(f.start)||'날짜 미정'} · 부스 ${(f.booths||[]).length} · 식당 ${normalizeFoodVendors(f).length} · 음식 ${totalFoodItems(f)} · 일정 ${(f.events||[]).length}</p></div><div class="item-actions"><button data-manage-festival="${f.id}">운영 관리</button><button data-toggle-festival="${f.id}">${f.visible?'숨기기':'공개하기'}</button><button class="danger" data-delete-festival="${f.id}">삭제</button></div></article>`).join(''):'<div class="admin-empty">행사를 새로 만들어주세요.</div>';
  $$('[data-manage-festival]').forEach(b=>b.addEventListener('click',()=>selectManagerFestival(b.dataset.manageFestival)));
  $$('[data-toggle-festival]').forEach(b=>b.addEventListener('click',async()=>{try{await saveFestivals(festivals().map(f=>f.id===b.dataset.toggleFestival?{...f,visible:!f.visible}:f));renderAdmin();renderHome();toast('행사 공개 상태가 Firebase에 저장되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}}));
  $$('[data-delete-festival]').forEach(b=>b.addEventListener('click',async()=>{try{await saveFestivals(festivals().filter(f=>f.id!==b.dataset.deleteFestival));if(state.managerFestivalId===b.dataset.deleteFestival)state.managerFestivalId=null;renderAdmin();renderHome();toast('행사가 Firebase에서 삭제되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}}));
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
function resetFestivalEditor(){state.editingFestivalId=null;$('#festivalEditorTitle').textContent='새 행사 만들기';['festivalEditName','festivalEditYear','festivalEditShort','festivalEditTagline','festivalEditDescription','festivalEditStart','festivalEditEnd'].forEach(x=>$('#'+x).value='');$('#festivalEditColor').value='#ff6038';$('#festivalEditVisible').checked=true;$('#festivalEditFeatured').checked=false}
function openFestivalEditor(fid=null){resetFestivalEditor();if(fid){const f=festivals().find(x=>x.id===fid);state.editingFestivalId=fid;$('#festivalEditorTitle').textContent='행사 기본 정보 수정';$('#festivalEditName').value=f.name;$('#festivalEditYear').value=f.year;$('#festivalEditShort').value=f.short;$('#festivalEditTagline').value=f.tagline;$('#festivalEditDescription').value=f.description;$('#festivalEditStart').value=f.start;$('#festivalEditEnd').value=f.end;$('#festivalEditColor').value=f.color;$('#festivalEditVisible').checked=f.visible;$('#festivalEditFeatured').checked=f.featured}openOverlay('festivalEditor')}

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

$('#addFestivalButton').addEventListener('click',()=>openFestivalEditor());$('#editFestivalButton').addEventListener('click',()=>openFestivalEditor(state.managerFestivalId));$('#saveFestivalButton').addEventListener('click',async()=>{const p={name:$('#festivalEditName').value.trim(),year:+$('#festivalEditYear').value||new Date().getFullYear(),short:$('#festivalEditShort').value.trim(),tagline:$('#festivalEditTagline').value.trim(),description:$('#festivalEditDescription').value.trim(),start:$('#festivalEditStart').value,end:$('#festivalEditEnd').value,color:$('#festivalEditColor').value,visible:$('#festivalEditVisible').checked,featured:$('#festivalEditFeatured').checked};if(!p.name)return toast('행사 이름을 입력해주세요.');let fs=festivals();if(p.featured)fs=fs.map(f=>({...f,featured:false}));if(state.editingFestivalId)fs=fs.map(f=>f.id===state.editingFestivalId?{...f,...p}:f);else{const n={id:id(),...p,booths:[],menus:[],foodVendors:[],events:[]};fs.push(n);state.managerFestivalId=n.id}try{await saveFestivals(fs);closeOverlay('festivalEditor');renderAdmin();renderHome();toast('행사가 Firebase에 저장되었습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});
function selectManagerFestival(fid,scroll=true){state.managerFestivalId=fid;const f=festivals().find(x=>x.id===fid);if(!f){$('#festivalManager').hidden=true;return}$('#festivalManager').hidden=false;$('#managerFestivalTitle').textContent=`${f.name} 운영 관리`;$('#managerFestivalMeta').textContent=`${f.year} · ${f.visible?'학생 공개':'학생 숨김'} · ${formatDate(f.start)}`;$('#managerFestivalStatus').textContent=f.featured?'대표 행사':'관리 중';renderManagerLists();if(scroll)$('#festivalManager').scrollIntoView({behavior:'smooth',block:'start'})}
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
function renderBoothSlotDraft(){
  $('#boothSlotList').innerHTML=state.boothSlotsDraft.length
    ?state.boothSlotsDraft.map((slot,index)=>`<button type="button" data-remove-booth-slot="${index}">
      <span>${esc(formatReservationSlot(slot))}</span><b>삭제</b>
    </button>`).join('')
    :'<div class="manager-empty">예약 날짜와 시간을 추가해주세요.</div>';
  $$('[data-remove-booth-slot]').forEach(button=>button.addEventListener('click',()=>{
    state.boothSlotsDraft.splice(Number(button.dataset.removeBoothSlot),1);
    renderBoothSlotDraft();
  }));
}
function openBoothEditor(bid=null){
  const festival=managerFestival();
  state.editingBoothId=bid;
  state.pendingImage.booth='';
  state.boothSlotsDraft=[];
  $('#boothEditorTitle').textContent=bid?'체험 부스 수정':'체험 부스 추가';
  ['boothName','boothOwner','boothLocation','boothDescription','boothImage'].forEach(id=>$('#'+id).value='');
  $('#boothCapacity').value=5;
  $('#boothMinPeople').value=1;
  $('#boothDuration').value=15;
  $('#boothSlotDate').value=festival?.start||localDateKey();
  $('#boothSlotTime').value='13:00';
  previewImage('booth','');
  if(bid){
    const booth=festival.booths.find(item=>item.id===bid);
    $('#boothName').value=booth.name||'';
    $('#boothOwner').value=booth.owner||'';
    $('#boothLocation').value=booth.location||'';
    $('#boothDescription').value=booth.description||'';
    $('#boothCapacity').value=booth.capacity||5;
    $('#boothMinPeople').value=booth.minPeople||1;
    $('#boothDuration').value=booth.duration||15;
    state.boothSlotsDraft=normalizedBoothTimes(booth,festival);
    previewImage('booth',booth.image);
  }
  renderBoothSlotDraft();
  openOverlay('boothEditor');
}
$('#addBoothSlot').addEventListener('click',()=>{
  const date=$('#boothSlotDate').value;
  const time=$('#boothSlotTime').value;
  if(!date||!time)return toast('예약 날짜와 시간을 모두 선택해주세요.');
  const slot=`${date}T${time}`;
  if(state.boothSlotsDraft.includes(slot))return toast('이미 추가한 예약 시간입니다.');
  state.boothSlotsDraft.push(slot);
  state.boothSlotsDraft.sort();
  renderBoothSlotDraft();
});
$('#addBoothButton').addEventListener('click',()=>openBoothEditor());
$('#saveBoothButton').addEventListener('click',async event=>{
  event.stopImmediatePropagation();
  const capacity=Number($('#boothCapacity').value||1);
  const minPeople=Number($('#boothMinPeople').value||1);
  const payload={
    name:$('#boothName').value.trim(),
    owner:$('#boothOwner').value.trim(),
    location:$('#boothLocation').value.trim(),
    description:$('#boothDescription').value.trim(),
    capacity,
    minPeople,
    duration:Number($('#boothDuration').value||1),
    times:[...state.boothSlotsDraft],
    image:state.pendingImage.booth
  };
  if(!payload.name)return toast('부스 이름을 입력해주세요.');
  if(!Number.isInteger(capacity)||capacity<1)return toast('회차 정원은 1명 이상이어야 합니다.');
  if(!Number.isInteger(minPeople)||minPeople<1||minPeople>capacity){
    return toast('최소 예약 인원은 1명 이상이며 회차 정원보다 클 수 없습니다.');
  }
  if(!payload.times.length)return toast('예약 날짜와 시간을 한 개 이상 추가해주세요.');
  try{
    await updateManagerFestival(festival=>({
      ...festival,
      booths:state.editingBoothId
        ?festival.booths.map(booth=>booth.id===state.editingBoothId?{...booth,...payload}:booth)
        :[...festival.booths,{id:id(),...payload}]
    }));
    closeOverlay('boothEditor');
    toast('날짜·시간 예약 부스가 Firebase에 저장되었습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error))}
},true);

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
function adminBoothEntries(){
  return festivals().flatMap(festival=>(festival.booths||[]).map(booth=>({
    festival,
    booth,
    key:`${festival.id}:${booth.id}`
  })));
}
function boothReservations(festivalId,boothId){
  return reservations()
    .filter(item=>item.festivalId===festivalId&&item.boothId===boothId)
    .sort((a,b)=>String(a.time||'').localeCompare(String(b.time||''))||Number(a.createdAt)-Number(b.createdAt));
}
function boothSlotSummary(festival,booth,items){
  const times=booth.times?.length?booth.times:['즉시 예약'];
  return times.map(time=>{
    const matching=items.filter(item=>String(item.time||'즉시 예약')===String(time));
    const people=matching.reduce((sum,item)=>sum+Math.max(1,Number(item.groupSize||1)),0);
    return {time,people,count:matching.length,capacity:Math.max(1,Number(booth.capacity||1))};
  });
}
function openAdminBoothReservations(key){
  const entry=adminBoothEntries().find(item=>item.key===key);
  if(!entry)return toast('부스 정보를 찾지 못했습니다.');
  state.adminReservationBoothKey=key;

  const items=boothReservations(entry.festival.id,entry.booth.id);
  const totalPeople=items.reduce((sum,item)=>sum+Math.max(1,Number(item.groupSize||1)),0);
  const slots=boothSlotSummary(entry.festival,entry.booth,items);

  $('#adminBoothReservationTitle').textContent=`${entry.booth.name} 예약자 명단`;
  $('#adminBoothReservationSummary').textContent=
    `${entry.festival.name} · ${entry.booth.location||'장소 미정'} · 예약 ${items.length}건 · 누적 ${totalPeople}명`;

  $('#adminBoothSlotSummary').innerHTML=slots.map(slot=>`
    <article class="${slot.people>=slot.capacity?'slot-full':''}">
      <span>${esc(formatReservationSlot(slot.time))}</span>
      <b>${slot.people}/${slot.capacity}명</b>
      <small>${slot.count}건</small>
    </article>
  `).join('');

  $('#adminBoothReservationList').innerHTML=items.length
    ?items.map(item=>{
      const info=resolvedReservationInfo(item);
      return `<article class="admin-booth-person-card">
        <div><b>${esc(info.user)}</b><small>${esc(info.time)} · ${info.groupSize}명 · ${new Date(info.createdAt).toLocaleString('ko-KR')}</small></div>
        <div class="reservation-admin-actions">
          <button data-admin-reservation-detail="${item.id}">상세</button>
          <button data-message-reservation="${item.id}">메시지</button>
        </div>
      </article>`;
    }).join('')
    :'<div class="admin-empty">이 부스에는 아직 예약자가 없습니다.</div>';

  $$('#adminBoothReservationList [data-admin-reservation-detail]').forEach(button=>
    button.addEventListener('click',()=>openReservationDetail(button.dataset.adminReservationDetail))
  );
  $$('#adminBoothReservationList [data-message-reservation]').forEach(button=>
    button.addEventListener('click',()=>openReservationMessage(button.dataset.messageReservation))
  );
  openOverlay('adminBoothReservationModal');
}
function renderAdminReservations(){
  const entries=adminBoothEntries();
  const totalPeople=reservations().reduce((sum,item)=>sum+Math.max(1,Number(item.groupSize||1)),0);
  $('#adminReservationTotal').textContent=totalPeople;

  $('#adminReservationList').innerHTML=entries.length
    ?entries.map(entry=>{
      const items=boothReservations(entry.festival.id,entry.booth.id);
      const people=items.reduce((sum,item)=>sum+Math.max(1,Number(item.groupSize||1)),0);
      const slots=boothSlotSummary(entry.festival,entry.booth,items);
      return `<button class="admin-booth-reservation-card" data-admin-booth-reservations="${entry.key}">
        <div class="admin-booth-reservation-main">
          <span>${esc(entry.festival.name)}</span>
          <h3>${esc(entry.booth.name)}</h3>
          <p>${esc(entry.booth.location||'장소 미정')} · 예약 ${items.length}건</p>
        </div>
        <div class="admin-booth-reservation-total">
          <span>누적 예약 인원</span><b>${people}명</b>
        </div>
        <div class="admin-booth-slot-preview">
          ${slots.map(slot=>`<i class="${slot.people>=slot.capacity?'slot-full':''}">${esc(formatReservationSlot(slot.time))} ${slot.people}/${slot.capacity}</i>`).join('')}
        </div>
        <strong>예약자 명단 보기 →</strong>
      </button>`;
    }).join('')
    :'<div class="admin-empty">등록된 체험 부스가 없습니다.</div>';

  $$('[data-admin-booth-reservations]').forEach(button=>
    button.addEventListener('click',()=>openAdminBoothReservations(button.dataset.adminBoothReservations))
  );
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
$('#clearReservations').addEventListener('click',async()=>{try{await window.baemoonFirebase.clearReservations();renderAdmin();toast('Firebase 예약 명단을 초기화했습니다.')}catch(error){toast(firebaseFriendlyMessage(error))}});$('#downloadAdminCsv').addEventListener('click',()=>{const rs=reservations(),safe=v=>`"${String(v??'').replaceAll('"','""')}"`,csv=['행사,부스,예약자,시간,예약인원,등록시각',...rs.map(r=>[r.festivalName,r.boothName,r.user,r.time,Number(r.groupSize||1),new Date(r.createdAt).toLocaleString('ko-KR')].map(safe).join(','))].join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='baemoon-reservations.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
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
    setFirebaseStatus('connected','Firebase 전체 연결됨',`게시글 ${result.posts} · 행사 ${result.festivals} · 급식 ${result.meals} · 예약 ${result.reservations} · 알림 ${result.notifications} · 사진 ${result.media}`);$$('[data-sync-item]').forEach(el=>el.className='');
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
  setFirebaseStatus('saving','관리자 전체 저장 중','공지·일정·행사·급식·게스트 설정과 사진을 서버에 저장합니다.');
  try{
    const result=await window.baemoonFirebase.saveAllAdminData({
      festivals:festivals(),
      meals:meals(),
      notices:notices(),
      dailySchedules:todaySchedules(),
      guestAccess:guestAccess()
    });
    if(result.data){window.firebaseCache.festivals=result.data.festivals;window.firebaseCache.meals=result.data.meals;window.firebaseCache.notices=result.data.notices;window.firebaseCache.dailySchedules=result.data.dailySchedules;window.firebaseCache.guestAccess=result.data.guestAccess}markAdminSaved(`전체 저장 완료 · 행사 ${result.festivals}개 · 공지 ${result.notices}개 · 급식 ${result.meals}개 · 사진 ${result.media}개`);
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


/* v11.18 launch preparation */
function formatReservationSlot(value){
  const raw=String(value||'즉시 예약');
  if(raw==='즉시 예약')return raw;
  const matched=raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if(!matched)return raw;
  const date=new Date(`${matched[1]}T00:00:00`);
  const dateText=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(date);
  return `${dateText} ${matched[2]}`;
}
function normalizedBoothTimes(booth,festival){
  const raw=Array.isArray(booth?.times)?booth.times:[];
  const fallbackDate=festival?.start||localDateKey();
  return raw.map(value=>{
    const text=String(value||'').trim();
    if(!text)return null;
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text))return text;
    if(/^\d{2}:\d{2}$/.test(text))return `${fallbackDate}T${text}`;
    return text;
  }).filter(Boolean);
}
function route(screen,opts={}){
  if(!session()){showAuthGate();return}
  if(isAdmin()&&screen==='home'&&!opts.preview)screen='admin';
  const access=guestAccess();
  if(isGuest()&&['guide','timetable','community','classchat'].includes(screen)){
    toast('학교 내부 메뉴는 학생만 이용할 수 있습니다.');
    screen='home';
  }
  if(isGuest()&&['festivals','festival'].includes(screen)&&!access.festivals){
    toast('현재 게스트에게 행사가 공개되지 않았습니다.');
    screen='home';
  }
  state.screen=screen;
  $$('.screen').forEach(item=>item.classList.toggle('active',item.dataset.screen===screen));
  $$('#bottomNav [data-go]').forEach(button=>{
    const target=screen==='festival'?'festivals':screen;
    button.classList.toggle('active',button.dataset.go===target);
  });
  $('#appShell').classList.toggle('admin-mode',screen==='admin'&&isAdmin());
  if(screen==='admin')renderAdmin();
  if(screen==='festivals')renderFestivalHub();
  if(screen==='festival')renderFestival();
  if(screen==='timetable')renderTimetable();
  if(screen==='community')renderCommunity();
  if(screen==='classchat')renderClassChat();
  if(screen==='my')renderMy();
  applyRoleVisibility();
  window.scrollTo({top:0,behavior:'smooth'});
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
  $$('[data-guest-nav="guide"],[data-guest-nav="timetable"],[data-guest-nav="community"]').forEach(button=>{
    button.hidden=guest;
  });
  $$('[data-guest-nav="festivals"]').forEach(button=>{
    button.hidden=guest&&!access.festivals;
  });
  const navButtons=$$('#bottomNav [data-go]').filter(button=>!button.hidden&&getComputedStyle(button).display!=='none');
  if($('#bottomNav'))$('#bottomNav').style.gridTemplateColumns=`repeat(${Math.max(1,navButtons.length)},1fr)`;
  if(guest&&['guide','timetable','community','classchat'].includes(state.screen)){
    route('home');
  }
}
function renderHome(){
  const access=guestAccess();
  renderTodayCard();
  renderMealCard();
  const visible=(isGuest()&&!access.festivals)?[]:festivals().filter(f=>f.visible);
  $('#festivalHomeCount').textContent=`${visible.length}개`;
  $('#festivalHomeList').innerHTML=visible.length
    ?`<button class="festival-entry-card" id="openFestivalHubFromHome">
        <div><span class="card-tag">FESTIVAL</span><h3>행사 화면 열기</h3>
        <p>${visible.slice(0,3).map(item=>esc(item.name)).join(' · ')}${visible.length>3?' 외':''}</p></div>
        <strong>${visible.length}개 행사 →</strong>
      </button>`
    :'<div class="festival-empty">관리자가 공개한 행사가 없습니다.</div>';
  $('#openFestivalHubFromHome')?.addEventListener('click',()=>route('festivals'));
  renderHomeReservations();
  renderNotices();
  updateFestivalNav();
  applyRoleVisibility();
}
function updateFestivalNav(){
  const button=$('#festivalNavButton');
  const hasFestival=festivals().some(item=>item.visible);
  if(!button)return;
  if(!hasFestival){
    button.style.setProperty('display','none','important');
  }else{
    button.style.removeProperty('display');
    $('#festivalNavLabel').textContent='행사';
    $('#festivalNavIcon').textContent='축';
    button.onclick=()=>route('festivals');
  }
}
function renderFestivalHub(){
  const access=guestAccess();
  const visible=(isGuest()&&!access.festivals)?[]:festivals().filter(item=>item.visible);
  $('#festivalHubCount').textContent=`${visible.length}개`;
  $('#festivalHubList').innerHTML=visible.length
    ?visible.map(festival=>`<button class="festival-hub-card" data-select-festival="${festival.id}" style="--festival-color:${festival.color||'#ff6038'}">
      <div class="festival-hub-card-cover">
        <span>${dday(festival.start)||'FESTIVAL'}</span>
        <b>${esc(String(festival.year||''))}</b>
      </div>
      <div class="festival-hub-card-copy">
        <small>${esc((festival.short||'BAEMOON').toUpperCase())}</small>
        <h2>${esc(festival.name)}</h2>
        <p>${esc(festival.tagline||festival.description||'행사 상세 정보를 확인하세요.')}</p>
        <strong>행사 들어가기 →</strong>
      </div>
    </button>`).join('')
    :'<div class="festival-empty">현재 공개된 행사가 없습니다.</div>';
  $$('[data-select-festival]').forEach(button=>button.addEventListener('click',()=>{
    state.currentFestivalId=button.dataset.selectFestival;
    route('festival');
  }));
}
function renderMenus(festival){
  const vendors=normalizeFoodVendors(festival);
  $('#foodList').innerHTML=vendors.length
    ?vendors.map(vendor=>`<button class="food-vendor-card horizontal" data-open-restaurant="${vendor.id}">
      <header>
        <div><span class="card-tag">FOOD STORE</span><h3>${esc(vendor.name)}</h3></div>
        <p>${esc(vendor.operator||'운영 주체 미등록')} · ${esc(vendor.location||'위치 미정')}</p>
      </header>
      <div class="food-preview-row">
        ${vendor.foods.length?vendor.foods.slice(0,5).map(food=>`
          <div class="food-preview-item">
            <div class="food-preview-image" style="${imageSrc(food.image)?`background-image:url('${imageSrc(food.image)}')`:''}">
              ${food.image?'':esc((food.name||'?').slice(0,1))}
            </div>
            <span>${esc(food.name)}</span>
          </div>`).join(''):'<div class="festival-empty compact">등록된 음식이 없습니다.</div>'}
      </div>
      <strong class="food-detail-link">전체 메뉴 보기 →</strong>
    </button>`).join('')
    :'<div class="festival-empty">등록된 식당이 없습니다.</div>';
  $$('[data-open-restaurant]').forEach(button=>button.addEventListener('click',()=>openRestaurantMenu(button.dataset.openRestaurant)));
}
function openRestaurantMenu(vendorId){
  const festival=selectedFestival();
  const vendor=normalizeFoodVendors(festival).find(item=>item.id===vendorId);
  if(!vendor)return toast('음식점 정보를 찾지 못했습니다.');
  $('#restaurantMenuTitle').textContent=vendor.name;
  $('#restaurantMenuMeta').textContent=`${vendor.operator||'운영 주체 미등록'} · ${vendor.location||'위치 미정'}`;
  $('#restaurantMenuDetailList').innerHTML=vendor.foods.length?vendor.foods.map(food=>`
    <article class="restaurant-menu-detail">
      <div class="restaurant-menu-photo ${food.image?'zoomable-image':''}" data-image="${imageSrc(food.image)}"
        style="${imageSrc(food.image)?`background-image:url('${imageSrc(food.image)}')`:''}">
        ${food.image?'':esc((food.name||'?').slice(0,1))}
      </div>
      <div><span>${esc(food.category||'메뉴')}</span><h3>${esc(food.name)}</h3>
      <p>${esc(food.description||'')}</p><b>${Number(food.price||0).toLocaleString()}원</b></div>
    </article>`).join(''):'<div class="festival-empty">등록된 음식이 없습니다.</div>';
  openOverlay('restaurantMenuModal');
  bindZoomables();
}
function openReservation(boothId){
  const current=session();
  if(!['student','guest'].includes(current?.role))return toast('학생 또는 게스트로 로그인한 뒤 예약할 수 있습니다.');
  if(current.role==='guest'&&!guestAccess().festivals)return toast('현재 게스트 예약이 공개되지 않았습니다.');
  const festival=selectedFestival();
  const booth=festival?.booths?.find(item=>item.id===boothId);
  if(!booth)return;
  state.reservationBoothId=boothId;
  const times=normalizedBoothTimes(booth,festival);
  const slots=times.length?times:['즉시 예약'];
  $('#reservationModalTitle').textContent=booth.name;
  $('#reservationModeText').textContent=times.length
    ?'날짜와 시간별 현재 예약 인원을 확인하고 원하는 회차를 선택하세요.'
    :'예약 인원을 선택한 뒤 바로 예약합니다.';
  $('#reservationTimeGrid').innerHTML=slots.map((time,index)=>{
    const availability=slotAvailability(festival,booth,time);
    const unavailable=availability.maxForCurrentUser<availability.minPeople;
    const label=formatReservationSlot(time);
    const parts=label.split(' ');
    const clock=parts.pop();
    return `<button class="${index===0?'selected':''} ${unavailable?'slot-full':''}"
      data-time="${esc(time)}" ${unavailable?'disabled':''}>
      <b>${esc(parts.join(' ')||label)}</b><em>${esc(clock||'')}</em>
      <small>${availability.reserved}/${availability.capacity}명</small>
    </button>`;
  }).join('');
  const firstAvailable=$$('#reservationTimeGrid button').find(button=>!button.disabled);
  $$('#reservationTimeGrid button').forEach(button=>button.classList.remove('selected'));
  if(firstAvailable)firstAvailable.classList.add('selected');
  $$('#reservationTimeGrid button').forEach(button=>button.addEventListener('click',()=>{
    $$('#reservationTimeGrid button').forEach(item=>item.classList.remove('selected'));
    button.classList.add('selected');
    updateReservationPartyAvailability(festival,booth,button.dataset.time);
  }));
  $('#reservationUserLabel').firstChild.textContent=current.role==='student'?'학생 예약자':'게스트 예약자';
  $('#reservationUser').value=current.role==='student'
    ?`${studentDisplayId(current)} ${current.name}`
    :`${current.school} · ${current.name}`;
  updateReservationPartyAvailability(festival,booth,firstAvailable?.dataset.time||slots[0]);
  openOverlay('reservationModal');
}
function resolvedReservationInfo(reservation){
  const festival=festivals().find(item=>item.id===reservation?.festivalId);
  const booth=festival?.booths?.find(item=>item.id===reservation?.boothId);
  return {
    festivalName:reservation?.festivalName||festival?.name||'행사',
    boothName:reservation?.boothName||booth?.name||'체험 부스',
    location:reservation?.location||booth?.location||'장소 미정',
    duration:reservation?.duration||booth?.duration||'',
    time:formatReservationSlot(reservation?.time||'즉시 예약'),
    user:reservation?.user||`${reservation?.studentKey||''} ${reservation?.name||''}`.trim(),
    groupSize:Math.max(1,Number(reservation?.groupSize||1)),
    createdAt:Number(reservation?.createdAt||Date.now())
  };
}
function renderTimetable(){
  const current=session();
  if(current?.role!=='student'){
    $('#timetableClassLabel').textContent='학생 로그인 후 학급 시간표를 확인할 수 있습니다.';
    $('#timetableDayTabs').innerHTML='';
    $('#timetablePeriodList').innerHTML='<div class="festival-empty">학생 전용 시간표입니다.</div>';
    return;
  }
  const days=['월','화','수','목','금'];
  const dayNames=['월요일','화요일','수요일','목요일','금요일'];
  const timetable=(window.firebaseCache?.timetables||[]).find(item=>
    Number(item.grade)===Number(current.grade)&&Number(item.classNo)===Number(current.classNo)
  );
  $('#timetableClassLabel').textContent=`${current.grade}학년 ${current.classNo}반 시간표`;
  $('#timetableDayTabs').innerHTML=days.map((day,index)=>
    `<button class="${state.timetableDay===index?'active':''}" data-timetable-day="${index}">${day}</button>`
  ).join('');
  $('#timetableDayTitle').textContent=dayNames[state.timetableDay];
  $('#timetableUpdatedAt').textContent=timetable?.updatedAt
    ?`${new Date(timetable.updatedAt).toLocaleDateString('ko-KR')} 수정`
    :'업데이트 없음';
  const subjects=timetable?.days?.[state.timetableDay]||[];
  const periodCount=Math.max(7,subjects.length);
  $('#timetablePeriodList').innerHTML=Array.from({length:periodCount},(_,index)=>{
    const subject=subjects[index]||'수업 없음';
    return `<article class="${subject==='수업 없음'?'empty':''}">
      <span>${index+1}교시</span><b>${esc(subject)}</b>
    </article>`;
  }).join('');
  $$('[data-timetable-day]').forEach(button=>button.addEventListener('click',()=>{
    state.timetableDay=Number(button.dataset.timetableDay);
    renderTimetable();
  }));
}
function timetableDocumentId(grade,classNo){return `g${grade}-c${classNo}`}
function currentAdminTimetable(){
  const grade=Number($('#adminTimetableGrade').value||1);
  const classNo=Number($('#adminTimetableClass').value||1);
  return (window.firebaseCache?.timetables||[]).find(item=>
    Number(item.grade)===grade&&Number(item.classNo)===classNo
  )||{grade,classNo,days:Array.from({length:5},()=>Array(7).fill(''))};
}
function renderAdminTimetable(){
  if(!$('#adminTimetableClass').options.length){
    $('#adminTimetableClass').innerHTML=Array.from({length:15},(_,index)=>`<option value="${index+1}">${index+1}반</option>`).join('');
  }
  const timetable=currentAdminTimetable();
  const dayNames=['월','화','수','목','금'];
  $('#adminTimetableGrid').innerHTML=dayNames.map((day,dayIndex)=>`
    <section><h3>${day}요일</h3>
    ${Array.from({length:7},(_,periodIndex)=>`<label><span>${periodIndex+1}교시</span>
      <input data-timetable-subject="${dayIndex}:${periodIndex}" value="${esc(timetable.days?.[dayIndex]?.[periodIndex]||'')}" placeholder="과목">
    </label>`).join('')}</section>
  `).join('');
}
function classChatKey(){
  const current=session();
  return current?.role==='student'?`g${current.grade}-c${current.classNo}`:'';
}
function renderClassChat(){
  const current=session();
  if(current?.role!=='student'){
    $('#classChatMessages').innerHTML='<div class="festival-empty">학생만 반별 채팅을 이용할 수 있습니다.</div>';
    return;
  }
  $('#classChatTitle').textContent=`${current.grade}학년 ${current.classNo}반 채팅방`;
  $('#classChatMemberLabel').textContent=`${current.grade}-${current.classNo} 실명제`;
  const messages=[...(window.firebaseCache?.classChatMessages||[])].sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
  $('#classChatMessages').innerHTML=messages.length?messages.map(message=>{
    const mine=message.authorUid===current.uid;
    return `<article class="class-chat-message ${mine?'mine':''}">
      <div><b>${esc(message.authorLabel||message.authorName||'학생')}</b>
      <time>${new Date(message.createdAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div>
      <p>${esc(message.body)}</p>
    </article>`;
  }).join(''):'<div class="class-chat-empty">아직 메시지가 없습니다. 첫 메시지를 보내보세요.</div>';
  const box=$('#classChatMessages');
  requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight});
}


$('#backToFestivalHub').addEventListener('click',()=>route('festivals'));
$('#openClassChatButton').addEventListener('click',()=>route('classchat'));
$('#backToCommunity').addEventListener('click',()=>route('community'));
$('#openGuestMessageComposer').addEventListener('click',()=>{
  $('#alertAudience').value='게스트';
  $('#alertTitle').value='게스트 안내';
  $('#alertBody').value='';
  openOverlay('alertComposer');
});
$('#adminTimetableGrade').addEventListener('change',renderAdminTimetable);
$('#adminTimetableClass').addEventListener('change',renderAdminTimetable);


/* ===== v11.21 launch-ready overrides ===== */
const TIMETABLE_KEYS=['mon','tue','wed','thu','fri'];
const TIMETABLE_LABELS=['월요일','화요일','수요일','목요일','금요일'];

function normalizeTimetableDays(value){
  const raw=value?.days??value??{};
  if(Array.isArray(raw)){
    return Object.fromEntries(TIMETABLE_KEYS.map((key,index)=>[
      key,Array.from({length:7},(_,period)=>String(raw?.[index]?.[period]||''))
    ]));
  }
  return Object.fromEntries(TIMETABLE_KEYS.map(key=>[
    key,Array.from({length:7},(_,period)=>String(raw?.[key]?.[period]||''))
  ]));
}
function timetableForStudent(current=session()){
  return (window.firebaseCache?.timetables||[]).find(item=>
    Number(item.grade)===Number(current?.grade)&&Number(item.classNo)===Number(current?.classNo)
  );
}
renderTimetable=function(){
  const current=session();
  if(current?.role!=='student'){
    $('#timetableClassLabel').textContent='학생 로그인 후 학급 시간표를 확인할 수 있습니다.';
    $('#timetableDayTabs').innerHTML='';
    $('#timetablePeriodList').innerHTML='<div class="festival-empty">학생 전용 시간표입니다.</div>';
    return;
  }
  const timetable=timetableForStudent(current);
  const days=normalizeTimetableDays(timetable);
  const todayIndex=new Date().getDay()-1;
  $('#timetableClassLabel').textContent=`${current.grade}학년 ${current.classNo}반 시간표`;
  $('#timetableDayTabs').innerHTML=TIMETABLE_LABELS.map((label,index)=>`
    <button class="${state.timetableDay===index?'active':''}" data-timetable-day="${index}">
      ${label.slice(0,1)}${todayIndex===index?'<small>오늘</small>':''}
    </button>`).join('');
  $('#timetableDayTitle').textContent=TIMETABLE_LABELS[state.timetableDay];
  $('#timetableUpdatedAt').textContent=timetable?.updatedAt
    ?`${new Date(timetable.updatedAt).toLocaleDateString('ko-KR')} 수정`
    :'업데이트 없음';
  const subjects=days[TIMETABLE_KEYS[state.timetableDay]]||[];
  $('#timetablePeriodList').innerHTML=Array.from({length:7},(_,index)=>{
    const subject=subjects[index]||'수업 없음';
    return `<article class="${subject==='수업 없음'?'empty':''}">
      <span>${index+1}교시</span><b>${esc(subject)}</b>
    </article>`;
  }).join('');
  $$('[data-timetable-day]').forEach(button=>button.addEventListener('click',()=>{
    state.timetableDay=Number(button.dataset.timetableDay);
    renderTimetable();
  }));
};
currentAdminTimetable=function(){
  const grade=Number($('#adminTimetableGrade').value||1);
  const classNo=Number($('#adminTimetableClass').value||1);
  const found=(window.firebaseCache?.timetables||[]).find(item=>
    Number(item.grade)===grade&&Number(item.classNo)===classNo
  );
  return found||{grade,classNo,days:Object.fromEntries(TIMETABLE_KEYS.map(key=>[key,Array(7).fill('')]))};
};
renderAdminTimetable=function(){
  if(!$('#adminTimetableClass').options.length){
    $('#adminTimetableClass').innerHTML=Array.from({length:15},(_,index)=>`<option value="${index+1}">${index+1}반</option>`).join('');
  }
  const timetable=currentAdminTimetable();
  const days=normalizeTimetableDays(timetable);
  $('#adminTimetableGrid').innerHTML=TIMETABLE_LABELS.map((dayLabel,dayIndex)=>`
    <section><h3>${dayLabel}</h3>
    ${Array.from({length:7},(_,periodIndex)=>`<label><span>${periodIndex+1}교시</span>
      <input data-timetable-subject="${TIMETABLE_KEYS[dayIndex]}:${periodIndex}"
        value="${esc(days[TIMETABLE_KEYS[dayIndex]][periodIndex]||'')}" placeholder="과목">
    </label>`).join('')}</section>
  `).join('');
};


/* 반별 채팅 이미지와 알림 */
function classChatNotifyEnabled(){
  return window.firebaseCache?.notificationPreference?.classChatEnabled!==false;
}
function renderClassChatNotificationButton(){
  const button=$('#classChatNotificationToggle');
  if(!button)return;
  const enabled=classChatNotifyEnabled();
  button.textContent=enabled?'알림 켜짐':'알림 꺼짐';
  button.setAttribute('aria-pressed',String(enabled));
  button.classList.toggle('off',!enabled);
  const badge=$('#classChatUnreadBadge');
  if(badge){
    badge.hidden=!state.classChatUnread;
    badge.textContent=state.classChatUnread>99?'99+':String(state.classChatUnread);
  }
}
function previewClassChatImage(value){
  state.pendingImage.classChat=value||'';
  const src=imageSrc(value);
  $('#classChatImagePreview').hidden=!src;
  if(src)$('#classChatImagePreviewImg').src=src;
  else $('#classChatImagePreviewImg').removeAttribute('src');
}
$('#classChatImageInput').addEventListener('change',async event=>{
  try{
    previewClassChatImage(await compressImage(event.target.files?.[0]));
    toast('채팅 사진을 추가했습니다.');
  }catch(error){toast(error.message)}
});
$('#removeClassChatImage').addEventListener('click',()=>{
  $('#classChatImageInput').value='';
  previewClassChatImage('');
});
$('#classChatNotificationToggle').addEventListener('click',async()=>{
  const next=!classChatNotifyEnabled();
  try{
    await window.baemoonFirebase.setClassChatNotificationPreference(next);
    window.firebaseCache.notificationPreference={
      ...(window.firebaseCache.notificationPreference||{}),classChatEnabled:next
    };
    renderClassChatNotificationButton();
    toast(next?'반 채팅 알림을 켰습니다.':'반 채팅 알림을 껐습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error))}
});
function classChatSeenKey(){
  return `bm_class_chat_seen_v1119_${session()?.uid||'none'}`;
}
function handleClassChatMessages(items){
  const normalized=[...(items||[])].sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
  const previousIds=new Set((window.firebaseCache?.classChatMessages||[]).map(item=>item.id));
  window.firebaseCache.classChatMessages=normalized;
  const current=session();
  if(state.classChatInitialized){
    const incoming=normalized.filter(item=>
      !previousIds.has(item.id)&&item.authorUid!==current?.uid
    );
    if(incoming.length&&state.screen!=='classchat'){
      state.classChatUnread+=incoming.length;
      const latest=incoming.at(-1);
      toast(`${latest.authorName||'반 친구'}님의 새 메시지가 왔습니다.`);
      if(classChatNotifyEnabled()){
        showDeviceNotification({
          id:`classchat-${latest.id}`,
          title:`${current?.grade}학년 ${current?.classNo}반 채팅`,
          body:latest.body||'사진을 보냈습니다.',
          audience:'전체',
          type:'chat',
          createdAt:latest.createdAt
        });
      }
    }
  }
  state.classChatInitialized=true;
  renderClassChat();
  renderClassChatNotificationButton();
}
renderClassChat=function(){
  const current=session();
  if(current?.role!=='student'){
    $('#classChatMessages').innerHTML='<div class="festival-empty">학생만 반별 채팅을 이용할 수 있습니다.</div>';
    return;
  }
  if(state.screen==='classchat')state.classChatUnread=0;
  $('#classChatTitle').textContent=`${current.grade}학년 ${current.classNo}반 채팅방`;
  const messages=[...(window.firebaseCache?.classChatMessages||[])].sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
  $('#classChatMessages').innerHTML=messages.length?messages.map(message=>{
    const mine=message.authorUid===current.uid;
    const src=imageSrc(message.image);
    return `<article class="class-chat-message ${mine?'mine':''}">
      <div><b>${esc(message.authorLabel||message.authorName||'학생')}</b>
      <time>${new Date(message.createdAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div>
      ${src?`<img class="class-chat-message-image zoomable-image" src="${src}" data-image="${src}" alt="채팅 사진">`:''}
      ${message.body?`<p>${esc(message.body)}</p>`:''}
    </article>`;
  }).join(''):'<div class="class-chat-empty">아직 메시지가 없습니다. 첫 메시지를 보내보세요.</div>';
  renderClassChatNotificationButton();
  bindZoomables();
  const box=$('#classChatMessages');
  requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight});
};
$('#classChatForm').addEventListener('submit',async event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const body=$('#classChatInput').value.trim();
  const image=state.pendingImage.classChat;
  if(!body&&!image)return;
  const button=event.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;
  try{
    await window.baemoonFirebase.sendClassChatMessage({classKey:classChatKey(),body,image});
    $('#classChatInput').value='';
    $('#classChatImageInput').value='';
    previewClassChatImage('');
  }catch(error){toast(firebaseFriendlyMessage(error))}
  finally{button.disabled=false}
},true);

/* 학교 지도 v11.21 - 편집 가능한 교실 블록 구조 */
function schoolMaps(){return window.firebaseCache?.schoolMaps||[]}
function mapSpace(id,name,type,x,y,width,height,rotation=0,links='',extra={}){
  return {
    id,name,baseName:name,type,x,y,width,height,rotation,links,
    description:'',photo:'',background:'#ffffff',textColor:'#111827',
    backgroundImage:'',...extra
  };
}
function defaultSchoolMap(floor){
  const f=Number(floor);

  if(f===1){
    const rooms={};

    rooms['corridor-west']=mapSpace(
      'corridor-west','서쪽 복도','corridor',
      13,52,5.5,72,0,
      '1:corridor-north-west,1:corridor-south-west,1:stairs-west-1,1:stairs-west-2',
      {background:'#d9dde3'}
    );
    rooms['stairs-west-1']=mapSpace(
      'stairs-west-1','서쪽 계단 A','stairs',
      5.5,19,10,12,0,'1:corridor-west,2:stairs-west',
      {background:'#6339a6',textColor:'#ffffff'}
    );
    rooms['stairs-west-2']=mapSpace(
      'stairs-west-2','서쪽 계단 B','stairs',
      5.5,72,10,12,0,'1:corridor-west,2:stairs-west',
      {background:'#6339a6',textColor:'#ffffff'}
    );
    rooms['west-room-1']=mapSpace('west-room-1','1층 교실 A','room',5.5,34,10,13,0,'1:corridor-west');
    rooms['west-room-2']=mapSpace('west-room-2','1층 교실 B','room',5.5,49,10,13,0,'1:corridor-west');
    rooms['west-room-3']=mapSpace('west-room-3','1층 교실 C','room',5.5,88,10,11,0,'1:corridor-west');

    rooms['corridor-north-west']=mapSpace(
      'corridor-north-west','북쪽 복도 서편','corridor',
      31,15,31,5.5,0,'1:corridor-west,1:corridor-north-east,1:corridor-ring-west',
      {background:'#d9dde3'}
    );
    rooms['corridor-north-east']=mapSpace(
      'corridor-north-east','북쪽 복도 동편','corridor',
      62,15,31,5.5,0,'1:corridor-north-west,1:corridor-east,1:corridor-ring-east',
      {background:'#d9dde3'}
    );
    const northNames=['준비실','음악실','미술실','동아리실','상담실','학생회실'];
    northNames.forEach((name,index)=>{
      const id=`north-room-${index+1}`;
      const x=22+index*10;
      rooms[id]=mapSpace(id,name,'room',x,7.2,9,9,0,
        index<3?'1:corridor-north-west':'1:corridor-north-east');
    });

    rooms['corridor-ring-west']=mapSpace(
      'corridor-ring-west','중앙 서쪽 복도','corridor',
      28,47,5,49,7,'1:corridor-north-west,1:corridor-ring-south-west,1:hall-main',
      {background:'#d9dde3'}
    );
    rooms['corridor-ring-east']=mapSpace(
      'corridor-ring-east','중앙 동쪽 복도','corridor',
      72,46,5,50,-5,'1:corridor-north-east,1:corridor-ring-south-east,1:hall-main,1:corridor-east',
      {background:'#d9dde3'}
    );
    rooms['corridor-ring-south-west']=mapSpace(
      'corridor-ring-south-west','중앙 남서 복도','corridor',
      40,78,28,5,20,'1:corridor-ring-west,1:corridor-ring-south-east,1:corridor-south-west',
      {background:'#d9dde3'}
    );
    rooms['corridor-ring-south-east']=mapSpace(
      'corridor-ring-south-east','중앙 남동 복도','corridor',
      61,79,28,5,-14,'1:corridor-ring-east,1:corridor-ring-south-west,1:corridor-south-east',
      {background:'#d9dde3'}
    );

    rooms['hall-main']=mapSpace(
      'hall-main','중앙 행사장','hall',
      50,46,36,39,0,
      '1:corridor-ring-west,1:corridor-ring-east,1:corridor-ring-south-west,1:corridor-ring-south-east',
      {background:'#f5f1e7',clipPath:'polygon(8% 0,92% 0,100% 18%,94% 88%,55% 100%,7% 86%,0 22%)'}
    );

    rooms['center-booth-1']=mapSpace(
      'center-booth-1','행사 공간 A','room',
      36,61,14,12,-20,'1:corridor-ring-west,1:corridor-ring-south-west'
    );
    rooms['center-booth-2']=mapSpace(
      'center-booth-2','행사 공간 B','room',
      50,68,16,12,8,'1:corridor-ring-south-west,1:corridor-ring-south-east'
    );
    rooms['center-booth-3']=mapSpace(
      'center-booth-3','행사 공간 C','room',
      64,61,14,12,18,'1:corridor-ring-east,1:corridor-ring-south-east'
    );
    rooms['center-booth-4']=mapSpace(
      'center-booth-4','행사 공간 D','room',
      48,87,16,10,-5,'1:corridor-ring-south-west'
    );
    rooms['center-booth-5']=mapSpace(
      'center-booth-5','행사 공간 E','room',
      66,87,14,10,-18,'1:corridor-ring-south-east'
    );

    rooms['corridor-east']=mapSpace(
      'corridor-east','동쪽 복도','corridor',
      81,50,5.5,66,0,'1:corridor-north-east,1:corridor-south-east,1:stairs-east,1:hall-east',
      {background:'#d9dde3'}
    );
    rooms['stairs-east']=mapSpace(
      'stairs-east','동쪽 계단','stairs',
      88,17,9,12,0,'1:corridor-east,2:stairs-east',
      {background:'#6339a6',textColor:'#ffffff'}
    );
    rooms['hall-east']=mapSpace(
      'hall-east','강당·체육관','hall',
      93,52,12,58,0,'1:corridor-east',
      {background:'#eee7f7'}
    );

    rooms['corridor-south-west']=mapSpace(
      'corridor-south-west','남서 복도','corridor',
      25,93,28,5,0,'1:corridor-west,1:corridor-ring-south-west,1:entrance-main',
      {background:'#d9dde3'}
    );
    rooms['corridor-south-east']=mapSpace(
      'corridor-south-east','남동 복도','corridor',
      73,94,27,5,0,'1:corridor-east,1:corridor-ring-south-east,1:entrance-main',
      {background:'#d9dde3'}
    );
    rooms['entrance-main']=mapSpace(
      'entrance-main','본관 출입구','entrance',
      50,96,16,7,0,'1:corridor-south-west,1:corridor-south-east',
      {background:'#dff4e7'}
    );

    return {
      id:'floor-1',floor:1,title:'1층 행사 안내도',
      background:'#faf9f5',backgroundImage:'',layoutVersion:3,points:rooms
    };
  }

  const grade=f===2?2:3;
  const rooms={};
  const corridorIds=['corridor-w','corridor-mw','corridor-me','corridor-e'];
  const corridorXs=[21,41,61,81];

  corridorIds.forEach((id,index)=>{
    const links=[];
    if(index>0)links.push(`${f}:${corridorIds[index-1]}`);
    if(index<corridorIds.length-1)links.push(`${f}:${corridorIds[index+1]}`);
    rooms[id]=mapSpace(
      id,`${f}층 중앙 복도 ${index+1}`,'corridor',
      corridorXs[index],52,21,7,0,links.join(','),
      {background:'#d9dde3'}
    );
  });

  const westFloorLinks=f===2
    ?`${f}:corridor-w,1:stairs-west-1,3:stairs-west`
    :`${f}:corridor-w,2:stairs-west`;
  const eastFloorLinks=f===2
    ?`${f}:corridor-e,1:stairs-east,3:stairs-east`
    :`${f}:corridor-e,2:stairs-east`;

  rooms['stairs-west']=mapSpace(
    'stairs-west','서쪽 계단','stairs',
    7,29,9,18,0,westFloorLinks,
    {background:'#6339a6',textColor:'#ffffff'}
  );
  rooms['stairs-east']=mapSpace(
    'stairs-east','동쪽 계단','stairs',
    93,69,9,18,0,eastFloorLinks,
    {background:'#6339a6',textColor:'#ffffff'}
  );

  for(let index=0;index<8;index++){
    const roomNo=index+1;
    const id=`room-${grade}-${roomNo}`;
    const x=18+index*9.5;
    const corridorIndex=Math.min(3,Math.floor(index/2));
    rooms[id]=mapSpace(
      id,`${grade}-${roomNo}`,'room',
      x,27,8.5,18,0,`${f}:${corridorIds[corridorIndex]}`
    );
  }

  const lowerNames=f===2
    ?['시청각실','도서관','컴퓨터실','과학실','상담실','동아리실']
    :['진로활동실','대회의실','미디어실','과학실','상담실','동아리실'];

  lowerNames.forEach((name,index)=>{
    const id=`lower-room-${index+1}`;
    const x=22+index*12;
    const corridorIndex=Math.min(3,Math.floor(index/1.5));
    rooms[id]=mapSpace(
      id,name,'room',
      x,76,10.5,18,0,`${f}:${corridorIds[corridorIndex]}`
    );
  });

  rooms['restroom-west']=mapSpace(
    'restroom-west','화장실','restroom',
    8,74,8,16,0,`${f}:corridor-w`,
    {background:'#fff1d6'}
  );
  rooms['restroom-east']=mapSpace(
    'restroom-east','화장실','restroom',
    92,27,8,16,0,`${f}:corridor-e`,
    {background:'#fff1d6'}
  );

  return {
    id:`floor-${f}`,floor:f,title:`${f}층 행사 안내도`,
    background:'#fbfaf7',backgroundImage:'',layoutVersion:3,points:rooms
  };
}
function cloneMap(value){return JSON.parse(JSON.stringify(value))}
function floorMap(floor){
  const base=defaultSchoolMap(floor);
  const saved=schoolMaps().find(item=>Number(item.floor)===Number(floor));
  if(!saved||Number(saved.layoutVersion||0)<3)return cloneMap(base);
  const savedPoints=saved.points&&typeof saved.points==='object'&&!Array.isArray(saved.points)
    ?saved.points:null;
  return {
    ...base,...saved,
    background:saved.background||base.background,
    backgroundImage:saved.backgroundImage||'',
    points:savedPoints&&Object.keys(savedPoints).length?savedPoints:base.points
  };
}
function mapPoints(doc){
  const points=doc?.points&&typeof doc.points==='object'&&!Array.isArray(doc.points)?doc.points:{};
  return Object.values(points).map(point=>({
    width:Number(point.width||12),height:Number(point.height||10),
    rotation:Number(point.rotation||0),background:point.background||'#ffffff',
    textColor:point.textColor||'#111827',backgroundImage:point.backgroundImage||'',
    ...point,floor:Number(point.floor||doc.floor),globalId:`${Number(point.floor||doc.floor)}:${point.id}`
  }));
}
function allMapPoints(){return [1,2,3].flatMap(floor=>mapPoints(floorMap(floor)))}
function mapPointByGlobalId(globalId){return allMapPoints().find(point=>point.globalId===globalId)}
function mapRoomStyle(point){
  const image=imageSrc(point.backgroundImage);
  return [
    `left:${Number(point.x||50)}%`,
    `top:${Number(point.y||50)}%`,
    `width:${Number(point.width||12)}%`,
    `height:${Number(point.height||10)}%`,
    `transform:translate(-50%,-50%) rotate(${Number(point.rotation||0)}deg)`,
    `background-color:${point.background||'#ffffff'}`,
    `color:${point.textColor||'#111827'}`,
    image?`background-image:linear-gradient(rgba(17,24,39,.18),rgba(17,24,39,.18)),url("${image}")`:'',
    point.clipPath?`clip-path:${point.clipPath}`:''
  ].filter(Boolean).join(';');
}
function renderRouteSelectors(){
  const points=allMapPoints()
    .filter(point=>point.type!=='corridor')
    .sort((a,b)=>a.floor-b.floor||String(a.name).localeCompare(String(b.name),'ko'));
  const startValue=$('#routeStart').value;
  const endValue=$('#routeEnd').value;
  const options='<option value="">선택하세요</option>'+points.map(point=>
    `<option value="${esc(point.globalId)}">${point.floor}F · ${esc(point.name)}</option>`
  ).join('');
  $('#routeStart').innerHTML=options;
  $('#routeEnd').innerHTML=options;
  if(points.some(point=>point.globalId===startValue))$('#routeStart').value=startValue;
  if(points.some(point=>point.globalId===endValue))$('#routeEnd').value=endValue;
}
function currentRouteSegment(floor){
  return (state.currentRoutePath||[]).filter(point=>Number(point.floor)===Number(floor));
}
function renderGuide(){
  const map=floorMap(state.currentMapFloor);
  const points=mapPoints(map);
  $$('#floorTabs button').forEach(button=>button.classList.toggle(
    'active',Number(button.dataset.floor)===Number(state.currentMapFloor)
  ));
  $('#floorTitle').textContent=map.title||`${state.currentMapFloor}층 안내도`;
  $('#mapPointCount').textContent=`${points.filter(point=>point.type!=='corridor').length}개 공간`;

  const blueprint=$('#schoolBlueprint');
  const floorImage=imageSrc(map.backgroundImage);
  blueprint.style.backgroundColor=map.background||'#f5f2ea';
  blueprint.style.backgroundImage=floorImage?`url("${floorImage}")`:'';
  blueprint.innerHTML=points.map(point=>`
    <button class="school-map-room map-type-${esc(point.type||'room')}"
      style="${mapRoomStyle(point)}" data-map-point="${esc(point.globalId)}"
      title="${esc(point.name)}">
      <span>${esc(point.name)}</span>
      ${point.baseName&&point.baseName!==point.name?`<small>${esc(point.baseName)}</small>`:''}
    </button>`).join('');
  $('#mapEmptyState').hidden=points.length>0;

  $$('[data-map-point]').forEach(button=>button.addEventListener('click',()=>{
    openMapPointDetail(button.dataset.mapPoint);
  }));

  const segment=currentRouteSegment(state.currentMapFloor);
  const overlay=$('#routeOverlay');
  if(segment.length>=2){
    const path=segment.map(point=>`${Number(point.x||50)*10},${Number(point.y||50)*7}`).join(' ');
    overlay.innerHTML=`<polyline points="${path}" class="map-route-line"></polyline>`+
      segment.map((point,index)=>`<circle cx="${Number(point.x||50)*10}" cy="${Number(point.y||50)*7}"
        r="${index===0||index===segment.length-1?13:8}" class="map-route-node"></circle>`).join('');
  }else overlay.innerHTML='';
  renderRouteSelectors();
}
function openMapPointDetail(globalId){
  const point=mapPointByGlobalId(globalId);
  if(!point)return;
  state.mapPointDetailId=globalId;
  $('#mapPointDetailFloor').textContent=`${point.floor}F · ${point.baseName||point.name}`;
  $('#mapPointDetailName').textContent=point.name;
  $('#mapPointDetailDescription').textContent=point.description||'등록된 상세 설명이 없습니다.';
  const src=imageSrc(point.photo||point.backgroundImage);
  const photo=$('#mapPointDetailPhoto');
  photo.style.backgroundImage=src?`url("${src}")`:'';
  photo.classList.toggle('empty',!src);
  photo.textContent=src?'':'사진 없음';
  openOverlay('mapPointDetailModal');
}
$('#mapPointSetDestination').addEventListener('click',()=>{
  const point=mapPointByGlobalId(state.mapPointDetailId);
  if(!point)return;
  state.currentMapFloor=point.floor;
  renderGuide();
  $('#routeEnd').value=point.globalId;
  closeOverlay('mapPointDetailModal');
  toast('목적지로 설정했습니다. 출발지를 선택해주세요.');
});
function edgeDistance(a,b){
  const floorPenalty=Math.abs(Number(a.floor)-Number(b.floor))*120;
  return Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y))+floorPenalty;
}
function buildMapGraph(){
  const points=allMapPoints();
  const byId=new Map(points.map(point=>[point.globalId,point]));
  const edges=new Map(points.map(point=>[point.globalId,new Map()]));
  const link=(a,b)=>{
    if(!byId.has(a)||!byId.has(b)||a===b)return;
    const distance=edgeDistance(byId.get(a),byId.get(b));
    edges.get(a).set(b,Math.min(edges.get(a).get(b)??Infinity,distance));
    edges.get(b).set(a,Math.min(edges.get(b).get(a)??Infinity,distance));
  };
  points.forEach(point=>{
    String(point.links||'').split(',').map(value=>value.trim()).filter(Boolean)
      .forEach(target=>link(point.globalId,target));
  });
  return {points,byId,edges};
}
function shortestMapPath(startId,endId){
  const {points,byId,edges}=buildMapGraph();
  if(!byId.has(startId)||!byId.has(endId))return [];
  const dist=new Map(points.map(point=>[point.globalId,Infinity]));
  const prev=new Map();
  const unvisited=new Set(points.map(point=>point.globalId));
  dist.set(startId,0);
  while(unvisited.size){
    let current=null,best=Infinity;
    unvisited.forEach(id=>{if(dist.get(id)<best){best=dist.get(id);current=id}});
    if(current===null||best===Infinity)break;
    unvisited.delete(current);
    if(current===endId)break;
    edges.get(current)?.forEach((weight,next)=>{
      if(!unvisited.has(next))return;
      const candidate=best+weight;
      if(candidate<dist.get(next)){dist.set(next,candidate);prev.set(next,current)}
    });
  }
  const ids=[];
  let cursor=endId;
  while(cursor){ids.unshift(cursor);if(cursor===startId)break;cursor=prev.get(cursor)}
  return ids[0]===startId?ids.map(id=>byId.get(id)):[];
}
function routeStepText(path){
  if(!path.length)return [];
  const steps=[`${path[0].floor}층 ${path[0].name}에서 출발합니다.`];
  for(let index=1;index<path.length;index++){
    const before=path[index-1],current=path[index];
    if(before.floor!==current.floor){
      const method=[before.type,current.type].includes('elevator')?'엘리베이터':'계단';
      steps.push(`${method}을 이용해 ${current.floor}층으로 이동합니다.`);
    }else if(index===path.length-1){
      steps.push(`${current.name}에 도착합니다.`);
    }else{
      steps.push(`${current.name} 방향으로 이동합니다.`);
    }
  }
  return steps;
}
function runRouteSearch(){
  const startId=$('#routeStart').value,endId=$('#routeEnd').value;
  if(!startId||!endId)return toast('출발지와 목적지를 모두 선택해주세요.');
  if(startId===endId)return toast('출발지와 목적지가 같습니다.');
  const path=shortestMapPath(startId,endId);
  if(!path.length)return toast('연결된 경로를 찾지 못했습니다. 관리자 지도에서 공간 연결을 확인해주세요.');
  state.currentRoutePath=path;
  state.currentMapFloor=path[0].floor;
  const steps=routeStepText(path);
  $('#routeResult').innerHTML=`<span class="route-number">${path.length}</span><div>
    <b>${esc(path[0].name)} → ${esc(path.at(-1).name)}</b>
    <small>${path.length}개 공간을 연결한 추천 경로입니다.</small></div>`;
  $('#routeStepList').innerHTML=steps.map((step,index)=>`
    <article><span>${index+1}</span><p>${esc(step)}</p></article>`).join('');
  renderGuide();
  toast('추천 경로를 표시했습니다.');
}
$('#findRoute').addEventListener('click',event=>{
  event.preventDefault();event.stopImmediatePropagation();runRouteSearch();
},true);
$('#swapRoutePoints').addEventListener('click',()=>{
  const start=$('#routeStart').value;
  $('#routeStart').value=$('#routeEnd').value;
  $('#routeEnd').value=start;
});
$('#floorTabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-floor]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  state.currentMapFloor=Number(button.dataset.floor);
  renderGuide();
},true);

/* 관리자 지도 편집 */
function ensureAdminMapDraft(floor=state.adminMapFloor){
  const key=String(floor);
  if(!state.adminMapDrafts[key]){
    state.adminMapDrafts[key]=cloneMap(floorMap(floor));
  }
  return state.adminMapDrafts[key];
}
function allDraftMapPoints(){
  return [1,2,3].flatMap(floor=>{
    const doc=state.adminMapDrafts[String(floor)]||floorMap(floor);
    return mapPoints(doc);
  });
}
function renderAdminMap(){
  const draft=ensureAdminMapDraft();
  $$('#adminMapFloorTabs [data-admin-map-floor]').forEach(button=>button.classList.toggle(
    'active',Number(button.dataset.adminMapFloor)===state.adminMapFloor
  ));
  $('#adminMapTitle').value=draft.title||`${state.adminMapFloor}층 안내도`;
  $('#adminMapBackgroundColor').value=draft.background||'#f5f2ea';

  const blueprint=$('#adminMapBlueprint');
  const floorImage=imageSrc(draft.backgroundImage);
  blueprint.style.backgroundColor=draft.background||'#f5f2ea';
  blueprint.style.backgroundImage=floorImage?`url("${floorImage}")`:'';
  const points=mapPoints(draft);
  blueprint.innerHTML=points.map(point=>`
    <button class="school-map-room admin-map-room map-type-${esc(point.type||'room')}"
      style="${mapRoomStyle(point)}" data-edit-map-point="${esc(point.id)}">
      <span>${esc(point.name)}</span>
      ${point.baseName&&point.baseName!==point.name?`<small>${esc(point.baseName)}</small>`:''}
    </button>`).join('');

  $('#adminMapPointList').innerHTML=points.length?points.map(point=>`
    <article>
      <div><b>${esc(point.name)}</b>
      <small>${esc(point.baseName||point.type)} · ${Number(point.width).toFixed(1)}×${Number(point.height).toFixed(1)}%</small></div>
      <div><button data-edit-map-point="${esc(point.id)}">수정</button>
      <button class="danger" data-delete-map-point="${esc(point.id)}">삭제</button></div>
    </article>`).join(''):'<div class="admin-empty">등록된 공간이 없습니다.</div>';

  $$('[data-edit-map-point]').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation();
    openMapPointEditor(button.dataset.editMapPoint);
  }));
  $$('[data-delete-map-point]').forEach(button=>button.addEventListener('click',()=>{
    delete draft.points[button.dataset.deleteMapPoint];
    renderAdminMap();
  }));
}
function previewMapPointPhoto(value){
  state.pendingImage.mapPoint=value||'';
  const src=imageSrc(value);
  $('#mapPointPhotoPreview').hidden=!src;
  if(src)$('#mapPointPhotoPreviewImg').src=src;
  else $('#mapPointPhotoPreviewImg').removeAttribute('src');
}
function previewMapRoomBackground(value){
  state.pendingImage.mapRoom=value||'';
  const src=imageSrc(value);
  $('#mapRoomBackgroundPreview').hidden=!src;
  if(src)$('#mapRoomBackgroundPreviewImg').src=src;
  else $('#mapRoomBackgroundPreviewImg').removeAttribute('src');
}
function renderMapPointLinkOptions(currentId=''){
  const currentGlobal=`${state.adminMapFloor}:${currentId}`;
  const current=ensureAdminMapDraft().points?.[currentId];
  const selected=new Set(String(current?.links||'').split(',').filter(Boolean));
  $('#mapPointLinkOptions').innerHTML=allDraftMapPoints()
    .filter(point=>point.globalId!==currentGlobal)
    .sort((a,b)=>a.floor-b.floor||String(a.name).localeCompare(String(b.name),'ko'))
    .map(point=>`<label><input type="checkbox" value="${esc(point.globalId)}"
      ${selected.has(point.globalId)?'checked':''}>
      <span>${point.floor}F · ${esc(point.name)}</span></label>`).join('')||
      '<small>먼저 다른 공간을 등록해주세요.</small>';
}
function openMapPointEditor(pointId=null,position=null){
  const draft=ensureAdminMapDraft();
  const point=pointId?draft.points?.[pointId]:null;
  state.editingMapPointId=pointId;
  $('#mapPointEditorTitle').textContent=point?'교실·시설 수정':'공간 추가';
  $('#mapPointName').value=point?.name||'';
  $('#mapPointBaseName').value=point?.baseName||point?.name||'';
  $('#mapPointType').value=point?.type||'room';
  $('#mapPointDescription').value=point?.description||'';
  $('#mapRoomBackgroundColor').value=point?.background||'#ffffff';
  $('#mapRoomTextColor').value=point?.textColor||'#111827';
  $('#mapPointX').value=Number(point?.x??position?.x??50).toFixed(1);
  $('#mapPointY').value=Number(point?.y??position?.y??50).toFixed(1);
  $('#mapPointWidth').value=Number(point?.width??12).toFixed(1);
  $('#mapPointHeight').value=Number(point?.height??10).toFixed(1);
  $('#mapPointRotation').value=Number(point?.rotation??0).toFixed(0);
  previewMapPointPhoto(point?.photo||'');
  previewMapRoomBackground(point?.backgroundImage||'');
  renderMapPointLinkOptions(pointId||'');
  openOverlay('mapPointEditorModal');
}
$('#adminMapFloorTabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-admin-map-floor]');
  if(!button)return;
  state.adminMapFloor=Number(button.dataset.adminMapFloor);
  renderAdminMap();
});
$('#adminMapBackgroundColor').addEventListener('input',event=>{
  ensureAdminMapDraft().background=event.target.value;
  renderAdminMap();
});
$('#adminMapBackgroundImageInput').addEventListener('change',async event=>{
  try{
    ensureAdminMapDraft().backgroundImage=await compressImage(event.target.files?.[0]);
    renderAdminMap();
    toast(`${state.adminMapFloor}층 배경을 설정했습니다.`);
  }catch(error){toast(error.message)}
});
$('#resetDefaultSchoolMap').addEventListener('click',()=>{
  if(!confirm(`${state.adminMapFloor}층을 기본 구조로 다시 불러올까요? 현재 수정 내용은 사라집니다.`))return;
  state.adminMapDrafts[String(state.adminMapFloor)]=cloneMap(defaultSchoolMap(state.adminMapFloor));
  renderAdminMap();
  toast('기본 학교 구조를 다시 불러왔습니다.');
});
$('#adminMapPreview').addEventListener('click',event=>{
  if(event.target.closest('[data-edit-map-point]'))return;
  const rect=$('#adminMapPreview').getBoundingClientRect();
  openMapPointEditor(null,{
    x:Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),
    y:Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))
  });
});
$('#addMapPointButton').addEventListener('click',()=>openMapPointEditor());
$('#mapPointPhotoInput').addEventListener('change',async event=>{
  try{previewMapPointPhoto(await compressImage(event.target.files?.[0]))}
  catch(error){toast(error.message)}
});
$('#removeMapPointPhoto').addEventListener('click',()=>previewMapPointPhoto(''));
$('#mapRoomBackgroundImageInput').addEventListener('change',async event=>{
  try{previewMapRoomBackground(await compressImage(event.target.files?.[0]))}
  catch(error){toast(error.message)}
});
$('#removeMapRoomBackground').addEventListener('click',()=>previewMapRoomBackground(''));
$('#saveMapPointButton').addEventListener('click',()=>{
  const draft=ensureAdminMapDraft();
  const name=$('#mapPointName').value.trim();
  if(!name)return toast('표시 이름을 입력해주세요.');
  const pointId=state.editingMapPointId||id();
  const links=$$('#mapPointLinkOptions input:checked').map(input=>input.value).join(',');
  draft.points=draft.points||{};
  draft.points[pointId]={
    id:pointId,floor:state.adminMapFloor,name,
    baseName:$('#mapPointBaseName').value.trim()||name,
    type:$('#mapPointType').value,
    description:$('#mapPointDescription').value.trim(),
    photo:state.pendingImage.mapPoint||'',
    backgroundImage:state.pendingImage.mapRoom||'',
    background:$('#mapRoomBackgroundColor').value||'#ffffff',
    textColor:$('#mapRoomTextColor').value||'#111827',
    x:Number($('#mapPointX').value||50),
    y:Number($('#mapPointY').value||50),
    width:Number($('#mapPointWidth').value||12),
    height:Number($('#mapPointHeight').value||10),
    rotation:Number($('#mapPointRotation').value||0),
    links
  };
  closeOverlay('mapPointEditorModal');
  renderAdminMap();
});
$('#saveAdminMapFloor').addEventListener('click',async()=>{
  const draft=ensureAdminMapDraft();
  draft.title=$('#adminMapTitle').value.trim()||`${state.adminMapFloor}층 안내도`;
  draft.background=$('#adminMapBackgroundColor').value||'#f5f2ea';
  draft.layoutVersion=2;
  const button=$('#saveAdminMapFloor');
  button.disabled=true;button.textContent='저장 중…';
  try{
    const saved=await window.baemoonFirebase.saveSchoolMap(draft);
    state.adminMapDrafts[String(state.adminMapFloor)]=cloneMap(saved);
    toast(`${state.adminMapFloor}층 학교 구조를 저장했습니다.`);
  }catch(error){toast(firebaseFriendlyMessage(error))}
  finally{button.disabled=false;button.textContent='층 지도 저장'}
});

/* 건의함 */
function suggestions(){return window.firebaseCache?.suggestions||[]}
function currentSuggestion(){return suggestions().find(item=>item.id===state.currentSuggestionId)}
function suggestionOwnerLabel(item){
  if(!isAdmin())return item.visibility==='private'?'내 비공개 건의':'익명 건의자';
  const user=accounts().find(account=>account.uid===item.ownerUid);
  return user?`${user.grade}학년 ${user.classNo}반 ${user.number}번 ${user.name}`:`학생 UID ${String(item.ownerUid||'').slice(0,8)}`;
}
function anonymousSuggestionAlias(uid){
  let hash=0;
  for(const char of String(uid||''))hash=(hash*31+char.charCodeAt(0))%97;
  return `익명 학생 ${hash+1}`;
}
function renderSuggestions(){
  const list=suggestions()
    .filter(item=>state.suggestionMode==='public'?item.visibility==='public':item.visibility==='private')
    .sort((a,b)=>Number(b.updatedAt||b.createdAt)-Number(a.updatedAt||a.createdAt));
  $('#suggestionList').innerHTML=list.length?list.map(item=>`
    <button class="suggestion-card ${item.visibility}" data-open-suggestion="${item.id}">
      <div><span>${item.visibility==='private'?'관리자 1:1':'공개 건의'}</span>
      <h3>${esc(item.title)}</h3><p>${esc(item.preview||item.body||'')}</p></div>
      <footer><b>${esc(suggestionOwnerLabel(item))}</b><small>${new Date(item.updatedAt||item.createdAt).toLocaleString('ko-KR')}</small></footer>
    </button>`).join(''):'<div class="community-empty">등록된 건의가 없습니다.</div>';
  $$('[data-open-suggestion]').forEach(button=>button.addEventListener('click',()=>openSuggestionThread(button.dataset.openSuggestion)));
}
function renderAdminSuggestions(){
  const list=[...suggestions()].sort((a,b)=>Number(b.updatedAt||b.createdAt)-Number(a.updatedAt||a.createdAt));
  $('#adminSuggestionCount').textContent=`${list.length}건`;
  $('#adminSuggestionList').innerHTML=list.length?list.map(item=>`
    <article class="admin-suggestion-card">
      <div><span>${item.visibility==='private'?'1:1 비공개':'공개 건의'} · ${esc(item.status||'접수')}</span>
      <h3>${esc(item.title)}</h3><p>${esc(suggestionOwnerLabel(item))}</p></div>
      <button data-open-suggestion="${item.id}">대화 열기</button>
    </article>`).join(''):'<div class="admin-empty">건의가 없습니다.</div>';
  $$('#adminSuggestionList [data-open-suggestion]').forEach(button=>button.addEventListener('click',()=>openSuggestionThread(button.dataset.openSuggestion)));
}
function openSuggestionThread(suggestionId){
  const item=suggestions().find(value=>value.id===suggestionId);
  if(!item)return toast('건의 내용을 찾지 못했습니다.');
  state.currentSuggestionId=suggestionId;
  $('#suggestionThreadMode').textContent=item.visibility==='private'?'관리자 1:1':'공개 건의';
  $('#suggestionThreadTitle').textContent=item.title;
  $('#suggestionThreadMeta').textContent=`${suggestionOwnerLabel(item)} · ${new Date(item.createdAt).toLocaleString('ko-KR')}`;
  $('#suggestionThreadMessages').innerHTML='<div class="class-chat-empty">대화를 불러오는 중입니다.</div>';
  window.baemoonFirebase.watchSuggestionMessages(suggestionId);
  openOverlay('suggestionThreadModal');
}
function handleSuggestionMessages(items){
  window.firebaseCache.suggestionMessages=items||[];
  const item=currentSuggestion();
  const current=session();
  const messages=[...(items||[])].sort((a,b)=>Number(a.createdAt)-Number(b.createdAt));
  $('#suggestionThreadMessages').innerHTML=messages.length?messages.map(message=>{
    const mine=message.senderUid===current?.uid;
    let label='관리자';
    if(message.senderRole!=='admin'){
      if(isAdmin()){
        const user=accounts().find(account=>account.uid===message.senderUid);
        label=user?`${user.grade}-${user.classNo}-${user.number} ${user.name}`:'학생';
      }else if(mine)label='나';
      else label=message.senderUid===item?.ownerUid?'건의자':anonymousSuggestionAlias(message.senderUid);
    }
    return `<article class="suggestion-message ${mine?'mine':''} ${message.senderRole==='admin'?'admin':''}">
      <div><b>${esc(label)}</b><time>${new Date(message.createdAt).toLocaleString('ko-KR')}</time></div>
      <p>${esc(message.body)}</p>
    </article>`;
  }).join(''):'<div class="class-chat-empty">첫 답변을 기다리고 있습니다.</div>';
  const box=$('#suggestionThreadMessages');
  requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight});
}
function renderSuggestionMode(){
  $$('#suggestionTabs [data-suggestion-mode]').forEach(button=>button.classList.toggle(
    'active',button.dataset.suggestionMode===state.suggestionMode
  ));
  renderSuggestions();
}
$('#suggestionTabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-suggestion-mode]');
  if(!button)return;
  state.suggestionMode=button.dataset.suggestionMode;
  renderSuggestionMode();
});
$('#openSuggestionComposer').addEventListener('click',()=>{
  if(!isStudent())return toast('학생만 건의를 작성할 수 있습니다.');
  $('#suggestionVisibility').value=state.suggestionMode;
  $('#suggestionTitle').value='';
  $('#suggestionBody').value='';
  openOverlay('suggestionComposerModal');
});
$('#saveSuggestionButton').addEventListener('click',async()=>{
  const title=$('#suggestionTitle').value.trim(),body=$('#suggestionBody').value.trim();
  if(!title||!body)return toast('제목과 내용을 입력해주세요.');
  const button=$('#saveSuggestionButton');button.disabled=true;
  try{
    const saved=await window.baemoonFirebase.createSuggestion({
      visibility:$('#suggestionVisibility').value,title,body
    });
    closeOverlay('suggestionComposerModal');
    state.suggestionMode=saved.visibility;
    renderSuggestionMode();
    toast(saved.visibility==='private'?'관리자 1:1 건의를 전달했습니다.':'공개 건의를 등록했습니다.');
  }catch(error){toast(firebaseFriendlyMessage(error))}
  finally{button.disabled=false}
});
$('#suggestionThreadForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const body=$('#suggestionThreadInput').value.trim();
  if(!body||!state.currentSuggestionId)return;
  const button=event.currentTarget.querySelector('button');button.disabled=true;
  try{
    await window.baemoonFirebase.sendSuggestionMessage(state.currentSuggestionId,body);
    $('#suggestionThreadInput').value='';
  }catch(error){toast(firebaseFriendlyMessage(error))}
  finally{button.disabled=false}
});

/* 커뮤니티 건의함 전환 */
const renderCommunityV1118=renderCommunity;
renderCommunity=function(){
  const suggestionSelected=state.communityCategory==='건의함';
  $('#suggestionHub').hidden=!suggestionSelected;
  $('#communityFeed').hidden=suggestionSelected;
  $('.community-search').hidden=suggestionSelected;
  $('#openCommunityComposer').hidden=suggestionSelected||!isStudent();
  if(suggestionSelected){
    if(isGuest()){
      $('#suggestionHub').hidden=true;
      $('#communityFeed').hidden=false;
      $('#communityFeed').innerHTML='<div class="community-locked">건의함은 배문고 학생 전용입니다.</div>';
      return;
    }
    renderSuggestionMode();
    return;
  }
  renderCommunityV1118();
};

/* 관리자 예약 명단은 사람 정보 우선, 작업 버튼은 접기 */
openAdminBoothReservations=function(key){
  const entry=adminBoothEntries().find(item=>item.key===key);
  if(!entry)return toast('부스 정보를 찾지 못했습니다.');
  state.adminReservationBoothKey=key;
  const items=boothReservations(entry.festival.id,entry.booth.id);
  const totalPeople=items.reduce((sum,item)=>sum+Math.max(1,Number(item.groupSize||1)),0);
  const slots=boothSlotSummary(entry.festival,entry.booth,items);
  $('#adminBoothReservationTitle').textContent=`${entry.booth.name} 예약자 명단`;
  $('#adminBoothReservationSummary').textContent=
    `${entry.festival.name} · ${entry.booth.location||'장소 미정'} · 예약 ${items.length}건 · 누적 ${totalPeople}명`;
  $('#adminBoothSlotSummary').innerHTML=slots.map(slot=>`
    <article class="${slot.people>=slot.capacity?'slot-full':''}">
      <span>${esc(formatReservationSlot(slot.time))}</span><b>${slot.people}/${slot.capacity}명</b><small>${slot.count}건</small>
    </article>`).join('');
  $('#adminBoothReservationList').innerHTML=items.length?items.map(item=>{
    const info=resolvedReservationInfo(item);
    return `<article class="admin-booth-person-card reservation-person-v2">
      <div class="reservation-person-main">
        <b>${esc(info.user)}</b><small>${esc(info.time)} · ${info.groupSize}명</small>
        <em>${new Date(info.createdAt).toLocaleString('ko-KR')}</em>
      </div>
      <button class="reservation-manage-toggle" data-toggle-reservation-actions="${item.id}">관리</button>
      <div class="reservation-admin-actions" data-reservation-actions="${item.id}" hidden>
        <button data-admin-reservation-detail="${item.id}">예약 상세</button>
        <button data-message-reservation="${item.id}">메시지 보내기</button>
      </div>
    </article>`;
  }).join(''):'<div class="admin-empty">이 부스에는 아직 예약자가 없습니다.</div>';
  $$('[data-toggle-reservation-actions]').forEach(button=>button.addEventListener('click',()=>{
    const actions=$(`[data-reservation-actions="${button.dataset.toggleReservationActions}"]`);
    actions.hidden=!actions.hidden;
    button.textContent=actions.hidden?'관리':'접기';
  }));
  $$('#adminBoothReservationList [data-admin-reservation-detail]').forEach(button=>
    button.addEventListener('click',()=>openReservationDetail(button.dataset.adminReservationDetail))
  );
  $$('#adminBoothReservationList [data-message-reservation]').forEach(button=>
    button.addEventListener('click',()=>openReservationMessage(button.dataset.messageReservation))
  );
  openOverlay('adminBoothReservationModal');
};

/* 라우팅/관리자 렌더 확장 */
const routeV1118=route;
route=function(screen,opts={}){
  routeV1118(screen,opts);
  if(state.screen==='guide')renderGuide();
  if(state.screen==='classchat'){
    state.classChatUnread=0;
    renderClassChat();
  }
};
const renderAdminV1118=renderAdmin;
renderAdmin=function(){
  renderAdminV1118();
  renderAdminMap();
  renderAdminSuggestions();
};


/* v11.21 시간표 저장: 문서 캡처 단계에서 단 한 번만 처리 */
document.addEventListener('click',async event=>{
  const button=event.target.closest('#saveAdminTimetable');
  if(!button)return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if(button.dataset.saving==='1')return;
  button.dataset.saving='1';
  button.disabled=true;
  const originalText=button.textContent;
  button.textContent='저장 중…';

  const grade=Number($('#adminTimetableGrade').value||1);
  const classNo=Number($('#adminTimetableClass').value||1);
  const days=Object.fromEntries(TIMETABLE_KEYS.map(key=>[key,Array(7).fill('')]));

  $$('[data-timetable-subject]').forEach(input=>{
    const [dayKey,periodText]=input.dataset.timetableSubject.split(':');
    if(days[dayKey])days[dayKey][Number(periodText)]=input.value.trim();
  });

  try{
    const saved=await window.baemoonFirebase.saveTimetable({
      id:timetableDocumentId(grade,classNo),grade,classNo,days
    });

    const cache=window.firebaseCache.timetables||(window.firebaseCache.timetables=[]);
    const index=cache.findIndex(item=>item.id===saved.id);
    if(index>=0)cache[index]=saved;
    else cache.push(saved);

    toast(`${grade}학년 ${classNo}반 시간표를 저장했습니다.`);
  }catch(error){
    console.error('Timetable save failed:',error);
    toast(firebaseFriendlyMessage(error));
  }finally{
    button.dataset.saving='0';
    button.disabled=false;
    button.textContent=originalText||'시간표 저장';
  }
},true);

seed();
populateStudentSelectors();
state.lastDayKey=localDateKey();
showAuthGate();

window.baemoonApp={
  state,
  session,
  route,
  enterApp,
  showAuthGate,
  renderHome,
  renderMealCard,
  renderAdminMeals,
  renderFestival,
  renderFestivalHub,
  renderTimetable,
  renderClassChat,
  renderClassChatNotificationButton,
  renderMy,
  renderHomeReservations,
  renderCommunity,
  renderSuggestions,
  renderAdmin,
  renderAdminCommunity,
  renderAdminStudents,
  renderNotices,
  renderTodayCard,
  renderAdminNotices,
  renderAdminToday,
  renderAdminTimetable,
  renderAdminReservations,
  renderNotifications,
  handleBroadcastNotifications,
  handlePersonalNotifications,
  handleClassChatMessages,
  handleSuggestionMessages,
  renderGuide,
  renderAdminMap,
  renderAdminSuggestions,
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

