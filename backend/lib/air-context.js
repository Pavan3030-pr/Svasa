'use strict';
const S=require('../../frontend/js/core.js');
const cache=new Map(),pool=require('./upstream-pool').createPool(24);
async function fetchReading(p,key){
 return pool.run(key,async()=>{const url=new URL(process.env.AIR_CONTEXT_BASE||'https://air-quality-api.open-meteo.com/v1/air-quality');url.search=new URLSearchParams({latitude:String(p.lat),longitude:String(p.lon),timezone:'GMT',forecast_days:'2',current:'us_aqi,pm2_5,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide',hourly:'us_aqi,pm2_5'}).toString();const r=await fetch(url,{signal:AbortSignal.timeout(5000),redirect:'error'});if(!r.ok)throw new Error('Air provider unavailable');return r.json();});
}
function coordinates(p){
  if(!p||typeof p.lat!=='number'||typeof p.lon!=='number'||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)return null;
  return {lat:Math.round(p.lat*10000)/10000,lon:Math.round(p.lon*10000)/10000};
}
const pmUnit=u=>typeof u==='string'&&['µg/m³','µg/m3','ug/m3','ug/m³'].includes(u.replace(/μ/g,'µ').replace(/\s/g,'').toLowerCase());
const aqiValue=v=>Number.isFinite(v)&&v>=0&&v<=1000;
const pmValue=v=>Number.isFinite(v)&&v>=0&&v<=10000;
function timestamp(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s))return NaN;const t=Date.parse(s+'Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,16)===s?t:NaN;}
// Reject contradictory provider metadata. Legacy payloads without optional
// metadata still use the explicitly requested GMT and concentration units.
function validateReading(d,p,now=Date.now()){
 const c=d?.current,t=timestamp(c?.time);
 if(!c||!aqiValue(c.us_aqi)||!Number.isFinite(t)||now-t>3*3600000||t-now>3600000)throw Error('Fresh air data unavailable');
 if(Object.hasOwn(d,'utc_offset_seconds')&&d.utc_offset_seconds!==0)throw Error('Unexpected air data timezone');
 if(Object.hasOwn(d,'latitude')||Object.hasOwn(d,'longitude')){
  const lat=d.latitude,lon=d.longitude;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||Math.abs(lat-p.lat)>1.5||Math.abs(((lon-p.lon+540)%360)-180)>1.5)throw Error('Unexpected air data location');
 }
 const pm25=pmValue(c.pm2_5)&&(!d.current_units||!Object.hasOwn(d.current_units,'pm2_5')||pmUnit(d.current_units.pm2_5))?c.pm2_5:null;
 const h=d.hourly,rows=[];let prev=-Infinity;
 if(Array.isArray(h?.time)&&Array.isArray(h.us_aqi)&&h.time.length<=240){
  for(let i=0;i<h.time.length;i++){const ts=timestamp(h.time[i]);if(!Number.isFinite(ts)||ts<=prev){rows.length=0;break;}prev=ts;if(ts<t||ts>t+24*3600000)continue;rows.push({time:h.time[i],aqi:aqiValue(h.us_aqi[i])?h.us_aqi[i]:null,pm2_5:pmValue(h.pm2_5?.[i])&&(!d.hourly_units||!Object.hasOwn(d.hourly_units,'pm2_5')||pmUnit(d.hourly_units.pm2_5))?h.pm2_5[i]:null});if(rows.length===24)break;}
 }
 return {c,pm25,rows};
}
async function verifiedContext(place,profile,lang,hist){
  const p=coordinates(place);if(!p)throw new Error('Invalid coordinates');
  const key=p.lat+','+p.lon,hit=cache.get(key);
  let d=hit&&Date.now()-hit.at<180000?hit.d:null;
  if(!d)d=await fetchReading(p,key);
  const {c,pm25,rows:h}=validateReading(d,p);
  if(!hit||d!==hit.d){if(cache.size>=250&&!cache.has(key))cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),d});}
  const w=S.bestWindow(h,2);
  return {...S.validateCtx({aqi:c.us_aqi,city:p.lat.toFixed(4)+', '+p.lon.toFixed(4),profile,lang,hist,dominant:S.dominant(c),trend:S.trend(h),window:w}),observedAt:c.time+'Z',source:'Open-Meteo / CAMS model',timezone:'UTC',pm25};
}
module.exports={coordinates,verifiedContext,validateReading};
