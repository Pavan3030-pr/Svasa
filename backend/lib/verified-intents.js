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
module.exports={questions,answer};
