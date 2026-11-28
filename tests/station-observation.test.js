'use strict';
const assert=require('node:assert/strict'),{parseStation,pair,observe}=require('../scripts/station-observation'),{cities}=require('../scripts/forecast-quality');
(async()=>{
 const now=Date.parse('2026-11-28T06:30Z'),city=cities[0],raw={id:42,latitude:city.lat,longitude:city.lon,time:'2026-11-28T05:40:00Z',pm25:60};
 const s=parseStation(raw,city,now);assert.ok(s);
 const model={latitude:city.lat,longitude:city.lon,utc_offset_seconds:0,hourly_units:{pm2_5:'µg/m³'},hourly:{time:['2026-11-28T05:00','2026-11-28T06:00','2026-11-28T07:00'],pm2_5:[10,45,99]}};
 const r=pair(s,model,now);assert.equal(r.offsetMinutes,20);assert.equal(r.difference,-15);assert.equal(r.modelPm25,45);
 assert.equal(parseStation({...raw,time:'2026-11-28T02:00:00Z'},city,now),null);assert.equal(parseStation({...raw,time:'2026-11-28T06:40:00Z'},city,now),null);assert.equal(parseStation({...raw,latitude:0},city,now),null);
 assert.equal(pair(s,{...model,hourly_units:{pm2_5:'mg/m³'}},now),null);assert.equal(pair(s,{...model,utc_offset_seconds:19800},now),null);
 assert.equal(pair(s,{...model,hourly:{time:['2026-11-28T07:00'],pm2_5:[5]}},now),null);
 assert.equal(pair(s,{...model,hourly:{time:['2026-11-28T06:00','2026-11-28T06:00'],pm2_5:[45,70]}},now),null);
 let calls=0;const report=await observe({now,read:async url=>{calls++;const u=new URL(url);if(u.pathname==='/api/stations')return {station:Number(u.searchParams.get('lat'))===city.lat?raw:null};return model;}});
 assert.equal(calls,4);assert.equal(report.matched,1);assert.equal(report.expected,3);assert.equal(report.meanAbsoluteDifference,15);assert.equal(report.meanSignedDifference,-15);assert.equal(report.results.filter(x=>x.status==='no-valid-fresh-station').length,2);
 const missing=await observe({now,read:async()=>{throw Error('fixture unavailable');}});assert.equal(missing.matched,0);assert.equal(missing.meanAbsoluteDifference,null);
 console.log('Station observation: time, grid, units, missing coverage and signed difference verified with fixtures');
})().catch(e=>{console.error(e);process.exitCode=1;});
