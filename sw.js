const CACHE = "baemoon-v11-9-mobile-login";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=11.9.0",
  "./firebase-loader.js?v=11.9.0",
  "./firebase-runtime.js?v=11.9.0",
  "./manifest.json",
  "./privacy.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const destination = event.request.destination;
  const networkFirst = event.request.mode === "navigate" || destination === "script" || destination === "style";

  if(networkFirst){
    event.respondWith(
      fetch(event.request, {cache:"no-store"})
        .then(response => {
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          }
          return response;
        })
        .catch(async()=>{
          const cached=await caches.match(event.request);
          if(cached)return cached;
          if(event.request.mode === "navigate")return caches.match("./index.html");
          return Response.error();
        })
    );
    return;
  }

  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
