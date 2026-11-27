/* Optional background alerts; no tracking or permission prompt before user action. */
(function(root){'use strict';root.SvasaPushUI={init({$,store,st}){
/* Optional opt-in Web Push. No background location tracking. */
let pushConfig=null;
const pushStatus=s=>{$('pushstatus').textContent=s;};
async function pushApi(body){const r=await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Background alert service unavailable');return r.json();}
async function initPush(){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return;
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
const alertsPanel=$('pushon').closest('.card');
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){observer.disconnect();initPush();}},{rootMargin:'160px'});observer.observe(alertsPanel);}else initPush();


}};})(window);
