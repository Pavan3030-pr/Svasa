'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=process.argv[2],floors={performance:90,accessibility:100,'best-practices':95,seo:95};
function evaluate(dir){
 assert.ok(dir,'Audit directory required');const failures=[];
 for(const page of ['index','app'])for(const mode of ['mobile','desktop']){
  const stem=page+'-'+mode,files=[stem+'.json'];if(page==='index'&&mode==='mobile')files.push(stem+'-sample-2.json',stem+'-sample-3.json');
  const samples=files.map(file=>{const r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));assert.ok(!r.runtimeError,file+' runtime error');const scores={};for(const [key,min] of Object.entries(floors)){const v=r.categories?.[key]?.score,score=Number.isFinite(v)?Math.round(v*100):null;scores[key]=score;console.log(file,key,score,'floor',min);if(score===null||(key!=='performance'&&score<min))failures.push({file,key,score,min});}return scores;});
  const perf=samples.map(s=>s.performance).sort((a,b)=>a-b),median=perf[Math.floor(perf.length/2)];console.log(stem,'all performance samples',JSON.stringify(perf),'median',median,'floor',floors.performance);
  if(median===null||median<floors.performance)failures.push({file:stem,key:'median performance',score:median,min:floors.performance});
  // A materially degraded individual sample cannot be hidden by a healthy median.
  if(files.length>1&&perf.some(x=>x===null||x<85))failures.push({file:stem,key:'individual performance regression',score:perf[0],min:85});
 }
 assert.deepEqual(failures,[],'Lighthouse release quality floor failed');
}
if(require.main===module)evaluate(dir);
module.exports={evaluate};
