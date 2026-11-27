'use strict';
const S=require('../../frontend/js/core.js');
const cache=new Map(),pending=new Map();
async function fetchReading(p,key){
 if(pending.has(key))return pending.get(key);
 const promise=(async()=>{const url=new URL(process.env.AIR_CONTEXT_BASE||'https://air-quality-api.open-meteo.com/v1/air-quality');url.search=new URLSearchParams({latitude:String(p.lat),longitude:String(p.lon),timezone:'GMT',forecast_days:'2',current:'us_aqi,pm2_5,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide',hourly:'us_aqi,pm2_5'}).toString();const r=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('Air provider unavailable');return r.json();})();
 pending.set(key,promise);try{return await promise;}finally{if(pending.get(key)===promise)pending.delete(key);}
}
function coordinates(p){
  if(!p||typeof p.lat!=='number'||typeof p.lon!=='number'||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)return null;
  return {lat:Math.round(p.lat*10000)/10000,lon:Math.round(p.lon*10000)/10000};
}
async function verifiedContext(place,profile,lang,hist){
  const p=coordinates(place);if(!p)throw new Error('Invalid coordinates');
  const key=p.lat+','+p.lon,hit=cache.get(key);
  let d=hit&&Date.now()-hit.at<180000?hit.d:null;
  if(!d)d=await fetchReading(p,key);
  const c=d&&d.current,t=c&&typeof c.time==='string'?Date.parse(c.time+'Z'):NaN;
  if(!c||!S.band(c.us_aqi)||c.us_aqi>1000||!Number.isFinite(t)||Date.now()-t>3*3600000||t-Date.now()>3600000)throw new Error('Fresh air data unavailable');
  if(cache.size>=250)cache.clear();
  if(!hit||d!==hit.d)cache.set(key,{at:Date.now(),d});
  const h=S.hourlyFrom(d,c.time),w=S.bestWindow(h,2);
  return {...S.validateCtx({aqi:c.us_aqi,city:p.lat.toFixed(4)+', '+p.lon.toFixed(4),profile,lang,hist,dominant:S.dominant(c),trend:S.trend(h),window:w}),observedAt:c.time+'Z',source:'Open-Meteo / CAMS model',timezone:'UTC',pm25:Number.isFinite(c.pm2_5)&&c.pm2_5>=0?c.pm2_5:null};
}
module.exports={coordinates,verifiedContext};
