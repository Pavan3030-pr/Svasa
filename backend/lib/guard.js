'use strict';
const hits = new Map();
const {createHash}=require('node:crypto');
const redisConfig=()=>({url:process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN});
const distributedConfigured=()=>{const c=redisConfig();return !!(c.url&&c.token);};
const ip = req => String((process.env.VERCEL && req.headers && req.headers['x-vercel-forwarded-for']) || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim().slice(0,100);
// Bounded local fixed-window fallback. Never reset all active counters under pressure.
function limited(key,max=20){
 const now=Date.now(),id=String(key);let row=hits.get(id);
 if(!row||row.until<=now){
  if(!row&&hits.size>=5000){for(const [k,v] of hits)if(v.until<=now)hits.delete(k);if(hits.size>=5000)return true;}
  row={count:0,until:now+60000};hits.set(id,row);
 }
 if(row.count>=max)return true;
 row.count++;return false;
}
async function rateLimit(key,max=20){
  if(!distributedConfigured())return limited(key,max);
  const id=createHash('sha256').update(String(key)).digest('hex');
  const script="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n";
  const config=redisConfig();const response=await fetch(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'1','svasa:limit:'+id]),signal:AbortSignal.timeout(2000),redirect:'error'});
  if(!response.ok)throw new Error('Rate limit service unavailable');const value=await response.json();if(!Number.isInteger(value.result)||value.result<1)throw new Error('Rate limit service unavailable');return value.result>max;
}
// Shared daily provider budget. Count actual outbound attempts, including retries.
function providerLimit(){const n=Number(process.env.GEMINI_DAILY_LIMIT||300);return Number.isInteger(n)&&n>=1&&n<=10000?n:300;}
let daySlot=-1,dayCount=0,localCooldown=0;
const cooldownKey='svasa:gemini:cooldown';
function retryAfterSeconds(value,now=Date.now()){const n=typeof value==='string'&&value.trim()?(/^[0-9]+$/.test(value.trim())?Number(value):Math.ceil((Date.parse(value)-now)/1000)):NaN;return Number.isFinite(n)?Math.max(30,Math.min(3600,n)):60;}
async function markModelCooldown(seconds){const ttl=Math.max(30,Math.min(3600,Math.ceil(seconds)||60));localCooldown=Math.max(localCooldown,Date.now()+ttl*1000);if(!distributedConfigured())return;const config=redisConfig(),script="local t=redis.call('TTL',KEYS[1]); if t<tonumber(ARGV[1]) then redis.call('SET',KEYS[1],'1','EX',ARGV[1]) end; return 1";const r=await fetch(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'1',cooldownKey,String(ttl)]),signal:AbortSignal.timeout(2000),redirect:'error'});if(!r.ok||(await r.json()).result!==1)throw Error('Provider cooldown unavailable');}
async function reserveModelAttempt(){
 const now=Math.floor(Date.now()/1000),day=Math.floor(now/86400),ttl=86400-now%86400,limit=providerLimit();
 if(localCooldown>Date.now())throw Object.assign(Error('Provider cooldown active'),{code:'PROVIDER_COOLDOWN'});
 if(!distributedConfigured()){if(daySlot!==day){daySlot=day;dayCount=0;}if(dayCount>=limit)return false;dayCount++;return true;}
 const config=redisConfig(),script="if redis.call('EXISTS',KEYS[2])==1 then return -1 end; local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return 0 end; n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[2]) end; return 1";
 const res=await fetch(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'2','svasa:gemini:budget:'+day,cooldownKey,String(limit),String(ttl)]),signal:AbortSignal.timeout(2000),redirect:'error'});
 if(!res.ok)throw Error('Provider budget unavailable');const j=await res.json();if(j.result===-1)throw Object.assign(Error('Provider cooldown active'),{code:'PROVIDER_COOLDOWN'});if(j.result!==0&&j.result!==1)throw Error('Provider budget unavailable');return j.result===1;
}
function sameOrigin(h){if(h['sec-fetch-site']==='cross-site')return false;const o=h.origin;if(!o)return true;try{const u=new URL(o);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.origin===o&&u.host===h.host&&(!process.env.VERCEL||u.protocol==='https:');}catch(_){return false;}}
const isJson=h=>/^application\/json(?:\s*;|\s*$)/i.test(h['content-type']||'');
function tooBig(b) { try { return Buffer.byteLength(JSON.stringify(b)||'', 'utf8') > 4096; } catch (_) { return true; } }
module.exports = { ip, limited, rateLimit, providerLimit, reserveModelAttempt, retryAfterSeconds, markModelCooldown, distributedConfigured, redisConfig, sameOrigin, isJson, tooBig };
