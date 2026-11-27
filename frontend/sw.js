const C = 'svasa-v17', A = ['./', 'index.html', 'app.html', 'css/styles.css', 'css/landing.css', 'js/core.js', 'js/app.js', 'js/landing.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(A))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('svasa-') && x !== C).map(x => caches.delete(x))))));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if(!A.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();e.waitUntil(caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{}));}return r;}).catch(async()=>await caches.match(e.request)||Response.error()));
});

self.addEventListener('push',e=>{let d;try{d=e.data.json();}catch(_){return;}if(!d||typeof d.title!=='string'||typeof d.body!=='string')return;e.waitUntil(self.registration.showNotification(d.title.slice(0,80),{body:d.body.slice(0,180),icon:'icon.svg',tag:'svasa-background'}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(new URL('app.html',self.registration.scope).href));});
