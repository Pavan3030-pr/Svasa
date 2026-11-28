'use strict';
// Offline, anonymous, self-reported results. One file per consenting participant.
const fs=require('node:fs'),assert=require('node:assert/strict');
function summarize(files){
 const counts={yes:0,partly:0,no:0},trust={...counts},ease={1:0,2:0,3:0,4:0,5:0};let sum=0;
 for(const f of files){
  assert.ok(f&&typeof f==='object'&&Array.isArray(f.responses)&&f.responses.length===1,'Expected exactly one voluntary response per participant file');
  const x=f.responses[0];assert.ok(x&&Object.keys(x).sort().join(',')==='ease,task,trust'&&Object.hasOwn(counts,x.task)&&Object.hasOwn(trust,x.trust)&&Number.isInteger(x.ease)&&x.ease>=1&&x.ease<=5,'Invalid anonymous response');
  counts[x.task]++;trust[x.trust]++;ease[x.ease]++;sum+=x.ease;
 }
 return {scope:'Anonymous self-reported usability; participant independence must be established by the study organizer, not this script. Not clinical evidence.',participantFiles:files.length,minimumStudySize:5,minimumMet:files.length>=5,task:counts,trust,ease,meanEase:files.length?Math.round(sum/files.length*100)/100:null};
}
if(require.main===module){try{const paths=process.argv.slice(2);assert.ok(new Set(paths.map(p=>fs.realpathSync(p))).size===paths.length,'Duplicate input file path');const files=paths.map(p=>{assert.ok(fs.statSync(p).size<=10000,'File too large');return JSON.parse(fs.readFileSync(p,'utf8'));});console.log(JSON.stringify(summarize(files),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={summarize};
