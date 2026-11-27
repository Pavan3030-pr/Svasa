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
for(const [lang,good,unsafe,wrong] of [
 ['hi','सावधानी रखें।','पूरी तरह सुरक्षित','AQI ९९९'],
 ['te','జాగ్రత్తలు తీసుకోండి.','పూర్తిగా సురక్షితం','AQI ౯౯౯'],
 ['ta','கவனமாக இருங்கள்.','முற்றிலும் பாதுகாப்பானது','AQI ௯௯௯'],
 ['bn','সতর্ক থাকুন।','সম্পূর্ণ নিরাপদ','AQI ৯৯৯']
]){
 const ctx={aqi:150,pm25:50,lang,profile:'child',window:{avg:80,start:'2026-11-27T10:00',end:'2026-11-27T12:00'}};
 const valid={kind:'air',recommendation:good,reason:good,limitation:good};
 check(validateResponse(JSON.stringify(valid),ctx)!==null);
 check(validateResponse(JSON.stringify({...valid,recommendation:unsafe}),ctx)===null);
 check(validateResponse(JSON.stringify({...valid,reason:good+' '+wrong}),ctx)===null);
 check(validateResponse(JSON.stringify({...valid,reason:good+' 19:00'}),ctx)===null);
 check(validateResponse(JSON.stringify({...valid,reason:good+' PM2.5 500 µg/m³'}),ctx)===null);
}
const accurate={aqi:160,pm25:50,profile:'general',lang:'en',window:{avg:80,start:'2026-11-27T10:00',end:'2026-11-27T12:00'}};
for(const reason of ['Current AQI 80','AQI 160.5','999 AQI','PM2.5 is 500','PM2.5: 49'])check(validateResponse(JSON.stringify({...base,reason}),accurate)===null);
for(const reason of ['Current AQI 160','AQI 80','PM2.5 is 50'])check(validateResponse(JSON.stringify({...base,reason}),accurate)!==null);
for(const [lang,label,txt] of [['hi','वायु गुणवत्ता सूचकांक','सावधानी रखें।'],['te','గాలి నాణ్యత సూచిక','జాగ్రత్తలు తీసుకోండి.'],['ta','காற்றுத் தரக் குறியீடு','கவனமாக இருங்கள்.'],['bn','বায়ুর মান সূচক','সতর্ক থাকুন।']])check(validateResponse(JSON.stringify({kind:'air',recommendation:txt,reason:label+' 999',limitation:txt}),{...accurate,lang})===null);
check(validateResponse(JSON.stringify({kind:'offtopic',recommendation:'hidden text',reason:'',limitation:''}),accurate)===null);
console.log(cases+' deterministic AI contract and multilingual safety cases passed (not live model evaluations)');
