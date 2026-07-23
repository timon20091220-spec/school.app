window.__firebaseRuntimeReady=false;
window.__firebaseRuntimeState='loading';
window.__firebaseRuntimeError=null;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForApp(timeoutMs=10000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(
      window.__baemoonAppReady===true &&
      window.baemoonApp &&
      typeof window.baemoonApp.setSession==='function'
    ){
      return;
    }
    await sleep(25);
  }
  throw new Error('앱 화면 초기화 시간 초과');
}

async function loadFirebaseRuntime(){
  let lastError=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      await import(`./firebase-runtime-v1110.js?attempt=${attempt}`);
      return;
    }catch(error){
      lastError=error;
      console.error(`Firebase runtime attempt ${attempt} failed:`,error);
      if(attempt<2)await sleep(900);
    }
  }
  throw lastError||new Error('Firebase runtime load failed');
}

try{
  await waitForApp();
  await loadFirebaseRuntime();

  if(!window.baemoonAuth){
    throw new Error('Firebase 로그인 API가 생성되지 않았습니다.');
  }

  window.__firebaseRuntimeReady=true;
  window.__firebaseRuntimeState='ready';
  window.dispatchEvent(new Event('baemoon:firebase-ready'));
}catch(error){
  window.__firebaseRuntimeReady=false;
  window.__firebaseRuntimeState='error';
  window.__firebaseRuntimeError=error;
  window.dispatchEvent(new CustomEvent('baemoon:firebase-error',{detail:{message:String(error?.message||error)}}));
  console.error('Firebase login module failed:',error);
}
