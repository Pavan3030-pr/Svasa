'use strict';
const assert=require('node:assert/strict'),{requestWithPacing}=require('./live-ai-pacing');
const rate={status:200,data:{source:'rules',reason:'provider_rate_limit'}},live={status:200,data:{source:'gemini'}};
async function run(responses,strict){
 const waits=[],retries=[];let n=0;const result=await requestWithPacing(async()=>responses[n++],{q:'test'},{strict,sleep:async ms=>waits.push(ms),onRetry:i=>retries.push(i)});
 return {result,waits,retries,n};
}
(async()=>{
 let x=await run([rate,live],true);assert.deepEqual(x.waits,[70000,75000]);assert.equal(x.result.data.source,'gemini');assert.equal(x.result.attempts.length,2);assert.equal(x.retries.length,1);
 x=await run([rate,rate,rate],true);assert.deepEqual(x.waits,[70000,75000,130000]);assert.equal(x.result.data.reason,'provider_rate_limit');assert.equal(x.n,3);
 const daily={status:200,data:{source:'rules',reason:'provider_rate_limit',providerDiagnostic:{quota:'daily',retryAfterSeconds:60}}};x=await run([daily],true);assert.equal(x.n,1);
 const long={status:200,data:{source:'rules',reason:'provider_rate_limit',providerDiagnostic:{quota:'minute',retryAfterSeconds:300}}};x=await run([long],true);assert.equal(x.n,1);
 const delayed={status:200,data:{source:'rules',reason:'provider_rate_limit',providerDiagnostic:{quota:'minute',retryAfterSeconds:90}}};x=await run([delayed,live],true);assert.deepEqual(x.waits,[70000,95000]);assert.equal(x.result.data.source,'gemini');
 x=await run([rate],false);assert.deepEqual(x.waits,[15000]);assert.equal(x.n,1);
 for(const reason of ['invalid_model_response','provider_budget_exhausted','provider_rejected','provider_unconfigured','provider_network']){
  x=await run([{status:200,data:{source:'rules',reason}}],true);assert.equal(x.n,1);assert.equal(x.result.data.reason,reason);
 }
 x=await run([{status:429,data:{error:'Too many requests'}}],true);assert.equal(x.n,1);
 x=await run([live],true);assert.equal(x.n,1);assert.equal(x.result.data.source,'gemini');
 console.log('Strict live AI pacing: bounded cooldown retries and unchanged smoke behavior passed');
})().catch(e=>{console.error(e);process.exitCode=1});
