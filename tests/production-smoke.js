'use strict';
const assert=require('node:assert/strict');
const base=process.env.SVASA_PRODUCTION_URL||'https://svasa-sage.vercel.app';
const out={checkedAt:new Date().toISOString(),expectedCommit:process.env.GITHUB_SHA||null,checks:{}};
async function get(path,options={}){return fetch(base+path,{...options,signal:AbortSignal.timeout(25000),redirect:'error'});}
async function json(path,options){const r=await get(path,options);return {status:r.status,data:await r.json()};}
async function check(name,fn){try{out.checks[name]=await fn();}catch(e){out.checks[name]={result:'fail',reason:String(e.message).slice(0,160)};}}
(async()=>{
 let health=null;
 for(let i=0;i<8;i++){try{const r=await json('/api/health');if(r.status===200&&r.data.ok){health=r.data;if(!out.expectedCommit||health.build===out.expectedCommit)break;}}catch(_){}if(i<7)await new Promise(r=>setTimeout(r,10000));}
 out.checks.health=health?{result:'pass',build:health.build||null,geminiConfigured:!!health.ai,stationsConfigured:!!health.stations,redisConfigured:!!health.distributedRateLimit,pushConfigured:!!health.backgroundPush}:{result:'fail',reason:'Health unavailable'};
 out.checks.commit=health&&out.expectedCommit&&health.build!==out.expectedCommit?{result:'unverified',reason:'Production commit could not be matched; Vercel deployment may still be propagating'}:{result:health?.build?'pass':'unverified'};
 await check('landing',async()=>{const r=await get('/');assert.equal(r.status,200);assert.ok((await r.text()).includes('Svasa'));return {result:'pass'};});
 await check('app',async()=>{const r=await get('/app.html');assert.equal(r.status,200);assert.ok((await r.text()).includes('optimizeday'));return {result:'pass'};});
 const post=body=>json('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function livePost(body){await pause(15000);return post(body);}
 await check('emergency',async()=>{const r=await post({q:'I cannot breathe',ctx:{lang:'en'}});assert.equal(r.status,200);assert.equal(r.data.source,'safety');return {result:'pass'};});
 await check('gemini',async()=>{if(!health?.ai)return {result:'not configured'};const r=await livePost({q:'What precautions should I consider for outdoor activity?',place:{lat:17.385,lon:78.4867},ctx:{profile:'general',lang:'en',hist:[]}});assert.equal(r.status,200);assert.equal(r.data.source,'gemini');assert.ok(r.data.sections?.recommendation&&r.data.sections?.reason&&r.data.sections?.limitation);assert.ok(Number.isFinite(r.data.evidence?.aqi));return {result:'pass',source:r.data.evidence.source};});
 await check('multilingual',async()=>{
  if(!health?.ai)return {result:'not configured'};
  const cases=[['hi','बाहर टहलने के लिए क्या सावधानी रखूँ?',/[\u0900-\u097f]/],['te','బయట నడవడానికి ఎలాంటి జాగ్రత్తలు తీసుకోవాలి?',/[\u0c00-\u0c7f]/],['ta','வெளியே நடக்க என்ன முன்னெச்சரிக்கை தேவை?',/[\u0b80-\u0bff]/],['bn','বাইরে হাঁটার জন্য কী সতর্কতা নেব?',/[\u0980-\u09ff]/]];
  const results=[];
  for(const [lang,q,script] of cases){try{const r=await livePost({q,place:{lat:17.385,lon:78.4867},ctx:{profile:'general',lang,hist:[]}});const sections=r.data.sections||{};const fields=['recommendation','reason','limitation'].map(k=>({field:k,script:typeof sections[k]==='string'&&script.test(sections[k])}));results.push({lang,status:r.status,source:r.data.source||null,error:r.data.error||null,reason:r.data.reason||null,fields,pass:r.status===200&&r.data.source==='gemini'&&fields.every(x=>x.script)&&Number.isFinite(r.data.evidence?.aqi)});}catch(_){results.push({lang,pass:false,error:'Network or response parse failure'});}}
  return {result:results.every(x=>x.pass)?'pass':results.every(x=>x.pass||x.reason==='provider_rate_limit')?'quota limited':'fail',cases:results,scope:'Script, response schema and evidence only; not clinical or translation-quality assessment'};
 });
 await check('schedulerAuthorization',async()=>{const r=await json('/api/push-dispatch');assert.equal(r.status,403);return {result:'pass'};});
 await check('stations',async()=>{if(!health?.stations)return {result:'not configured'};const r=await json('/api/stations?lat=17.385&lon=78.4867');assert.equal(r.status,200);return {result:'pass',stationAvailable:!!r.data.station,readingValid:r.data.station?Number.isFinite(r.data.station.pm25)&&r.data.station.pm25>=0:null};});
 await check('pushConfig',async()=>{const r=await json('/api/push');assert.equal(r.status,200);assert.equal(typeof r.data.enabled,'boolean');if(health?.distributedRateLimit){assert.equal(r.data.enabled,true,'Push disabled despite Redis configuration; check VAPID pair and subject');assert.match(r.data.publicKey,/^[A-Za-z0-9_-]{87}$/);}return {result:'pass',enabled:r.data.enabled};});
 console.log(JSON.stringify(out,null,2));require('node:fs').mkdirSync('production-artifacts',{recursive:true});require('node:fs').writeFileSync('production-artifacts/results.json',JSON.stringify(out,null,2));
 if(Object.values(out.checks).some(x=>x.result==='fail'||x.result==='quota limited'))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
