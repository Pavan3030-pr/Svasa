'use strict';const assert=require('node:assert/strict'),S=require('../frontend/js/core'),g=require('../backend/lib/guard');
(async()=>{
const time=Array.from({length:24},(_,i)=>'2026-11-26T'+String(i).padStart(2,'0')+':00'),until='2026-11-27T00:00';
const series=n=>Array(24).fill(n);const data={hourly:{time,pm2_5:series(45),pm10:series(75),nitrogen_dioxide:series(20)}};
assert.equal(S.historicalMean(data,'pm2_5',until,24).mean,45);
assert.equal(S.indiaModel24(data,until).aqi,75);
assert.equal(S.indiaModel24({hourly:{time,pm2_5:series(45)}},until),null);
data.hourly.pm2_5.splice(0,9,...Array(9).fill(null));
assert.equal(S.historicalMean(data,'pm2_5',until,24,16),null);assert.equal(S.indiaModel24(data,until),null);
process.env.UPSTASH_REDIS_REST_URL='https://redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';
let calls=0;global.fetch=async(url,o)=>{assert.equal(o.headers.Authorization,'Bearer fixture');const cmd=JSON.parse(o.body);assert.equal(cmd[0],'EVAL');assert.ok(!cmd[3].includes('private-ip'));return {ok:true,json:async()=>({result:++calls})}};
assert.equal(await g.rateLimit('private-ip',1),false);assert.equal(await g.rateLimit('private-ip',1),true);
global.fetch=async()=>({ok:false});await assert.rejects(()=>g.rateLimit('private-ip'),/unavailable/);
console.log('Historical averaging and distributed rate limit tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
