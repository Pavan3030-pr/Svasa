'use strict';
const assert=require('node:assert/strict'),g=require('../backend/lib/guard');
(async()=>{
 const good={host:'example.test',origin:'https://example.test'};
 assert.equal(g.sameOrigin(good),true);assert.equal(g.sameOrigin({...good,'sec-fetch-site':'cross-site'}),false);assert.equal(g.sameOrigin({...good,origin:'https://evil.test'}),false);assert.equal(g.sameOrigin({...good,origin:'https://example.test/path'}),false);assert.equal(g.sameOrigin({...good,origin:'https://user@example.test'}),false);
 assert.equal(g.isJson({'content-type':'application/json; charset=utf-8'}),true);assert.equal(g.isJson({'content-type':'application/jsonp'}),false);
 process.env.GEMINI_DAILY_LIMIT='2';assert.equal(g.providerLimit(),2);
 process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';
 let used=0;global.fetch=async(url,opt)=>{assert.equal(url,'https://redis.example.test');assert.equal(opt.redirect,'error');const cmd=JSON.parse(opt.body);assert.equal(cmd[0],'EVAL');assert.match(cmd[3],/^svasa:gemini:budget:/);assert.equal(cmd[4],'2');return {ok:true,json:async()=>({result:used++<2?1:0})};};
 const results=await Promise.all(Array.from({length:10},()=>g.reserveModelAttempt()));assert.equal(results.filter(Boolean).length,2);
 global.fetch=async()=>({ok:true,json:async()=>({result:'unexpected'})});await assert.rejects(g.reserveModelAttempt,/Provider budget unavailable/);
 delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
 assert.equal(await g.reserveModelAttempt(),true);assert.equal(await g.reserveModelAttempt(),true);assert.equal(await g.reserveModelAttempt(),false);
 console.log('Security regression: strict origin/media type, shared provider budget contract and fail-closed storage passed (fixture Redis).');
})().catch(e=>{console.error(e);process.exitCode=1;});
