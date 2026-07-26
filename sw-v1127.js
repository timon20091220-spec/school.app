const CACHE='baemoon-v11-27-context-festival';
const ASSETS=[
  './',
  './index.html',
  './styles.css?v=1127',
  './app-v1127.js',
  './firebase-runtime-v1127.js',
  './manifest.webmanifest',
  './privacy.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  const url=new URL(event.request.url);
  const local=url.origin===self.location.origin;
  const networkFirst=
    event.request.mode==='navigate'
    ||(local&&['script','style','manifest'].includes(event.request.destination));

  if(networkFirst){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        if(response.ok){
          // 반환 전에 즉시 복제해야 브라우저가 본문을 소비한 뒤 clone 오류가 나지 않습니다.
          const cacheCopy=response.clone();
          event.waitUntil(
            caches.open(CACHE)
              .then(cache=>cache.put(event.request,cacheCopy))
              .catch(error=>console.warn('Cache update skipped:',error))
          );
        }
        return response;
      }catch(error){
        const cached=await caches.match(event.request,{ignoreSearch:true});
        if(cached)return cached;
        if(event.request.mode==='navigate')return caches.match('./index.html');
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request))
  );
});
