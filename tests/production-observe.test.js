'use strict';
const assert=require('node:assert/strict'),{observe}=require('../scripts/production-observe');
(async()=>{const health={ok:true,build:'a'.repeat(40),ai:true,stations:true,distributedRateLimit:true,backgroundPush:true},mock=h=>async u=>({ok:true,status:200,json:async()=>h,text:async()=> 'Svasa optimizeday'});
assert.equal((await observe(mock(health))).ok,true);assert.equal((await observe(mock({...health,ai:false}))).ok,false);assert.equal((await observe(async()=>{throw Error('private')})).ok,false);
assert.ok(!JSON.stringify(await observe(mock({...health,secret:'private'}))).includes('private'));
console.log('Service observation: configured healthy, missing provider, network failure and field allowlist passed');
})().catch(e=>{console.error(e);process.exitCode=1});
