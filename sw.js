const CACHE='baemoon-v11-7-single-main';
const ASSETS=[
  './',
  './index.html',
  './styles.css',
  './main.js?v=11.7.0',
  './manifest.json',
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
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  const url=new URL(event.request.url);
  const isNavigation=event.request.mode==='navigate';
  const isScript=event.request.destination==='script';

  if(isNavigation){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(event.request);
        if(cached)return cached;
        if(isScript)return new Response(
          "throw new Error('필수 스크립트를 불러오지 못했습니다. 인터넷 연결 후 새로고침해주세요.');",
          {headers:{'Content-Type':'text/javascript; charset=utf-8'}}
        );
        return Response.error();
      })
  );
});
