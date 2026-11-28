'use strict';
// Read-only scheduled observations. No model generation, station quota or push dispatch.
const fs=require('node:fs'),{performance}=require('node:perf_hooks'),assert=require('node:assert/strict');
const origin='https://svasa-sage.vercel.app';
async function observe(fetcher=fetch){
 const results=[];
 for(const path of ['/api/health','/','/app.html']){
  const start=performance.now();let status=null,build=null,configured=null,outcome='unavailable';
  try{const r=await fetcher(origin+path,{signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});status=r.status;
   if(r.ok){if(path==='/api/health'){const d=await r.json();build=typeof d.build==='string'&&/^[a-f0-9]{40}$/.test(d.build)?d.build:null;configured={ai:d.ai===true,stations:d.stations===true,distributedRateLimit:d.distributedRateLimit===true,backgroundPush:d.backgroundPush===true};outcome=d.ok===true&&build&&Object.values(configured).every(Boolean)?'ok':'configuration-or-health-failure';}else{const body=await r.text();outcome=body.includes('Svasa')&&(path==='/'||body.includes('optimizeday'))?'ok':'unexpected-content';}}
  }catch(_){}
  results.push({path,status,build,configured,outcome,durationMs:Math.round(performance.now()-start)});
 }
 return {scope:'Three read-only checks; not provider uptime, SLA or load benchmark',checkedAt:new Date().toISOString(),ok:results.every(x=>x.outcome==='ok'),results};
}
if(require.main===module)observe().then(r=>{fs.mkdirSync('service-observation-artifacts',{recursive:true});fs.writeFileSync('service-observation-artifacts/results.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));assert.ok(r.ok,'Service observation failed');}).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={observe};
