'use strict';
const hits = new Map();
const {createHash}=require('node:crypto');
const distributedConfigured=()=>!!(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
const ip = req => String((process.env.VERCEL && req.headers && req.headers['x-vercel-forwarded-for']) || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim().slice(0,100);
function limited(key, max = 20) {
  const n = Date.now(), a = (hits.get(key) || []).filter(t => n - t < 60000);
  a.push(n); hits.set(key, a); if (hits.size > 5000) hits.clear();
  return a.length > max;
}
async function rateLimit(key,max=20){
  if(!distributedConfigured())return limited(key,max);
  const id=createHash('sha256').update(String(key)).digest('hex');
  const script="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n";
  const response=await fetch(process.env.UPSTASH_REDIS_REST_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'1','svasa:limit:'+id]),signal:AbortSignal.timeout(2000)});
  if(!response.ok)throw new Error('Rate limit service unavailable');const value=await response.json();if(!Number.isInteger(value.result)||value.result<1)throw new Error('Rate limit service unavailable');return value.result>max;
}
function sameOrigin(h) { const o = h.origin; if (!o) return true; try { return new URL(o).host === h.host; } catch (_) { return false; } }
const isJson = h => /^application\/json/i.test(h['content-type'] || '');
function tooBig(b) { try { return Buffer.byteLength(JSON.stringify(b)||'', 'utf8') > 4096; } catch (_) { return true; } }
module.exports = { ip, limited, rateLimit, distributedConfigured, sameOrigin, isJson, tooBig };
