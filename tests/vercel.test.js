const assert=require('assert');process.env.GEMINI_API_KEY='k';
const airFixture=()=>({current:{time:new Date().toISOString().slice(0,16),us_aqi:160,pm2_5:55,us_aqi_pm2_5:160},hourly:{time:[],us_aqi:[],pm2_5:[]}});
global.fetch=async u=>({ok:true,json:async()=>String(u).includes('air-quality-api')?airFixture():({candidates:[{content:{parts:[{text:JSON.stringify({kind:'air',recommendation:'Wear N95.',reason:'High pollution.',limitation:'Model estimate.'})}]}}]})});
const h=require('../api/ask.js');
const call=(o)=>new Promise(r=>{const res={headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){r({code:this.code,b})}};if(o.body&&o.body.ctx&&typeof o.body.ctx.aqi==='number')o.body.place={lat:28.6,lon:77.2};h(Object.assign({method:'POST',headers:{'content-type':'application/json',host:'x.vercel.app'},socket:{remoteAddress:'1.1.1.'+Math.floor(Math.random()*250)}},o),res)});
(async()=>{const ctx={aqi:160,city:'Delhi',profile:'general',trend:'rising'};
 let r=await call({body:{q:'mask?',ctx}});assert.equal(r.code,200);assert.match(r.b.answer,/Wear N95/);assert.match(r.b.answer,/Data used/);assert.equal(r.b.evidence.aqi,160);
 global.fetch=async u=>({ok:true,json:async()=>String(u).includes('air-quality-api')?airFixture():({candidates:[{content:{parts:[{text:JSON.stringify({kind:'offtopic',recommendation:'',reason:'',limitation:''})}]}}]})});
 r=await call({body:{q:'write a poem',ctx}});assert.equal(r.code,200);assert.ok(!/Data used/.test(r.b.answer));assert.equal(r.b.source,'offtopic');
 assert.equal((await call({method:'GET'})).code,405);
 assert.equal((await call({headers:{'content-type':'application/json',host:'x.vercel.app',origin:'https://evil.example'},body:{q:'x',ctx}})).code,403);
 assert.equal((await call({headers:{'content-type':'text/plain',host:'x.vercel.app'},body:{}})).code,415);
 assert.equal((await call({body:{q:'x',ctx:{aqi:'bad'}}})).code,400);
 assert.equal((await call({body:{q:'I cannot breathe',ctx}})).b.source,'safety');
 assert.equal((await call({body:{q:'a'.repeat(5000),ctx}})).code,413);
 global.fetch=async u=>String(u).includes('air-quality-api')?{ok:true,json:async()=>airFixture()}:{ok:false,status:429};
 for(const [lang,script] of [['en',/[A-Za-z]/],['hi',/[\u0900-\u097f]/],['te',/[\u0c00-\u0c7f]/],['ta',/[\u0b80-\u0bff]/],['bn',/[\u0980-\u09ff]/]]){r=await call({body:{q:'Can I walk?',ctx:{...ctx,lang}}});assert.equal(r.code,200);assert.equal(r.b.source,'rules');assert.equal(r.b.reason,'provider_rate_limit');for(const field of ['recommendation','reason','limitation'])assert.match(r.b.sections[field],script);assert.equal(r.b.evidence.aqi,160);}
 const fallback=require('../backend/lib/quota-guidance'),ground={aqi:160,profile:'general',lang:'en',dominant:'pm2_5',window:{start:'2026-11-27T09:00',end:'2026-11-27T11:00',avg:90}};
 assert.match(fallback(ground,'Do I need a mask?').recommendation,/N95/);
 assert.match(fallback(ground,'Should I open windows?').recommendation,/windows/i);
 assert.match(fallback(ground,'Best time to go out?').reason,/09:00–11:00 UTC/);
 assert.match(fallback(ground,'What is polluting the air?').recommendation,/PM2.5/);
 const localized=[['hi','क्या मुझे मास्क चाहिए?','क्या खिड़कियाँ खोलूँ?'],['te','నాకు మాస్క్ అవసరమా?','కిటికీలు తెరవాలా?'],['ta','எனக்கு முகக்கவசம் தேவையா?','ஜன்னல்களைத் திறக்கலாமா?'],['bn','আমার কি মাস্ক দরকার?','জানালা খুলব?']];
 for(const [lang,mask,windows] of localized){const one=fallback({...ground,lang},mask),two=fallback({...ground,lang},windows);assert.match(one.recommendation,/N95/);assert.notEqual(one.recommendation,two.recommendation);assert.equal(fallback.intent(windows),'windows');}
 console.log('vercel function tests passed');process.exit(0)})();
