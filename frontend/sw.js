const C = 'svasa-v50', A = ['./', 'index.html', 'app.html', 'css/styles.css', 'css/landing.css', 'css/notifications.css', 'js/app.bundle.js', 'js/landing.bundle.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('svasa-') && x !== C && x !== 'svasa-inbox-v1').map(x => caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if(!A.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();e.waitUntil(caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{}));}return r;}).catch(async()=>await caches.match(e.request)||Response.error()));
});

self.addEventListener('message',e=>{if(e.data?.type==='svasa-worker-version'&&e.ports?.[0])e.ports[0].postMessage(C);});
self.addEventListener('push',e=>{
 let d;try{d=e.data.json();}catch(_){return;}if(!d||typeof d.title!=='string'||typeof d.body!=='string')return;
 e.waitUntil((async()=>{
  const at=Date.now(),entry={id:at+'-'+crypto.randomUUID(),at,title:d.title.slice(0,80),body:d.body.slice(0,180),view:'today'};
  // Persist before showing; also attach the entry to the notification itself for recovery.
  try{const cache=await caches.open('svasa-inbox-v1');await cache.put(new URL('__svasa_inbox/'+entry.id,self.registration.scope).href,new Response(JSON.stringify(entry),{headers:{'Content-Type':'application/json'}}));const keys=await cache.keys();for(const k of keys.slice(0,Math.max(0,keys.length-30)))await cache.delete(k);}catch(_){}
  await self.registration.showNotification(entry.title,{body:entry.body,icon:'icon.svg',tag:'svasa-background',data:entry});
  const tabs=await clients.matchAll({type:'window',includeUncontrolled:true});for(const tab of tabs){tab.postMessage({type:'svasa-inbox-update',entry});if(entry.title==='Svasa · Test notification')tab.postMessage({type:'svasa-test-shown'});}
 })());
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(new URL('app.html',self.registration.scope).href));});
