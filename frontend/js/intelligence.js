/* Forecast proxies, not measured personal exposure. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SvasaIntelligence=factory();})(typeof window!=='undefined'?window:globalThis,function intelligence(){
'use strict';
const valid=x=>Number.isFinite(x)&&x>=0;
const iso=t=>typeof t==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)&&Number.isFinite(Date.parse(t+'Z'));
const next=t=>new Date(Date.parse(t+'Z')+3600000).toISOString().slice(0,16);
function slot(hours,index,duration,S,profile){
 if(!Array.isArray(hours)||!Number.isInteger(index)||index<0||!Number.isInteger(duration)||duration<1||duration>4)return null;
 const h=hours.slice(index,index+duration);if(h.length!==duration||!h.every((x,i)=>x&&iso(x.time)&&valid(x.pm2_5)&&valid(x.aqi)&&S.band(x.aqi)&&(!i||next(h[i-1].time)===x.time)))return null;
 const peak=Math.max(...h.map(x=>x.aqi));return {index,start:h[0].time,end:next(h.at(-1).time),exposure:h.reduce((n,x)=>n+x.pm2_5,0),peak,caution:S.effectiveLevel(peak,profile)>=2};
}
function compare(hours,items,plan,S,profile){
 if(!Array.isArray(hours)||!Array.isArray(items)||!Array.isArray(plan?.slots)||items.length!==plan.slots.length)return null;
 const rows=items.map((a,i)=>({name:a.name,fixed:a.flex===0,before:slot(hours,a.preferred,a.duration,S,profile),after:slot(hours,plan.slots[i].index,a.duration,S,profile)}));
 if(rows.some(x=>!x.after))return null;
 const beforeValid=rows.every((x,i)=>x.before&&(!i||rows[i-1].before.end<=x.before.start));
 const baseline=beforeValid?rows.reduce((n,x)=>n+x.before.exposure,0):null,optimized=rows.reduce((n,x)=>n+x.after.exposure,0);
 return {rows,baseline,optimized,delta:baseline===null?null:baseline-optimized,pct:baseline>0?(baseline-optimized)/baseline*100:null};
}
function trust({fresh,model,station,hours}){
 const coverage=Array.isArray(hours)?hours.slice(0,24).filter(x=>x&&iso(x.time)&&valid(x.aqi)&&valid(x.pm2_5)).length:0;
 const base={coverage,expected:24,model:valid(model)?model:null,station:null,difference:null};
 if(!fresh||!valid(model))return {...base,state:'unavailable',label:'Fresh evidence unavailable',detail:'Do not use sample or cached data to optimize activities.'};
 if(!station||!valid(station.pm25))return {...base,state:'model-only',label:'Model only',detail:'No comparable ground reading is available. Forecasts remain model estimates.'};
 if(!valid(station.ageHours)||station.ageHours>3)return {...base,state:'stale-station',label:'Station time stale or unknown',detail:'Ground reading excluded from comparison.'};
 if(!valid(station.distanceKm)||station.distanceKm>25)return {...base,state:'model-only',label:'Station distance not comparable',detail:'Ground reading excluded from comparison.'};
 const absolute=Math.abs(model-station.pm25),relative=absolute/Math.max(model,station.pm25,1),disagreement=absolute>=15&&relative>=0.4;
 return {...base,station:station.pm25,difference:absolute,state:disagreement?'disagreement':'comparison',label:disagreement?'Material source disagreement':'Ground comparison available',detail:(disagreement?'Review local conditions before relying on the model. ':'Readings are available for comparison, not independent validation. ')+'Station and model locations and averaging periods can differ. The flag is a heuristic (≥15 µg/m³ and ≥40% of the larger reading), not a confidence probability.'};
}
function capture(items,plan,hours,cityKey,profile,policy){
 if(!plan||!Array.isArray(items)||!Array.isArray(hours)||!items.every(x=>hours[x.preferred]&&iso(hours[x.preferred].time)))return null;
 return {cityKey,profile,policy,items:items.map((a,i)=>({name:a.name,duration:a.duration,flex:a.flex,preferredTime:hours[a.preferred].time,chosenTime:plan.slots[i].start})),exposure:plan.exposure,risk:plan.risk};
}
// Storage is untrusted. Bound the shape and lifespan before restoring any draft.
function restore(snapshot,S,cityKey,profile,now=Date.now()){
 if(!snapshot||snapshot.version!==1||snapshot.cityKey!==cityKey||snapshot.profile!==profile||!Object.hasOwn(S.PROFILES,profile)||!['exposure','routine','robust'].includes(snapshot.policy)||!Number.isFinite(snapshot.savedAt)||snapshot.savedAt>now+60000||now-snapshot.savedAt>48*3600000||!Array.isArray(snapshot.items)||snapshot.items.length<1||snapshot.items.length>4||!valid(snapshot.exposure)||!Number.isInteger(snapshot.risk)||snapshot.risk<0||snapshot.risk>snapshot.items.length)return null;
 const names=['Commute','Walk','Workout','School','Shopping','Other'];
 if(!snapshot.items.every(a=>a&&names.includes(a.name)&&Number.isInteger(a.duration)&&a.duration>=1&&a.duration<=4&&[0,1,2,4,6].includes(a.flex)&&iso(a.preferredTime)&&iso(a.chosenTime)&&Math.abs(Date.parse(a.preferredTime+'Z')-Date.parse(a.chosenTime+'Z'))<=a.flex*3600000))return null;
 return {cityKey,profile,policy:snapshot.policy,items:snapshot.items.map(a=>({name:a.name,duration:a.duration,flex:a.flex,preferredTime:a.preferredTime,chosenTime:a.chosenTime})),exposure:snapshot.exposure,risk:snapshot.risk};
}
function revise(snapshot,hours,S,cityKey,profile){
 if(!snapshot||snapshot.cityKey!==cityKey||snapshot.profile!==profile)return {state:'different-context'};
 if(!Array.isArray(hours)||!hours.length)return {state:'unavailable'};
 const items=snapshot.items.map(a=>{const preferred=hours.findIndex(h=>h.time===a.preferredTime);return {...a,preferred,earliest:Math.max(0,preferred-a.flex),latest:Math.min(hours.length,preferred+a.duration+a.flex)};});
 if(items.some(a=>a.preferred<0||a.preferred+a.duration>hours.length))return {state:'expired'};
 const proposal=snapshot.policy==='robust'?robustPlan(hours,items,S,profile):S.optimizeDay(hours,items,profile,snapshot.policy);if(!proposal)return {state:'infeasible'};
 const original=items.map(a=>slot(hours,hours.findIndex(h=>h.time===a.chosenTime),a.duration,S,profile)),priorValid=original.every((x,i)=>x&&(!i||original[i-1].end<=x.start)),prior=priorValid?original.reduce((n,x)=>n+x.exposure,0):null,changed=proposal.slots.some((x,i)=>x.start!==items[i].chosenTime);
 return {state:changed?'changed':'unchanged',items,proposal,prior,priorRisk:priorValid?original.filter(x=>x.caution).length:null,changed,delta:prior===null?null:prior-proposal.exposure};
}
function familyWindow(hours,members,S){
 if(!Array.isArray(members)||!members.length||!Array.isArray(hours))return null;
 const people=members.slice(0,6).filter(m=>m&&Object.hasOwn(S.PROFILES,m.profile));if(!people.length)return null;
 let best=null;
 for(let i=0;i<Math.min(hours.length,24);i++){
  const s=slot(hours,i,1,S,'general');if(!s)continue;
  const guidance=people.map(m=>({name:m.name,profile:m.profile,caution:S.effectiveLevel(s.peak,m.profile)>=2,advice:S.advice(s.peak,m.profile).exercise})),count=guidance.filter(x=>x.caution).length;
  if(!best||count<best.count||(count===best.count&&(s.exposure<best.slot.exposure||(s.exposure===best.slot.exposure&&s.peak<best.slot.peak))))best={slot:s,count,guidance};
 }
 return best;
}
function ledger(entries){const a=Array.isArray(entries)?entries.filter(x=>x&&valid(x.exposure)):[];return {saved:a.length,completed:a.filter(x=>x.completed===true).length,lower:a.filter(x=>valid(x.baseline)&&x.baseline>x.exposure).length,completedLower:a.filter(x=>x.completed===true&&valid(x.baseline)&&x.baseline>x.exposure).length};}
function verifyText(value,ctx,S){
 if(!value||value.kind!=='air')return true;
 const digits=s=>String(s).replace(/[\u0966-\u096f\u0c66-\u0c6f\u0be6-\u0bef\u09e6-\u09ef]/g,x=>String(x.charCodeAt(0)%16-6));
 const t=digits([value.recommendation,value.reason,value.limitation].join('\n')),recommendation=digits(value.recommendation||'');
 if(/(?:पूरी तरह सुरक्षित|बिल्कुल सुरक्षित|कोई जोखिम नहीं|పూర్తిగా సురక్షితం|ఎలాంటి ప్రమాదం లేదు|முற்றிலும் பாதுகாப்பானது|எந்த ஆபத்தும் இல்லை|সম্পূর্ণ নিরাপদ|কোনো ঝুঁকি নেই)/u.test(t))return false;
 const allowedAQI=new Set([Math.round(ctx.aqi),ctx.window?.avg].filter(Number.isFinite));
 const numeric='(\\d+(?:\\.\\d+)?)';
 // Check common native-language labels as well as the English abbreviation.
 const aqiLabel='(?:\\bAQI\\b|वायु गुणवत्ता सूचकांक|वायु गुणवत्ता सूचक|గాలి నాణ్యత సూచిక|వాయు నాణ్యత సూచిక|காற்றுத் தரக் குறியீடு|বায়ুর মান সূচক|বায়ুর গুণমান সূচক)';
 for(const m of t.matchAll(new RegExp(aqiLabel+'\\s*(?:is\\s*|of\\s*|[:=]\\s*)?'+numeric,'giu')))if(!allowedAQI.has(Number(m[1])))return false;
 for(const m of t.matchAll(new RegExp(numeric+'\\s*(?:US\\s+)?AQI\\b','gi')))if(!allowedAQI.has(Number(m[1])))return false;
 // Current claims cannot borrow the lower forecast-window mean.
 for(const m of t.matchAll(/(?:current|now|currently)\s+(?:modelled\s+)?(?:US\s+)?AQI\s*(?:is\s*|[:=]\s*)?(\d+(?:\.\d+)?)/gi))if(Number(m[1])!==Math.round(ctx.aqi))return false;
 if(/\b(?:guaranteed safe|zero risk|no risk|risk.free|100\s*%\s*safe)\b/i.test(t))return false;
 if(/\b(?:stop (?:taking|using) (?:your|the)|double (?:your|the) dose|take \d+\s*(?:mg|tablets?))\b/i.test(recommendation))return false;
 for(const m of t.matchAll(/\bPM\s*2\.5\s*(?:concentration\s*)?(?:is\s*|of\s*|[:=]\s*)?(\d+(?:\.\d+)?)/gi))if(!valid(ctx.pm25)||Math.abs(Number(m[1])-ctx.pm25)>.51)return false;
 const permitted=new Set([ctx.window?.start?.slice(11,16),ctx.window?.end?.slice(11,16)].filter(Boolean));
 for(const m of t.matchAll(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g))if(!permitted.has(m[0]))return false;
 if(S.effectiveLevel(ctx.aqi,ctx.profile)>=2&&/(?:^|[.!?]\s+)(?:go (?:for a )?|do |try |continue )?(?:run(?:ning)?|jog(?:ging)?|strenuous exercise|intense exercise) (?:outdoors|outside)\b/i.test(recommendation))return false;
 return true;
}

// Deterministic sensitivity analysis, not a calibrated forecast uncertainty interval.
// Shift the same hourly AQI/PM pair together; where a neighboring hour is missing,
// retain the nominal reading and disclose that boundary rule.
const scenarioIds=['nominal','peak-earlier','peak-later','higher-pm'];
function scenarioRows(hours,S){
 const h=hours.slice(0,24);
 const usable=x=>x&&iso(x.time)&&valid(x.aqi)&&S.band(x.aqi)&&valid(x.pm2_5);
 const adjacent=(x,y,d)=>usable(x)&&usable(y)&&(d===1?next(x.time)===y.time:next(y.time)===x.time);
 return [h,h.map((x,i)=>adjacent(x,h[i+1],1)?{...x,aqi:h[i+1].aqi,pm2_5:h[i+1].pm2_5}:x),h.map((x,i)=>adjacent(x,h[i-1],-1)?{...x,aqi:h[i-1].aqi,pm2_5:h[i-1].pm2_5}:x),h.map(x=>usable(x)?{...x,pm2_5:x.pm2_5*1.25}:x)];
}
function objectives(t,policy){
 return policy==='robust'?[t.worstRisk,t.worstExposure,t.shift,t.scenarios[0].exposure]:policy==='routine'?[t.scenarios[0].risk,t.shift,t.scenarios[0].exposure]:[t.scenarios[0].risk,t.scenarios[0].exposure,t.shift];
}
const lex=(a,b)=>!b||a.some((v,i)=>v<b[i]&&a.slice(0,i).every((n,j)=>n===b[j]));
function analyze(hours,items,S,profile){
 if(!Array.isArray(hours)||!Array.isArray(items)||!items.length||items.length>4||!Object.hasOwn(S.PROFILES,profile))return null;
 const h=hours.slice(0,24),n=h.length,scenarios=scenarioRows(h,S);
 if(!items.every(a=>a&&Number.isInteger(a.duration)&&a.duration>=1&&a.duration<=4&&Number.isInteger(a.preferred)&&Number.isInteger(a.earliest)&&Number.isInteger(a.latest)&&a.earliest>=0&&a.latest<=n&&a.earliest<=a.preferred&&a.preferred+a.duration<=a.latest))return null;
 const options=items.map(a=>Array.from({length:Math.max(0,a.latest-a.earliest-a.duration+1)},(_,k)=>{
  const index=a.earliest+k,slots=scenarios.map(rows=>slot(rows,index,a.duration,S,profile));
  return slots.every(Boolean)?{index,endIndex:index+a.duration,slots,shift:Math.abs(index-a.preferred)}:null;
 }).filter(Boolean));
 const best={exposure:null,routine:null,robust:null},scores={},chosen=[];let count=0;
 function walk(k,end){
  if(k===items.length){
   count++;
   const totals=scenarioIds.map((id,j)=>({id,risk:chosen.reduce((n,o)=>n+Number(o.slots[j].caution),0),exposure:chosen.reduce((n,o)=>n+o.slots[j].exposure,0)}));
   const t={indices:chosen.map(o=>o.index),scenarios:totals,shift:chosen.reduce((n,o)=>n+o.shift,0),worstRisk:Math.max(...totals.map(x=>x.risk)),worstExposure:Math.max(...totals.map(x=>x.exposure))};
   for(const p of Object.keys(best)){const score=objectives(t,p);if(lex(score,scores[p])){scores[p]=score;best[p]=t;}}
   return;
  }
  for(const o of options[k])if(o.index>=end){chosen.push(o);walk(k+1,o.endIndex);chosen.pop();}
 }
 walk(0,0);
 return {count,best,options:options.map(a=>a.length)};
}
function evaluateSchedule(hours,items,indices,S,profile){
 if(!Array.isArray(indices)||indices.length!==items.length)return null;
 const scenarios=scenarioRows(hours,S);
 if(!indices.every((index,i)=>Number.isInteger(index)&&index>=items[i].earliest&&index+items[i].duration<=items[i].latest&&(!i||indices[i-1]+items[i-1].duration<=index)))return null;
 const totals=scenarios.map((h,j)=>{const s=items.map((a,i)=>slot(h,indices[i],a.duration,S,profile));return s.every(Boolean)?{id:scenarioIds[j],risk:s.filter(x=>x.caution).length,exposure:s.reduce((n,x)=>n+x.exposure,0)}:null;});
 if(totals.some(x=>!x))return null;
 return {indices:[...indices],scenarios:totals,shift:indices.reduce((n,x,i)=>n+Math.abs(x-items[i].preferred),0),worstRisk:Math.max(...totals.map(x=>x.risk)),worstExposure:Math.max(...totals.map(x=>x.exposure))};
}
function robustPlan(hours,items,S,profile,analysis){
 const t=(analysis||analyze(hours,items,S,profile))?.best.robust;if(!t)return null;
 const base=S.optimizeDay(hours,items,profile,'exposure');if(!base)return null;
 const slots=items.map((a,i)=>({...slot(hours,t.indices[i],a.duration,S,profile),endIndex:t.indices[i]+a.duration,shift:Math.abs(t.indices[i]-a.preferred)}));
 return {...base,policy:'robust',slots,risk:t.scenarios[0].risk,exposure:t.scenarios[0].exposure,shift:t.shift,changePct:base.baseline>0?Math.round((base.baseline-t.scenarios[0].exposure)/base.baseline*100):null};
}
function certificate(hours,items,plan,S,profile,analysis){
 if(!plan||!['exposure','routine','robust'].includes(plan.policy))return null;
 const a=analysis||analyze(hours,items,S,profile),t=evaluateSchedule(hours,items,plan.slots.map(x=>x.index),S,profile);if(!a?.count||!t)return null;
 const score=objectives(t,plan.policy),optimal=objectives(a.best[plan.policy],plan.policy);
 if(!score.every((v,i)=>Math.abs(v-optimal[i])<=1e-8*Math.max(1,Math.abs(optimal[i]))))return null;
 return {version:1,method:'Exhaustive ordered non-overlapping hourly schedules; deterministic sensitivity scenarios, not probabilities',profile,policy:plan.policy,hours:hours.slice(0,24).map(x=>x?{time:x.time,aqi:x.aqi,pm2_5:x.pm2_5}:null),items:items.map(({name,duration,preferred,earliest,latest})=>({name,duration,preferred,earliest,latest})),selected:t,feasibleSchedules:a.count,objective:score};
}
function verifyCertificate(c,S){
 try{
  if(!c||c.version!==1||!['exposure','routine','robust'].includes(c.policy)||!Array.isArray(c.hours)||c.hours.length>24||!Array.isArray(c.items)||c.items.length>4)return false;
  const a=analyze(c.hours,c.items,S,c.profile);if(!a?.count||a.count!==c.feasibleSchedules)return false;
  const t=evaluateSchedule(c.hours,c.items,c.selected.indices,S,c.profile);if(!t)return false;
  const score=objectives(t,c.policy),optimal=objectives(a.best[c.policy],c.policy);
  return JSON.stringify(t)===JSON.stringify(c.selected)&&JSON.stringify(score)===JSON.stringify(c.objective)&&score.every((v,i)=>Math.abs(v-optimal[i])<=1e-8*Math.max(1,Math.abs(optimal[i])));
 }catch(_){return false;}
}
function conflict(hours,items,S,profile){
 const a=analyze(hours,items,S,profile);if(!a||a.count)return null;
 const n=Math.min(hours.length,24),suggestions=[];
 // Search one activity's flexibility at a time. A fixed commitment is never changed automatically.
 for(let i=0;i<items.length;i++){
  const x=items[i],old=Number.isInteger(x.flex)?x.flex:Math.max(x.preferred-x.earliest,x.latest-x.preferred-x.duration);
  for(const flex of [1,2,4,6].filter(v=>v>old)){
   const revised=items.map((v,j)=>j===i?{...v,earliest:Math.max(0,v.preferred-flex),latest:Math.min(n,v.preferred+v.duration+flex)}:v);
   if(S.optimizeDay(hours,revised,profile,'exposure')){suggestions.push({index:i,name:x.name,flex,added:Math.max(0,x.preferred-revised[i].earliest-old,revised[i].latest-x.preferred-x.duration-old),fixed:x.flex===0});break;}
  }
 }
 suggestions.sort((x,y)=>x.added-y.added||Number(x.fixed)-Number(y.fixed)||x.index-y.index);
 return {missing:items.filter((_,i)=>!a.options[i]).map(x=>x.name),suggestion:suggestions[0]||null};
}

return {slot,compare,trust,capture,restore,revise,familyWindow,ledger,verifyText,analyze,evaluateSchedule,robustPlan,certificate,verifyCertificate,conflict};
});
