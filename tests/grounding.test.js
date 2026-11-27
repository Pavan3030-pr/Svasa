const assert=require('node:assert/strict'),S=require('../frontend/js/core'),air=require('../backend/lib/air-context');
(async()=>{
  const date=new Date().toISOString().slice(0,16);
  let calls=0;global.fetch=async url=>{calls++;assert.match(String(url),/latitude=17.4/);return {ok:true,json:async()=>({current:{time:date,us_aqi:170,pm2_5:60,us_aqi_pm2_5:170},hourly:{time:[],us_aqi:[]}})}};
  const ctx=await air.verifiedContext({lat:17.4,lon:78.5},'__proto__','constructor',[]);
  assert.equal(ctx.aqi,170);assert.equal(ctx.profile,'general');assert.equal(ctx.lang,'en');assert.equal(ctx.source,'Open-Meteo / CAMS model');
  await air.verifiedContext({lat:17.4,lon:78.5},'general','en',[]);assert.equal(calls,1);
  let concurrent=0;global.fetch=async()=>{concurrent++;await new Promise(r=>setTimeout(r,15));return {ok:true,json:async()=>({current:{time:date,us_aqi:100,pm2_5:20},hourly:{time:[],us_aqi:[]}})};};
  const batch=await Promise.all(Array.from({length:50},()=>air.verifiedContext({lat:18,lon:79},'general','en',[])));assert.equal(concurrent,1);assert.ok(batch.every(x=>x.aqi===100));
  assert.equal(air.coordinates({lat:91,lon:0}),null);assert.equal(air.coordinates({lat:'17',lon:78}),null);
  global.fetch=async()=>({ok:true,json:async()=>({current:{time:'2000-01-01T00:00',us_aqi:10}})});
  await assert.rejects(()=>air.verifiedContext({lat:1,lon:2},'general','en',[]),/Fresh air data/);
  const now=Date.parse('2026-11-27T05:30Z');
  assert.equal(S.readingAge({current:{time:'2026-11-27T11:00'},utc_offset_seconds:19800},now),0);
  assert.equal(S.readingAge({current:{time:'2026-11-27T11:00'}},now),null);
  assert.equal(S.cleanQuestion('a'.repeat(600)).length,500);
  assert.equal(S.validateCtx({aqi:100,profile:'constructor',dominant:'__proto__',lang:'constructor'}).dominant,null);
  console.log('Grounding and freshness tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
