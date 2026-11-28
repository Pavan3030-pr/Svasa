'use strict';
const assert=require('node:assert/strict'),{createPool}=require('../backend/lib/upstream-pool'),air=require('../backend/lib/air-context'),oq=require('../backend/lib/openaq');
(async()=>{
 const pool=createPool(4);let release;const gate=new Promise(r=>release=r),work=()=>gate;
 const same=Array.from({length:100},()=>pool.run('same',work));const distinct=Array.from({length:3},(_,i)=>pool.run('other'+i,work));
 const denied=await Promise.allSettled(Array.from({length:100},(_,i)=>pool.run('overflow'+i,work)));assert.equal(denied.filter(x=>x.status==='rejected'&&x.reason.code==='UPSTREAM_BUSY').length,100);
 assert.equal(pool.stats().active,4);release(1);await Promise.all([...same,...distinct]);assert.deepEqual(pool.stats(),{limit:4,active:0,peak:4,joined:99,rejected:100,completed:4,failed:0});
 await assert.rejects(pool.run('retry',()=>{throw Error('fixture');}));assert.equal(await pool.run('retry',()=>2),2);
 const now=new Date().toISOString().slice(0,16);let airHits=0,unblock;const airGate=new Promise(r=>unblock=r);
 global.fetch=async()=>{airHits++;await airGate;return {ok:true,json:async()=>({current:{time:now,us_aqi:100,pm2_5:25},hourly:{time:[],us_aqi:[]}})}};
 const batch=Array.from({length:40},(_,i)=>air.verifiedContext({lat:i/10,lon:10},'general','en',[]));
 const settled=Promise.allSettled(batch);await new Promise(r=>setImmediate(r));assert.equal(airHits,24);unblock();const results=await settled;assert.equal(results.filter(x=>x.status==='fulfilled').length,24);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='UPSTREAM_BUSY').length,16);
 let hits=0;const station=(id,lat)=>({id,name:'Fixture '+id,coordinates:{latitude:lat,longitude:78},sensors:[{id:id*10,parameter:{name:'pm25',units:'µg/m³'}}]});
 global.fetch=async url=>{hits++;await new Promise(r=>setTimeout(r,2));const u=String(url);if(u.includes('/locations?'))return {ok:true,json:async()=>({results:[station(1,17.01),station(2,17.03)]})};return {ok:true,json:async()=>({results:[{sensorsId:u.includes('/1/')?10:20,value:20,datetime:{utc:new Date(Date.now()-(u.includes('/1/')?5:1)*3600000).toISOString()}}]})};};
 const stations=await Promise.all(Array.from({length:60},()=>oq.nearest(17,78)));assert.ok(stations.every(x=>x.id===2));assert.equal(hits,3);
 let limited=0;global.fetch=async()=>{limited++;return {ok:false,status:429,headers:{get:()=> '120'}};};await assert.rejects(oq.nearest(18,78),e=>e.code==='UPSTREAM_COOLDOWN');await assert.rejects(oq.nearest(19,78),e=>e.code==='UPSTREAM_COOLDOWN');assert.equal(limited,1);
 console.log('Upstream admission: 100 duplicate callers coalesced; 100 excess unique calls rejected; 24 air requests bounded; 60 station calls coalesced; fresher station preferred; provider cooldown respected. Mock transport only.');
})().catch(e=>{console.error(e);process.exitCode=1});
