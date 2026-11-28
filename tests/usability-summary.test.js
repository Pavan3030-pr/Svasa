'use strict';
const assert=require('node:assert/strict'),{summarize}=require('../scripts/usability-summary');
const entry=(task,trust,ease)=>({responses:[{task,trust,ease}]});
assert.equal(summarize([]).meanEase,null);assert.equal(summarize([]).minimumMet,false);
const r=summarize([entry('yes','yes',5),entry('partly','yes',3),entry('no','no',1)]);assert.deepEqual(r.task,{yes:1,partly:1,no:1});assert.deepEqual(r.trust,{yes:2,partly:0,no:1});assert.equal(r.meanEase,3);assert.equal(r.minimumMet,false);
assert.throws(()=>summarize([{responses:[{task:'yes',trust:'yes',ease:5,name:'private'}]}]));assert.throws(()=>summarize([entry('invalid','yes',5)]));assert.throws(()=>summarize([{responses:[]}]));
console.log('Usability aggregation: empty study, exact counts, private-field rejection, invalid responses passed');
