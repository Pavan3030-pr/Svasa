'use strict';
const {performance}=require('node:perf_hooks');
const reasons=new Set(['provider_rate_limit','provider_network','provider_unavailable','provider_rejected','provider_unconfigured','invalid_model_response','provider_budget_unavailable','provider_budget_exhausted']);
const sources=new Set(['gemini','rules','safety','offtopic','verified']);
const routes=new Set(['ask','stations','push','push-dispatch']);
function event(route,result,elapsed){
 if(!routes.has(route))throw Error('Unknown diagnostic route');
 const status=Number.isInteger(result?.status)&&result.status>=100&&result.status<=599?result.status:500;
 const record={event:'svasa_api',route,status,durationMs:Math.max(0,Math.round(elapsed)),outcome:status>=500?'unavailable':status>=400?'rejected':'ok'};
 if(route==='ask'){
  const source=result?.body?.source,reason=result?.body?.reason;
  if(sources.has(source))record.source=source;
  if(reasons.has(reason))record.reason=reason;
  if(status===200&&source==='rules')record.outcome='fallback';
 }else if(route==='stations'&&status===200){const s=result?.body?.station;record.station=s&&Number.isFinite(s.ageHours)?s.ageHours<=3?'fresh':'stale':s?'unknown-age':'not-found';}
 return record;
}
function observe(route,handler,{write=record=>console.log(JSON.stringify(record)),clock=()=>performance.now()}={}){
 return async function(req){const start=clock(),name=route==='push'&&req.query?.dispatch==='1'?'push-dispatch':route;let result;try{result=await handler(req);return result;}finally{
  try{write(event(name,result,clock()-start));}catch(_){}
 }};
}
module.exports={observe,event};
