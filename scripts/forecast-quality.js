'use strict';
// Earlier forecast vs later model estimate, not independent ground truth.
const fs=require('node:fs'),path=require('node:path');
const cities=[{id:'delhi',lat:28.6139,lon:77.209},{id:'hyderabad',lat:17.385,lon:78.4867},{id:'bengaluru',lat:12.9716,lon:77.5946}];
const leads=[6,12,24],valid=x=>Number.isFinite(x)&&x>=0;
function epoch(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)?Date.parse(s+'Z'):NaN;}
function hour(ms){return new Date(ms).toISOString().slice(0,16);}
function round(x){return Math.round(x*100)/100;}
function extract(raw,now){
 if(!Array.isArray(raw))throw Error('Expected multi-city response');
 return cities.map(city=>{
  const d=raw.find(x=>Number.isFinite(x?.latitude)&&Number.isFinite(x?.longitude)&&Math.abs(x.latitude-city.lat)<=1.5&&Math.abs(x.longitude-city.lon)<=1.5);
  const empty={id:city.id,rows:[],anchor:null};
  if(!d||d.utc_offset_seconds!==0||!Array.isArray(d.hourly?.time)||!Array.isArray(d.hourly.pm2_5)||!Array.isArray(d.hourly.us_aqi))return empty;
  const anchor=epoch(d.current?.time);
  if(!Number.isFinite(anchor)||anchor>now+3600000||now-anchor>3*3600000)return empty;
  const rows=d.hourly.time.map((time,i)=>({time,pm25:d.hourly.pm2_5[i],aqi:d.hourly.us_aqi[i]})).filter(x=>Number.isFinite(epoch(x.time))&&valid(x.pm25)&&valid(x.aqi)&&x.aqi<=1000);
  return {id:city.id,rows,anchor:hour(Math.floor(anchor/3600000)*3600000)};
 });
}
function snapshot(data,now){return {version:1,createdAt:new Date(now).toISOString(),source:'Open-Meteo / CAMS model',forecasts:data.flatMap(d=>d.anchor?leads.flatMap(lead=>{const target=hour(epoch(d.anchor)+lead*3600000),x=d.rows.find(x=>x.time===target);return x?[{city:d.id,anchor:d.anchor,target,lead,pm25:x.pm25,aqi:x.aqi}]:[];}):[])};}
function compare(previous,data,now){
 const records=[],skipped={notMature:0,missing:0,invalid:0};const seen=new Set();
 const forecasts=Array.isArray(previous?.forecasts)&&previous.forecasts.length<=9&&previous.version===1?previous.forecasts:[];
 for(const x of forecasts){
  if(!x||!cities.some(c=>c.id===x.city)||!leads.includes(x.lead)||epoch(x.target)-epoch(x.anchor)!==x.lead*3600000||!valid(x.pm25)||!valid(x.aqi)||x.aqi>1000||seen.has(x.city+':'+x.lead)){skipped.invalid++;continue;}seen.add(x.city+':'+x.lead);
  const city=data.find(d=>d.id===x.city);if(epoch(x.target)>now){skipped.notMature++;continue;}
  if(!city?.anchor){skipped.missing++;continue;}if(epoch(x.target)>epoch(city.anchor)){skipped.notMature++;continue;}
  const later=city.rows.find(r=>r.time===x.target);if(!later){skipped.missing++;continue;}
  records.push({city:x.city,lead:x.lead,target:x.target,pm25Forecast:x.pm25,pm25LaterModel:later.pm25,aqiForecast:x.aqi,aqiLaterModel:later.aqi,pm25Error:round(x.pm25-later.pm25),aqiError:round(x.aqi-later.aqi)});
 }
 const groups=leads.map(lead=>{const r=records.filter(x=>x.lead===lead);const mean=key=>r.length?round(r.reduce((n,x)=>n+Math.abs(x[key]),0)/r.length):null;return {lead,count:r.length,pm25MAE:mean('pm25Error'),aqiMAE:mean('aqiError')};});
 return {method:'Earlier forecast vs later model estimate for matching UTC hour and fixed city; not independent observations or personal exposure',previousCreatedAt:previous?.createdAt||null,expected:forecasts.length,matched:records.length,skipped,groups,records};
}
async function main(){
 const now=Date.now(),url=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');url.search=new URLSearchParams({latitude:cities.map(x=>x.lat).join(','),longitude:cities.map(x=>x.lon).join(','),current:'us_aqi',hourly:'pm2_5,us_aqi',past_days:'2',forecast_days:'3',timezone:'GMT'}).toString();
 const res=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!res.ok)throw Error('Forecast provider unavailable: '+res.status);
 const data=extract(await res.json(),now),next=snapshot(data,now);if(!next.forecasts.length)throw Error('No valid forecast samples available');
 const previousFile=process.argv[2],previous=previousFile&&fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):null;
 const report=compare(previous,data,now),dir='forecast-quality-artifacts';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'snapshot.json'),JSON.stringify(next,null,2));fs.writeFileSync(path.join(dir,'evaluation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({snapshotSamples:next.forecasts.length,matched:report.matched,groups:report.groups,skipped:report.skipped,scope:report.method},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={cities,leads,extract,snapshot,compare};
