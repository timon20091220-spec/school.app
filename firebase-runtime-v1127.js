/* 배문고 Firebase Runtime v12.03 performance loader
   검증된 v11.27 Firebase 런타임을 캐시 우선으로 불러오고,
   시간별 정원·빠른 저장·중복 요청 합치기 기능을 적용합니다. */
const BASE_SOURCES=[
  'https://cdn.jsdelivr.net/gh/timon20091220-spec/school.app@68b50607fcd2ce5a233be1c03f091bccda420f9b/firebase-runtime-v1127.js',
  'https://raw.githubusercontent.com/timon20091220-spec/school.app/68b50607fcd2ce5a233be1c03f091bccda420f9b/firebase-runtime-v1127.js'
];
const CACHE_KEY='baemoon-firebase-runtime-68b50607-v1203';
const OLD_CACHE_KEYS=['baemoon-firebase-runtime-68b50607-v1202','baemoon-firebase-runtime-68b50607-v1201','baemoon-firebase-runtime-68b50607-v1144','baemoon-firebase-runtime-68b50607-v1143','baemoon-firebase-runtime-68b50607-v1142','baemoon-firebase-runtime-68b50607-v1141'];
const SLOT_FUNCTION=`function reservationSlotInput(festival,booth,time){
  const capacity=Math.max(1,Number(booth?.slotCapacities?.[String(time||'즉시 예약')]||booth.capacity||1));
  return {
    festivalId:String(festival.id),festivalName:String(festival.name||'행사'),
    boothId:String(booth.id),boothName:String(booth.name||'부스'),
    time:String(time||'즉시 예약'),capacity,
    minPeople:Math.max(1,Math.min(capacity,Number(booth.minPeople||1))),
    maxPeople:Math.max(1,Math.min(capacity,Number(booth.maxPeople||capacity))),
    openStart:String(booth.openStart||(festival.start?String(festival.start)+'T00:00':'')),openEnd:String(booth.openEnd||(festival.end?String(festival.end)+'T23:59':festival.start?String(festival.start)+'T23:59':'')),
    bookingClosed:false,waitlistEnabled:true,
    congestion:'auto',active:true
  };
}`;

function validRuntime(value){
  return typeof value==='string'&&value.length>10000&&value.includes('window.baemoonFirebase')&&value.includes('reservationServerRequest');
}
function readRuntimeCache(){
  for(const key of [CACHE_KEY,...OLD_CACHE_KEYS]){
    try{
      const value=localStorage.getItem(key);
      if(!validRuntime(value))continue;
      if(key!==CACHE_KEY)try{localStorage.setItem(CACHE_KEY,value)}catch{}
      return value;
    }catch{}
  }
  return '';
}
function saveRuntimeCache(value){if(validRuntime(value))try{localStorage.setItem(CACHE_KEY,value)}catch{}}
async function fetchRuntimeSource(timeoutMs=4200){
  const attempts=BASE_SOURCES.map(async url=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{cache:'force-cache',signal:controller.signal});
      if(!response.ok)throw new Error(`Firebase 런타임 HTTP ${response.status}`);
      const text=await response.text();
      if(!validRuntime(text))throw new Error('Firebase 런타임 파일 검증 실패');
      return text;
    }finally{clearTimeout(timer)}
  });
  if(typeof Promise.any==='function')return Promise.any(attempts);
  return new Promise((resolve,reject)=>{
    let failed=0,lastError;
    attempts.forEach(task=>task.then(resolve).catch(error=>{lastError=error;if(++failed===attempts.length)reject(lastError)}));
  });
}
async function loadSource(){
  const cached=readRuntimeCache();
  if(cached){
    fetchRuntimeSource().then(saveRuntimeCache).catch(()=>{});
    return cached;
  }
  const source=await fetchRuntimeSource();
  saveRuntimeCache(source);
  return source;
}
function backgroundSyncExpression(argument){
  return `(globalThis.queueMicrotask||((task)=>setTimeout(task,0)))(()=>syncReservationSlots(${argument},{quiet:true}).catch(error=>console.warn('Background reservation sync failed:',error)))`;
}
function optimizeRuntime(source){
  source=source.replace(
    'const clean=JSON.parse(JSON.stringify(item));\n  clean.booths=await Promise.all',
    'const clean=JSON.parse(JSON.stringify(item));\n  clean.guideImage=await persistMedia(clean.guideImage||"","festival-guide");\n  clean.booths=await Promise.all'
  );
  source=source.replace(
    "where('scope','in',['festival-booth','festival-menu'])",
    "where('scope','in',['festival-booth','festival-menu','festival-guide'])"
  );
  source=source.replace(
    'async saveFestivals(items){requireAdmin();const prepared=await Promise.all(items.map(prepareFestival));await syncCollection("festivals",prepared);await syncReservationSlots(prepared,{quiet:true});return prepared}',
    `async saveFestivals(items){requireAdmin();const prepared=await Promise.all(items.map(prepareFestival));await syncCollection("festivals",prepared);${backgroundSyncExpression('prepared')};return prepared}`
  );
  source=source.replace(
    ']);await syncReservationSlots(prepared.festivals,{quiet:true});const mediaSnap=',
    `]);${backgroundSyncExpression('prepared.festivals')};const mediaSnap=`
  );
  source=source.replace(
    /async reservationServerHealth\(\)\{\s*const response=await fetch\(`\$\{RESERVATION_API\}\/health`,\{cache:'no-store'\}\);\s*if\(!response\.ok\)throw new Error\('예약 서버 상태를 확인할 수 없습니다\.'\);\s*return response\.json\(\);\s*\}/,
    `async reservationServerHealth(){
      const key='bm-reservation-health-v1203';
      try{const cached=JSON.parse(sessionStorage.getItem(key)||'null');if(cached?.data&&Date.now()-Number(cached.at||0)<60000)return cached.data}catch{}
      if(reservationHealthPromise)return reservationHealthPromise;
      reservationHealthPromise=(async()=>{const response=await fetch(RESERVATION_API+'/health',{cache:'no-store'});if(!response.ok)throw new Error('예약 서버 상태를 확인할 수 없습니다.');const data=await response.json();try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),data}))}catch{}return data})().finally(()=>{reservationHealthPromise=null});
      return reservationHealthPromise;
    }`
  );
  source=source.replace("const payload=await reservationServerRequest('/api/admin/dashboard',{","const payload=await reservationServerRequest(force?'/api/admin/dashboard?force=1':'/api/admin/dashboard',{");

  source=source.replace(
    `window.firebaseCache.adminReservationStats={
        ok:true,summary:payload.summary||{},ranking:payload.ranking||[]
      };`,
    `window.firebaseCache.adminReservationStats={
        ok:true,summary:payload.summary||{},ranking:payload.ranking||[],reservations:payload.reservations||[],queue:payload.queue||[]
      };`
  );
  source=source.replace('let personalOverviewLoadedAt=0;','let personalOverviewLoadedAt=0;\nlet reservationHealthPromise=null;');
  source=source.replace(
    "const auth=getAuth(firebaseApp);",
    `const auth=getAuth(firebaseApp);\nconst GUEST_SIGNED_OUT_KEY='bm_guest_signed_out_v1203';`
  );
  source=source.replace(
    "async function submitGuestLogin(){await applyLoginPersistence();\n  await waitForInitialAuth();",
    `async function submitGuestLogin(){await applyLoginPersistence();\n  await waitForInitialAuth();\n  if(auth.currentUser?.isAnonymous){\n    const remembered=await getGuestProfile(auth.currentUser);\n    if(remembered?.school&&remembered?.name){\n      localStorage.removeItem(GUEST_SIGNED_OUT_KEY);\n      const now=Date.now(),deviceId=remembered.deviceId||guestDeviceId(),guestCode=remembered.guestCode||guestIdentityCode(deviceId,remembered.school,remembered.name);\n      await updateDoc(doc(db,'guestProfiles',auth.currentUser.uid),{lastLoginAt:now,deviceId,guestCode});\n      const profile={...remembered,role:'guest',deviceId,guestCode,lastLoginAt:now};\n      ui().setSession(profile);startDataListeners('guest',profile);ui().closeOverlay('guestConfirmModal');ui().enterApp('home');ui().toast(remembered.name+'님, 이전 게스트 계정으로 로그인했습니다.');return;\n    }\n  }`
  );
  source=source.replace(
    "await setDoc(doc(db,'guestProfiles',credential.user.uid),profile,{merge:true});",
    "localStorage.removeItem(GUEST_SIGNED_OUT_KEY);\n    await setDoc(doc(db,'guestProfiles',credential.user.uid),profile,{merge:true});"
  );
  source=source.replace(
    `async function logout(){try{await signOut(auth)}finally{stopListeners();ui().clearSession();ui().showAuthGate();ui().toast("로그아웃되었습니다.")}}`,
    `async function logout(){if(auth.currentUser?.isAnonymous){localStorage.setItem(GUEST_SIGNED_OUT_KEY,'1');stopListeners();ui().clearSession();ui().showAuthGate();ui().toast("로그아웃되었습니다.");return}try{await signOut(auth)}finally{stopListeners();ui().clearSession();ui().showAuthGate();ui().toast("로그아웃되었습니다.")}}`
  );
  source=source.replace(
    "if(user.isAnonymous){\n      const guestProfile=await getGuestProfile(user);",
    "if(user.isAnonymous){\n      if(localStorage.getItem(GUEST_SIGNED_OUT_KEY)==='1'){ui().clearSession();ui().showAuthGate();return;}\n      const guestProfile=await getGuestProfile(user);"
  );
  return source;
}

try{
  let source=await loadSource();
  const pattern=/function reservationSlotInput\(festival,booth,time\)\{[\s\S]*?\n\}\nfunction festivalReservationSlots/;
  if(!pattern.test(source))throw new Error('시간별 정원 적용 위치를 찾지 못했습니다.');
  source=source.replace(pattern,`${SLOT_FUNCTION}\nfunction festivalReservationSlots`)
    .replace(/getAuth,\s*createUserWithEmailAndPassword/,'getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword')
    .replace('const auth=getAuth(firebaseApp);',`const auth=getAuth(firebaseApp);
const LOGIN_KEEP_KEY='bm_login_keep_v1203';
if(localStorage.getItem(LOGIN_KEEP_KEY)===null)localStorage.setItem(LOGIN_KEEP_KEY,'1');
async function applyLoginPersistence(forceValue){
  const keep=forceValue===undefined?localStorage.getItem(LOGIN_KEEP_KEY)!=='0':Boolean(forceValue);
  localStorage.setItem(LOGIN_KEEP_KEY,keep?'1':'0');
  await setPersistence(auth,keep?browserLocalPersistence:browserSessionPersistence);
  return keep;
}
await applyLoginPersistence();
window.baemoonSetLoginPersistence=applyLoginPersistence;`)
    .replace(/async function submitStudentLogin\(\)\{/,'async function submitStudentLogin(){await applyLoginPersistence();')
    .replace(/async function submitAdminLogin\(\)\{/,'async function submitAdminLogin(){await applyLoginPersistence();')
    .replace(/async function submitGuestLogin\(\)\{/,'async function submitGuestLogin(){await applyLoginPersistence();')
    .replace(/async submitStudentLogin\(\)\{/,'async submitStudentLogin(){await applyLoginPersistence();')
    .replace(/async submitAdminLogin\(\)\{/,'async submitAdminLogin(){await applyLoginPersistence();')
    .replace(/async submitGuestLogin\(\)\{/,'async submitGuestLogin(){await applyLoginPersistence();')
    .replace(/v11\.27/g,'v12.03');
  source=optimizeRuntime(source);
  if(!source.includes('browserLocalPersistence')||!source.includes('window.baemoonSetLoginPersistence'))throw new Error('로그인 유지 설정을 적용하지 못했습니다.');
  const blobUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  try{await import(blobUrl)}finally{URL.revokeObjectURL(blobUrl)}
}catch(error){
  console.error('배문고 Firebase Runtime v12.03 시작 실패:',error);
  window.__firebaseRuntimeReady=false;
  window.dispatchEvent(new CustomEvent('baemoon:firebase-runtime-error',{detail:{message:error?.message||String(error)}}));
}
