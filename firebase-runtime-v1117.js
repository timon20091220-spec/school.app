import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInAnonymously, signOut, onAuthStateChanged, updatePassword
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, runTransaction, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

window.__firebaseRuntimeState='loading';
window.__firebaseRuntimeError=null;

const firebaseConfig={
  apiKey:"AIzaSyDkIBksaXIqEVwZGE58UmiNXRQXefYSUNc",
  authDomain:"school-fe512.firebaseapp.com",
  projectId:"school-fe512",
  storageBucket:"school-fe512.firebasestorage.app",
  messagingSenderId:"446975040573",
  appId:"1:446975040573:web:b4e1e773c5464425055e54",
  measurementId:"G-1FYLLVRQC2"
};

const appUi=window.baemoonApp;
if(
  !appUi ||
  typeof appUi.setSession!=='function' ||
  typeof appUi.enterApp!=='function'
){
  throw new Error('앱 화면 초기화에 실패했습니다.');
}
const firebaseApp=initializeApp(firebaseConfig);
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
const ADMIN_EMAIL="admin@school-fe512.firebaseapp.com";
const COMMON_PASSWORD="baemoon2026";
const ui=()=>appUi;
const $=selector=>document.querySelector(selector);

window.firebaseCache={
  communityPosts:[],users:[],reports:[],festivals:null,meals:null,notices:null,
  dailySchedules:null,guestAccess:null,reservations:null,notifications:[],
  personalNotifications:[],notificationStates:{},notificationPreference:{enabled:true},media:{},ready:false
};

let authFlowInProgress=false;
let listenerStops=[];
let pendingPasswordProfile=null;
let initialAuthSettled=false;
let resolveInitialAuth;
const initialAuthReady=new Promise(resolve=>{resolveInitialAuth=resolve});
function settleInitialAuth(){
  if(initialAuthSettled)return;
  initialAuthSettled=true;
  resolveInitialAuth();
}
async function waitForInitialAuth(){
  await Promise.race([
    initialAuthReady,
    new Promise(resolve=>setTimeout(resolve,5000))
  ]);
}

function normalizeDate(value){if(typeof value==="number")return value;if(value&&typeof value.toMillis==="function")return value.toMillis();return Date.now()}
function plain(snapshot){return {id:snapshot.id,...snapshot.data(),createdAt:normalizeDate(snapshot.data().createdAt)}}
function normalizePost(snapshot){const data=snapshot.data();return {id:snapshot.id,...data,createdAt:normalizeDate(data.createdAt),likes:Array.isArray(data.likes)?data.likes:[],comments:(Array.isArray(data.comments)?data.comments:[]).map(c=>({...c,createdAt:normalizeDate(c.createdAt)}))}}
function displayFirebaseError(error){
  const code=String(error?.code||'');
  const message=String(error?.message||'');
  if(message.includes('DUPLICATE_RESERVATION'))return '이미 같은 부스와 시간으로 예약했습니다.';
  if(code.includes('network-request-failed')||code.includes('unavailable'))return '인터넷 연결을 확인해주세요.';
  if(code.includes('too-many-requests'))return '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.';
  if(code.includes('operation-not-allowed'))return 'Firebase Authentication에서 이메일/비밀번호 로그인을 활성화해주세요.';
  if(code.includes('configuration-not-found'))return 'Firebase Authentication 설정을 확인해주세요.';
  if(code.includes('user-disabled'))return 'Firebase에서 정지된 계정입니다.';
  if(code.includes('invalid-credential')||code.includes('wrong-password'))return '로그인 정보가 올바르지 않습니다.';
  if(code.includes('email-already-in-use'))return '이미 새 비밀번호가 설정된 계정입니다. 본인이 설정한 비밀번호를 입력해주세요.';
  if(code.includes('reservation-permission'))return '예약 권한 규칙을 적용하지 못했습니다. v11.17 firestore.rules를 게시해주세요.';
  if(code.includes('permission-denied'))return '최신 v11.17 Firestore 규칙을 게시해주세요.';
  if(code.includes('weak-password'))return '새 비밀번호는 8자 이상으로 설정해주세요.';
  if(code.includes('requires-recent-login'))return '보안을 위해 다시 로그인한 뒤 비밀번호를 변경해주세요.';
  if(code.includes('resource-exhausted')||message.includes('용량'))return '사진 또는 데이터 용량이 너무 큽니다.';
  return code ? `Firebase 오류: ${code}` : (message||'Firebase 연결 중 알 수 없는 오류가 발생했습니다.');
}
function studentKey(grade,classNo,number){return `${new Date().getFullYear()}-${grade}-${String(classNo).padStart(2,"0")}-${String(number).padStart(2,"0")}`}
function studentEmail(key){return `${key}@student.baemoon.app`}
function studentSession(profile){return {role:"student",uid:profile.uid,studentKey:profile.studentKey,grade:Number(profile.grade),classNo:Number(profile.classNo),number:Number(profile.number),name:profile.name,id:`${profile.grade}${String(profile.classNo).padStart(2,"0")}${String(profile.number).padStart(2,"0")}`}}
function isAdminUser(){return auth.currentUser?.email===ADMIN_EMAIL}
function requireAdmin(){if(!isAdminUser())throw new Error("관리자 권한이 필요합니다.")}
function requireUser(){if(!auth.currentUser)throw new Error("Firebase 로그인이 필요합니다.")}

function stopListeners(){listenerStops.forEach(stop=>{try{stop()}catch{}});listenerStops=[];Object.assign(window.firebaseCache,{communityPosts:[],users:[],reports:[],festivals:null,meals:null,notices:null,dailySchedules:null,guestAccess:null,reservations:null,notifications:[],personalNotifications:[],notificationStates:{},notificationPreference:{enabled:true},media:{},ready:false})}

async function getStudentProfile(user){const snap=await getDoc(doc(db,"users",user.uid));return snap.exists()?{uid:user.uid,...snap.data()}:null}
async function getGuestProfile(user){
  const snap=await getDoc(doc(db,"guestProfiles",user.uid));
  return snap.exists()?{uid:user.uid,...snap.data()}:null;
}

async function commitInChunks(operations){for(let i=0;i<operations.length;i+=450){const batch=writeBatch(db);operations.slice(i,i+450).forEach(op=>op(batch));await batch.commit()}}
async function syncCollection(name,items){const existing=await getDocs(collection(db,name));const incoming=new Set(items.map(item=>String(item.id)));const ops=[];existing.docs.forEach(s=>{if(!incoming.has(s.id))ops.push(batch=>batch.delete(s.ref))});items.forEach(item=>{const clean=JSON.parse(JSON.stringify(item));ops.push(batch=>batch.set(doc(db,name,String(item.id)),clean,{merge:false}))});await commitInChunks(ops)}

async function persistMedia(value,scope){if(!value||!String(value).startsWith("data:image/"))return value||"";if(String(value).length>800000){const e=new Error("사진 용량이 너무 큽니다.");e.code="resource-exhausted";throw e}const ref=doc(collection(db,"media"));await setDoc(ref,{dataUrl:value,scope,ownerUid:auth.currentUser.uid,createdAt:Date.now()});return `media://${ref.id}`}
async function prepareFestival(item){
  const clean=JSON.parse(JSON.stringify(item));
  clean.booths=await Promise.all((clean.booths||[]).map(async booth=>({
    ...booth,
    image:await persistMedia(booth.image,"festival-booth")
  })));
  clean.menus=await Promise.all((clean.menus||[]).map(async menu=>({
    ...menu,
    image:await persistMedia(menu.image,"festival-menu")
  })));
  clean.foodVendors=await Promise.all((clean.foodVendors||[]).map(async vendor=>({
    ...vendor,
    foods:await Promise.all((vendor.foods||[]).map(async food=>({
      ...food,
      image:await persistMedia(food.image,"festival-menu")
    })))
  })));
  return clean;
}
async function prepareNotice(item){const clean=JSON.parse(JSON.stringify(item));clean.image=await persistMedia(clean.image,"notice");return clean}
async function prepareAdminPayload(payload){return {festivals:await Promise.all((payload.festivals||[]).map(prepareFestival)),meals:JSON.parse(JSON.stringify(payload.meals||[])),notices:await Promise.all((payload.notices||[]).map(prepareNotice)),dailySchedules:JSON.parse(JSON.stringify(payload.dailySchedules||[])),guestAccess:JSON.parse(JSON.stringify(payload.guestAccess||{}))}}

async function migrateCollectionIfEmpty(name,key,prepare=x=>Promise.resolve(x)){const remote=await getDocs(collection(db,name));if(!remote.empty)return 0;let local=[];try{local=JSON.parse(localStorage.getItem(key)||"[]")}catch{}if(!Array.isArray(local)||!local.length)return 0;const prepared=await Promise.all(local.map(prepare));await syncCollection(name,prepared);return prepared.length}
async function migrateAdminLocalData(){let total=0;total+=await migrateCollectionIfEmpty("festivals","bm_festivals_v5",prepareFestival);total+=await migrateCollectionIfEmpty("meals","bm_meals_v10");total+=await migrateCollectionIfEmpty("notices","bm_notices_v5",prepareNotice);total+=await migrateCollectionIfEmpty("dailySchedules","bm_today_v5");const guestRef=doc(db,"settings","guestAccess");const guest=await getDoc(guestRef);if(!guest.exists()){
  let legacy={festivals:true,meals:false};
  try{
    const stored=JSON.parse(localStorage.getItem("bm_guest_access_v7")||"{}");
    legacy={festivals:stored?.festivals!==false,meals:stored?.meals===true};
  }catch{}
  await setDoc(guestRef,legacy);
}let localReservations=[];try{localReservations=JSON.parse(localStorage.getItem("bm_reservations_v5")||"[]")}catch{}const remoteReservations=await getDocs(collection(db,"reservations"));if(remoteReservations.empty&&Array.isArray(localReservations)&&localReservations.length){const items=localReservations.map(r=>({...r,userUid:r.userUid||"legacy-admin-import",createdAt:normalizeDate(r.createdAt)}));await syncCollection("reservations",items);total+=items.length}return total}

async function migrateStudentLocalData(profile){let migrated=0;let localPosts=[];try{localPosts=JSON.parse(localStorage.getItem("bm_community_v7")||"[]")}catch{}if(Array.isArray(localPosts)){const remote=await getDocs(collection(db,"communityPosts"));const ids=new Set(remote.docs.map(d=>d.id));const ops=[];for(const p of localPosts.filter(p=>p.authorKey===profile.studentKey)){if(ids.has(String(p.id)))continue;const image=await persistMedia(p.image||"","community");const clean={category:p.category||"자유",title:p.title||"제목 없음",body:p.body||"",image,authorUid:auth.currentUser.uid,authorKey:profile.studentKey,authorName:profile.name,authorGrade:Number(profile.grade),authorClass:Number(profile.classNo),authorNumber:Number(profile.number),anonymous:false,pinned:Boolean(p.pinned),hidden:Boolean(p.hidden),likes:Array.isArray(p.likes)?p.likes:[],comments:Array.isArray(p.comments)?p.comments:[],reportCount:Number(p.reportCount||0),createdAt:normalizeDate(p.createdAt)};ops.push(batch=>batch.set(doc(db,"communityPosts",String(p.id)),clean));migrated++}await commitInChunks(ops)}let localReservations=[];try{localReservations=JSON.parse(localStorage.getItem("bm_reservations_v5")||"[]")}catch{}if(Array.isArray(localReservations)){const mine=localReservations.filter(r=>r.studentKey===profile.studentKey);for(const r of mine){const ref=doc(db,"reservations",`${auth.currentUser.uid}_${r.boothId}_${encodeURIComponent(r.time||"즉시 예약")}`);const snap=await getDoc(ref);if(!snap.exists()){await setDoc(ref,{...r,id:ref.id,userUid:auth.currentUser.uid,studentKey:profile.studentKey,createdAt:normalizeDate(r.createdAt)});migrated++}}}let localNotifications=[];try{localNotifications=JSON.parse(localStorage.getItem("bm_notifications_v5")||"[]")}catch{}if(Array.isArray(localNotifications)){for(const n of localNotifications){const ref=doc(db,"userNotifications",auth.currentUser.uid,"items",String(n.id||crypto.randomUUID()));const snap=await getDoc(ref);if(!snap.exists()){await setDoc(ref,{title:n.title||"알림",body:n.body||"",type:n.type||"event",audience:"개인",ownerUid:auth.currentUser.uid,createdAt:normalizeDate(n.createdAt)});if(n.read)await setDoc(doc(db,"notificationStates",auth.currentUser.uid,"items",ref.id),{notificationId:ref.id,userUid:auth.currentUser.uid,read:true,hidden:false,updatedAt:Date.now()});migrated++}}}return migrated}

function listenShared(role){
  let mealStop=null;

  const stopMealListener=()=>{
    if(mealStop){
      mealStop();
      mealStop=null;
    }
  };
  const startMealListener=()=>{
    if(mealStop)return;
    mealStop=onSnapshot(
      collection(db,'meals'),
      snapshot=>{
        window.firebaseCache.meals=snapshot.docs.map(item=>({id:item.id,...item.data()}));
        ui().renderMealCard();
        if(role==='admin')ui().renderAdminMeals();
      },
      error=>ui().toast(displayFirebaseError(error))
    );
  };

  listenerStops.push(()=>stopMealListener());

  listenerStops.push(onSnapshot(
    collection(db,'festivals'),
    snapshot=>{
      window.firebaseCache.festivals=snapshot.docs.map(item=>({id:item.id,...item.data()}));
      ui().renderHome();
      if(ui().state.screen==='festival')ui().renderFestival();
      if(role==='admin')ui().renderAdmin();
    },
    error=>ui().toast(displayFirebaseError(error))
  ));

  listenerStops.push(onSnapshot(
    doc(db,'settings','guestAccess'),
    snapshot=>{
      const access=snapshot.exists()
        ?{festivals:snapshot.data()?.festivals!==false,meals:snapshot.data()?.meals===true}
        :{festivals:true,meals:false};
      window.firebaseCache.guestAccess=access;

      if(role==='guest'){
        if(access.meals){
          startMealListener();
        }else{
          stopMealListener();
          window.firebaseCache.meals=[];
          ui().renderMealCard();
        }
      }

      ui().renderHome();
      ui().applyRoleVisibility();
      if(role==='admin')ui().renderGuestSettings();
    },
    error=>ui().toast(displayFirebaseError(error))
  ));

  if(role!=='guest'){
    startMealListener();

    listenerStops.push(onSnapshot(
      collection(db,'notices'),
      snapshot=>{
        window.firebaseCache.notices=snapshot.docs.map(plain);
        ui().renderNotices();
        if(role==='admin')ui().renderAdminNotices();
      },
      error=>ui().toast(displayFirebaseError(error))
    ));

    listenerStops.push(onSnapshot(
      collection(db,'dailySchedules'),
      snapshot=>{
        window.firebaseCache.dailySchedules=snapshot.docs.map(item=>({id:item.id,...item.data()}));
        ui().renderTodayCard();
        if(role==='admin')ui().renderAdminToday();
      },
      error=>ui().toast(displayFirebaseError(error))
    ));
  }else{
    window.firebaseCache.notices=[];
    window.firebaseCache.dailySchedules=[];
  }

  const mediaSource=role==='guest'
    ?query(collection(db,'media'),where('scope','in',['festival-booth','festival-menu']))
    :collection(db,'media');
  listenerStops.push(onSnapshot(
    mediaSource,
    snapshot=>{
      window.firebaseCache.media=Object.fromEntries(snapshot.docs.map(item=>[item.id,item.data()]));
      ui().renderHome();
      if(ui().state.screen==='festival')ui().renderFestival();
      if(ui().state.screen==='community')ui().renderCommunity();
      if(role==='admin')ui().renderAdmin();
    },
    error=>ui().toast(displayFirebaseError(error))
  ));
}
function listenNotifications(uid,role){
  if(role!=='guest'){
    listenerStops.push(onSnapshot(
      collection(db,'broadcastNotifications'),
      snapshot=>ui().handleBroadcastNotifications(snapshot.docs.map(plain)),
      error=>ui().toast(displayFirebaseError(error))
    ));
  }else{
    window.firebaseCache.notifications=[];
  }

  listenerStops.push(onSnapshot(
    collection(db,'userNotifications',uid,'items'),
    snapshot=>ui().handlePersonalNotifications(snapshot.docs.map(plain)),
    error=>ui().toast(displayFirebaseError(error))
  ));
  listenerStops.push(onSnapshot(
    collection(db,'notificationStates',uid,'items'),
    snapshot=>{
      window.firebaseCache.notificationStates=Object.fromEntries(snapshot.docs.map(item=>[item.id,item.data()]));
      ui().renderNotifications();
    },
    error=>ui().toast(displayFirebaseError(error))
  ));
  listenerStops.push(onSnapshot(
    doc(db,'notificationPreferences',uid),
    snapshot=>{
      window.firebaseCache.notificationPreference=snapshot.exists()?snapshot.data():{enabled:true};
      ui().renderNotifications();
    },
    error=>ui().toast(displayFirebaseError(error))
  ));
}
function listenReservationSlots(role){
  listenerStops.push(onSnapshot(
    collection(db,'reservationSlots'),
    snapshot=>{
      window.firebaseCache.reservationSlots=snapshot.docs.map(plain);
      if(ui().state.screen==='festival')ui().renderFestival();
      if(role==='admin')ui().renderAdminReservations();
    },
    error=>ui().toast(displayFirebaseError(error))
  ));
}
function listenReservations(role,uid){const source=role==="admin"?collection(db,"reservations"):query(collection(db,"reservations"),where("userUid","==",uid));listenerStops.push(onSnapshot(source,s=>{window.firebaseCache.reservations=s.docs.map(plain);ui().renderMy();ui().renderHomeReservations();if(role==="admin")ui().renderAdminReservations()},e=>ui().toast(displayFirebaseError(e))))}
async function refreshAdminCommunity(){requireAdmin();const s=await getDocs(collection(db,"communityPosts"));window.firebaseCache.communityPosts=s.docs.map(normalizePost);ui().renderAdminCommunity();ui().renderCommunity();return s.size}
function startDataListeners(role,profile=null){
  stopListeners();
  listenShared(role);
  listenNotifications(auth.currentUser.uid,role);
  listenReservations(role,auth.currentUser.uid);
  listenReservationSlots(role);

  if(role==='student'||role==='admin'){
    listenerStops.push(onSnapshot(
      collection(db,'communityPosts'),
      snapshot=>{
        window.firebaseCache.communityPosts=snapshot.docs.map(normalizePost);
        ui().renderCommunity();
        if(role==='admin')ui().renderAdminCommunity();
      },
      error=>ui().toast(displayFirebaseError(error))
    ));
  }else{
    window.firebaseCache.communityPosts=[];
  }

  if(role==='admin'){
    rebuildReservationSlots().catch(error=>console.warn('Reservation slot rebuild skipped:',error));
    listenerStops.push(onSnapshot(
      collection(db,'users'),
      snapshot=>{
        window.firebaseCache.users=snapshot.docs.map(item=>({
          uid:item.id,
          ...item.data(),
          lastLoginAt:normalizeDate(item.data().lastLoginAt)
        }));
        ui().renderAdminStudents();
      },
      error=>ui().toast(displayFirebaseError(error))
    ));
    listenerStops.push(onSnapshot(
      collection(db,'communityReports'),
      snapshot=>{
        window.firebaseCache.reports=snapshot.docs.map(plain);
        ui().renderAdminCommunity();
      },
      error=>ui().toast(displayFirebaseError(error))
    ));
  }else if(profile){
    window.firebaseCache.users=role==='student'?[profile]:[];
  }

  window.firebaseCache.ready=true;
}

async function migrateStudentDataAfterLogin(profile){
  try{
    const migrated=await migrateStudentLocalData(profile);
    ui().toast(migrated
      ?`로그인 성공 · 기기 데이터 ${migrated}개를 Firebase로 이전했습니다.`
      :`${profile.name}님, 로그인했습니다.`);
  }catch(error){
    console.warn('Local student data migration skipped:',error);
    ui().toast(`${profile.name}님, 로그인했습니다. 일부 옛 기기 데이터는 이전하지 못했습니다.`);
  }
}
async function activateStudentProfile(profile){
  pendingPasswordProfile=null;
  ui().setSession(studentSession(profile));
  startDataListeners('student',profile);
  ui().closeOverlay('passwordChangeModal');
  ui().enterApp('home');
  await migrateStudentDataAfterLogin(profile);
}
function requireStudentPasswordChange(profile){
  pendingPasswordProfile=profile;
  ui().setSession(studentSession(profile));
  ui().closeOverlay('studentLoginModal');
  $('#newStudentPassword').value='';
  $('#newStudentPasswordConfirm').value='';
  $('#passwordChangeError').hidden=true;
  ui().openOverlay('passwordChangeModal');
  setTimeout(()=>$('#newStudentPassword').focus(),180);
}
async function finishStudentLogin(user,expected){
  const ref=doc(db,'users',user.uid);
  const snap=await getDoc(ref);
  let profile;

  if(!snap.exists()){
    profile={
      uid:user.uid,
      role:'student',
      studentKey:expected.key,
      grade:expected.grade,
      classNo:expected.classNo,
      number:expected.number,
      name:expected.name,
      active:true,
      usesCustomPassword:false,
      passwordChangedAt:null,
      createdAt:Date.now(),
      lastLoginAt:Date.now()
    };
    await setDoc(ref,profile);
  }else{
    profile={uid:user.uid,...snap.data()};
    const mismatch=
      profile.studentKey!==expected.key||
      Number(profile.grade)!==expected.grade||
      Number(profile.classNo)!==expected.classNo||
      Number(profile.number)!==expected.number||
      String(profile.name).trim()!==expected.name;
    if(mismatch){await signOut(auth);throw new Error('STUDENT_INFO_MISMATCH')}
    if(profile.active===false){await signOut(auth);throw new Error('STUDENT_SUSPENDED')}
    await updateDoc(ref,{lastLoginAt:Date.now()});
    profile.lastLoginAt=Date.now();
  }

  if(!profile.passwordChangedAt||profile.usesCustomPassword!==true){
    requireStudentPasswordChange(profile);
    return;
  }
  await activateStudentProfile(profile);
}
async function changeStudentPassword(){
  requireUser();
  if(auth.currentUser?.isAnonymous||auth.currentUser?.email===ADMIN_EMAIL){
    throw new Error('학생 계정에서만 비밀번호를 변경할 수 있습니다.');
  }

  const password=$('#newStudentPassword').value;
  const confirmPassword=$('#newStudentPasswordConfirm').value;
  if(password.length<8)throw new Error('새 비밀번호는 8자 이상이어야 합니다.');
  if(password===COMMON_PASSWORD)throw new Error('공통 비밀번호와 다른 새 비밀번호를 설정해주세요.');
  if(password!==confirmPassword)throw new Error('새 비밀번호 확인이 일치하지 않습니다.');

  await updatePassword(auth.currentUser,password);
  const changedAt=Date.now();
  await updateDoc(doc(db,'users',auth.currentUser.uid),{
    usesCustomPassword:true,
    passwordChangedAt:changedAt,
    lastLoginAt:changedAt
  });

  const profile={
    ...(pendingPasswordProfile||await getStudentProfile(auth.currentUser)),
    usesCustomPassword:true,
    passwordChangedAt:changedAt,
    lastLoginAt:changedAt
  };
  await activateStudentProfile(profile);
  ui().toast('새 비밀번호가 설정되었습니다.');
}

async function submitStudentLogin(){
  const button=$('#studentLoginSubmit');
  const errorBox=$('#studentLoginError');
  errorBox.hidden=true;

  const grade=Number($('#studentGrade').value);
  const classNo=Number($('#studentClass').value);
  const number=Number($('#studentNumber').value);
  const name=$('#studentName').value.trim().replace(/\s+/g,' ');
  const password=$('#studentPassword').value;

  if(!name||!password){
    errorBox.textContent='이름과 비밀번호를 입력해주세요.';
    errorBox.hidden=false;
    (!name?$('#studentName'):$('#studentPassword')).focus();
    return;
  }

  button.disabled=true;
  button.textContent='Firebase 확인 중…';
  try{
    await waitForInitialAuth();
    authFlowInProgress=true;

    const key=studentKey(grade,classNo,number);
    const email=studentEmail(key);
    const expected={key,grade,classNo,number,name};
    let credential;

    try{
      credential=await signInWithEmailAndPassword(auth,email,password);
    }catch(error){
      const code=String(error?.code||'');
      if(!(code.includes('invalid-credential')||code.includes('user-not-found')))throw error;

      if(password!==COMMON_PASSWORD){
        const wrong=new Error('설정한 비밀번호가 올바르지 않습니다. 첫 로그인이라면 학교 공통 비밀번호를 입력해주세요.');
        wrong.code='auth/wrong-password';
        throw wrong;
      }

      try{
        credential=await createUserWithEmailAndPassword(auth,email,COMMON_PASSWORD);
      }catch(createError){
        if(String(createError?.code||'').includes('email-already-in-use')){
          const custom=new Error('이미 새 비밀번호가 설정된 계정입니다. 본인이 설정한 비밀번호를 입력해주세요.');
          custom.code='auth/email-already-in-use';
          throw custom;
        }
        throw createError;
      }
    }

    await finishStudentLogin(credential.user,expected);
  }catch(error){
    console.error('Student login failed:',error);
    if(error.message==='STUDENT_INFO_MISMATCH'){
      errorBox.textContent='이미 등록된 학번의 이름과 일치하지 않습니다.';
    }else if(error.message==='STUDENT_SUSPENDED'){
      errorBox.textContent='관리자에 의해 정지된 계정입니다.';
    }else{
      errorBox.textContent=error.message||displayFirebaseError(error);
    }
    errorBox.hidden=false;
  }finally{
    authFlowInProgress=false;
    button.disabled=false;
    button.textContent='학생 로그인';
    $('#studentPassword').value='';
  }
}
async function submitAdminLogin(){await waitForInitialAuth();const button=$("#adminLoginSubmit"),errorBox=$("#adminLoginError"),adminId=$("#adminLoginId").value.trim().toLowerCase(),password=$("#adminLoginPassword").value;errorBox.hidden=true;if(adminId!=="admin"){errorBox.textContent="관리자 ID가 올바르지 않습니다.";errorBox.hidden=false;return}button.disabled=true;button.textContent="관리자 확인 중…";authFlowInProgress=true;try{const credential=await signInWithEmailAndPassword(auth,ADMIN_EMAIL,password);if(credential.user.email!==ADMIN_EMAIL)throw new Error("NOT_ADMIN");ui().setSession({role:"admin",uid:credential.user.uid,id:"admin",name:"관리자"});const migrated=await migrateAdminLocalData();startDataListeners("admin");ui().closeOverlay("adminLoginModal");ui().enterApp("admin");ui().toast(migrated?`기존 관리자 데이터 ${migrated}개를 Firebase로 이전했습니다.`:"Firebase 관리자 로그인에 성공했습니다.")}catch(error){errorBox.textContent=error.message==="NOT_ADMIN"?"관리자 계정이 아닙니다.":displayFirebaseError(error);errorBox.hidden=false}finally{authFlowInProgress=false;button.disabled=false;button.textContent="관리자 로그인";$("#adminLoginPassword").value=""}}
async function submitGuestLogin(){
  await waitForInitialAuth();
  const button=$('#confirmGuestEntry');
  const errorBox=$('#guestLoginError');
  const school=$('#guestSchool').value.trim().replace(/\s+/g,' ');
  const name=$('#guestName').value.trim().replace(/\s+/g,' ');
  errorBox.hidden=true;

  if(!school||!name){
    errorBox.textContent='소속 학교와 이름을 모두 입력해주세요.';
    errorBox.hidden=false;
    (!school?$('#guestSchool'):$('#guestName')).focus();
    return;
  }

  button.disabled=true;
  button.textContent='들어가는 중…';
  authFlowInProgress=true;
  try{
    const credential=auth.currentUser?.isAnonymous
      ?{user:auth.currentUser}
      :await signInAnonymously(auth);
    const profile={
      uid:credential.user.uid,
      role:'guest',
      school,
      name,
      createdAt:Date.now(),
      lastLoginAt:Date.now()
    };
    await setDoc(doc(db,'guestProfiles',credential.user.uid),profile,{merge:true});
    ui().setSession(profile);
    startDataListeners('guest',profile);
    ui().closeOverlay('guestConfirmModal');
    ui().enterApp('home');
    ui().toast(`${name}님, 게스트로 입장했습니다.`);
  }catch(error){
    errorBox.textContent=displayFirebaseError(error);
    errorBox.hidden=false;
  }finally{
    authFlowInProgress=false;
    button.disabled=false;
    button.textContent='들어가기';
  }
}
async function logout(){try{await signOut(auth)}finally{stopListeners();ui().clearSession();ui().showAuthGate();ui().toast("로그아웃되었습니다.")}}
function interceptClick(selector,handler){
  document.addEventListener("click",event=>{
    const target=event.target.closest(selector);
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(handler(target,event)).catch(error=>{
      console.error(error);
      ui().toast(displayFirebaseError(error));
    });
  },true);
}
interceptClick("#studentLoginSubmit",submitStudentLogin);interceptClick("#adminLoginSubmit",submitAdminLogin);interceptClick("#confirmGuestEntry",submitGuestLogin);interceptClick("#logoutButton,#adminLogout",logout);
$("#studentPassword").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submitStudentLogin()}});$("#adminLoginPassword").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submitAdminLogin()}});

interceptClick("#saveCommunityPost",async()=>{const s=ui().session();if(s?.role!=="student")return ui().toast("학생 로그인 후 이용할 수 있습니다.");const title=$("#communityPostTitle").value.trim(),body=$("#communityPostBody").value.trim();if(!title||!body)return ui().toast("제목과 내용을 입력해주세요.");const image=await persistMedia(ui().state.pendingImage.community||"","community");const ref=doc(collection(db,"communityPosts"));await setDoc(ref,{category:$("#communityPostCategory").value,title,body,image,authorUid:auth.currentUser.uid,authorKey:s.studentKey,authorName:s.name,authorGrade:s.grade,authorClass:s.classNo,authorNumber:s.number,anonymous:false,pinned:false,hidden:false,likes:[],comments:[],reportCount:0,createdAt:Date.now()});ui().closeOverlay("communityComposer");$("#communityPostTitle").value="";$("#communityPostBody").value="";ui().state.pendingImage.community="";ui().toast("Firebase 커뮤니티에 게시했습니다.")});
interceptClick("#communityDetailLike",async()=>{const s=ui().session(),postId=ui().state.currentPostId;if(s?.role!=="student"||!postId)return;await runTransaction(db,async tx=>{const ref=doc(db,"communityPosts",postId),snap=await tx.get(ref);if(!snap.exists())throw new Error("게시글이 없습니다.");const likes=Array.isArray(snap.data().likes)?snap.data().likes:[],uid=auth.currentUser.uid;tx.update(ref,{likes:likes.includes(uid)?likes.filter(x=>x!==uid):[...likes,uid]})})});
interceptClick("#saveCommunityComment",async()=>{const s=ui().session(),body=$("#communityCommentInput").value.trim(),postId=ui().state.currentPostId;if(s?.role!=="student"||!body||!postId)return;await runTransaction(db,async tx=>{const ref=doc(db,"communityPosts",postId),snap=await tx.get(ref);if(!snap.exists())throw new Error("게시글이 없습니다.");const comments=Array.isArray(snap.data().comments)?snap.data().comments:[];tx.update(ref,{comments:[...comments,{id:crypto.randomUUID(),authorUid:auth.currentUser.uid,authorKey:s.studentKey,authorLabel:`${s.grade}학년 ${s.classNo}반 ${s.number}번 ${s.name}`,body,createdAt:Date.now()}]})});$("#communityCommentInput").value=""});
document.addEventListener("click",event=>{const b=event.target.closest("[data-report-reason]");if(!b)return;event.preventDefault();event.stopImmediatePropagation();(async()=>{const s=ui().session(),postId=ui().state.currentPostId;if(s?.role!=="student"||!postId)return;const reportRef=doc(db,"communityReports",`${postId}_${auth.currentUser.uid}`);await setDoc(reportRef,{postId,reporterUid:auth.currentUser.uid,reporterKey:s.studentKey,reason:b.dataset.reportReason,createdAt:Date.now()});await runTransaction(db,async tx=>{const ref=doc(db,"communityPosts",postId),snap=await tx.get(ref);if(snap.exists())tx.update(ref,{reportCount:Number(snap.data().reportCount||0)+1})});ui().closeOverlay("communityReportModal");ui().closeOverlay("communityDetailModal");ui().toast("신고가 Firebase 관리자 목록에 전달되었습니다.")})().catch(e=>ui().toast(displayFirebaseError(e)))},true);
document.addEventListener("click",event=>{const pin=event.target.closest("[data-admin-pin-post]"),hide=event.target.closest("[data-admin-hide-post]"),remove=event.target.closest("[data-admin-delete-post]"),toggle=event.target.closest("[data-toggle-student]"),reset=event.target.closest("[data-reset-student]");if(!pin&&!hide&&!remove&&!toggle&&!reset)return;event.preventDefault();event.stopImmediatePropagation();(async()=>{requireAdmin();if(pin){const id=pin.dataset.adminPinPost,p=window.firebaseCache.communityPosts.find(x=>x.id===id);await updateDoc(doc(db,"communityPosts",id),{pinned:!p?.pinned})}if(hide){const id=hide.dataset.adminHidePost,p=window.firebaseCache.communityPosts.find(x=>x.id===id);await updateDoc(doc(db,"communityPosts",id),{hidden:!p?.hidden})}if(remove){await deleteDoc(doc(db,"communityPosts",remove.dataset.adminDeletePost));ui().toast("게시글을 삭제했습니다.")}if(toggle){const a=window.firebaseCache.users.find(x=>x.studentKey===toggle.dataset.toggleStudent);if(a)await updateDoc(doc(db,"users",a.uid),{active:a.active===false})}if(reset)ui().openOverlay?ui().openOverlay("accountGuideModal"):document.getElementById("accountGuideModal")?.classList.add("show")})().catch(e=>ui().toast(displayFirebaseError(e)))},true);

onAuthStateChanged(auth,async user=>{
  if(authFlowInProgress){
    settleInitialAuth();
    return;
  }

  stopListeners();
  try{
    if(!user){
      ui().clearSession();
      ui().showAuthGate();
      return;
    }

    if(user.isAnonymous){
      const guestProfile=await getGuestProfile(user);
      if(!guestProfile?.school||!guestProfile?.name){
        await signOut(auth);
        ui().clearSession();
        ui().showAuthGate();
        return;
      }
      await updateDoc(doc(db,'guestProfiles',user.uid),{lastLoginAt:Date.now()});
      ui().setSession({...guestProfile,lastLoginAt:Date.now()});
      startDataListeners('guest',guestProfile);
      ui().enterApp('home');
      return;
    }

    if(user.email===ADMIN_EMAIL){
      ui().setSession({role:'admin',uid:user.uid,id:'admin',name:'관리자'});
      startDataListeners('admin');
      ui().enterApp('admin');
      try{
        const migrated=await migrateAdminLocalData();
        if(migrated)ui().toast(`기존 관리자 데이터 ${migrated}개를 Firebase로 이전했습니다.`);
      }catch(error){
        console.warn('Admin migration skipped:',error);
      }
      return;
    }

    const profile=await getStudentProfile(user);
    if(!profile||profile.active===false){
      await signOut(auth);
      ui().clearSession();
      ui().showAuthGate();
      ui().toast(profile?.active===false
        ?'정지된 계정입니다.'
        :'학생 정보가 삭제된 계정입니다. 같은 학생 정보로 다시 로그인해주세요.');
      return;
    }

    if(!profile.passwordChangedAt||profile.usesCustomPassword!==true){
      requireStudentPasswordChange(profile);
      return;
    }
    await activateStudentProfile(profile);
  }catch(error){
    console.error('Auth state handling failed:',error);
    ui().clearSession();
    ui().showAuthGate();
    ui().toast(displayFirebaseError(error));
  }finally{
    settleInitialAuth();
  }
});



window.baemoonAuth={
  submitStudentLogin,
  submitAdminLogin,
  submitGuestLogin,
  changeStudentPassword,
  logout
};

async function refreshAdminStudents(){
  requireAdmin();
  const snapshot=await getDocs(collection(db,"users"));
  window.firebaseCache.users=snapshot.docs.map(item=>({uid:item.id,...item.data()}));
  ui().renderAdminStudents();
  return snapshot.size;
}

async function rebuildReservationSlots(){
  requireAdmin();
  const [reservationSnapshot,festivalSnapshot]=await Promise.all([
    getDocs(collection(db,'reservations')),
    getDocs(collection(db,'festivals'))
  ]);

  const festivals=festivalSnapshot.docs.map(plain);
  const boothMap=new Map();
  festivals.forEach(festival=>(festival.booths||[]).forEach(booth=>{
    boothMap.set(`${festival.id}:${booth.id}`,{festival,booth});
  }));

  const slots=new Map();
  reservationSnapshot.docs.forEach(item=>{
    const data={id:item.id,...item.data()};
    const time=data.time||'즉시 예약';
    const slotId=data.slotId||`${data.festivalId}_${data.boothId}_${encodeURIComponent(time)}`;
    const boothInfo=boothMap.get(`${data.festivalId}:${data.boothId}`);
    const capacity=Math.max(1,Number(data.capacity||boothInfo?.booth?.capacity||1));
    const minPeople=Math.max(1,Number(data.minPeople||boothInfo?.booth?.minPeople||1));
    const previous=slots.get(slotId)||{
      id:slotId,
      festivalId:data.festivalId,
      festivalName:data.festivalName||boothInfo?.festival?.name||'',
      boothId:data.boothId,
      boothName:data.boothName||boothInfo?.booth?.name||'',
      time,
      capacity,
      minPeople,
      reservedPeople:0,
      updatedAt:Date.now()
    };
    previous.reservedPeople+=Math.max(1,Number(data.groupSize||1));
    previous.capacity=capacity;
    previous.minPeople=minPeople;
    slots.set(slotId,previous);
  });

  await syncCollection('reservationSlots',[...slots.values()]);
  return slots.size;
}

window.baemoonFirebase={
  async refreshAdminStudents(){return refreshAdminStudents()},
  async saveFestivals(items){requireAdmin();const prepared=await Promise.all(items.map(prepareFestival));await syncCollection("festivals",prepared);return prepared},
  async saveMeals(items){requireAdmin();const prepared=JSON.parse(JSON.stringify(items));await syncCollection("meals",prepared);return prepared},
  async saveNotices(items){requireAdmin();const prepared=await Promise.all(items.map(prepareNotice));await syncCollection("notices",prepared);return prepared},
  async saveDailySchedules(items){requireAdmin();const prepared=JSON.parse(JSON.stringify(items));await syncCollection("dailySchedules",prepared);return prepared},
  async saveGuestAccess(value){requireAdmin();await setDoc(doc(db,"settings","guestAccess"),value,{merge:false});return value},
  async createReservation(payload){
    requireUser();
    const current=ui().session();
    if(!['student','guest'].includes(current?.role)){
      throw new Error('학생 또는 게스트만 예약할 수 있습니다.');
    }

    const time=payload.time||'즉시 예약';
    const reservationId=`${auth.currentUser.uid}_${payload.boothId}_${encodeURIComponent(time)}`;
    const slotId=`${payload.festivalId}_${payload.boothId}_${encodeURIComponent(time)}`;
    const reservationRef=doc(db,'reservations',reservationId);
    const slotRef=doc(db,'reservationSlots',slotId);

    try{
      return await runTransaction(db,async transaction=>{
        const reservationSnap=await transaction.get(reservationRef);
        const slotSnap=await transaction.get(slotRef);

        const groupSize=Number(payload.groupSize||1);
        const minPeople=Number(payload.minPeople||1);
        const capacity=Number(payload.capacity||1);
        if(!Number.isInteger(groupSize)||!Number.isInteger(minPeople)||!Number.isInteger(capacity)){
          throw new Error('예약 인원 정보가 올바르지 않습니다.');
        }
        if(minPeople<1||capacity<minPeople||groupSize<minPeople||groupSize>capacity){
          throw new Error(`예약 인원은 ${minPeople}명 이상 ${capacity}명 이하여야 합니다.`);
        }

        const existing=reservationSnap.exists()?reservationSnap.data():null;
        const existingSize=Math.max(0,Number(existing?.groupSize||0));
        const currentReserved=Math.max(
          existingSize,
          Number(slotSnap.exists()?slotSnap.data()?.reservedPeople||0:existingSize)
        );
        const nextReserved=currentReserved-existingSize+groupSize;
        const remainingForUpdate=Math.max(0,capacity-(currentReserved-existingSize));

        if(nextReserved>capacity){
          const error=new Error(`남은 자리는 ${remainingForUpdate}명입니다.`);
          error.code='reservation-capacity-full';
          throw error;
        }

        const identity=current.role==='student'
          ?{
            participantRole:'student',
            studentKey:current.studentKey,
            grade:current.grade,
            classNo:current.classNo,
            number:current.number,
            name:current.name
          }
          :{
            participantRole:'guest',
            guestSchool:current.school,
            guestName:current.name,
            name:current.name
          };

        const data={
          id:reservationId,
          slotId,
          userUid:auth.currentUser.uid,
          ...identity,
          ...payload,
          time,
          groupSize,
          minPeople,
          capacity,
          createdAt:existing?.createdAt||Date.now(),
          updatedAt:Date.now()
        };

        transaction.set(reservationRef,data);
        transaction.set(slotRef,{
          id:slotId,
          festivalId:payload.festivalId,
          festivalName:payload.festivalName||'',
          boothId:payload.boothId,
          boothName:payload.boothName||'',
          time,
          capacity,
          minPeople,
          reservedPeople:nextReserved,
          updatedAt:Date.now()
        });

        return {...data,updated:Boolean(existing)};
      });
    }catch(error){
      if(String(error?.code||'').includes('permission-denied')){
        const wrapped=new Error('예약 조회 또는 저장 권한이 거부되었습니다.');
        wrapped.code='reservation-permission';
        throw wrapped;
      }
      throw error;
    }
  },
  async cancelReservation(reservationId){
    requireUser();
    const reservationRef=doc(db,'reservations',reservationId);

    return runTransaction(db,async transaction=>{
      const reservationSnap=await transaction.get(reservationRef);
      if(!reservationSnap.exists())return false;

      const data=reservationSnap.data();
      if(!isAdminUser()&&data.userUid!==auth.currentUser.uid){
        throw new Error('본인의 예약만 취소할 수 있습니다.');
      }

      const slotId=data.slotId||`${data.festivalId}_${data.boothId}_${encodeURIComponent(data.time||'즉시 예약')}`;
      const slotRef=doc(db,'reservationSlots',slotId);
      const slotSnap=await transaction.get(slotRef);
      const reserved=Math.max(0,Number(slotSnap.exists()?slotSnap.data()?.reservedPeople||0:data.groupSize||1));
      const nextReserved=Math.max(0,reserved-Math.max(1,Number(data.groupSize||1)));

      transaction.delete(reservationRef);
      if(slotSnap.exists()){
        if(nextReserved===0){
          transaction.delete(slotRef);
        }else{
          transaction.update(slotRef,{reservedPeople:nextReserved,updatedAt:Date.now()});
        }
      }
      return true;
    });
  },
  async sendReservationMessage(reservationId,payload){
    requireAdmin();
    const reservationSnap=await getDoc(doc(db,'reservations',reservationId));
    if(!reservationSnap.exists())throw new Error('예약 정보를 찾지 못했습니다.');
    const reservation={id:reservationSnap.id,...reservationSnap.data()};
    if(!reservation.userUid)throw new Error('예약자의 Firebase 계정 정보를 찾지 못했습니다.');

    const ref=doc(collection(db,'userNotifications',reservation.userUid,'items'));
    const data={
      id:ref.id,
      title:String(payload.title||'예약 안내'),
      body:String(payload.body||''),
      type:'reservation',
      audience:'개인',
      ownerUid:reservation.userUid,
      senderUid:auth.currentUser.uid,
      reservationId:reservation.id,
      boothName:reservation.boothName||'',
      createdAt:Date.now()
    };
    await setDoc(ref,data);
    return data;
  },
  async clearReservations(){
    requireAdmin();
    const [reservationsSnapshot,slotsSnapshot]=await Promise.all([
      getDocs(collection(db,'reservations')),
      getDocs(collection(db,'reservationSlots'))
    ]);
    await commitInChunks([
      ...reservationsSnapshot.docs.map(item=>batch=>batch.delete(item.ref)),
      ...slotsSnapshot.docs.map(item=>batch=>batch.delete(item.ref))
    ]);
    return reservationsSnapshot.size;
  },
  async createBroadcastNotification(payload){requireAdmin();const ref=doc(collection(db,"broadcastNotifications"));const data={id:ref.id,...payload,ownerUid:null,createdAt:Date.now()};await setDoc(ref,data);return data},
  async createPersonalNotification(payload){requireUser();const ref=doc(collection(db,"userNotifications",auth.currentUser.uid,"items"));const data={id:ref.id,...payload,ownerUid:auth.currentUser.uid,audience:"개인",createdAt:Date.now()};await setDoc(ref,data);return data},
  async setNotificationPreference(enabled){requireUser();await setDoc(doc(db,"notificationPreferences",auth.currentUser.uid),{enabled:Boolean(enabled),updatedAt:Date.now()},{merge:true});return enabled},
  async markNotificationRead(notificationId){requireUser();await setDoc(doc(db,"notificationStates",auth.currentUser.uid,"items",notificationId),{notificationId,userUid:auth.currentUser.uid,read:true,hidden:false,updatedAt:Date.now()},{merge:true})},
  async markAllNotificationsRead(ids){requireUser();await commitInChunks(ids.map(id=>batch=>batch.set(doc(db,"notificationStates",auth.currentUser.uid,"items",id),{notificationId:id,userUid:auth.currentUser.uid,read:true,hidden:false,updatedAt:Date.now()},{merge:true})))},
  async hideNotifications(ids){requireUser();await commitInChunks(ids.map(id=>batch=>batch.set(doc(db,"notificationStates",auth.currentUser.uid,"items",id),{notificationId:id,userUid:auth.currentUser.uid,read:true,hidden:true,updatedAt:Date.now()},{merge:true})))},
  async refreshAdminCommunity(){return refreshAdminCommunity()},
  async saveAllAdminData(payload){requireAdmin();const prepared=await prepareAdminPayload(payload);await Promise.all([syncCollection("festivals",prepared.festivals),syncCollection("meals",prepared.meals),syncCollection("notices",prepared.notices),syncCollection("dailySchedules",prepared.dailySchedules),setDoc(doc(db,"settings","guestAccess"),prepared.guestAccess,{merge:false})]);const mediaSnap=await getDocs(collection(db,"media"));await setDoc(doc(db,"adminBackups",String(Date.now())),{savedAt:Date.now(),adminUid:auth.currentUser.uid,counts:{festivals:prepared.festivals.length,meals:prepared.meals.length,notices:prepared.notices.length,dailySchedules:prepared.dailySchedules.length,media:mediaSnap.size}});return {festivals:prepared.festivals.length,meals:prepared.meals.length,notices:prepared.notices.length,dailySchedules:prepared.dailySchedules.length,media:mediaSnap.size,data:prepared}},
  async checkConnection(){requireUser();const names=["festivals","meals","notices","dailySchedules","communityPosts","reservations","broadcastNotifications","media","users","communityReports","reservationSlots"];const snaps=await Promise.all(names.map(n=>getDocs(collection(db,n))));return {festivals:snaps[0].size,meals:snaps[1].size,notices:snaps[2].size,dailySchedules:snaps[3].size,posts:snaps[4].size,reservations:snaps[5].size,notifications:snaps[6].size,media:snaps[7].size,users:snaps[8].size,reports:snaps[9].size}}
};


window.__firebaseRuntimeReady=true;
window.__firebaseRuntimeState='ready';
window.dispatchEvent(new Event('baemoon:firebase-runtime-ready'));
