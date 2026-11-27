'use strict';
const {createHash,timingSafeEqual}=require('node:crypto');
const guard=require('./guard'),air=require('./air-context');
const INDEX='svasa:push:index',PREFIX='svasa:push:',TTL=30*86400;
const configured=()=>guard.distributedConfigured()&&!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT&&process.env.CRON_SECRET);
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
 const r=await fetch(process.env.UPSTASH_REDIS_REST_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(cmd),signal:AbortSignal.timeout(3000)});
 if(!r.ok)throw Error('storage unavailable');const j=await r.json();if(j.error)throw Error('storage unavailable');return j.result;
}
async function subscribe(body){
 const value=validate(body);if(!value)return 400;
 const id=digest(body.subscription.endpoint),key=PREFIX+id,record=JSON.stringify({...value,tokenHash:digest(body.token),last:null});
 const script="local old=redis.call('GET',KEYS[1]); if old and cjson.decode(old).tokenHash~=ARGV[1] then return -1 end; redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[2]); if not old and redis.call('ZCARD',KEYS[2])>=20 then return 0 end; redis.call('SET',KEYS[1],ARGV[3],'EX',ARGV[4]); redis.call('ZADD',KEYS[2],ARGV[5],ARGV[6]); return 1";
 const now=Math.floor(Date.now()/1000),n=await redis(['EVAL',script,'2',key,INDEX,digest(body.token),String(now),record,String(TTL),String(now+TTL),id]);
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
async function dispatch(){
 const webpush=require('web-push');
 webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 const now=Math.floor(Date.now()/1000);await redis(['ZREMRANGEBYSCORE',INDEX,'-inf',String(now)]);
 const ids=await redis(['ZRANGE',INDEX,'0','19']);let sent=0,errors=0;
 const lock=await redis(['SET',PREFIX+'dispatch-lock','1','NX','EX','300']);if(lock!=='OK')return {checked:0,sent:0,errors:0,busy:true};
 await Promise.all(ids.map(async id=>{
  try{
   const key=PREFIX+id,raw=await redis(['GET',key]);if(!raw){await redis(['ZREM',INDEX,id]);return;}
   const r=JSON.parse(raw);if(!validSubscription(r.subscription))return;
   const ctx=await air.verifiedContext(r.place,'general','en',[]),high=ctx.aqi>=r.threshold;
   if(high&&r.last!==true){
    // Claim before sending; a failed attempt can be retried after one hour.
    const claim=await redis(['SET',PREFIX+'claim:'+id,'1','NX','EX','3600']);if(claim!=='OK')return;
    // Recheck ownership before sending.
    if(await redis(['GET',key])!==raw)return;
    try{await webpush.sendNotification(r.subscription,JSON.stringify({title:'Svasa · Air quality alert',body:'Modelled US AQI '+Math.round(ctx.aqi)+'. Check current conditions before outdoor activity.'}),{TTL:3600,timeout:5000});sent++;}
    catch(e){if(e.statusCode===404||e.statusCode===410){await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1]); redis.call('ZREM',KEYS[2],ARGV[2]) end; return 1",'2',key,INDEX,raw,id]);return;}throw e;}
   }
   await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('SET',KEYS[1],ARGV[2],'KEEPTTL') end; return nil",'1',key,raw,JSON.stringify({...r,last:high})]);
  }catch(_){errors++;}
 }));
 return {checked:ids.length,sent,errors};
}
module.exports={configured,validSubscription,validate,subscribe,unsubscribe,authorized,dispatch};
