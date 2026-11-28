'use strict';
// Compare independently observed station PM2.5 with the model near the same
// public station and hour. Unknown station averaging intervals prevent a
// calibrated forecast accuracy claim. Missing samples are not zero error.
const fs=require('node:fs'),{cities}=require('./forecast-quality'),{km}=require('../backend/lib/openaq');
const ORIGIN='https://svasa-sage.vercel.app',MODEL='https://air-quality-api.open-meteo.com/v1/air-quality';
const number=(x,max)=>Number.isFinite(x)&&x>=0&&x<=max;
const coords=(lat,lon)=>Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180;
const unit=x=>typeof x==='string'&&['µg/m³','ug/m3','µg/m3','ug/m³'].includes(x.replace(/μ/g,'µ').replace(/\s/g,'').toLowerCase());
function parseStation(s,city,now){
 if(!s||!Number.isSafeInteger(s.id)||s.id<1||!coords(s.latitude,s.longitude)||!number(s.pm25,2000)||km(city.lat,city.lon,s.latitude,s.longitude)>25.1)return null;
 const time=typeof s.time==='string'&&/(?:Z|[+-]\d\d:\d\d)$/i.test(s.time)?Date.parse(s.time):NaN;
 if(!Number.isFinite(time)||time>now||now-time>3*3600000)return null;
 return {id:s.id,lat:s.latitude,lon:s.longitude,time,pm25:s.pm25};
}
function pair(station,model,now){
 if(!station||!model||model.utc_offset_seconds!==0||!coords(model.latitude,model.longitude)||km(station.lat,station.lon,model.latitude,model.longitude)>150||!unit(model.hourly_units?.pm2_5)||!Array.isArray(model.hourly?.time)||!Array.isArray(model.hourly.pm2_5)||model.hourly.time.length>240)return null;
 let best=null,seen=new Set();
 for(let i=0;i<model.hourly.time.length;i++){
  const stamp=model.hourly.time[i];if(typeof stamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(stamp)||seen.has(stamp))return null;seen.add(stamp);
  const t=Date.parse(stamp+'Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,16)!==stamp)return null;
  const delta=Math.abs(t-station.time),pm=model.hourly.pm2_5[i];
  if(t>now||delta>30*60000||!number(pm,10000))continue;
  if(!best||delta<best.delta||(delta===best.delta&&t<best.t))best={delta,t,pm};
 }
 if(!best)return null;
 return {stationId:station.id,stationTime:new Date(station.time).toISOString(),modelTime:new Date(best.t).toISOString(),offsetMinutes:best.delta/60000,stationPm25:station.pm25,modelPm25:best.pm,difference:Math.round((best.pm-station.pm25)*100)/100,gridDistanceKm:Math.round(km(station.lat,station.lon,model.latitude,model.longitude)*10)/10};
}
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
async function observe({read=json,now=Date.now()}={}){
 const results=[];
 for(const city of cities){
  let s;try{s=parseStation((await read(ORIGIN+'/api/stations?lat='+city.lat+'&lon='+city.lon)).station,city,now);}catch(_){results.push({city:city.id,status:'station-unavailable'});continue;}
  if(!s){results.push({city:city.id,status:'no-valid-fresh-station'});continue;}
  const url=new URL(MODEL);url.search=new URLSearchParams({latitude:String(s.lat),longitude:String(s.lon),timezone:'GMT',hourly:'pm2_5',past_days:'1',forecast_days:'1'}).toString();
  let p;try{p=pair(s,await read(url.toString()),now);}catch(_){results.push({city:city.id,status:'model-unavailable'});continue;}
  results.push(p?{city:city.id,status:'matched',...p}:{city:city.id,status:'no-comparable-model-hour'});
 }
 const pairs=results.filter(x=>x.status==='matched'),mean=fn=>pairs.length?Math.round(pairs.reduce((n,x)=>n+fn(x.difference),0)/pairs.length*100)/100:null;
 return {createdAt:new Date(now).toISOString(),method:'OpenAQ station observation versus nearest available Open-Meteo/CAMS hourly model estimate at station coordinates, within 30 minutes; unknown station averaging period; not calibrated forecast accuracy or personal exposure',expected:cities.length,matched:pairs.length,meanAbsoluteDifference:mean(Math.abs),meanSignedDifference:mean(x=>x),results};
}
async function main(){const r=await observe();fs.mkdirSync('station-observation-artifacts',{recursive:true});fs.writeFileSync('station-observation-artifacts/results.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));if(r.matched===0)throw Error('No comparable station/model pairs; evidence unavailable');}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseStation,pair,observe};
