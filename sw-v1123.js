const CACHE='baemoon-v11-23-booth-fix';
const ASSETS=[
  './',
  './index.html',
  './styles.css?v=1123',
  './app-v1123.js',
  './firebase-runtime-v1123.js',
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
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response.ok){
            caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
          }
          return response;
        })
        .catch(async()=>{
          const cached=await caches.match(event.request,{ignoreSearch:true});
          if(cached)return cached;
          if(event.request.mode==='navigate')return caches.match('./index.html');
          return Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request))
  );
});
