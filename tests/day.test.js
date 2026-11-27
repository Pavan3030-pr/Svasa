const S=require('../frontend/js/core'),assert=require('node:assert/strict');
const hrs=[90,70,30,20,10,80].map((pm,i)=>({time:'2026-11-27T0'+i+':00',aqi:pm,pm2_5:pm}));
const p=S.optimizeDay(hrs,[{duration:1,preferred:0,earliest:0,latest:4},{duration:1,preferred:1,earliest:1,latest:6}],'general');
assert.equal(p.exposure,30);assert.equal(p.baseline,160);assert.equal(p.slots[0].index,3);assert.equal(p.slots[1].index,4);assert.equal(p.changePct,81);
assert.equal(S.optimizeDay(hrs,[{duration:2,preferred:0,earliest:0,latest:2},{duration:2,preferred:0,earliest:0,latest:2}],'general'),null);
assert.equal(S.optimizeDay([{...hrs[0],pm2_5:null}],[{duration:1,preferred:0,earliest:0,latest:1}],'general'),null);
assert.equal(S.optimizeDay(hrs,[{duration:0,preferred:0,earliest:0,latest:2}],'general'),null);
console.log('Personal day planner tests passed');
