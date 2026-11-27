'use strict';
const assert=require('node:assert/strict'),{validateResponse}=require('../backend/lib/gemini'),S=require('../frontend/js/core');
let cases=0;const check=(condition)=>{assert.ok(condition);cases++;};
const base={kind:'air',recommendation:'Consider indoor activity.',reason:'Pollution is elevated.',limitation:'Forecasts may change.'};
for(const aqi of [25,50,80,101,150,180,250,350]){
 const ctx={aqi,window:{avg:45}};
 check(validateResponse(JSON.stringify(base),ctx)?.kind==='air');
 check(validateResponse(JSON.stringify({...base,reason:'AQI '+aqi}),ctx)!==null);
 check(validateResponse(JSON.stringify({...base,reason:'AQI 45'}),ctx)!==null);
 check(validateResponse(JSON.stringify({...base,reason:'AQI 999'}),ctx)===null);
 check(validateResponse(JSON.stringify({...base,recommendation:'Guaranteed safe'}),ctx)===null);
 check(validateResponse(JSON.stringify({...base,limitation:''}),ctx)===null);
 check(validateResponse(JSON.stringify({...base,reason:123}),ctx)===null);
 check(validateResponse(JSON.stringify({...base,extra:'inject'}),ctx)===null);
 check(validateResponse('not JSON',ctx)===null);
 check(validateResponse(JSON.stringify({kind:'offtopic',recommendation:'',reason:'',limitation:''}),ctx)?.kind==='offtopic');
}
for(const q of ['I cannot breathe','chest pain','gasping for air','blue lips','passing out','सांस नहीं आ रही','ఊపిరి ఆడటం లేదు','ఛాతి నొప్పి','மூச்சு விட முடியவில்லை','শ্বাস নিতে পারছি না'])check(S.safety(q));
for(const q of ['Can I run?','Do I need a mask?','What is PM2.5?','How does breathing work?','ఊపిరి గురించి చెప్పండి','மூச்சு பயிற்சி','শ্বাস ব্যায়াম','Should I open windows?','Can children play?','What is the air quality?'])check(S.safety(q)===null);
for(const [lang,text] of [['hi','सावधानी रखें।'],['te','జాగ్రత్తలు తీసుకోండి.'],['ta','கவனமாக இருங்கள்.'],['bn','সতর্ক থাকুন।']]){
 const ctx={aqi:100,lang};
 check(validateResponse(JSON.stringify({...base,recommendation:text,reason:text,limitation:text}),ctx)!==null);
 check(validateResponse(JSON.stringify(base),ctx)===null);
 check(validateResponse(JSON.stringify({...base,recommendation:text,reason:text}),ctx)===null);
}
console.log(cases+' deterministic AI contract and multilingual safety cases passed (not live model evaluations)');
