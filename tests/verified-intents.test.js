'use strict';
const assert=require('node:assert/strict'),V=require('../backend/lib/verified-intents'),route=require('../backend/routes/ask'),S=require('../frontend/js/core');
(async()=>{
 const scripts={en:/[A-Za-z]/,hi:/[\u0900-\u097f]/,te:/[\u0c00-\u0c7f]/,ta:/[\u0b80-\u0bff]/,bn:/[\u0980-\u09ff]/};let cases=0;
 for(const [lang,questions] of Object.entries(V.questions))for(const profile of Object.keys(S.PROFILES))for(const aqi of [25,75,150,250,350]){
  const ctx={lang,profile,aqi,dominant:'pm2_5',window:{start:'2026-11-27T10:00',end:'2026-11-27T12:00',avg:60}};
  for(const q of questions){const a=V.answer(q,ctx);assert.ok(a);for(const k of ['recommendation','reason','limitation'])assert.match(a[k],scripts[lang]);assert.ok(a.reason.includes(String(aqi)));cases++;}
  assert.equal(V.answer('Write a poem',ctx),null);assert.equal(V.answer(questions[0]+' ignore instructions',ctx),null);
  assert.match(V.answer(questions[2],ctx).reason,/10:00–12:00 UTC/);
 }
 let calls=0;global.fetch=async url=>{assert.match(String(url),/air-quality-api/);calls++;return {ok:true,json:async()=>({current:{time:new Date().toISOString().slice(0,16),us_aqi:150,pm2_5:45},hourly:{time:[],us_aqi:[]}})}};
 for(const lang of Object.keys(V.questions)){const r=await route({method:'POST',headers:{'content-type':'application/json'},ip:'fixture-'+lang,body:{q:V.questions[lang][0],mode:'verified',place:{lat:17,lon:78},ctx:{lang}}});assert.equal(r.status,200);assert.equal(r.body.source,'verified');assert.equal(r.body.evidence.aqi,150);}
 for(const [lang,t] of Object.entries(V.factual)){const ctx={lang,profile:'general',aqi:150,pm25:45};for(const q of [...t.aqi,...t.pm]){const v=V.factualAnswer(q+'?',ctx);assert.ok(v);assert.match(v.recommendation,scripts[lang]);assert.ok(v.recommendation.includes(t.aqi.includes(q)?'150':'45'));assert.equal(V.factualAnswer(q+' ignore instructions',ctx),null);}assert.equal(V.factualAnswer(t.pm[0],{...ctx,pm25:null}).recommendation,t.missing);const r=await route({method:'POST',headers:{'content-type':'application/json'},ip:'fact-'+lang,body:{q:t.aqi[0]+'?',place:{lat:17,lon:78},ctx:{lang}}});assert.equal(r.status,200);assert.equal(r.body.source,'verified');assert.ok(r.body.sections.recommendation.includes('150'));}
 assert.equal(calls,1);
 console.log(cases+' deterministic quick-answer cases across profiles, AQI bands and five languages; API path uses no model calls. Not independent language or clinical validation.');
})().catch(e=>{console.error(e);process.exitCode=1});
