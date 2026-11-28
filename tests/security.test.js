'use strict';
const assert=require('node:assert/strict'),g=require('../backend/lib/guard');
(async()=>{
 const good={host:'example.test',origin:'https://example.test'};
 assert.equal(g.sameOrigin(good),true);assert.equal(g.sameOrigin({...good,'sec-fetch-site':'cross-site'}),false);assert.equal(g.sameOrigin({...good,origin:'https://evil.test'}),false);assert.equal(g.sameOrigin({...good,origin:'https://example.test/path'}),false);assert.equal(g.sameOrigin({...good,origin:'https://user@example.test'}),false);
 assert.equal(g.isJson({'content-type':'application/json; charset=utf-8'}),true);assert.equal(g.isJson({'content-type':'application/jsonp'}),false);
 process.env.GEMINI_DAILY_LIMIT='2';assert.equal(g.providerLimit(),2);
 process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';
 let used=0;global.fetch=async(url,opt)=>{assert.equal(url,'https://redis.example.test');assert.equal(opt.redirect,'error');const cmd=JSON.parse(opt.body);assert.equal(cmd[0],'EVAL');assert.match(cmd[3],/^svasa:gemini:budget:/);assert.equal(cmd[2],'2');assert.equal(cmd[4],'svasa:gemini:cooldown');assert.equal(cmd[5],'2');return {ok:true,json:async()=>({result:used++<2?1:0})};};
 const budgetFetch=global.fetch;
 global.fetch=async(url,opt)=>{assert.equal(opt.redirect,'error');assert.match(JSON.parse(opt.body)[3],/^svasa:limit:/);return {ok:true,json:async()=>({result:2})};};
 assert.equal(await g.rateLimit('fixture',1),true);global.fetch=budgetFetch;
 const results=await Promise.all(Array.from({length:10},()=>g.reserveModelAttempt()));assert.equal(results.filter(Boolean).length,2);
 global.fetch=async()=>({ok:true,json:async()=>({result:'unexpected'})});await assert.rejects(g.reserveModelAttempt,/Provider budget unavailable/);
 delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
 assert.equal(await g.reserveModelAttempt(),true);assert.equal(await g.reserveModelAttempt(),true);assert.equal(await g.reserveModelAttempt(),false);
 const now=Date.now,clock=now();let elapsed=0;Date.now=()=>clock+elapsed;
 try{
  assert.equal(g.limited('protected',1),false);assert.equal(g.limited('protected',1),true);
  for(let i=0;i<4999;i++)assert.equal(g.limited('fixture:'+i,1),false);
  assert.equal(g.limited('overflow',1),true);assert.equal(g.limited('protected',1),true);
  elapsed=60001;assert.equal(g.limited('overflow',1),false);assert.equal(g.limited('protected',1),false);
 }finally{Date.now=now;}
 process.env.OPENAQ_API_KEY='fixture';const oq=require('../backend/lib/openaq');
 global.fetch=async(url,opt)=>{assert.equal(opt.redirect,'error');throw Error('redirect rejected');};
 await assert.rejects(()=>oq.nearest(17.385,78.4867),/redirect rejected/);
 delete process.env.OPENAQ_API_KEY;
 assert.equal(g.retryAfterSeconds('120'),120);assert.equal(g.retryAfterSeconds('invalid'),60);assert.equal(g.retryAfterSeconds('99999'),3600);assert.equal(g.retryAfterSeconds(new Date(clock+90000).toUTCString(),clock),90);
 process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';global.fetch=async()=>({ok:true,json:async()=>({result:-1})});await assert.rejects(g.reserveModelAttempt,e=>e.code==='PROVIDER_COOLDOWN');global.fetch=async()=>({ok:true,json:async()=>({result:[-1,92,'daily']})});await assert.rejects(g.reserveModelAttempt,e=>e.code==='PROVIDER_COOLDOWN'&&e.diagnostic.stage==='shared_cooldown'&&e.diagnostic.quota==='daily'&&e.diagnostic.retryAfterSeconds===92);global.fetch=async(url,opt)=>{const cmd=JSON.parse(opt.body);assert.equal(cmd[3],'svasa:gemini:cooldown');assert.equal(cmd[4],'120');assert.equal(cmd[5],'daily');return {ok:true,json:async()=>({result:1})};};await g.markModelCooldown(120,'daily');await assert.rejects(g.reserveModelAttempt,e=>e.code==='PROVIDER_COOLDOWN'&&e.diagnostic.quota==='daily'&&e.diagnostic.retryAfterSeconds<=120);
 console.log('Security regression: strict origin/media type, shared provider budget contract and fail-closed storage passed (fixture Redis).');
})().catch(e=>{console.error(e);process.exitCode=1;});
