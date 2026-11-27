'use strict';
const assert=require('node:assert/strict'),S=require('../frontend/js/core');
assert.equal(S.band(null),null);assert.equal(S.band(''),null);assert.equal(S.band(NaN),null);
assert.match(S.advice(null,'general').go,/unavailable/i);
const h=[{time:'2026-11-27T09:00',aqi:90},{time:'2026-11-27T10:00',aqi:180},{time:'2026-11-27T12:00',aqi:1}];
assert.equal(S.bestWindow(h,2).peak,180);assert.equal(S.bestWindow(h,0),null);assert.equal(S.planTrip(h,2,11,15),null);
assert.equal(S.planTrip(h,2,0,24).win.peak,180);
console.log('Reliability regression tests passed');
