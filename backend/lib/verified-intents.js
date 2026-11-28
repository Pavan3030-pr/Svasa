'use strict';
// Explicitly selected, bounded questions; never claim arbitrary free text is understood.
const guidance=require('./quota-guidance');
const questions={
 en:['Can I run outside?','Do I need a mask?','Best time to go out?','Should I open windows?','Is it safe for my child?','What is polluting the air?'],
 hi:['क्या मैं बाहर दौड़ सकता हूँ?','क्या मुझे मास्क चाहिए?','बाहर जाने का सबसे अच्छा समय?','क्या खिड़कियाँ खोलूँ?','क्या यह मेरे बच्चे के लिए सुरक्षित है?','हवा में क्या प्रदूषण है?'],
 te:['నేను బయట పరిగెత్తవచ్చా?','నాకు మాస్క్ అవసరమా?','బయటకు వెళ్లడానికి ఉత్తమ సమయం?','కిటికీలు తెరవాలా?','ఇది నా బిడ్డకు సురక్షితమా?','గాలిలో ఏ కాలుష్యం ఉంది?'],
 ta:['நான் வெளியே ஓடலாமா?','எனக்கு முகக்கவசம் தேவையா?','வெளியே செல்ல சிறந்த நேரம்?','ஜன்னல்களைத் திறக்கலாமா?','இது என் குழந்தைக்கு பாதுகாப்பானதா?','காற்றில் என்ன மாசு உள்ளது?'],
 bn:['আমি কি বাইরে দৌড়াতে পারি?','আমার কি মাস্ক দরকার?','বাইরে যাওয়ার সেরা সময় কখন?','জানালা খুলব কি?','এটা কি আমার সন্তানের জন্য নিরাপদ?','বাতাসে কী দূষণ আছে?']
};
const topics=['general','mask','time','windows','child','pollutant'];
function answer(q,ctx){
 const list=questions[ctx.lang];if(!list)return null;
 const i=list.findIndex(x=>x.normalize('NFC')===q.normalize('NFC'));if(i<0)return null;
 // Use canonical topic, avoiding fragile inflection and translated keyword matching.
 return guidance(ctx,questions.en[i],'verified_intent',topics[i]);
}
// Exact, standalone factual queries: no inference about an arbitrary prompt.
const factual={
 en:{aqi:['what is the current aqi','current aqi','what is the aqi now'],pm:['what is the current pm2.5','current pm2.5','what is the pm2.5 now'],aqiText:'Current modelled US AQI: ',pmText:'Current modelled PM2.5: ',missing:'A current modelled PM2.5 value is unavailable.'},
 hi:{aqi:['अभी वायु गुणवत्ता सूचकांक क्या है','वर्तमान एक्यूआई क्या है'],pm:['अभी पीएम2.5 कितना है'],aqiText:'वर्तमान मॉडल आधारित अमेरिकी वायु गुणवत्ता सूचकांक: ',pmText:'वर्तमान मॉडल आधारित पीएम2.5: ',missing:'वर्तमान मॉडल आधारित पीएम2.5 उपलब्ध नहीं है।'},
 te:{aqi:['ప్రస్తుత గాలి నాణ్యత సూచిక ఎంత','ప్రస్తుత ఏక్యూఐ ఎంత'],pm:['ప్రస్తుత పీఎం2.5 ఎంత'],aqiText:'ప్రస్తుత నమూనా ఆధారిత US AQI: ',pmText:'ప్రస్తుత నమూనా ఆధారిత పీఎం2.5: ',missing:'ప్రస్తుత నమూనా ఆధారిత పీఎం2.5 అందుబాటులో లేదు.'},
 ta:{aqi:['தற்போதைய காற்றுத் தரக் குறியீடு என்ன','தற்போதைய ஏக்யூஐ என்ன'],pm:['தற்போதைய பிஎம்2.5 என்ன'],aqiText:'தற்போதைய மாதிரி அடிப்படையிலான US AQI: ',pmText:'தற்போதைய மாதிரி அடிப்படையிலான பிஎம்2.5: ',missing:'தற்போதைய மாதிரி அடிப்படையிலான பிஎம்2.5 கிடைக்கவில்லை.'},
 bn:{aqi:['বর্তমান বায়ুর মান সূচক কত','এখন একিউআই কত'],pm:['বর্তমান পিএম2.5 কত'],aqiText:'বর্তমান মডেলভিত্তিক US AQI: ',pmText:'বর্তমান মডেলভিত্তিক পিএম2.5: ',missing:'বর্তমান মডেলভিত্তিক পিএম2.5 পাওয়া যাচ্ছে না।'}
};
const normalize=q=>String(q).normalize('NFC').trim().replace(/[?？।]+$/u,'').trim().replace(/\s+/gu,' ').toLowerCase();
function factualAnswer(q,ctx){
 const t=factual[ctx.lang];if(!t)return null;const k=normalize(q),aqi=t.aqi.includes(k),pm=t.pm.includes(k);if(!aqi&&!pm)return null;
 const v=guidance(ctx,'Can I run outside?','verified_intent','general');
 const recommendation=aqi?t.aqiText+Math.round(ctx.aqi):Number.isFinite(ctx.pm25)&&ctx.pm25>=0?t.pmText+String(ctx.pm25)+' µg/m³':t.missing;
 return {...v,recommendation};
}
module.exports={questions,answer,factualAnswer,factual};
