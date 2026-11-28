'use strict';
const assert=require('node:assert/strict'),S=require('../frontend/js/core'),I=require('../frontend/js/intelligence');
const hours=Array.from({length:12},(_,i)=>({time:new Date(Date.UTC(2026,10,27,i)).toISOString().slice(0,16),aqi:[50,50,150,150,50,50,50,150,50,50,50,50][i],pm2_5:[10,10,90,90,10,10,10,90,10,10,10,10][i]}));
const items=[{name:'Commute',preferred:0,duration:1,flex:0,earliest:0,latest:1},{name:'Walk',preferred:4,duration:1,flex:2,earliest:2,latest:7}];
const a=I.analyze(hours,items,S,'general');assert.equal(a.count,5);
const normal=S.optimizeDay(hours,items,'general','exposure'),robust=I.robustPlan(hours,items,S,'general',a);
assert.equal(robust.slots[0].index,0);assert.equal(robust.slots[1].index,5);
assert.ok(I.evaluateSchedule(hours,items,robust.slots.map(x=>x.index),S,'general').worstExposure<I.evaluateSchedule(hours,items,normal.slots.map(x=>x.index),S,'general').worstExposure);
for(const p of ['exposure','routine','robust']){const plan=p==='robust'?robust:S.optimizeDay(hours,items,'general',p),c=I.certificate(hours,items,plan,S,'general',a);assert.ok(I.verifyCertificate(JSON.parse(JSON.stringify(c)),S));assert.equal(I.verifyCertificate({...c,feasibleSchedules:c.feasibleSchedules+1},S),false);assert.equal(I.verifyCertificate({...c,objective:c.objective.map(x=>x+1)},S),false);}
const overlap=[{name:'Commute',preferred:2,duration:2,flex:0,earliest:2,latest:4},{name:'Walk',preferred:2,duration:1,flex:0,earliest:2,latest:3}];
const conflict=I.conflict(hours,overlap,S,'general');assert.ok(conflict.suggestion);assert.equal(conflict.suggestion.fixed,true);assert.equal(conflict.suggestion.flex,2);assert.equal(overlap[1].flex,0);
const missing=hours.map(x=>({...x,pm2_5:null}));assert.equal(I.analyze(missing,items,S,'general').count,0);assert.equal(I.robustPlan(missing,items,S,'general'),null);assert.equal(I.conflict(missing,items,S,'general').suggestion,null);
let seed=19;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n;};
for(let k=0;k<100;k++){const h=hours.map(x=>({...x,aqi:rand(250),pm2_5:rand(90)+1})),p=I.analyze(h,items,S,'asthma'),r=I.robustPlan(h,items,S,'asthma',p);assert.ok(r);const normal=S.optimizeDay(h,items,'asthma','exposure');const cert=I.certificate(h,items,normal,S,'asthma',p);assert.ok(cert,'Nominal independent exhaustive comparison');assert.ok(I.verifyCertificate(I.certificate(h,items,r,S,'asthma',p),S));}
console.log('Robust scenario selection, fixed commitments, conflict suggestions and certificate verification passed');
