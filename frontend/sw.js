const C = 'svasa-v16', A = ['./', 'index.html', 'app.html', 'css/styles.css', 'css/landing.css', 'js/core.js', 'js/app.js', 'js/landing.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(A))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('svasa-') && x !== C).map(x => caches.delete(x))))));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if(!A.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();e.waitUntil(caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{}));}return r;}).catch(async()=>await caches.match(e.request)||Response.error()));
});
