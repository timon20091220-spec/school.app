/* 배문고 Firebase Runtime v11.33 loader
   v11.27의 검증된 Firebase 연결 코드를 고정 커밋에서 불러온 뒤,
   시간별 정원 기능을 적용해 실행합니다. */
const BASE_SOURCES=[
  'https://raw.githubusercontent.com/timon20091220-spec/school.app/68b50607fcd2ce5a233be1c03f091bccda420f9b/firebase-runtime-v1127.js',
  'https://cdn.jsdelivr.net/gh/timon20091220-spec/school.app@68b50607fcd2ce5a233be1c03f091bccda420f9b/firebase-runtime-v1127.js'
];
const CACHE_KEY='baemoon-firebase-runtime-68b50607-v1133';
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

async function loadSource(){
  let lastError=null;
  for(const url of BASE_SOURCES){
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw new Error(`Firebase 런타임 HTTP ${response.status}`);
      const text=await response.text();
      if(text.length<10000)throw new Error('Firebase 런타임 파일이 너무 짧습니다.');
      try{localStorage.setItem(CACHE_KEY,text)}catch{}
      return text;
    }catch(error){lastError=error;}
  }
  try{const cached=localStorage.getItem(CACHE_KEY);if(cached)return cached}catch{}
  throw lastError||new Error('Firebase 런타임을 불러오지 못했습니다.');
}

try{
  let source=await loadSource();
  const pattern=/function reservationSlotInput\(festival,booth,time\)\{[\s\S]*?\n\}\nfunction festivalReservationSlots/;
  if(!pattern.test(source))throw new Error('시간별 정원 적용 위치를 찾지 못했습니다.');
  source=source.replace(pattern,`${SLOT_FUNCTION}\nfunction festivalReservationSlots`)
    .replace(/v11\.27/g,'v11.33');
  const blobUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  try{await import(blobUrl)}finally{URL.revokeObjectURL(blobUrl)}
}catch(error){
  console.error('배문고 Firebase Runtime v11.33 시작 실패:',error);
  window.__firebaseRuntimeReady=false;
  window.dispatchEvent(new CustomEvent('baemoon:firebase-runtime-error',{detail:{message:error?.message||String(error)}}));
}
