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
  if(!("Notification" in window)){showToast("이 기기에서는 웹 알림을 지원하지 않습니다.");return;}
  const result = await Notification.requestPermission();
  if(result==="granted"){
    if(navigator.vibrate) navigator.vibrate([50,40,70]);
    showToast("행사 알림이 켜졌습니다.");
  } else showToast("알림 권한이 허용되지 않았습니다.");
}
document.getElementById("alertButton").addEventListener("click",requestAlerts);
document.getElementById("subscribeEvents").addEventListener("click",requestAlerts);
document.getElementById("myAlertSetting").addEventListener("click",requestAlerts);

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
