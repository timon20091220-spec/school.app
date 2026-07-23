const CACHE='baemoon-v11-10-login-wait';
const ASSETS=[
  './',
  './index.html',
  './styles.css',
  './app-v1110.js',
  './firebase-loader-v1110.js',
  './firebase-runtime-v1110.js',
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
  const isLocal=url.origin===self.location.origin;
  const isNavigation=event.request.mode==='navigate';
  const isAppCode=isLocal&&(
    url.pathname.endsWith('.js')||
    url.pathname.endsWith('.css')||
    url.pathname.endsWith('.html')
  );

  if(isNavigation||isAppCode){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          }
          return response;
        })
        .catch(async()=>{
          const cached=await caches.match(event.request,{ignoreSearch:true});
          if(cached)return cached;
          if(isNavigation)return caches.match('./index.html');
          return Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request))
  );
});
