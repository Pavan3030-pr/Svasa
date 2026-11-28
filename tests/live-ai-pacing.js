'use strict';
// Separate the strict provider evaluation from ordinary fallback smoke checks.
// Do not retry invalid output, exhausted daily budgets, auth/config errors or HTTP failures.
async function requestWithPacing(post,body,{strict=false,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onRetry=()=>{}}={}){
 const delays=strict?[70000,75000,130000]:[15000],attempts=[];
 let response;
 for(let i=0;i<delays.length;i++){
  const diagnostic=response?.data?.providerDiagnostic;
  const retry=diagnostic?.retryAfterSeconds;
  const wait=i&&Number.isInteger(retry)&&retry>0?Math.max(delays[i],(retry+5)*1000):delays[i];
  // Never retry ahead of a declared cooldown; keep the CI evaluation bounded.
  if(i&&(['daily','zero'].includes(diagnostic?.quota)||wait>130000))break;
  if(i)onRetry({attempt:i+1,waitMs:wait,reason:response.data.reason});
  await sleep(wait);response=await post(body);
  attempts.push({status:response.status,source:response.data?.source||null,reason:response.data?.reason||null,providerDiagnostic:response.data?.providerDiagnostic||null});
  if(!(strict&&response.status===200&&response.data?.source==='rules'&&response.data.reason==='provider_rate_limit'))break;
 }
 return {...response,attempts};
}
module.exports={requestWithPacing};
