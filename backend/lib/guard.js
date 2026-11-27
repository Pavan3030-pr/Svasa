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
let daySlot=-1,dayCount=0;
async function reserveModelAttempt(){
 const now=Math.floor(Date.now()/1000),day=Math.floor(now/86400),ttl=86400-now%86400,limit=providerLimit();
 if(!distributedConfigured()){if(daySlot!==day){daySlot=day;dayCount=0;}if(dayCount>=limit)return false;dayCount++;return true;}
 const config=redisConfig(),script="local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return 0 end; n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[2]) end; return 1";
 const res=await fetch(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'1','svasa:gemini:budget:'+day,String(limit),String(ttl)]),signal:AbortSignal.timeout(2000),redirect:'error'});
 if(!res.ok)throw Error('Provider budget unavailable');const j=await res.json();if(j.result!==0&&j.result!==1)throw Error('Provider budget unavailable');return j.result===1;
}
function sameOrigin(h){if(h['sec-fetch-site']==='cross-site')return false;const o=h.origin;if(!o)return true;try{const u=new URL(o);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.origin===o&&u.host===h.host&&(!process.env.VERCEL||u.protocol==='https:');}catch(_){return false;}}
const isJson=h=>/^application\/json(?:\s*;|\s*$)/i.test(h['content-type']||'');
function tooBig(b) { try { return Buffer.byteLength(JSON.stringify(b)||'', 'utf8') > 4096; } catch (_) { return true; } }
module.exports = { ip, limited, rateLimit, providerLimit, reserveModelAttempt, distributedConfigured, redisConfig, sameOrigin, isJson, tooBig };
