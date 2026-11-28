'use strict';
const assert=require('node:assert/strict');
async function waitForStable({expected,read,attempts=36,consecutive=3,sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}){
 assert.match(expected||'',/^[a-f0-9]{40}$/);
 let streak=0;
 for(let i=0;i<attempts;i++){
  let build=null;try{const value=await read();if(value?.ok===true)build=value.build;}catch(_){}
  streak=build===expected?streak+1:0;
  log('Deployment sample '+(i+1)+': '+(build||'unavailable')+' ('+streak+'/'+consecutive+' matching)');
  if(streak===consecutive)return;
  if(i+1<attempts)await sleep(5000);
 }
 throw Error('Exact deployment did not stabilize: '+expected);
}
async function readHealth(){const r=await fetch('https://svasa-sage.vercel.app/api/health',{cache:'no-store',signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok)throw Error('Health unavailable');return r.json();}
if(require.main===module)waitForStable({expected:process.env.GITHUB_SHA,read:readHealth}).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={waitForStable,readHealth};
