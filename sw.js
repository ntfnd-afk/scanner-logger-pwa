const CACHE='scanner-logger-v31-auto-close'; const ASSETS=[
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  // DB helpers
  './vendor-idb.js',
  './db/index.js',
  // Features
  './features/wakelock.js',
  './features/orientation.js',
  // State
  './state/appState.js',
  // Sync
  './sync/index.js',
  // UI
  './ui/tabs.js'
];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(keys=> Promise.all(keys.map(k=> k!==CACHE? caches.delete(k): null)))); self.clients.claim(); });
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET') return; e.respondWith(caches.match(e.request).then(cached=> cached || fetch(e.request).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=> c.put(e.request,copy)); return res; }).catch(()=> cached || new Response('Offline',{status:503}))) ); });
