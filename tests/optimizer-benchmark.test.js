'use strict';
const assert=require('node:assert/strict'),S=require('../frontend/js/core');
let seed=3157;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const cmp=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]-b[i];}return 0;};
function exhaustive(h,a,p,policy){
 let best=null,count=0;
 function walk(k,end,risk,exposure,shift){
  if(k===a.length){count++;const score=policy==='routine'?[risk,shift,exposure]:[risk,exposure,shift];if(!best||cmp(score,best)<0)best=score;return;}
  const x=a[k];for(let i=Math.max(end,x.earliest);i+x.duration<=x.latest;i++){
   const v=h.slice(i,i+x.duration);if(v.length!==x.duration||v.some(z=>!Number.isFinite(z.pm2_5)||!S.band(z.aqi)))continue;
   walk(k+1,i+x.duration,risk+Number(S.effectiveLevel(Math.max(...v.map(z=>z.aqi)),p)>=2),exposure+v.reduce((n,z)=>n+z.pm2_5,0),shift+Math.abs(i-x.preferred));
  }
 }
 walk(0,0,0,0,0);return {best,count};
}
let checked=0,feasible=0,totalCandidates=0,lower=0,comparable=0;
for(let k=0;k<250;k++){
 const h=Array.from({length:24},(_,i)=>({time:'2026-11-27T'+String(i).padStart(2,'0')+':00',aqi:20+rand(200),pm2_5:5+rand(95)}));
 if(k%7===0)h[rand(24)].pm2_5=null;
 const a=Array.from({length:1+rand(4)},(_,i)=>{const preferred=i*5+rand(3),duration=1+rand(3),flex=[0,1,2,4,6][rand(5)];return {preferred,duration,earliest:Math.max(0,preferred-flex),latest:Math.min(24,preferred+duration+flex),flex};});
 const p=['general','child','asthma','athlete'][k%4];
 for(const policy of ['exposure','routine']){
  const ref=exhaustive(h,a,p,policy),got=S.optimizeDay(h,a,p,policy);checked++;totalCandidates+=ref.count;
  assert.equal(!!got,!!ref.best);if(!got)continue;feasible++;
  assert.deepEqual(policy==='routine'?[got.risk,got.shift,got.exposure]:[got.risk,got.exposure,got.shift],ref.best);
  assert.ok(got.slots.every((x,i)=>a[i].flex!==0||x.index===a[i].preferred));
  if(policy==='exposure'&&got.baseline!==null){comparable++;if(got.exposure<got.baseline)lower++;}
 }
}
console.log(JSON.stringify({method:'Synthetic seeded scenarios; exhaustive optimality comparison; not health outcomes',cases:checked,feasible,totalCandidates,comparable,lower}));
