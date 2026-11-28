'use strict';
const assert=require('node:assert/strict'),{classify429,safeDiagnostic}=require('../backend/lib/provider-quota'),gemini=require('../backend/lib/gemini');
(async()=>{
 const fixture=(quotaId,quotaValue,seconds)=>({ok:false,status:429,headers:{get:()=>null},json:async()=>({error:{message:'private provider text',details:[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId,quotaValue,quotaDimensions:{project:'private-project'}}]},{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:seconds+'s'}]}})});
 assert.deepEqual(await classify429(fixture('GenerateRequestsPerDayPerProject','20',90)),{stage:'upstream_429',quota:'daily',retryAfterSeconds:90});
 assert.equal((await classify429(fixture('RequestsPerMinute','0',15))).quota,'zero');
 assert.equal((await classify429(fixture('RequestsPerMinute','20',95))).quota,'minute');
 assert.equal((await classify429({status:429})).retryAfterSeconds,60);
 assert.deepEqual(safeDiagnostic({stage:'local_cooldown',quota:'private text',retryAfterSeconds:99999,secret:'do not expose'}),{stage:'local_cooldown',quota:'unknown',retryAfterSeconds:null});
 process.env.GEMINI_API_KEY='fixture';let hits=0;global.fetch=async()=>{hits++;return fixture('RequestsPerMinute','20',95);};
 const ctx={aqi:100,lang:'en',profile:'general',hist:[]};
 const one=await gemini.generate('Can I walk?',ctx);assert.equal(one.reason,'provider_rate_limit');assert.equal(one.diagnostic.stage,'upstream_429');assert.equal(one.diagnostic.retryAfterSeconds,95);
 const two=await gemini.generate('Can I run outside?',ctx);assert.equal(two.diagnostic.stage,'local_cooldown');assert.ok(two.diagnostic.retryAfterSeconds>30);assert.equal(hits,1);
 console.log('Quota diagnostics, provider retry delay and local cooldown verified with fixtures');
})().catch(e=>{console.error(e);process.exitCode=1;});
