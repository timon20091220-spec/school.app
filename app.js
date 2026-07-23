const screens = [...document.querySelectorAll(".screen")];
const navButtons = [...document.querySelectorAll("[data-go]")];
const bottomButtons = [...document.querySelectorAll(".bottom-nav [data-go]")];
const festivalTabs = [...document.querySelectorAll("#festivalTabs [data-tab]")];
const panels = [...document.querySelectorAll(".festival-panel")];
const toast = document.getElementById("toast");
let deferredPrompt = null;

function showToast(message){
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>toast.classList.remove("show"), 2200);
}

function go(screenName){
  screens.forEach(s=>s.classList.toggle("active", s.dataset.screen === screenName));
  bottomButtons.forEach(b=>b.classList.toggle("active", b.dataset.go === screenName));
  window.scrollTo({top:0, behavior:"smooth"});
}

function openFestivalPanel(name){
  go("festival");
  festivalTabs.forEach(tab=>tab.classList.toggle("active",tab.dataset.tab===name));
  panels.forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===name));
}

navButtons.forEach(btn=>{
  btn.addEventListener("click",()=>{
    const screen = btn.dataset.go;
    if(btn.dataset.panel){ openFestivalPanel(btn.dataset.panel); }
    else { go(screen); }
  });
});

festivalTabs.forEach(tab=>tab.addEventListener("click",()=>openFestivalPanel(tab.dataset.tab)));
document.querySelectorAll("[data-tab-target]").forEach(btn=>btn.addEventListener("click",()=>openFestivalPanel(btn.dataset.tabTarget)));

const now = new Date();
document.getElementById("todayText").textContent = new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short"}).format(now);

document.querySelectorAll("#floorTabs button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll("#floorTabs button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const floor = btn.dataset.floor;
    document.getElementById("floorTitle").textContent = `${floor}층 안내도`;
    const labels = [...document.querySelectorAll("#floorMap text")];
    const rooms = {
      1:["행정실","보건실","중앙현관","도서관","교무실","계단","급식실","학생쉼터"],
      2:["2-1","2-2","방송실","학생회실","교무실","계단","상담실","2-3"],
      3:["3-1","과학실","화학실","생명실","3-2","계단","준비실","3-3"],
      4:["음악실","미술실","정보실","동아리실","4-1","계단","시청각실","4-2"]
    };
    labels.forEach((label,i)=>label.textContent=rooms[floor][i]);
    showToast(`${floor}층 지도로 전환했습니다.`);
  });
});

document.getElementById("findRoute").addEventListener("click",()=>{
  const start = document.getElementById("routeStart").value;
  const end = document.getElementById("routeEnd").value;
  document.getElementById("routeResult").innerHTML = `<span class="route-number">1</span><div><b>${start} → ${end}</b><small>추천 경로를 지도에 표시했습니다 · 예상 3분</small></div>`;
  if(navigator.vibrate) navigator.vibrate(45);
  showToast("가장 빠른 경로를 찾았습니다.");
});

const modal = document.getElementById("reservationModal");
let selectedBooth = "";
document.querySelectorAll(".reserve-button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    selectedBooth = btn.closest(".reservation-card").dataset.booth;
    document.getElementById("modalBoothName").textContent = selectedBooth;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");
  });
});
document.querySelector(".modal-close").addEventListener("click",()=>modal.classList.remove("open"));
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
document.querySelectorAll(".time-grid button:not(:disabled)").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".time-grid button").forEach(b=>b.classList.remove("selected"));
  btn.classList.add("selected");
}));

document.getElementById("confirmReservation").addEventListener("click",()=>{
  const name = document.getElementById("reservationName").value.trim();
  if(!name){showToast("학번과 이름을 입력해주세요.");return;}
  const time = document.querySelector(".time-grid button.selected")?.textContent || "13:40";
  const reservations = JSON.parse(localStorage.getItem("bm_reservations")||"[]");
  reservations.push({booth:selectedBooth,name,time,createdAt:Date.now()});
  localStorage.setItem("bm_reservations",JSON.stringify(reservations));
  document.getElementById("reservationCount").textContent = `${reservations.length}건`;
  modal.classList.remove("open");
  if(navigator.vibrate) navigator.vibrate([60,40,90]);
  showToast(`${selectedBooth} ${time} 예약이 완료되었습니다.`);
});

document.querySelectorAll(".bell-mini").forEach(btn=>btn.addEventListener("click",()=>{
  btn.textContent="설정됨";
  btn.disabled=true;
  if(navigator.vibrate) navigator.vibrate([40,30,40]);
  showToast("행사 10분 전 알림을 설정했습니다.");
}));

async function requestAlerts(){
  await setNotificationEnabled(true);
}
document.getElementById("subscribeEvents").addEventListener("click",requestAlerts);

document.getElementById("vibrateDemo").addEventListener("click",()=>{
  if(navigator.vibrate){navigator.vibrate([120,70,120]);showToast("행사 알림 진동 미리보기입니다.");}
  else showToast("이 브라우저에서는 진동 미리보기를 지원하지 않습니다.");
});

document.querySelectorAll(".food-card>button").forEach(btn=>btn.addEventListener("click",()=>{
  btn.textContent="✓";showToast("관심 메뉴에 저장했습니다.");
}));

document.getElementById("mapLegendButton").addEventListener("click",e=>{
  const pop = document.getElementById("legendPopover");
  const rect=e.currentTarget.getBoundingClientRect();
  pop.style.top=`${rect.bottom+8}px`;pop.style.left=`${Math.max(16,rect.left-120)}px`;
  pop.classList.toggle("open");
});

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();deferredPrompt=e;
});
document.getElementById("installButton").addEventListener("click",async()=>{
  if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;}
  else showToast("브라우저 메뉴에서 ‘홈 화면에 추가’를 선택하세요.");
});

const saved = JSON.parse(localStorage.getItem("bm_reservations")||"[]");
document.getElementById("reservationCount").textContent = `${saved.length}건`;

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}


// ---- Login & admin prototype ----
const loginModal = document.getElementById("loginModal");
const accountButton = document.getElementById("accountButton");
const profileLoginButton = document.getElementById("profileLoginButton");
const loginClose = document.getElementById("loginClose");
const loginSubmit = document.getElementById("loginSubmit");
const loginHint = document.getElementById("loginHint");
let loginRole = "student";

function openLogin(){
  loginModal.classList.add("open");
  loginModal.setAttribute("aria-hidden","false");
}
function closeLogin(){
  loginModal.classList.remove("open");
  loginModal.setAttribute("aria-hidden","true");
}
accountButton.addEventListener("click",()=>{
  const session = JSON.parse(localStorage.getItem("bm_session")||"null");
  if(session){ go("my"); } else openLogin();
});
profileLoginButton.addEventListener("click",openLogin);
loginClose.addEventListener("click",closeLogin);
loginModal.addEventListener("click",e=>{if(e.target===loginModal)closeLogin()});

document.querySelectorAll("[data-login-role]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-login-role]").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  loginRole = btn.dataset.loginRole;
  document.getElementById("loginId").placeholder = loginRole==="student" ? "예: 20505" : "예: admin";
  document.getElementById("loginSecret").placeholder = loginRole==="student" ? "예: 박정빈" : "관리자 비밀번호";
  loginHint.textContent = loginRole==="student" ? "학생은 학번과 이름을 입력하세요." : "시제품 관리자 계정: admin / 2026";
}));

function updateSessionUI(){
  const session = JSON.parse(localStorage.getItem("bm_session")||"null");
  const adminEntry = document.getElementById("openAdminFromMy");
  const logoutButton = document.getElementById("logoutButton");
  if(!session){
    document.getElementById("profileRole").textContent="로그인 필요";
    document.getElementById("profileName").textContent="게스트 모드";
    document.getElementById("profileDetail").textContent="로그인하면 예약과 알림을 한곳에서 관리할 수 있습니다.";
    document.getElementById("profileAvatar").textContent="BM";
    profileLoginButton.hidden=false;
    adminEntry.hidden=true;
    logoutButton.hidden=true;
    accountButton.classList.remove("logged-in");
    return;
  }
  accountButton.classList.add("logged-in");
  profileLoginButton.hidden=true;
  logoutButton.hidden=false;
  if(session.role==="admin"){
    document.getElementById("profileRole").textContent="배문고 관리자";
    document.getElementById("profileName").textContent=session.name;
    document.getElementById("profileDetail").textContent="연봉제 운영과 학교 앱 콘텐츠를 관리할 수 있습니다.";
    document.getElementById("profileAvatar").textContent="AD";
    adminEntry.hidden=false;
  } else {
    document.getElementById("profileRole").textContent="배문고 학생";
    document.getElementById("profileName").textContent=session.name;
    document.getElementById("profileDetail").textContent=`학번 ${session.id} · 학생 계정`;
    document.getElementById("profileAvatar").textContent=session.name.slice(0,1);
    adminEntry.hidden=true;
  }
}

loginSubmit.addEventListener("click",()=>{
  const id = document.getElementById("loginId").value.trim();
  const secret = document.getElementById("loginSecret").value.trim();
  if(!id || !secret){showToast("로그인 정보를 모두 입력해주세요.");return;}
  if(loginRole==="admin"){
    if(id!=="admin" || secret!=="2026"){showToast("관리자 정보가 올바르지 않습니다.");return;}
    localStorage.setItem("bm_session",JSON.stringify({role:"admin",id:"admin",name:"관리자"}));
    closeLogin();updateSessionUI();renderAdminReservations();go("admin");
    showToast("관리자 센터에 로그인했습니다.");
  } else {
    localStorage.setItem("bm_session",JSON.stringify({role:"student",id,name:secret}));
    closeLogin();updateSessionUI();go("my");
    showToast(`${secret}님, 환영합니다.`);
  }
});

document.getElementById("openAdminFromMy").addEventListener("click",()=>{
  renderAdminReservations();go("admin");
});
document.getElementById("logoutButton").addEventListener("click",()=>{
  localStorage.removeItem("bm_session");updateSessionUI();go("home");showToast("로그아웃되었습니다.");
});

function renderAdminReservations(){
  const reservations = JSON.parse(localStorage.getItem("bm_reservations")||"[]");
  const list = document.getElementById("adminReservationList");
  document.getElementById("adminReservationTotal").textContent=reservations.length;
  if(!reservations.length){list.innerHTML='<div class="admin-empty">아직 예약 내역이 없습니다.</div>';return;}
  list.innerHTML=reservations.slice().reverse().map(r=>`
    <div class="admin-row">
      <div><b>${r.booth}</b><small>${r.name}</small></div>
      <span>${r.time}</span>
      <small>${new Date(r.createdAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}</small>
    </div>`).join("");
}
document.getElementById("clearReservations").addEventListener("click",()=>{
  localStorage.removeItem("bm_reservations");
  document.getElementById("reservationCount").textContent="0건";
  renderAdminReservations();showToast("예약 내역을 초기화했습니다.");
});
// The notice registration buttons are connected to the composer below.
// 관리자 알림 작성과 연봉제 메뉴 공개 설정은 아래 통합 관리 코드에서 처리합니다.
document.getElementById("downloadAdminCsv").addEventListener("click",()=>{
  const rows = JSON.parse(localStorage.getItem("bm_reservations")||"[]");
  const csv = ["부스,예약자,시간,등록시각",...rows.map(r=>`${r.booth},${r.name},${r.time},${new Date(r.createdAt).toLocaleString("ko-KR")}`)].join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="baemoon-reservations.csv";a.click();
  URL.revokeObjectURL(url);
  showToast("예약 명단을 내려받았습니다.");
});

// ---- Notice detail, editable notices, app inbox, and festival visibility ----
const NOTICE_KEY = "bm_notices";
const NOTIFICATION_KEY = "bm_notifications";
const NOTIFICATION_ENABLED_KEY = "bm_notifications_enabled";
const FESTIVAL_VISIBLE_KEY = "bm_festival_visible";

const noticeComposer = document.getElementById("noticeComposer");
const noticeDetailModal = document.getElementById("noticeDetailModal");
const alertComposer = document.getElementById("alertComposer");
const notificationCenter = document.getElementById("notificationCenter");

let editingNoticeId = null;
let pendingNoticeImage = "";

function escapeNoticeHtml(value=""){
  return String(value).replace(/[&<>"']/g, ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
function withLineBreaks(value=""){
  return escapeNoticeHtml(value).replace(/\n/g,"<br>");
}
function makeId(){
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
function dateToInputValue(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function getDdayText(dateString){
  if(!dateString) return "";
  const target = new Date(`${dateString}T00:00:00`);
  if(Number.isNaN(target.getTime())) return "";
  const today = new Date();
  today.setHours(0,0,0,0);
  const days = Math.ceil((target-today)/86400000);
  if(days>0) return `D-${days}`;
  if(days===0) return "D-DAY";
  return `D+${Math.abs(days)}`;
}
function noticeCategoryClass(category){
  if(category==="시험") return "exam";
  if(category==="행사") return "event";
  if(category==="긴급") return "emergency";
  return "";
}
function seedNotices(){
  if(localStorage.getItem(NOTICE_KEY)) return;
  const examDate = new Date();
  examDate.setDate(examDate.getDate()+18);
  const festivalDate = new Date();
  festivalDate.setDate(festivalDate.getDate()+45);
  const samples = [
    {
      id:makeId(),category:"시험",audience:"2학년",
      title:"2학기 기말고사 안내",
      summary:"시험 시간표와 과목별 시험 범위가 등록되었습니다.",
      body:"2학기 기말고사 시간표와 과목별 시험 범위를 확인해주세요.\n\n준비물과 시험실 변경 사항은 추후 공지될 수 있으니 시험 전날 다시 확인 바랍니다.",
      eventDate:dateToInputValue(examDate),pinned:true,imageData:"",createdAt:Date.now()-2000
    },
    {
      id:makeId(),category:"행사",audience:"전체",
      title:"연봉제 부스 운영 안내",
      summary:"체험 부스와 먹거리 장터 정보를 연봉제 메뉴에서 확인하세요.",
      body:"연봉제 체험 부스와 먹거리 장터 정보가 공개되었습니다.\n\n학교 안내 메뉴에서 부스 위치와 이동 경로를 확인하고, 예약 메뉴에서 원하는 체험 시간을 선택할 수 있습니다.",
      eventDate:dateToInputValue(festivalDate),pinned:false,imageData:"",createdAt:Date.now()-1000
    }
  ];
  localStorage.setItem(NOTICE_KEY,JSON.stringify(samples));
}
function getNotices(){
  try{
    return JSON.parse(localStorage.getItem(NOTICE_KEY)||"[]").map(n=>({
      ...n,
      summary:n.summary || n.body || "",
      body:n.body || n.summary || "",
      imageData:n.imageData || ""
    }));
  }catch{return [];}
}
function setNotices(notices){
  localStorage.setItem(NOTICE_KEY,JSON.stringify(notices));
}

function openNoticeDetail(id){
  const notice=getNotices().find(n=>n.id===id);
  if(!notice) return;
  const cls=noticeCategoryClass(notice.category);
  document.getElementById("noticeDetailTags").innerHTML=`
    <span class="notice-category ${cls}">${escapeNoticeHtml(notice.category)}</span>
    <span class="notice-category">${escapeNoticeHtml(notice.audience)}</span>
    ${notice.pinned?'<span class="notice-category">중요</span>':""}`;
  document.getElementById("noticeDetailTitle").textContent=notice.title;
  document.getElementById("noticeDetailDday").textContent=getDdayText(notice.eventDate);
  document.getElementById("noticeDetailMeta").innerHTML=`
    <span>등록 ${new Date(notice.createdAt).toLocaleString("ko-KR")}</span>
    ${notice.eventDate?`<span>관련일 ${escapeNoticeHtml(notice.eventDate)}</span>`:""}`;
  document.getElementById("noticeDetailBody").innerHTML=withLineBreaks(notice.body);
  const imageWrap=document.getElementById("noticeDetailImageWrap");
  if(notice.imageData){
    document.getElementById("noticeDetailImage").src=notice.imageData;
    imageWrap.hidden=false;
  }else{
    document.getElementById("noticeDetailImage").removeAttribute("src");
    imageWrap.hidden=true;
  }
  noticeDetailModal.classList.add("open");
  noticeDetailModal.setAttribute("aria-hidden","false");
}
function closeNoticeDetail(){
  noticeDetailModal.classList.remove("open");
  noticeDetailModal.setAttribute("aria-hidden","true");
}
document.getElementById("noticeDetailClose").addEventListener("click",closeNoticeDetail);
noticeDetailModal.addEventListener("click",e=>{if(e.target===noticeDetailModal)closeNoticeDetail();});

function renderSchoolNotices(){
  const notices=getNotices().sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt);
  const homeList=document.getElementById("homeNoticeList");
  const adminList=document.getElementById("adminNoticeList");
  document.getElementById("homeNoticeCount").textContent=`${notices.length}건`;
  document.getElementById("adminNoticeCount").textContent=notices.length;

  if(!notices.length){
    homeList.innerHTML='<div class="notice-empty">등록된 학교 공지가 없습니다.</div>';
    adminList.innerHTML='<div class="admin-empty">등록된 공지가 없습니다.</div>';
    return;
  }

  homeList.innerHTML=notices.map(n=>{
    const cls=noticeCategoryClass(n.category);
    const dday=getDdayText(n.eventDate);
    return `<article class="home-notice-card ${n.pinned?"pinned":""} ${cls}" data-notice-id="${n.id}" tabindex="0" role="button" aria-label="${escapeNoticeHtml(n.title)} 상세 보기">
      <div class="notice-card-top">
        <div class="notice-card-tags">
          <span class="notice-category ${cls}">${escapeNoticeHtml(n.category)}</span>
          <span class="notice-category">${escapeNoticeHtml(n.audience)}</span>
          ${n.pinned?'<span class="notice-category">중요</span>':""}
        </div>
        ${dday?`<b class="notice-dday">${dday}</b>`:""}
      </div>
      <h3>${escapeNoticeHtml(n.title)}</h3>
      <p>${escapeNoticeHtml(n.summary)}</p>
      <div class="notice-open-hint"><span>세부 내용 보기</span><b>→</b></div>
    </article>`;
  }).join("");

  adminList.innerHTML=notices.map(n=>`
    <article class="admin-notice-card">
      <div>
        <span class="notice-category ${noticeCategoryClass(n.category)}">${escapeNoticeHtml(n.category)} · ${escapeNoticeHtml(n.audience)}</span>
        <h3>${escapeNoticeHtml(n.title)} ${getDdayText(n.eventDate)?`<small>${getDdayText(n.eventDate)}</small>`:""}</h3>
        <p>${escapeNoticeHtml(n.summary)}</p>
      </div>
      <div class="admin-notice-actions">
        <button class="view-notice" data-notice-id="${n.id}">상세</button>
        <button class="edit-notice" data-notice-id="${n.id}">수정</button>
        <button class="toggle-pin-notice" data-notice-id="${n.id}">${n.pinned?"고정 해제":"상단 고정"}</button>
        <button class="delete-notice" data-notice-id="${n.id}">삭제</button>
      </div>
    </article>`).join("");

  document.querySelectorAll(".home-notice-card").forEach(card=>{
    const open=()=>openNoticeDetail(card.dataset.noticeId);
    card.addEventListener("click",open);
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
  });
  document.querySelectorAll(".view-notice").forEach(btn=>btn.addEventListener("click",()=>openNoticeDetail(btn.dataset.noticeId)));
  document.querySelectorAll(".edit-notice").forEach(btn=>btn.addEventListener("click",()=>openNoticeComposer(btn.dataset.noticeId)));
  document.querySelectorAll(".delete-notice").forEach(btn=>btn.addEventListener("click",()=>{
    setNotices(getNotices().filter(n=>n.id!==btn.dataset.noticeId));
    renderSchoolNotices();
    showToast("공지를 삭제했습니다.");
  }));
  document.querySelectorAll(".toggle-pin-notice").forEach(btn=>btn.addEventListener("click",()=>{
    setNotices(getNotices().map(n=>n.id===btn.dataset.noticeId?{...n,pinned:!n.pinned}:n));
    renderSchoolNotices();
    showToast("공지 고정 설정을 변경했습니다.");
  }));
}

function resetNoticeComposer(){
  editingNoticeId=null;
  pendingNoticeImage="";
  document.getElementById("noticeComposerTitle").textContent="새 공지 등록";
  document.getElementById("saveNoticeButton").textContent="공지 등록";
  document.getElementById("noticeCategory").value="일반";
  document.getElementById("noticeAudience").value="전체";
  document.getElementById("noticeTitle").value="";
  document.getElementById("noticeSummary").value="";
  document.getElementById("noticeBody").value="";
  document.getElementById("noticeEventDate").value="";
  document.getElementById("noticePinned").checked=false;
  document.getElementById("noticePush").checked=false;
  document.getElementById("noticeImage").value="";
  updateNoticeImagePreview();
}
function updateNoticeImagePreview(){
  const wrap=document.getElementById("noticeImagePreview");
  if(pendingNoticeImage){
    document.getElementById("noticeImagePreviewImg").src=pendingNoticeImage;
    wrap.hidden=false;
  }else{
    document.getElementById("noticeImagePreviewImg").removeAttribute("src");
    wrap.hidden=true;
  }
}
function openNoticeComposer(id=null){
  const session=JSON.parse(localStorage.getItem("bm_session")||"null");
  if(!session || session.role!=="admin"){
    showToast("관리자 로그인 후 사용할 수 있습니다.");
    return;
  }
  resetNoticeComposer();
  if(id){
    const notice=getNotices().find(n=>n.id===id);
    if(!notice) return;
    editingNoticeId=id;
    pendingNoticeImage=notice.imageData||"";
    document.getElementById("noticeComposerTitle").textContent="공지 수정";
    document.getElementById("saveNoticeButton").textContent="수정 내용 저장";
    document.getElementById("noticeCategory").value=notice.category;
    document.getElementById("noticeAudience").value=notice.audience;
    document.getElementById("noticeTitle").value=notice.title;
    document.getElementById("noticeSummary").value=notice.summary;
    document.getElementById("noticeBody").value=notice.body;
    document.getElementById("noticeEventDate").value=notice.eventDate||"";
    document.getElementById("noticePinned").checked=Boolean(notice.pinned);
    updateNoticeImagePreview();
  }
  noticeComposer.classList.add("open");
  noticeComposer.setAttribute("aria-hidden","false");
}
function closeNoticeComposer(){
  noticeComposer.classList.remove("open");
  noticeComposer.setAttribute("aria-hidden","true");
}
document.getElementById("openNoticeComposer").addEventListener("click",()=>openNoticeComposer());
document.getElementById("addNoticeButton").addEventListener("click",()=>openNoticeComposer());
document.getElementById("noticeComposerClose").addEventListener("click",closeNoticeComposer);
noticeComposer.addEventListener("click",e=>{if(e.target===noticeComposer)closeNoticeComposer();});
document.getElementById("removeNoticeImage").addEventListener("click",()=>{
  pendingNoticeImage="";
  document.getElementById("noticeImage").value="";
  updateNoticeImagePreview();
});

async function compressNoticeImage(file){
  if(!file || !file.type.startsWith("image/")) throw new Error("이미지 파일만 선택할 수 있습니다.");
  if(file.size>12*1024*1024) throw new Error("12MB 이하의 이미지를 선택해주세요.");
  const dataUrl=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error("이미지를 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
  const image=await new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("이미지를 불러올 수 없습니다."));
    img.src=dataUrl;
  });
  const maxWidth=1200,maxHeight=800;
  const scale=Math.min(1,maxWidth/image.width,maxHeight/image.height);
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",.8);
}
document.getElementById("noticeImage").addEventListener("change",async e=>{
  const file=e.target.files?.[0];
  if(!file) return;
  try{
    pendingNoticeImage=await compressNoticeImage(file);
    updateNoticeImagePreview();
    showToast("사진을 추가했습니다.");
  }catch(error){
    e.target.value="";
    showToast(error.message);
  }
});

document.getElementById("saveNoticeButton").addEventListener("click",async()=>{
  const title=document.getElementById("noticeTitle").value.trim();
  const summary=document.getElementById("noticeSummary").value.trim();
  const body=document.getElementById("noticeBody").value.trim();
  if(!title || !summary || !body){
    showToast("제목, 요약, 상세 내용을 모두 입력해주세요.");
    return;
  }
  const payload={
    category:document.getElementById("noticeCategory").value,
    audience:document.getElementById("noticeAudience").value,
    title,summary,body,imageData:pendingNoticeImage,
    eventDate:document.getElementById("noticeEventDate").value,
    pinned:document.getElementById("noticePinned").checked
  };
  let notices=getNotices();
  if(editingNoticeId){
    notices=notices.map(n=>n.id===editingNoticeId?{...n,...payload,updatedAt:Date.now()}:n);
  }else{
    notices.push({id:makeId(),...payload,createdAt:Date.now()});
  }
  setNotices(notices);
  renderSchoolNotices();
  closeNoticeComposer();

  if(document.getElementById("noticePush").checked){
    await addAppNotification({
      title:`학교 공지 · ${title}`,
      body:summary,
      audience:payload.audience,
      type:"notice",
      noticeId:editingNoticeId || notices[notices.length-1].id,
      vibrate:true
    });
  }
  showToast(editingNoticeId?"공지를 수정했습니다.":"새 공지를 등록했습니다.");
  editingNoticeId=null;
});

// Notification inbox
function getNotifications(){
  try{return JSON.parse(localStorage.getItem(NOTIFICATION_KEY)||"[]");}
  catch{return [];}
}
function setNotifications(items){
  localStorage.setItem(NOTIFICATION_KEY,JSON.stringify(items));
}
function isNotificationEnabled(){
  const saved=localStorage.getItem(NOTIFICATION_ENABLED_KEY);
  return saved===null ? true : saved==="true";
}
async function setNotificationEnabled(enabled){
  if(enabled && "Notification" in window && Notification.permission==="default"){
    const permission=await Notification.requestPermission();
    if(permission!=="granted"){
      localStorage.setItem(NOTIFICATION_ENABLED_KEY,"false");
      renderNotificationSettings();
      showToast("브라우저 알림 권한이 허용되지 않았습니다.");
      return false;
    }
  }
  if(enabled && "Notification" in window && Notification.permission==="denied"){
    localStorage.setItem(NOTIFICATION_ENABLED_KEY,"false");
    renderNotificationSettings();
    showToast("브라우저 설정에서 알림 권한을 허용해주세요.");
    return false;
  }
  localStorage.setItem(NOTIFICATION_ENABLED_KEY,String(enabled));
  renderNotificationSettings();
  showToast(enabled?"앱 알림을 켰습니다.":"앱 알림을 껐습니다.");
  return true;
}
async function addAppNotification({title,body,audience="전체",type="event",noticeId="",vibrate=false}){
  const item={id:makeId(),title,body,audience,type,noticeId,createdAt:Date.now(),read:false};
  const items=getNotifications();
  items.push(item);
  setNotifications(items);
  renderNotificationCenter();

  if(isNotificationEnabled()){
    if(vibrate && navigator.vibrate) navigator.vibrate([80,50,120]);
    if("Notification" in window && Notification.permission==="granted"){
      try{new Notification(title,{body,icon:"./icons/icon-192.png"});}catch{}
    }
  }
  return item;
}
function renderNotificationSettings(){
  const enabled=isNotificationEnabled();
  document.getElementById("notificationToggle").checked=enabled;
  document.getElementById("myNotificationStatus").textContent=enabled?"켜짐":"꺼짐";
  document.getElementById("notificationSettingDescription").textContent=enabled
    ?"행사 및 학교 공지 알림을 받습니다."
    :"앱 안에 알림은 저장되지만 소리·진동 알림은 표시하지 않습니다.";
}
function renderNotificationCenter(){
  const items=getNotifications().slice().reverse();
  const list=document.getElementById("notificationList");
  const unread=items.filter(item=>!item.read).length;
  const badge=document.getElementById("notificationBadge");
  badge.hidden=unread===0;
  badge.textContent=unread>99?"99+":String(unread);

  if(!items.length){
    list.innerHTML='<div class="notification-empty">아직 받은 알림이 없습니다.</div>';
  }else{
    list.innerHTML=items.map(item=>`
      <article class="notification-item ${item.read?"":"unread"}" data-notification-id="${item.id}" ${item.noticeId?`data-notice-id="${item.noticeId}"`:""}>
        <div class="notification-symbol">${item.type==="notice"?"N":"!"}</div>
        <div>
          <h3>${escapeNoticeHtml(item.title)}</h3>
          <p>${escapeNoticeHtml(item.body)}</p>
          <div class="notification-item-meta">
            <span>${escapeNoticeHtml(item.audience)}</span>
            <span>${new Date(item.createdAt).toLocaleString("ko-KR")}</span>
          </div>
        </div>
      </article>`).join("");
  }
  document.querySelectorAll(".notification-item").forEach(card=>card.addEventListener("click",()=>{
    const id=card.dataset.notificationId;
    setNotifications(getNotifications().map(item=>item.id===id?{...item,read:true}:item));
    renderNotificationCenter();
    if(card.dataset.noticeId){
      closeNotificationCenter();
      openNoticeDetail(card.dataset.noticeId);
    }
  }));
}
function openNotificationCenter(){
  notificationCenter.classList.add("open");
  notificationCenter.setAttribute("aria-hidden","false");
  setNotifications(getNotifications().map(item=>({...item,read:true})));
  renderNotificationCenter();
}
function closeNotificationCenter(){
  notificationCenter.classList.remove("open");
  notificationCenter.setAttribute("aria-hidden","true");
}
document.getElementById("alertButton").addEventListener("click",openNotificationCenter);
document.getElementById("myAlertSetting").addEventListener("click",openNotificationCenter);
document.getElementById("notificationCenterClose").addEventListener("click",closeNotificationCenter);
notificationCenter.addEventListener("click",e=>{if(e.target===notificationCenter)closeNotificationCenter();});
document.getElementById("clearNotifications").addEventListener("click",()=>{
  setNotifications([]);
  renderNotificationCenter();
  showToast("알림함을 비웠습니다.");
});
document.getElementById("notificationToggle").addEventListener("change",e=>setNotificationEnabled(e.target.checked));

// Admin alert composer
function openAlertComposer(){
  const session=JSON.parse(localStorage.getItem("bm_session")||"null");
  if(!session || session.role!=="admin"){
    showToast("관리자 로그인 후 사용할 수 있습니다.");
    return;
  }
  alertComposer.classList.add("open");
  alertComposer.setAttribute("aria-hidden","false");
}
function closeAlertComposer(){
  alertComposer.classList.remove("open");
  alertComposer.setAttribute("aria-hidden","true");
}
document.getElementById("eventControlButton").addEventListener("click",openAlertComposer);
document.getElementById("alertComposerClose").addEventListener("click",closeAlertComposer);
alertComposer.addEventListener("click",e=>{if(e.target===alertComposer)closeAlertComposer();});
document.getElementById("sendAlertMessage").addEventListener("click",async()=>{
  const title=document.getElementById("alertMessageTitle").value.trim();
  const body=document.getElementById("alertMessageBody").value.trim();
  if(!title || !body){
    showToast("알림 제목과 내용을 입력해주세요.");
    return;
  }
  await addAppNotification({
    title,body,
    audience:document.getElementById("alertMessageAudience").value,
    type:"event",
    vibrate:document.getElementById("alertMessageVibrate").checked
  });
  document.getElementById("alertMessageTitle").value="";
  document.getElementById("alertMessageBody").value="";
  closeAlertComposer();
  showToast("행사 알림을 알림함에 보냈습니다.");
});

// Festival menu visibility: clear wording and actual behavior.
function isFestivalVisible(){
  const saved=localStorage.getItem(FESTIVAL_VISIBLE_KEY);
  return saved===null ? true : saved==="true";
}
function applyFestivalVisibility(){
  const visible=isFestivalVisible();
  document.querySelectorAll('[data-go="festival"]').forEach(el=>el.hidden=!visible);
  document.querySelector(".bottom-nav").classList.toggle("festival-hidden",!visible);
  document.getElementById("festivalModeStatus").textContent=visible
    ?"학생 화면에 연봉제가 표시됩니다"
    :"학생 화면에서 연봉제가 숨겨집니다";
  document.getElementById("festivalVisibilityLabel").textContent=visible?"공개":"숨김";
  if(!visible && document.querySelector('[data-screen="festival"]').classList.contains("active")) go("home");
}
document.getElementById("toggleFestivalButton").addEventListener("click",()=>{
  const next=!isFestivalVisible();
  localStorage.setItem(FESTIVAL_VISIBLE_KEY,String(next));
  applyFestivalVisibility();
  showToast(next?"연봉제 메뉴를 학생 화면에 공개했습니다.":"연봉제 메뉴를 학생 화면에서 숨겼습니다.");
});

seedNotices();
renderSchoolNotices();
renderNotificationSettings();
renderNotificationCenter();
applyFestivalVisibility();
updateSessionUI();
