'use strict';
const {createHash,timingSafeEqual,createECDH}=require('node:crypto');
const guard=require('./guard'),air=require('./air-context');
const INDEX='svasa:push:index',PREFIX='svasa:push:',TTL=30*86400;
// Bound daily resource usage until load and provider quotas have been measured.
const capacity=()=>{const n=Number(process.env.PUSH_MAX_SUBSCRIPTIONS||60);return Number.isInteger(n)&&n>=20&&n<=120?n:60;};
function validVapid(publicKey,privateKey){
 try{const e=createECDH('prime256v1'),pub=Buffer.from(publicKey||'','base64url'),priv=Buffer.from(privateKey||'','base64url');if(pub.length!==65||priv.length!==32)return false;e.setPrivateKey(priv);return timingSafeEqual(pub,e.getPublicKey());}catch(_){return false;}
}
const configured=()=>guard.distributedConfigured()&&!!(process.env.VAPID_SUBJECT&&process.env.CRON_SECRET)&&validVapid(process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
const digest=s=>createHash('sha256').update(s).digest('hex');
function validSubscription(s){
 if(!s||typeof s.endpoint!=='string'||s.endpoint.length>1024||!s.keys)return false;
 let u;try{u=new URL(s.endpoint)}catch(_){return false;}
 return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)&&u.pathname.length>1&&typeof s.keys.p256dh==='string'&&/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh)&&typeof s.keys.auth==='string'&&/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth);
}
const validToken=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
function validate(body){
 if(!body||!validSubscription(body.subscription)||!validToken(body.token)||!air.coordinates(body.place)||![101,151,201].includes(body.threshold))return null;
 const {lat,lon}=air.coordinates(body.place),s=body.subscription;
 return {subscription:{endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}},place:{lat:Math.round(lat*100)/100,lon:Math.round(lon*100)/100},threshold:body.threshold};
}
async function redis(cmd){
 const config=guard.redisConfig();const r=await fetch(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(cmd),signal:AbortSignal.timeout(3000),redirect:'error'});
 if(!r.ok)throw Error('storage unavailable');const j=await r.json();if(j.error)throw Error('storage unavailable');return j.result;
}
async function subscribe(body){
 const value=validate(body);if(!value)return 400;
 const id=digest(body.subscription.endpoint),key=PREFIX+id,record=JSON.stringify({...value,tokenHash:digest(body.token),last:null});
 const script="local old=redis.call('GET',KEYS[1]); if old and cjson.decode(old).tokenHash~=ARGV[1] then return -1 end; redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[2]); if not old and redis.call('ZCARD',KEYS[2])>=tonumber(ARGV[7]) then return 0 end; redis.call('SET',KEYS[1],ARGV[3],'EX',ARGV[4]); redis.call('ZADD',KEYS[2],ARGV[5],ARGV[6]); return 1";
 const now=Math.floor(Date.now()/1000),n=await redis(['EVAL',script,'2',key,INDEX,digest(body.token),String(now),record,String(TTL),String(now+TTL),id,String(capacity())]);
 return n===1?200:n===-1?403:503;
}
async function unsubscribe(body){
 if(!body||typeof body.endpoint!=='string'||body.endpoint.length>1024||!validToken(body.token))return 400;
 const id=digest(body.endpoint),script="local old=redis.call('GET',KEYS[1]); if not old then return 1 end; if cjson.decode(old).tokenHash~=ARGV[1] then return 0 end; redis.call('DEL',KEYS[1]); redis.call('ZREM',KEYS[2],ARGV[2]); return 1";
 return await redis(['EVAL',script,'2',PREFIX+id,INDEX,digest(body.token),id])===1?200:403;
}
function authorized(header){
 const expected='Bearer '+(process.env.CRON_SECRET||'');if(!process.env.CRON_SECRET||typeof header!=='string')return false;
 const a=Buffer.from(header),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
}
async function testDelivery(body,deps={}){
 if(!body||typeof body.endpoint!=='string'||body.endpoint.length>1024||!validToken(body.token))return 400;
 const storage=deps.storage||redis,transport=deps.transport||require('web-push'),id=digest(body.endpoint);
 const raw=await storage(['GET',PREFIX+id]);if(!raw)return 404;
 const record=JSON.parse(raw);
 if(record.tokenHash!==digest(body.token)||!validSubscription(record.subscription)||record.subscription.endpoint!==body.endpoint)return 403;
 if(await storage(['SET',PREFIX+'test:'+id,'1','NX','EX','300'])!=='OK')return 429;
 transport.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 try{await transport.sendNotification(record.subscription,JSON.stringify({title:'Svasa · Test notification',body:'Your device can receive background air-quality notifications.'}),{TTL:300,timeout:5000});return 200;}catch(_){return 502;}
}
async function dispatch(deps={}){
 const webpush=deps.transport||require('web-push'),storage=deps.storage||redis,context=deps.context||air.verifiedContext;
 webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 const now=Math.floor(Date.now()/1000);await storage(['ZREMRANGEBYSCORE',INDEX,'-inf',String(now)]);
 const lock=await storage(['SET',PREFIX+'dispatch-lock','1','NX','EX','300']);if(lock!=='OK')return {checked:0,sent:0,errors:0,busy:true};
 const ids=await storage(['ZRANGE',INDEX,'0',String(capacity()-1)]);let sent=0,errors=0,checked=0;
 // Use a bounded worker pool instead of launching every upstream request together.
 let cursor=0;const worker=async()=>{while(cursor<ids.length){const id=ids[cursor++];checked++;
 await processOne(id);}};
 async function processOne(id){
  try{
   const key=PREFIX+id,raw=await storage(['GET',key]);if(!raw){await storage(['ZREM',INDEX,id]);return;}
   const r=JSON.parse(raw);if(!validSubscription(r.subscription))return;
   const ctx=await context(r.place,'general','en',[]),high=ctx.aqi>=r.threshold;
   if(high&&r.last!==true){
    // Claim before sending; a failed attempt can be retried after one hour.
    const claim=await storage(['SET',PREFIX+'claim:'+id,'1','NX','EX','3600']);if(claim!=='OK')return;
    // Recheck ownership before sending.
    if(await storage(['GET',key])!==raw)return;
    try{await webpush.sendNotification(r.subscription,JSON.stringify({title:'Svasa · Air quality alert',body:'Modelled US AQI '+Math.round(ctx.aqi)+'. Check current conditions before outdoor activity.'}),{TTL:3600,timeout:5000});sent++;}
    catch(e){if(e.statusCode===404||e.statusCode===410){await storage(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1]); redis.call('ZREM',KEYS[2],ARGV[2]) end; return 1",'2',key,INDEX,raw,id]);return;}throw e;}
   }
   await storage(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('SET',KEYS[1],ARGV[2],'KEEPTTL') end; return nil",'1',key,raw,JSON.stringify({...r,last:high})]);
  }catch(_){errors++;}
 }
 await Promise.all(Array.from({length:Math.min(12,ids.length)},worker));
 return {checked,sent,errors};
}
module.exports={capacity,configured,validVapid,validSubscription,validate,subscribe,unsubscribe,authorized,dispatch,testDelivery};
