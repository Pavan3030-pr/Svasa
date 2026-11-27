'use strict';
const assert=require('node:assert/strict');
const base=process.env.SVASA_PRODUCTION_URL||'https://svasa-sage.vercel.app';
const strictLive=process.env.SVASA_STRICT_LIVE_AI==='1';
const out={mode:strictLive?'strict live Gemini evaluation':'production resilience',checkedAt:new Date().toISOString(),expectedCommit:process.env.GITHUB_SHA||null,checks:{}};
async function get(path,options={}){return fetch(base+path,{...options,signal:AbortSignal.timeout(25000),redirect:'error'});}
async function json(path,options){const r=await get(path,options);return {status:r.status,data:await r.json()};}
async function check(name,fn){try{out.checks[name]=await fn();}catch(e){out.checks[name]={result:'fail',reason:String(e.message).slice(0,160)};}}
(async()=>{
 let health=null;
 for(let i=0;i<8;i++){try{const r=await json('/api/health');if(r.status===200&&r.data.ok){health=r.data;if(!out.expectedCommit||health.build===out.expectedCommit)break;}}catch(_){}if(i<7)await new Promise(r=>setTimeout(r,10000));}
 out.checks.health=health?{result:'pass',build:health.build||null,geminiConfigured:!!health.ai,stationsConfigured:!!health.stations,redisConfigured:!!health.distributedRateLimit,pushConfigured:!!health.backgroundPush}:{result:'fail',reason:'Health unavailable'};
 out.checks.commit=health&&(!out.expectedCommit||health.build===out.expectedCommit)?{result:'pass'}:{result:'fail',reason:'Production commit could not be matched'};
 out.checks.requiredConfiguration=health&&health.ai&&health.stations&&health.distributedRateLimit&&health.backgroundPush?{result:'pass'}:{result:'fail',reason:'One or more required providers are not configured'};
 await check('landing',async()=>{const r=await get('/');assert.equal(r.status,200);assert.ok((await r.text()).includes('Svasa'));return {result:'pass'};});
 await check('app',async()=>{const r=await get('/app.html');assert.equal(r.status,200);assert.ok((await r.text()).includes('optimizeday'));return {result:'pass'};});
 const post=body=>json('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function livePost(body){await pause(15000);return post(body);}
 await check('emergency',async()=>{const r=await post({q:'I cannot breathe',ctx:{lang:'en'}});assert.equal(r.status,200);assert.equal(r.data.source,'safety');return {result:'pass'};});
 const languageCases=[['en','What precautions should I consider for outdoor activity?',/[A-Za-z]/],['hi','बाहर टहलने के लिए क्या सावधानी रखूँ?',/[\u0900-\u097f]/],['te','బయట నడవడానికి ఎలాంటి జాగ్రత్తలు తీసుకోవాలి?',/[\u0c00-\u0c7f]/],['ta','வெளியே நடக்க என்ன முன்னெச்சரிக்கை தேவை?',/[\u0b80-\u0bff]/],['bn','বাইরে হাঁটার জন্য কী সতর্কতা নেব?',/[\u0980-\u09ff]/]];
 await check('assistantResilience',async()=>{
  const results=[];
  for(const [lang,q,script] of strictLive?languageCases:languageCases.slice(0,1)){
   try{
    const r=await livePost({q,place:{lat:17.385,lon:78.4867},ctx:{profile:'general',lang,hist:[]}});
    const fields=['recommendation','reason','limitation'].map(k=>({field:k,script:typeof r.data.sections?.[k]==='string'&&script.test(r.data.sections[k])}));
    const evidence=Number.isFinite(r.data.evidence?.aqi)&&Number.isFinite(Date.parse(r.data.evidence?.observedAt))&&r.data.evidence?.source==='Open-Meteo / CAMS model';
    const live=r.status===200&&r.data.source==='gemini'&&fields.every(x=>x.script)&&evidence;
    const fallback=r.status===200&&r.data.source==='rules'&&r.data.reason==='provider_rate_limit'&&fields.every(x=>x.script)&&evidence;
    results.push({lang,status:r.status,source:r.data.source||null,reason:r.data.reason||null,fields,evidence,result:live?'live Gemini':fallback?'verified quota fallback':'fail'});
   }catch(_){results.push({lang,result:'fail',reason:'Network or response parse failure'});}
  }
  const usable=results.every(x=>x.result==='live Gemini'||x.result==='verified quota fallback'),live=results.every(x=>x.result==='live Gemini');
  if(usable&&!live)console.log('::warning::Gemini quota limited; fallback was verified, live model evaluation remains incomplete.');
  return {result:!usable?'fail':strictLive&&!live?'quota limited':'pass',providerEvaluation:live?'live verified':'incomplete due to provider quota',cases:results,scope:'Response schema, script, source and evidence; not clinical or translation-quality assessment'};
 });
 await check('schedulerAuthorization',async()=>{const r=await json('/api/push-dispatch');assert.equal(r.status,403);return {result:'pass'};});
 await check('stations',async()=>{if(!health?.stations)return {result:'not configured'};const r=await json('/api/stations?lat=17.385&lon=78.4867');assert.equal(r.status,200);const station=r.data.station;if(station){assert.ok(Number.isFinite(station.pm25)&&station.pm25>=0);assert.ok(Number.isFinite(Date.parse(station.time)));}return {result:'pass',stationAvailable:!!station,readingValid:station?true:null};});
 await check('pushConfig',async()=>{const r=await json('/api/push');assert.equal(r.status,200);assert.equal(typeof r.data.enabled,'boolean');if(health?.distributedRateLimit){assert.equal(r.data.enabled,true,'Push disabled despite Redis configuration; check VAPID pair and subject');assert.match(r.data.publicKey,/^[A-Za-z0-9_-]{87}$/);}return {result:'pass',enabled:r.data.enabled};});
 console.log(JSON.stringify(out,null,2));require('node:fs').mkdirSync('production-artifacts',{recursive:true});require('node:fs').writeFileSync('production-artifacts/results.json',JSON.stringify(out,null,2));
 if(Object.values(out.checks).some(x=>x.result==='fail'||x.result==='quota limited'))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
