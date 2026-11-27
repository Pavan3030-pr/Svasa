'use strict';
// Separate the strict provider evaluation from ordinary fallback smoke checks.
// Do not retry invalid output, exhausted daily budgets, auth/config errors or HTTP failures.
async function requestWithPacing(post,body,{strict=false,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onRetry=()=>{}}={}){
 const delays=strict?[70000,75000,130000]:[15000],attempts=[];
 let response;
 for(let i=0;i<delays.length;i++){
  if(i)onRetry({attempt:i+1,waitMs:delays[i],reason:response.data.reason});
  await sleep(delays[i]);response=await post(body);
  attempts.push({status:response.status,source:response.data?.source||null,reason:response.data?.reason||null});
  if(!(strict&&response.status===200&&response.data?.source==='rules'&&response.data.reason==='provider_rate_limit'))break;
 }
 return {...response,attempts};
}
module.exports={requestWithPacing};
