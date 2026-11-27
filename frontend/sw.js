const C = 'svasa-v38', A = ['./', 'index.html', 'app.html', 'css/styles.css', 'css/landing.css', 'css/notifications.css', 'js/app.bundle.js', 'js/landing.bundle.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(A))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('svasa-') && x !== C && x !== 'svasa-inbox-v1').map(x => caches.delete(x))))));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if(!A.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();e.waitUntil(caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{}));}return r;}).catch(async()=>await caches.match(e.request)||Response.error()));
});

self.addEventListener('push',e=>{let d;try{d=e.data.json();}catch(_){return;}if(!d||typeof d.title!=='string'||typeof d.body!=='string')return;e.waitUntil((async()=>{await self.registration.showNotification(d.title.slice(0,80),{body:d.body.slice(0,180),icon:'icon.svg',tag:'svasa-background'});const at=Date.now(),entry={id:at+'-'+crypto.randomUUID(),at,title:d.title.slice(0,80),body:d.body.slice(0,180),view:'today'};try{const cache=await caches.open('svasa-inbox-v1');await cache.put(new URL('__svasa_inbox/'+entry.id,self.registration.scope).href,new Response(JSON.stringify(entry),{headers:{'Content-Type':'application/json'}}));const keys=await cache.keys();for(const k of keys.slice(0,Math.max(0,keys.length-30)))await cache.delete(k);}catch(_){}const tabs=await clients.matchAll({type:'window',includeUncontrolled:true});for(const tab of tabs){tab.postMessage({type:'svasa-inbox-update'});if(d.title==='Svasa · Test notification')tab.postMessage({type:'svasa-test-shown'});}})());});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(new URL('app.html',self.registration.scope).href));});
