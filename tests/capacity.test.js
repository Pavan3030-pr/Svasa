'use strict';
const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),fs=require('node:fs'),air=require('../backend/lib/air-context'),gemini=require('../backend/lib/gemini'),guard=require('../backend/lib/guard');
(async()=>{
process.env.GEMINI_API_KEY='fixture';let airCalls=0,aiCalls=0;const now=new Date().toISOString().slice(0,16);
global.fetch=async url=>{await new Promise(r=>setTimeout(r,10));if(String(url).includes('air-quality-api')){airCalls++;return {ok:true,json:async()=>({current:{time:now,us_aqi:100,pm2_5:25},hourly:{time:[],us_aqi:[]}})};}aiCalls++;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({kind:'air',recommendation:'Consider moderate activity.',reason:'Model estimate.',limitation:'Conditions can change.'})}]}}]})};};
const t=performance.now(),latencies=[];
await Promise.all(Array.from({length:100},async()=>{const start=performance.now();const ctx=await air.verifiedContext({lat:17.385,lon:78.4867},'general','en',[]);const answer=await gemini.generate('Do I need a mask?',ctx);assert.equal(answer.status,200);latencies.push(performance.now()-start);}));
assert.equal(airCalls,1);assert.equal(aiCalls,1);
const elapsed=performance.now()-t;latencies.sort((a,b)=>a-b);
const ctx=await air.verifiedContext({lat:17.385,lon:78.4867},'general','en',[]);
await gemini.generate('Do I need a mask?',ctx);assert.equal(aiCalls,1);
let limitedCalls=0;global.fetch=async()=>{limitedCalls++;return {ok:false,status:429};};
assert.equal((await gemini.generate('Can I run outside?',ctx)).quotaLimited,true);
assert.equal((await gemini.generate('Best time to go out?',ctx)).quotaLimited,true);assert.equal(limitedCalls,1);
const outcomes=Array.from({length:100},()=>guard.limited('fixture-capacity',20));assert.equal(outcomes.filter(x=>!x).length,20);
const report={scope:'local process, mocked provider transport, identical first-turn question; not production throughput',concurrent:100,airProviderCalls:airCalls,geminiCalls:aiCalls,elapsedMs:Math.round(elapsed),p95Ms:Math.round(latencies[Math.ceil(latencies.length*.95)-1]),quotaCircuitCalls:limitedCalls,rateLimitAccepted:20,rateLimitRejected:80};fs.mkdirSync('test-artifacts',{recursive:true});fs.writeFileSync('test-artifacts/capacity.json',JSON.stringify(report,null,2));console.log('Capacity evidence '+JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
