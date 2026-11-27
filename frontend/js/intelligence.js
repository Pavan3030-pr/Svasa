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
 if(!snapshot||snapshot.version!==1||snapshot.cityKey!==cityKey||snapshot.profile!==profile||!Object.hasOwn(S.PROFILES,profile)||!['exposure','routine'].includes(snapshot.policy)||!Number.isFinite(snapshot.savedAt)||snapshot.savedAt>now+60000||now-snapshot.savedAt>48*3600000||!Array.isArray(snapshot.items)||snapshot.items.length<1||snapshot.items.length>4||!valid(snapshot.exposure)||!Number.isInteger(snapshot.risk)||snapshot.risk<0||snapshot.risk>snapshot.items.length)return null;
 const names=['Commute','Walk','Workout','School','Shopping','Other'];
 if(!snapshot.items.every(a=>a&&names.includes(a.name)&&Number.isInteger(a.duration)&&a.duration>=1&&a.duration<=4&&[0,1,2,4,6].includes(a.flex)&&iso(a.preferredTime)&&iso(a.chosenTime)&&Math.abs(Date.parse(a.preferredTime+'Z')-Date.parse(a.chosenTime+'Z'))<=a.flex*3600000))return null;
 return {cityKey,profile,policy:snapshot.policy,items:snapshot.items.map(a=>({name:a.name,duration:a.duration,flex:a.flex,preferredTime:a.preferredTime,chosenTime:a.chosenTime})),exposure:snapshot.exposure,risk:snapshot.risk};
}
function revise(snapshot,hours,S,cityKey,profile){
 if(!snapshot||snapshot.cityKey!==cityKey||snapshot.profile!==profile)return {state:'different-context'};
 if(!Array.isArray(hours)||!hours.length)return {state:'unavailable'};
 const items=snapshot.items.map(a=>{const preferred=hours.findIndex(h=>h.time===a.preferredTime);return {...a,preferred,earliest:Math.max(0,preferred-a.flex),latest:Math.min(hours.length,preferred+a.duration+a.flex)};});
 if(items.some(a=>a.preferred<0||a.preferred+a.duration>hours.length))return {state:'expired'};
 const proposal=S.optimizeDay(hours,items,profile,snapshot.policy);if(!proposal)return {state:'infeasible'};
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
 for(const m of t.matchAll(/\bAQI\s*(?:is\s*|[:=]\s*)?(\d{1,4})\b/gi))if(!allowedAQI.has(Number(m[1])))return false;
 if(/\b(?:guaranteed safe|zero risk|no risk|risk.free|100\s*%\s*safe)\b/i.test(t))return false;
 for(const m of t.matchAll(/\bPM\s*2\.5\s*(?:concentration\s*)?(?:is\s*|of\s*|[:=]\s*)?(\d+(?:\.\d+)?)\s*(?:µg|μg|ug|micrograms?)/gi))if(!valid(ctx.pm25)||Math.abs(Number(m[1])-ctx.pm25)>.51)return false;
 const permitted=new Set([ctx.window?.start?.slice(11,16),ctx.window?.end?.slice(11,16)].filter(Boolean));
 for(const m of t.matchAll(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g))if(!permitted.has(m[0]))return false;
 if(S.effectiveLevel(ctx.aqi,ctx.profile)>=2&&/(?:^|[.!?]\s+)(?:go (?:for a )?|do |try |continue )?(?:run(?:ning)?|jog(?:ging)?|strenuous exercise|intense exercise) (?:outdoors|outside)\b/i.test(recommendation))return false;
 return true;
}
return {slot,compare,trust,capture,restore,revise,familyWindow,ledger,verifyText};
});
