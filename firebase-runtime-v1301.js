/* 배문고 Firebase Runtime v13.01 stabilization loader
   검증된 v11.27 Firebase 런타임을 캐시 우선으로 불러오고,
   시간별 정원·빠른 저장·중복 요청 합치기 기능을 적용합니다. */
const BASE_SOURCES=[
  'https://cdn.jsdelivr.net/gh/timon20091220-spec/school.app@68b50607fcd2ce5a233be1c03f091bccda420f9b/firebase-runtime-v1127.js',
  'https://raw.githubusercontent.com/timon20091220-spec/school.app/68b50607fcd2ce5a233be1c03f091bccda420f9b/firebase-runtime-v1127.js'
];
const CACHE_KEY='baemoon-firebase-runtime-68b50607-v1301'; // 기존 캐시 재사용으로 새로고침 속도 유지
const OLD_CACHE_KEYS=['baemoon-firebase-runtime-68b50607-v1205','baemoon-firebase-runtime-68b50607-v1204','baemoon-firebase-runtime-68b50607-v1203','baemoon-firebase-runtime-68b50607-v1202','baemoon-firebase-runtime-68b50607-v1201','baemoon-firebase-runtime-68b50607-v1144','baemoon-firebase-runtime-68b50607-v1143','baemoon-firebase-runtime-68b50607-v1142','baemoon-firebase-runtime-68b50607-v1141'];
const SLOT_FUNCTION=`function reservationSlotInput(festival,booth,time){
  const capacity=Math.max(1,Number(booth?.slotCapacities?.[String(time||'즉시 예약')]||booth.capacity||1));
  return {
    festivalId:String(festival.id),festivalName:String(festival.name||'행사'),
    boothId:String(booth.id),boothName:String(booth.name||'부스'),
    time:String(time||'즉시 예약'),capacity,
    minPeople:Math.max(1,Math.min(capacity,Number(booth.minPeople||1))),
    maxPeople:Math.max(1,Math.min(capacity,Number(booth.maxPeople||capacity))),
    openStart:String(booth.openStart||(festival.start?String(festival.start)+'T00:00':'')),openEnd:String(booth.openEnd||(festival.end?String(festival.end)+'T23:59':festival.start?String(festival.start)+'T23:59':'')),
    bookingClosed:false,waitlistEnabled:true,allowRebooking:Boolean(booth.allowRebooking),
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
      const key='bm-reservation-health-v1205';
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
    `const auth=getAuth(firebaseApp);
const GUEST_SIGNED_OUT_KEY='bm_guest_signed_out_v1300';
const GUEST_ACCOUNT_LOCK_KEY='bm_guest_account_lock_v1';
const GUEST_EMAIL_DOMAIN='guest.baemoon.app';
function readGuestAccountLock(){try{return JSON.parse(localStorage.getItem(GUEST_ACCOUNT_LOCK_KEY)||'null')}catch{return null}}
function writeGuestAccountLock(value){try{localStorage.setItem(GUEST_ACCOUNT_LOCK_KEY,JSON.stringify(value))}catch{}}
async function deterministicGuestAuthEmail(school,name){const normalized=String(school||'').trim().replace(/\s+/g,' ').toLowerCase()+'|'+String(name||'').trim().replace(/\s+/g,' ').toLowerCase();const bytes=new TextEncoder().encode(normalized);const hash=await crypto.subtle.digest('SHA-256',bytes);const id=[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('').slice(0,40);return 'guest-'+id+'@'+GUEST_EMAIL_DOMAIN}
function isGuestEmailUser(user){return Boolean(user&&String(user.email||'').toLowerCase().endsWith('@'+GUEST_EMAIL_DOMAIN))}
async function guestPasswordDigest(password,salt){if(!crypto?.subtle)return '';const bytes=new TextEncoder().encode(String(salt||'')+'|'+String(password||''));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('')}
window.baemoonGuestAccountInfo=()=>readGuestAccountLock();`
  );

  // v13.01: 학생 계정과 같은 Firebase Email/Password 기반 게스트 로그인.
  // 기존 익명 게스트는 linkWithCredential로 UID를 유지해 예약·대기·참여 기록을 보존합니다.
  source=source.replace(/async function submitGuestLogin\(\)\{[\s\S]*?\n\}\nasync function logout\(\)/,`async function submitGuestLogin(){
  await applyLoginPersistence(true);
  await waitForInitialAuth();
  const button=$('#confirmGuestEntry'),errorBox=$('#guestLoginError'),schoolInput=$('#guestSchool'),nameInput=$('#guestName'),passwordInput=$('#guestPasswordV1205')||$('#guestPasswordV1204');
  errorBox.hidden=true;button.disabled=true;button.textContent='Firebase 확인 중…';authFlowInProgress=true;
  try{
    let lock=readGuestAccountLock(),current=auth.currentUser;
    if(current&&!current.isAnonymous&&!isGuestEmailUser(current)){await signOut(auth);current=null}
    let existing=current?await getGuestProfile(current):null;
    const typedSchool=String(schoolInput?.value||'').trim().replace(/\s+/g,' '),typedName=String(nameInput?.value||'').trim().replace(/\s+/g,' ');
    if(lock&&typedSchool&&String(lock.school||'')!==typedSchool)throw new Error('이 브라우저에는 이미 다른 게스트 계정이 연결되어 있습니다.');
    if(lock&&typedName&&String(lock.name||'')!==typedName)throw new Error('이 브라우저에는 이미 다른 게스트 계정이 연결되어 있습니다.');
    const school=String(lock?.school||existing?.school||typedSchool).trim(),name=String(lock?.name||existing?.name||typedName).trim(),entered=String(passwordInput?.value||'');
    if(!school||!name)throw new Error('소속 학교와 이름을 모두 입력해주세요.');
    if(!entered)throw new Error('비밀번호를 입력해주세요.');
    let authEmail=String(lock?.authEmail||existing?.authEmail||'').toLowerCase();
    if(!authEmail)authEmail=await deterministicGuestAuthEmail(school,name);
    let user=current;
    if(current?.isAnonymous){
      if(lock&&!existing)throw new Error('기존 게스트 정보를 Firebase에서 찾지 못했습니다.');
      let personalPassword=entered;
      if(!existing?.usesCustomPassword){
        if(entered!==COMMON_PASSWORD)throw new Error('최초 비밀번호는 baemoon2026입니다.');
        personalPassword=await window.baemoonRequestGuestPasswordV13?.();if(!personalPassword)throw new Error('개인 비밀번호 설정이 취소되었습니다.');
      }
      try{user=(await linkWithCredential(current,EmailAuthProvider.credential(authEmail,personalPassword))).user}
      catch(error){if(String(error?.code||'').includes('email-already-in-use')||String(error?.code||'').includes('credential-already-in-use'))user=(await signInWithEmailAndPassword(auth,authEmail,personalPassword)).user;else throw error}
    }else if(isGuestEmailUser(current)){
      existing=existing||await getGuestProfile(current);
      if(!existing)throw new Error('게스트 프로필을 찾지 못했습니다.');
      if(entered===COMMON_PASSWORD)throw new Error('이미 개인 비밀번호를 설정했습니다. 개인 비밀번호로 로그인해주세요.');
      await signOut(auth);
      try{user=(await signInWithEmailAndPassword(auth,authEmail,entered)).user}catch{throw new Error('개인 비밀번호가 올바르지 않습니다.')}
    }else if(entered===COMMON_PASSWORD){
      const personalPassword=await window.baemoonRequestGuestPasswordV13?.();if(!personalPassword)throw new Error('개인 비밀번호 설정이 취소되었습니다.');
      try{user=(await createUserWithEmailAndPassword(auth,authEmail,personalPassword)).user}
      catch(error){if(String(error?.code||'').includes('email-already-in-use'))throw new Error('이미 가입된 게스트입니다. 개인 비밀번호로 로그인해주세요.');throw error}
      existing={};
    }else{
      try{user=(await signInWithEmailAndPassword(auth,authEmail,entered)).user}catch{throw new Error('학교·이름 또는 개인 비밀번호가 올바르지 않습니다. 최초 이용자는 baemoon2026을 입력해주세요.')}
      existing=await getGuestProfile(user);if(!existing)throw new Error('게스트 프로필을 찾지 못했습니다.');
    }
    if(lock?.uid&&String(lock.uid)!==String(user.uid))throw new Error('이 브라우저에서는 다른 게스트 계정을 사용할 수 없습니다.');
    existing=existing||await getGuestProfile(user)||{};
    if(existing.school&&String(existing.school).trim()!==school)throw new Error('등록된 소속 학교와 일치하지 않습니다.');
    if(existing.name&&String(existing.name).trim()!==name)throw new Error('등록된 이름과 일치하지 않습니다.');
    const now=Date.now(),deviceId=existing.deviceId||guestDeviceId();
    const profile={uid:user.uid,role:'guest',school,name,deviceId,guestCode:'',authEmail,authMode:'password',usesCustomPassword:true,createdAt:existing.createdAt||now,lastLoginAt:now};
    await setDoc(doc(db,'guestProfiles',user.uid),profile,{merge:true});writeGuestAccountLock({uid:user.uid,authEmail,school,name,createdAt:lock?.createdAt||profile.createdAt});localStorage.removeItem(GUEST_SIGNED_OUT_KEY);
    ui().setSession(profile);startDataListeners('guest',profile);ui().closeOverlay('guestConfirmModal');ui().enterApp('home');ui().toast(name+'님, 게스트로 로그인했습니다.');
  }catch(error){console.error('Guest login failed:',error);errorBox.textContent=error?.message||displayFirebaseError(error);errorBox.hidden=false}
  finally{authFlowInProgress=false;button.disabled=false;button.textContent='게스트 로그인';if(passwordInput)passwordInput.value=''}
}
async function logout()`);

  source=source.replace(
    `async function logout(){try{await signOut(auth)}finally{stopListeners();ui().clearSession();ui().showAuthGate();ui().toast("로그아웃되었습니다.")}}`,
    `async function logout(){const current=auth.currentUser;try{if(current?.isAnonymous){localStorage.setItem(GUEST_SIGNED_OUT_KEY,'1')}else await signOut(auth)}finally{stopListeners();ui().clearSession();ui().showAuthGate();ui().toast("로그아웃되었습니다.")}}`
  );

  source=source.replace(
    "if(user.isAnonymous){\n      const guestProfile=await getGuestProfile(user);",
    `if(isGuestEmailUser(user)){
      const guestProfile=await getGuestProfile(user);
      if(!guestProfile?.school||!guestProfile?.name){await signOut(auth);ui().clearSession();ui().showAuthGate();ui().toast('게스트 프로필을 찾지 못했습니다. 관리자에게 문의해주세요.');return}
      const now=Date.now(),deviceId=guestProfile.deviceId||guestDeviceId(),authEmail=String(user.email||guestProfile.authEmail||'').toLowerCase();
      const profile={...guestProfile,uid:user.uid,role:'guest',deviceId,guestCode:'',authEmail,authMode:'password',lastLoginAt:now};
      await updateDoc(doc(db,'guestProfiles',user.uid),{lastLoginAt:now,deviceId,guestCode:'',authEmail,authMode:'password'});
      writeGuestAccountLock({uid:user.uid,authEmail,school:profile.school,name:profile.name,createdAt:profile.createdAt||now});
      localStorage.removeItem(GUEST_SIGNED_OUT_KEY);
      ui().setSession(profile);startDataListeners('guest',profile);ui().enterApp('home');return;
    }
    if(user.isAnonymous){
      const guestProfile=await getGuestProfile(user);`
  );
  source=source.replace(
    "if(!guestProfile?.school||!guestProfile?.name){\n        await signOut(auth);",
    "if(!guestProfile?.school||!guestProfile?.name){\n        await signOut(auth);"
  );
  // 기존 익명 게스트는 자동 입장하지 않고 비밀번호 Firebase 계정 전환을 안내합니다.
  source=source.replace(
    /const now=Date\.now\(\);\n      const deviceId=guestProfile\.deviceId\|\|guestDeviceId\(\);\n      const guestCode=[\s\S]*?ui\(\)\.enterApp\('home'\);\n      return;/,
    `writeGuestAccountLock({uid:user.uid,school:guestProfile.school,name:guestProfile.name,hasLegacyPassword:Boolean(guestProfile.passwordHash&&guestProfile.passwordSalt),createdAt:guestProfile.createdAt||Date.now()});
      ui().clearSession();ui().showAuthGate();
      if(sessionStorage.getItem('bm_guest_migration_notice_v1205')!=='1'){sessionStorage.setItem('bm_guest_migration_notice_v1205','1');ui().toast('기존 게스트 계정은 한 번만 비밀번호 계정으로 전환해주세요.');}
      return;`
  );

  // 게스트 번호는 예약·대기 데이터에도 저장하거나 표시하지 않습니다.
  source=source.replace(/guestCode:String\(current\.guestCode\|\|'0000'\)/g,"guestCode:''");
  source=source.replace(/guestCode:String\(current\?\.guestCode\|\|'0000'\)/g,"guestCode:''");
  source=source.replace(/guestCode:current\.guestCode\|\|'0000'/g,"guestCode:''");
  source=source.replace(/guestCode:current\?\.guestCode\|\|'0000'/g,"guestCode:''");
  source=source.replace(/const guestCode=guestProfile\.guestCode\|\|guestIdentityCode\([\s\S]*?\);/,"const guestCode='';");

  return source;
}

try{
  let source=await loadSource();
  const pattern=/function reservationSlotInput\(festival,booth,time\)\{[\s\S]*?\n\}\nfunction festivalReservationSlots/;
  if(!pattern.test(source))throw new Error('시간별 정원 적용 위치를 찾지 못했습니다.');
  source=source.replace(pattern,`${SLOT_FUNCTION}\nfunction festivalReservationSlots`)
    .replace(/getAuth,\s*createUserWithEmailAndPassword/,'getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential')
    .replace('const auth=getAuth(firebaseApp);',`const auth=getAuth(firebaseApp);
const LOGIN_KEEP_KEY='bm_login_keep_v1205';
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
    .replace(/v11\.27/g,'v13.01');
  source=optimizeRuntime(source);
  if(!source.includes('browserLocalPersistence')||!source.includes('window.baemoonSetLoginPersistence'))throw new Error('로그인 유지 설정을 적용하지 못했습니다.');
  const blobUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  try{await import(blobUrl)}finally{URL.revokeObjectURL(blobUrl)}
}catch(error){
  console.error('배문고 Firebase Runtime v13.01 시작 실패:',error);
  window.__firebaseRuntimeReady=false;
  window.dispatchEvent(new CustomEvent('baemoon:firebase-runtime-error',{detail:{message:error?.message||String(error)}}));
}
