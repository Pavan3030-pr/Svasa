'use strict';
const {retryAfterSeconds}=require('./guard');
// Only bounded, enumerated metadata may leave this module. Provider error
// messages and arbitrary identifiers can contain sensitive account details.
async function classify429(res){
 const header=res.headers?.get?.('retry-after'),details=[];
 try{const body=await res.json();if(Array.isArray(body?.error?.details))details.push(...body.error.details.slice(0,16));}catch(_){}
 let quota='unknown',delay=0;
 for(const d of details){
  if(d?.['@type']==='type.googleapis.com/google.rpc.RetryInfo'&&typeof d.retryDelay==='string'&&/^\d+(?:\.\d{1,9})?s$/.test(d.retryDelay))delay=Math.max(delay,Math.ceil(Number(d.retryDelay.slice(0,-1))));
  if(d?.['@type']!=='type.googleapis.com/google.rpc.QuotaFailure'||!Array.isArray(d.violations))continue;
  for(const v of d.violations.slice(0,16)){
   const id=typeof v?.quotaId==='string'?v.quotaId:'',metric=typeof v?.quotaMetric==='string'?v.quotaMetric:'';
   if(v?.quotaValue===0||v?.quotaValue==='0')quota='zero';
   else if(quota!=='zero'&&/perday|per_day|daily/i.test(id+' '+metric))quota='daily';
   else if(quota==='unknown'&&/perminute|per_minute/i.test(id+' '+metric))quota='minute';
  }
 }
 const seconds=Math.max(retryAfterSeconds(header),Number.isFinite(delay)?Math.min(3600,delay):0);
 return {stage:'upstream_429',quota,retryAfterSeconds:seconds};
}
function safeDiagnostic(value){
 if(!value||!['upstream_429','local_cooldown','shared_cooldown'].includes(value.stage))return null;
 return {stage:value.stage,quota:['unknown','zero','daily','minute'].includes(value.quota)?value.quota:'unknown',retryAfterSeconds:Number.isInteger(value.retryAfterSeconds)&&value.retryAfterSeconds>=1&&value.retryAfterSeconds<=3600?value.retryAfterSeconds:null};
}
module.exports={classify429,safeDiagnostic};
