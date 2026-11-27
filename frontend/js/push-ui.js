/* Local notification inbox: no account, no remote event tracking. */
(function(root){'use strict';root.SvasaInbox={init({$,store,show}){
 const key='svasa_inbox_v1',cacheName='svasa-inbox-v1',views=new Set(['today','hourly','plan','cities','breathe','ask','family','reports']),day=86400000,dialog=$('notificationcenter');
 let state={items:[],clearedAt:0};
 const valid=x=>x&&typeof x.id==='string'&&x.id.length<=100&&typeof x.title==='string'&&typeof x.body==='string'&&Number.isFinite(x.at)&&x.at>Date.now()-7*day&&x.at<=Date.now()+60000&&views.has(x.view);
 function read(){const x=store.get(key,null);if(!x||!Array.isArray(x.items))return {items:[],clearedAt:0};const clearedAt=Number.isFinite(x.clearedAt)?x.clearedAt:0;return {items:x.items.filter(valid).filter(e=>e.at>clearedAt).sort((a,b)=>b.at-a.at).slice(0,50),clearedAt};}
 state=read();
 function paint(){const n=state.items.filter(x=>!x.read).length;$('notificationcount').textContent=n>99?'99+':String(n);$('notificationcount').hidden=!n;$('notificationbell').setAttribute('aria-label','Notifications, '+n+' unread');if(!dialog.open)return;
  $('notificationempty').hidden=!!state.items.length;$('notificationread').disabled=!n;$('notificationclear').disabled=!state.items.length;
  const list=$('notificationlist'),frag=document.createDocumentFragment();for(const x of state.items){const b=document.createElement('button'),dot=document.createElement('span'),copy=document.createElement('span'),title=document.createElement('strong'),body=document.createElement('span'),time=document.createElement('small');b.type='button';b.className='notificationitem';b.dataset.id=x.id;b.dataset.unread=String(!x.read);dot.className='notificationdot';dot.setAttribute('aria-hidden','true');title.textContent=x.title;body.className='notificationbody';body.textContent=x.body;time.textContent=new Date(x.at).toLocaleString();copy.append(title,body,time);b.append(dot,copy);frag.append(b);}list.replaceChildren(frag);
 }
 function save(){if(!store.set(key,state))$('notificationstatus').textContent='History cannot be saved on this device.';paint();}
 function add(entry){if(!valid(entry)||entry.at<=state.clearedAt||state.items.some(x=>x.id===entry.id))return false;state.items=[{...entry,title:entry.title.slice(0,100),body:entry.body.slice(0,240),read:false},...state.items].filter(valid).sort((a,b)=>b.at-a.at).slice(0,50);save();return true;}
 function emit(title,body,view='today'){const now=Date.now();if(state.items.some(x=>x.title===title&&x.body===body&&now-x.at<30000))return;add({id:crypto.randomUUID(),title,body,view,at:now});}
 function receive(entry){if(add(entry)&&entry.title==='Svasa · Test notification'){ $('pushreceived').hidden=false;$('pushstatus').textContent='The browser displayed a test notification. Confirm only if you saw it.';}}
 let syncPending=null;
 function sync(){if(syncPending)return syncPending;syncPending=(async()=>{
  // Recover an actual notification even if cache persistence or the tab message failed.
  try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration();if(reg?.active)for(const n of await reg.getNotifications({tag:'svasa-background'})){if(n.data)receive(n.data);}}}catch(_){}
  try{if('caches'in root&&await caches.has(cacheName)){const cache=await caches.open(cacheName);for(const k of (await cache.keys()).slice(-30)){try{const response=await cache.match(k);if(response)receive(await response.json());}catch(_){}}}}catch(_){}
 })().finally(()=>{syncPending=null;});return syncPending;}
 let inboxTimer=null;$('notificationbell').onclick=()=>{dialog.showModal();$('notificationbell').setAttribute('aria-expanded','true');paint();sync();clearInterval(inboxTimer);inboxTimer=setInterval(sync,1000);};
 $('notificationclose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{clearInterval(inboxTimer);inboxTimer=null;$('notificationbell').setAttribute('aria-expanded','false');$('notificationbell').focus();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 $('notificationread').onclick=()=>{state.items=state.items.map(x=>({...x,read:true}));save();};
 $('notificationclear').onclick=()=>{state={items:[],clearedAt:Date.now()};save();};
 $('notificationlist').onclick=e=>{const b=e.target.closest('button[data-id]'),x=b&&state.items.find(v=>v.id===b.dataset.id);if(!x)return;x.read=true;save();dialog.close();show(x.view);};
 $('notificationsettings').onclick=()=>{const panel=$('alertsettings'),open=panel.hidden;panel.hidden=!open;$('notificationsettings').setAttribute('aria-expanded',String(open));if(open){root.dispatchEvent(new Event('svasa-alert-settings'));panel.scrollIntoView({block:'nearest'});}};
 root.addEventListener('storage',e=>{if(e.key===key){state=read();paint();}});
 root.addEventListener('focus',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
 if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='svasa-inbox-update'){receive(e.data.entry);sync();}});
 paint();sync();return {emit,sync};
}};})(window);

/* Optional background alerts; no tracking or permission prompt before user action. */
(function(root){'use strict';root.SvasaPushUI={init({$,store,st}){
/* Optional opt-in Web Push. No background location tracking. */
let pushConfig=null;
const pushStatus=s=>{$('pushstatus').textContent=s;};
async function pushApi(body){const r=await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Background alert service unavailable');return r.json();}
async function initPush(){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){pushStatus('Background push is unavailable in this browser.');return;}
 try{
  const r=await fetch('/api/push');if(!r.ok)return;pushConfig=await r.json();
  const existing=store.get('svasa_push',null);
  $('pushoff').hidden=!existing;$('pushtest').hidden=!existing||!pushConfig.enabled;
  $('pushon').hidden=!pushConfig.enabled;$('pushthreshold').hidden=!pushConfig.enabled;
  if(existing)pushStatus('Saved subscription for '+existing.city+' · US AQI '+existing.threshold+'+. Renew or disable it here.');
 }catch(_){}
}
$('pushon').onclick=async()=>{
 if(!pushConfig?.enabled||!st.place||!st.data||st.demo||st.stale){pushStatus('Load a fresh city reading first.');return;}
 const place={lat:st.place.lat,lon:st.place.lon},city=st.place.name,threshold=Number($('pushlevel').value),btn=$('pushon');btn.disabled=true;
 try{
  if(await Notification.requestPermission()!=='granted')throw Error('Notification permission not granted');
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  const old=store.get('svasa_push',null);
  if(sub&&!old){await sub.unsubscribe();sub=null;}
  const k=pushConfig.publicKey.replace(/-/g,'+').replace(/_/g,'/'),bytes=Uint8Array.from(atob(k+'='.repeat((4-k.length%4)%4)),c=>c.charCodeAt(0));
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  const token=old?.endpoint===sub.endpoint?old.token:Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  // Save ownership token before network submission so the user can retry or revoke it.
  if(!store.set('svasa_push',{endpoint:sub.endpoint,token,city,threshold})){if(!old)await sub.unsubscribe();throw Error('Device storage unavailable; subscription not registered');}
  $('pushoff').hidden=false;
  await pushApi({action:'subscribe',subscription:sub.toJSON(),token,place,threshold});
  $('pushtest').hidden=false;
  pushStatus('Background alerts enabled for '+city+' · US AQI '+threshold+'+. Scheduled checks, not real-time alerts.');
 }catch(e){pushStatus(e.message+'; you can retry or disable the subscription.');}finally{btn.disabled=false;}
};
$('pushoff').onclick=async()=>{
 const old=store.get('svasa_push',null);if(!old)return;
 try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();await pushApi({action:'unsubscribe',endpoint:old.endpoint,token:old.token});store.set('svasa_push',null);$('pushoff').hidden=true;$('pushtest').hidden=true;$('pushreceived').hidden=true;pushStatus('Background alerts disabled.');}catch(_){pushStatus('Local notifications may be disabled, but server deletion was not confirmed. Retry or wait for 30-day expiry.');}
};
$('pushtest').onclick=async()=>{const old=store.get('svasa_push',null);if(!old)return;const button=$('pushtest');button.disabled=true;try{await pushApi({action:'test',endpoint:old.endpoint,token:old.token});$('pushreceived').hidden=false;pushStatus('Test accepted by the push service. Check your device notifications, then confirm receipt only if you actually saw it.');}catch(_){pushStatus('Test could not be sent. Check your subscription or retry after five minutes.');}finally{button.disabled=false;}};
$('pushreceived').onclick=()=>{store.set('svasa_push_receipt',{confirmedAt:new Date().toISOString(),method:'user-confirmed'});$('pushreceived').hidden=true;pushStatus('Receipt confirmed by you on this device.');};
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='svasa-test-shown'){ $('pushreceived').hidden=false;pushStatus('The browser displayed a test notification. Confirm only if you saw it.');}});
root.addEventListener('svasa-alert-settings',initPush);


}};})(window);
