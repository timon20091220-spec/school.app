import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkIBksaXIqEVwZGE58UmiNXRQXefYSUNc",
  authDomain: "school-fe512.firebaseapp.com",
  projectId: "school-fe512",
  storageBucket: "school-fe512.firebasestorage.app",
  messagingSenderId: "446975040573",
  appId: "1:446975040573:web:b4e1e773c5464425055e54",
  measurementId: "G-1FYLLVRQC2"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const ADMIN_EMAIL = "admin@school-fe512.firebaseapp.com";
const COMMON_PASSWORD = "baemoon2026";
const ui = () => window.baemoonApp;
const $ = selector => document.querySelector(selector);

window.firebaseCache = {
  communityPosts: [],
  users: [],
  reports: [],
  festivals: null,
  meals: null
};

let authFlowInProgress = false;
let listenerStops = [];

function stopListeners(){
  listenerStops.forEach(stop=>{
    try{ stop(); }catch{}
  });
  listenerStops=[];
  window.firebaseCache.communityPosts=[];
  window.firebaseCache.users=[];
  window.firebaseCache.reports=[];
  window.firebaseCache.festivals=null;
  window.firebaseCache.meals=null;
}

function normalizeDate(value){
  if(typeof value === "number") return value;
  if(value && typeof value.toMillis === "function") return value.toMillis();
  return Date.now();
}

function normalizePost(snapshot){
  const data=snapshot.data();
  return {
    id:snapshot.id,
    ...data,
    createdAt:normalizeDate(data.createdAt),
    likes:Array.isArray(data.likes)?data.likes:[],
    comments:(Array.isArray(data.comments)?data.comments:[]).map(comment=>({
      ...comment,
      createdAt:normalizeDate(comment.createdAt)
    }))
  };
}

function displayFirebaseError(error){
  const code=String(error?.code||"");
  if(code.includes("network-request-failed")) return "인터넷 연결을 확인해주세요.";
  if(code.includes("too-many-requests")) return "로그인 요청이 많습니다. 잠시 후 다시 시도해주세요.";
  if(code.includes("invalid-credential")||code.includes("wrong-password")) return "로그인 정보가 올바르지 않습니다.";
  if(code.includes("email-already-in-use")) return "이미 등록된 학생 계정입니다.";
  if(code.includes("permission-denied")) return "Firestore 보안 규칙을 먼저 게시해주세요.";
  return `Firebase 오류가 발생했습니다. (${code||"unknown"})`;
}

function studentKey(grade,classNo,number){
  return `${new Date().getFullYear()}-${grade}-${String(classNo).padStart(2,"0")}-${String(number).padStart(2,"0")}`;
}
function studentEmail(key){
  return `${key}@student.baemoon.app`;
}
function studentSession(profile){
  return {
    role:"student",
    uid:profile.uid,
    studentKey:profile.studentKey,
    grade:Number(profile.grade),
    classNo:Number(profile.classNo),
    number:Number(profile.number),
    name:profile.name,
    id:`${profile.grade}${String(profile.classNo).padStart(2,"0")}${String(profile.number).padStart(2,"0")}`
  };
}

async function getStudentProfile(user){
  const ref=doc(db,"users",user.uid);
  const snap=await getDoc(ref);
  if(!snap.exists()) return null;
  return {uid:user.uid,...snap.data()};
}


async function syncCollection(collectionName,items){
  const existing=await getDocs(collection(db,collectionName));
  const incomingIds=new Set(items.map(item=>String(item.id)));
  const batch=writeBatch(db);

  existing.docs.forEach(snapshot=>{
    if(!incomingIds.has(snapshot.id))batch.delete(snapshot.ref);
  });

  items.forEach(item=>{
    const clean=JSON.parse(JSON.stringify(item));
    batch.set(doc(db,collectionName,String(item.id)),clean,{merge:false});
  });

  await batch.commit();
}

async function migrateLocalFestivalsIfNeeded(){
  const remote=await getDocs(collection(db,"festivals"));
  if(!remote.empty)return;
  let local=[];
  try{local=JSON.parse(localStorage.getItem("bm_festivals_v5")||"[]");}catch{}
  if(!Array.isArray(local)||!local.length)return;
  await syncCollection("festivals",local);
  ui().toast("이 기기에서 수정한 축제를 Firebase로 옮겼습니다.");
}

async function migrateLocalMealsIfNeeded(){
  const remote=await getDocs(collection(db,"meals"));
  if(!remote.empty)return;
  let local=[];
  try{local=JSON.parse(localStorage.getItem("bm_meals_v10")||"[]");}catch{}
  if(!Array.isArray(local)||!local.length)return;
  await syncCollection("meals",local);
}

function subscribeSharedSchoolData(role){
  listenerStops.push(onSnapshot(collection(db,"festivals"),snapshot=>{
    window.firebaseCache.festivals=snapshot.docs.map(item=>({id:item.id,...item.data()}));
    ui().renderHome();
    if(ui().state.screen==="festival")ui().renderFestival();
    if(role==="admin")ui().renderAdmin();
  },error=>{
    console.error(error);
    ui().toast(displayFirebaseError(error));
  }));

  listenerStops.push(onSnapshot(collection(db,"meals"),snapshot=>{
    window.firebaseCache.meals=snapshot.docs.map(item=>({id:item.id,...item.data()}));
    ui().renderMealCard();
    if(role==="admin")ui().renderAdminMeals();
  },error=>{
    console.error(error);
    ui().toast(displayFirebaseError(error));
  }));
}

function startDataListeners(role,ownProfile=null){
  stopListeners();
  subscribeSharedSchoolData(role);

  if(role==="student"||role==="admin"){
    const postsQuery=query(collection(db,"communityPosts"),orderBy("createdAt","desc"));
    listenerStops.push(onSnapshot(postsQuery,snapshot=>{
      window.firebaseCache.communityPosts=snapshot.docs.map(normalizePost);
      ui().renderCommunity();
      if(role==="admin") ui().renderAdminCommunity();
    },error=>{
      console.error(error);
      ui().toast(displayFirebaseError(error));
    }));
  }

  if(role==="admin"){
    listenerStops.push(onSnapshot(collection(db,"users"),snapshot=>{
      window.firebaseCache.users=snapshot.docs.map(item=>({
        uid:item.id,
        ...item.data(),
        lastLoginAt:normalizeDate(item.data().lastLoginAt)
      }));
      ui().renderAdminStudents();
    },error=>console.error(error)));

    listenerStops.push(onSnapshot(collection(db,"communityReports"),snapshot=>{
      window.firebaseCache.reports=snapshot.docs.map(item=>({
        id:item.id,
        ...item.data(),
        createdAt:normalizeDate(item.data().createdAt)
      }));
      ui().renderAdminCommunity();
    },error=>console.error(error)));
  }else if(ownProfile){
    window.firebaseCache.users=[ownProfile];
  }
}

async function finishStudentLogin(user,expected){
  const ref=doc(db,"users",user.uid);
  const snap=await getDoc(ref);
  let profile;

  if(!snap.exists()){
    profile={
      uid:user.uid,
      role:"student",
      studentKey:expected.key,
      grade:expected.grade,
      classNo:expected.classNo,
      number:expected.number,
      name:expected.name,
      active:true,
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

    if(mismatch){
      await signOut(auth);
      throw new Error("STUDENT_INFO_MISMATCH");
    }
    if(profile.active===false){
      await signOut(auth);
      throw new Error("STUDENT_SUSPENDED");
    }
    await updateDoc(ref,{lastLoginAt:Date.now()});
    profile.lastLoginAt=Date.now();
  }

  const session=studentSession(profile);
  ui().setSession(session);
  startDataListeners("student",profile);
  ui().closeOverlay("studentLoginModal");
  ui().enterApp("home");
  ui().toast(`${profile.name}님, Firebase 로그인에 성공했습니다.`);
}

async function submitStudentLogin(){
  const button=$("#studentLoginSubmit");
  const errorBox=$("#studentLoginError");
  errorBox.hidden=true;

  const grade=Number($("#studentGrade").value);
  const classNo=Number($("#studentClass").value);
  const number=Number($("#studentNumber").value);
  const name=$("#studentName").value.trim();
  const password=$("#studentPassword").value.trim();

  if(!name||!password){
    errorBox.textContent="이름과 비밀번호를 입력해주세요.";
    errorBox.hidden=false;
    return;
  }
  if(password!==COMMON_PASSWORD){
    errorBox.textContent="공통 비밀번호가 올바르지 않습니다.";
    errorBox.hidden=false;
    return;
  }

  const key=studentKey(grade,classNo,number);
  const email=studentEmail(key);
  const expected={key,grade,classNo,number,name};

  button.disabled=true;
  button.textContent="Firebase 확인 중…";
  authFlowInProgress=true;

  try{
    let credential;
    try{
      credential=await signInWithEmailAndPassword(auth,email,password);
    }catch(error){
      const code=String(error.code||"");
      if(code.includes("invalid-credential")||code.includes("user-not-found")){
        credential=await createUserWithEmailAndPassword(auth,email,password);
      }else{
        throw error;
      }
    }
    await finishStudentLogin(credential.user,expected);
  }catch(error){
    console.error(error);
    if(error.message==="STUDENT_INFO_MISMATCH"){
      errorBox.textContent="이미 등록된 학번의 이름과 일치하지 않습니다.";
    }else if(error.message==="STUDENT_SUSPENDED"){
      errorBox.textContent="관리자에 의해 정지된 계정입니다.";
    }else{
      errorBox.textContent=displayFirebaseError(error);
    }
    errorBox.hidden=false;
  }finally{
    authFlowInProgress=false;
    button.disabled=false;
    button.textContent="학생 로그인";
    $("#studentPassword").value="";
  }
}

async function submitAdminLogin(){
  const button=$("#adminLoginSubmit");
  const errorBox=$("#adminLoginError");
  errorBox.hidden=true;
  const adminId=$("#adminLoginId").value.trim().toLowerCase();
  const password=$("#adminLoginPassword").value;

  if(adminId!=="admin"){
    errorBox.textContent="관리자 ID가 올바르지 않습니다.";
    errorBox.hidden=false;
    return;
  }

  button.disabled=true;
  button.textContent="관리자 확인 중…";
  authFlowInProgress=true;
  try{
    const credential=await signInWithEmailAndPassword(auth,ADMIN_EMAIL,password);
    if(credential.user.email!==ADMIN_EMAIL) throw new Error("NOT_ADMIN");
    const session={role:"admin",uid:credential.user.uid,id:"admin",name:"관리자"};
    ui().setSession(session);
    await migrateLocalFestivalsIfNeeded();
    await migrateLocalMealsIfNeeded();
    startDataListeners("admin");
    ui().closeOverlay("adminLoginModal");
    ui().enterApp("admin");
    ui().toast("Firebase 관리자 로그인에 성공했습니다.");
  }catch(error){
    console.error(error);
    errorBox.textContent=error.message==="NOT_ADMIN"
      ?"관리자 계정이 아닙니다."
      :displayFirebaseError(error);
    errorBox.hidden=false;
  }finally{
    authFlowInProgress=false;
    button.disabled=false;
    button.textContent="관리자 로그인";
    $("#adminLoginPassword").value="";
  }
}

async function submitGuestLogin(){
  authFlowInProgress=true;
  try{
    const credential=await signInAnonymously(auth);
    ui().setSession({role:"guest",uid:credential.user.uid,name:"게스트"});
    startDataListeners("guest");
    ui().closeOverlay("guestConfirmModal");
    ui().enterApp("home");
    ui().toast("Firebase 게스트 계정으로 입장했습니다.");
  }catch(error){
    console.error(error);
    ui().toast(displayFirebaseError(error));
  }finally{
    authFlowInProgress=false;
  }
}

async function logout(){
  try{
    await signOut(auth);
  }finally{
    stopListeners();
    ui().clearSession();
    ui().showAuthGate();
    ui().toast("로그아웃되었습니다.");
  }
}

function interceptClick(selector,handler){
  document.addEventListener("click",event=>{
    const target=event.target.closest(selector);
    if(!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(handler(target,event)).catch(error=>{
      console.error(error);
      ui().toast(displayFirebaseError(error));
    });
  },true);
}

interceptClick("#studentLoginSubmit",submitStudentLogin);
interceptClick("#adminLoginSubmit",submitAdminLogin);
interceptClick("#confirmGuestEntry",submitGuestLogin);
interceptClick("#logoutButton,#adminLogout",logout);

$("#studentPassword").addEventListener("keydown",event=>{
  if(event.key==="Enter"){
    event.preventDefault();
    submitStudentLogin();
  }
});
$("#adminLoginPassword").addEventListener("keydown",event=>{
  if(event.key==="Enter"){
    event.preventDefault();
    submitAdminLogin();
  }
});

// Shared Firebase community
interceptClick("#saveCommunityPost",async()=>{
  const session=ui().session();
  if(session?.role!=="student") return ui().toast("학생 로그인 후 이용할 수 있습니다.");

  const title=$("#communityPostTitle").value.trim();
  const body=$("#communityPostBody").value.trim();
  const image=ui().state.pendingImage.community||"";
  if(!title||!body) return ui().toast("제목과 내용을 입력해주세요.");
  if(image.length>700000) return ui().toast("사진 용량이 큽니다. 더 작은 사진을 사용해주세요.");

  const ref=doc(collection(db,"communityPosts"));
  await setDoc(ref,{
    category:$("#communityPostCategory").value,
    title,
    body,
    image,
    authorUid:auth.currentUser.uid,
    authorKey:session.studentKey,
    authorName:session.name,
    authorGrade:session.grade,
    authorClass:session.classNo,
    authorNumber:session.number,
    anonymous:false,
    pinned:false,
    hidden:false,
    likes:[],
    comments:[],
    reportCount:0,
    createdAt:Date.now()
  });
  ui().closeOverlay("communityComposer");
  $("#communityPostTitle").value="";
  $("#communityPostBody").value="";
  ui().state.pendingImage.community="";
  ui().toast("Firebase 커뮤니티에 게시했습니다.");
});

interceptClick("#communityDetailLike",async()=>{
  const session=ui().session();
  if(session?.role!=="student") return ui().toast("학생만 좋아요를 누를 수 있습니다.");
  const postId=ui().state.currentPostId;
  if(!postId) return;

  await runTransaction(db,async transaction=>{
    const ref=doc(db,"communityPosts",postId);
    const snap=await transaction.get(ref);
    if(!snap.exists()) throw new Error("게시글이 없습니다.");
    const data=snap.data();
    const likes=Array.isArray(data.likes)?data.likes:[];
    const uid=auth.currentUser.uid;
    transaction.update(ref,{
      likes:likes.includes(uid)?likes.filter(value=>value!==uid):[...likes,uid]
    });
  });
});

interceptClick("#saveCommunityComment",async()=>{
  const session=ui().session();
  if(session?.role!=="student") return ui().toast("학생 로그인 후 댓글을 작성할 수 있습니다.");
  const body=$("#communityCommentInput").value.trim();
  const postId=ui().state.currentPostId;
  if(!body||!postId) return;

  await runTransaction(db,async transaction=>{
    const ref=doc(db,"communityPosts",postId);
    const snap=await transaction.get(ref);
    if(!snap.exists()) throw new Error("게시글이 없습니다.");
    const data=snap.data();
    const comments=Array.isArray(data.comments)?data.comments:[];
    transaction.update(ref,{
      comments:[...comments,{
        id:crypto.randomUUID(),
        authorUid:auth.currentUser.uid,
        authorKey:session.studentKey,
        authorLabel:`${session.grade}학년 ${session.classNo}반 ${session.number}번 ${session.name}`,
        body,
        createdAt:Date.now()
      }]
    });
  });
  $("#communityCommentInput").value="";
});

document.addEventListener("click",event=>{
  const reasonButton=event.target.closest("[data-report-reason]");
  if(!reasonButton) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const session=ui().session();
  const postId=ui().state.currentPostId;
  if(session?.role!=="student"||!postId) return;

  (async()=>{
    const reportRef=doc(db,"communityReports",`${postId}_${auth.currentUser.uid}`);
    try{
      await setDoc(reportRef,{
        postId,
        reporterUid:auth.currentUser.uid,
        reporterKey:session.studentKey,
        reason:reasonButton.dataset.reportReason,
        createdAt:Date.now()
      });
    }catch(error){
      if(String(error.code||"").includes("permission-denied")){
        ui().closeOverlay("communityReportModal");
        return ui().toast("이미 신고한 게시글이거나 권한이 없습니다.");
      }
      throw error;
    }

    await runTransaction(db,async transaction=>{
      const postRef=doc(db,"communityPosts",postId);
      const snap=await transaction.get(postRef);
      if(!snap.exists()) return;
      transaction.update(postRef,{reportCount:Number(snap.data().reportCount||0)+1});
    });

    ui().closeOverlay("communityReportModal");
    ui().closeOverlay("communityDetailModal");
    ui().toast("신고가 Firebase 관리자 목록에 전달되었습니다.");
  })().catch(error=>{
    console.error(error);
    ui().toast(displayFirebaseError(error));
  });
},true);

// Admin moderation
document.addEventListener("click",event=>{
  const pin=event.target.closest("[data-admin-pin-post]");
  const hide=event.target.closest("[data-admin-hide-post]");
  const remove=event.target.closest("[data-admin-delete-post]");
  const toggleStudent=event.target.closest("[data-toggle-student]");
  const resetStudent=event.target.closest("[data-reset-student]");
  if(!pin&&!hide&&!remove&&!toggleStudent&&!resetStudent) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  (async()=>{
    if(ui().session()?.role!=="admin") return ui().toast("관리자 권한이 필요합니다.");

    if(pin){
      const postId=pin.dataset.adminPinPost;
      const post=window.firebaseCache.communityPosts.find(item=>item.id===postId);
      await updateDoc(doc(db,"communityPosts",postId),{pinned:!post?.pinned});
    }
    if(hide){
      const postId=hide.dataset.adminHidePost;
      const post=window.firebaseCache.communityPosts.find(item=>item.id===postId);
      await updateDoc(doc(db,"communityPosts",postId),{hidden:!post?.hidden});
    }
    if(remove){
      await deleteDoc(doc(db,"communityPosts",remove.dataset.adminDeletePost));
      ui().toast("게시글을 삭제했습니다.");
    }
    if(toggleStudent){
      const account=window.firebaseCache.users.find(item=>item.studentKey===toggleStudent.dataset.toggleStudent);
      if(account){
        await updateDoc(doc(db,"users",account.uid),{active:account.active===false});
        ui().toast("학생 계정 상태를 변경했습니다.");
      }
    }
    if(resetStudent){
      ui().toast("비밀번호 강제 초기화는 Cloud Functions 연결 단계에서 추가됩니다.");
    }
  })().catch(error=>{
    console.error(error);
    ui().toast(displayFirebaseError(error));
  });
},true);

onAuthStateChanged(auth,async user=>{
  if(authFlowInProgress) return;

  stopListeners();

  if(!user){
    ui().clearSession();
    ui().showAuthGate();
    return;
  }

  try{
    if(user.isAnonymous){
      ui().setSession({role:"guest",uid:user.uid,name:"게스트"});
      startDataListeners("guest");
      ui().enterApp("home");
      return;
    }

    if(user.email===ADMIN_EMAIL){
      ui().setSession({role:"admin",uid:user.uid,id:"admin",name:"관리자"});
      await migrateLocalFestivalsIfNeeded();
      await migrateLocalMealsIfNeeded();
      startDataListeners("admin");
      ui().enterApp("admin");
      return;
    }

    const profile=await getStudentProfile(user);
    if(!profile||profile.active===false){
      await signOut(auth);
      ui().clearSession();
      ui().showAuthGate();
      ui().toast(profile?.active===false?"정지된 계정입니다.":"학생 프로필을 찾지 못했습니다.");
      return;
    }

    ui().setSession(studentSession(profile));
    startDataListeners("student",profile);
    ui().enterApp("home");
  }catch(error){
    console.error(error);
    ui().clearSession();
    ui().showAuthGate();
    ui().toast(displayFirebaseError(error));
  }
});


window.baemoonFirebase={
  async saveFestivals(items){
    if(auth.currentUser?.email!==ADMIN_EMAIL)throw new Error("관리자 권한이 필요합니다.");
    await syncCollection("festivals",items);
  },
  async saveMeals(items){
    if(auth.currentUser?.email!==ADMIN_EMAIL)throw new Error("관리자 권한이 필요합니다.");
    await syncCollection("meals",items);
  }
};
