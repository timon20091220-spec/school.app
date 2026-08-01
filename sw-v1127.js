/* 배문고 학교 앱 Service Worker v11.34 */
const CACHE_NAME='baemoon-school-app-v11.34';
const CORE_ASSETS=[
  './','./index.html','./styles.css','./app-v1127.js','./firebase-runtime-v1127.js',
  './manifest.webmanifest','./privacy.html','./icons/icon-192.png','./icons/icon-512.png'
];
const LONG_VIBRATION=[700,180,700,180,1200];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(asset=>cache.add(new Request(asset,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
    // 새 버전이 적용되어도 사용 중인 화면은 강제로 새로고침하지 않습니다.
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:'no-store'});
        if(response?.ok){const cache=await caches.open(CACHE_NAME);cache.put('./index.html',response.clone()).catch(()=>{});}
        return response;
      }catch{
        return (await caches.match(request))||(await caches.match('./index.html'))||Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    const network=fetch(request).then(async response=>{
      if(response?.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}
      return response;
    }).catch(()=>null);
    return cached||(await network)||Response.error();
  })());
});

function notificationOptions(payload={}){
  return {
    body:String(payload.body||'부스에서 내 번호를 호출했습니다.'),
    icon:'./icons/icon-192.png',
    badge:'./icons/icon-192.png',
    tag:String(payload.tag||payload.queueId||('baemoon-'+Date.now())),
    renotify:true,
    requireInteraction:true,
    vibrate:LONG_VIBRATION,
    data:{url:String(payload.url||'./?open=notifications'),queueId:String(payload.queueId||''),type:String(payload.type||'')}
  };
}

self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json?.()||{body:event.data?.text?.()||''}}catch{payload={body:event.data?.text?.()||''}}
  event.waitUntil(self.registration.showNotification(String(payload.title||'배문고 앱 알림'),notificationOptions(payload)));
});

self.addEventListener('message',event=>{
  const message=event.data||{};
  if(message.type!=='SHOW_NOTIFICATION')return;
  event.waitUntil(self.registration.showNotification(String(message.title||'배문고 앱 알림'),notificationOptions(message)));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage({type:'QUEUE_NOTIFICATION_OPENED',queueId:event.notification.data?.queueId||''});return;}
    }
    await self.clients.openWindow(target);
  })());
});
