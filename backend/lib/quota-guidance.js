'use strict';
const S=require('../../frontend/js/core');
const messages={
 en:['Consider shorter outdoor activity and avoid heavy traffic.','Consider moving strenuous outdoor activity indoors.','Current modelled US AQI: ','The AI provider is rate limited. This is general rule-based guidance, not a personalized answer or medical advice.'],
 hi:['बाहर कम समय बिताने और भारी यातायात से दूर रहने पर विचार करें।','बाहर की कठिन गतिविधि को घर के अंदर करने पर विचार करें।','वर्तमान मॉडल आधारित वायु गुणवत्ता सूचकांक: ','एआई सेवा की अनुरोध सीमा पूरी हो गई है। यह नियम आधारित सामान्य सुझाव है, व्यक्तिगत या चिकित्सकीय सलाह नहीं।'],
 te:['బయట గడిపే సమయాన్ని తగ్గించి, అధిక ట్రాఫిక్ ఉన్న ప్రాంతాలను నివారించండి.','బయట చేసే తీవ్రమైన వ్యాయామాన్ని ఇంటి లోపల చేయడాన్ని పరిగణించండి.','ప్రస్తుత నమూనా ఆధారిత వాయు నాణ్యత సూచిక: ','ఏఐ సేవ అభ్యర్థన పరిమితిని చేరుకుంది. ఇది నియమాల ఆధారిత సాధారణ సూచన మాత్రమే, వ్యక్తిగత లేదా వైద్య సలహా కాదు.'],
 ta:['வெளியில் செலவிடும் நேரத்தைக் குறைத்து, அதிக போக்குவரத்து உள்ள இடங்களைத் தவிர்க்கலாம்.','தீவிரமான வெளிப்புற உடற்பயிற்சியை உள்ளே செய்யலாம்.','தற்போதைய மாதிரி அடிப்படையிலான காற்றுத் தரக் குறியீடு: ','ஏஐ சேவையின் கோரிக்கை வரம்பு எட்டப்பட்டுள்ளது. இது விதி அடிப்படையிலான பொதுவான வழிகாட்டுதல், தனிப்பட்ட அல்லது மருத்துவ ஆலோசனை அல்ல.'],
 bn:['বাইরে কম সময় কাটানো এবং বেশি যানজটের এলাকা এড়ানোর কথা বিবেচনা করুন।','কঠোর বাইরের ব্যায়াম ঘরের ভিতরে করার কথা বিবেচনা করুন।','বর্তমান মডেলভিত্তিক বায়ুর মান সূচক: ','এআই পরিষেবার অনুরোধের সীমা পূর্ণ হয়েছে। এটি নিয়মভিত্তিক সাধারণ নির্দেশনা, ব্যক্তিগত বা চিকিৎসা পরামর্শ নয়।']
};
// Deterministic intent matching, not diagnosis or unrestricted chat.
const patterns=[
 ['mask',/\b(mask|n95|ffp2|respirator)\b|मास्क|మాస్క్|முகக்கவசம்|মাস্ক/iu],
 ['windows',/\b(windows?|ventilat\w*)\b|खिड़क|కిటికీ|కిటికీలు|ஜன்னல்|জানালা/iu],
 ['time',/\b(best time|cleanest|when|forecast)\b|सबसे अच्छा समय|ఉత్తమ సమయం|சிறந்த நேரம்|সেরা সময়/iu],
 ['child',/\b(child|children|kid|baby|school)\b|बच्च|బిడ్డ|குழந்தை|শিশু|বাচ্চা/iu],
 ['pollutant',/\b(pollutant|polluting|pm2\.5|pm10|what is polluting)\b|प्रदूषण|కాలుష్యం|மாசு|দূষণ/iu]
];
const topicText={
 hi:{mask:['वायु प्रदूषण के लिए अभी मास्क आवश्यक नहीं हो सकता; अपनी संवेदनशीलता पर ध्यान दें।','बाहर कणों से बचाव के लिए अच्छी तरह फिट होने वाला N95 या FFP2 मास्क उपयोगी हो सकता है। यह गैसों से सुरक्षा नहीं देता।'],windows:['स्थानीय परिस्थितियों को ध्यान में रखकर थोड़ी देर हवा आने दें।','प्रदूषण अधिक होने पर खिड़कियाँ बंद रखने और साफ समय में हवा आने देने पर विचार करें।'],time:['अगले 24 घंटे के पूर्वानुमान में कम प्रदूषण वाला समय देखें।'],child:['बच्चों की गतिविधि सामान्य रखें लेकिन लक्षणों पर ध्यान दें।','बच्चों का बाहर खेलना सीमित करें और घर के अंदर खेलने पर विचार करें।'],pollutant:['डैशबोर्ड में प्रदूषकों का विवरण देखें। प्रमुख प्रदूषक: ']},
 te:{mask:['వాయు కాలుష్యం కోసం ప్రస్తుతం మాస్క్ అవసరం లేకపోవచ్చు; మీ సున్నితత్వాన్ని గమనించండి.','బయట కణాల నుంచి రక్షణకు సరిగ్గా సరిపోయే N95 లేదా FFP2 ఉపయోగపడవచ్చు. ఇది వాయువుల నుంచి రక్షించదు.'],windows:['స్థానిక పరిస్థితులను బట్టి కొద్దిసేపు గాలి రానివ్వండి.','కాలుష్యం ఎక్కువగా ఉన్నప్పుడు కిటికీలు మూసి, గాలి మెరుగుపడినప్పుడు తెరవడాన్ని పరిగణించండి.'],time:['రాబోయే 24 గంటల అంచనాలో తక్కువ కాలుష్యం ఉన్న సమయాన్ని చూడండి.'],child:['పిల్లల సాధారణ కార్యకలాపాల్లో లక్షణాలను గమనించండి.','పిల్లల బయట ఆటను తగ్గించి, ఇంట్లో ఆటను పరిగణించండి.'],pollutant:['డ్యాష్‌బోర్డ్‌లో కాలుష్య కారకాల వివరాలు చూడండి. ప్రధాన కారకం: ']},
 ta:{mask:['காற்று மாசுக்காக இப்போது முகக்கவசம் அவசியமில்லாமல் இருக்கலாம்; உங்கள் உணர்திறனைக் கவனியுங்கள்.','வெளியே துகள்களிலிருந்து பாதுகாப்புக்கு நன்றாகப் பொருந்தும் N95 அல்லது FFP2 உதவலாம். அது வாயுக்களிலிருந்து பாதுகாக்காது.'],windows:['உள்ளூர் சூழலைப் பொறுத்து சிறிது நேரம் காற்றோட்டம் ஏற்படுத்துங்கள்.','மாசு அதிகமாக இருந்தால் ஜன்னல்களை மூடி, காற்றுத் தரம் மேம்படும்போது திறக்கலாம்.'],time:['அடுத்த 24 மணி நேர முன்னறிவிப்பில் குறைந்த மாசுள்ள நேரத்தைப் பாருங்கள்.'],child:['குழந்தைகளின் வழக்கமான செயல்பாட்டில் அறிகுறிகளைக் கவனியுங்கள்.','குழந்தைகளின் வெளிப்புற விளையாட்டைக் குறைத்து உள்ளே விளையாடலாம்.'],pollutant:['முகப்பில் மாசுக் கூறுகளைப் பாருங்கள். முக்கிய மாசுக் கூறு: ']},
 bn:{mask:['বায়ুদূষণের জন্য এখন মাস্ক প্রয়োজন নাও হতে পারে; নিজের সংবেদনশীলতা খেয়াল করুন।','বাইরে কণা থেকে সুরক্ষায় ভালোভাবে ফিট করা N95 বা FFP2 সহায়ক হতে পারে। এটি গ্যাস থেকে সুরক্ষা দেয় না।'],windows:['স্থানীয় পরিস্থিতি অনুযায়ী অল্প সময় বাতাস চলাচল করতে দিন।','দূষণ বেশি হলে জানালা বন্ধ রেখে বায়ুর মান উন্নত হলে খোলার কথা বিবেচনা করুন।'],time:['পরবর্তী ২৪ ঘণ্টার পূর্বাভাসে কম দূষণের সময়টি দেখুন।'],child:['শিশুদের স্বাভাবিক কাজের সময় উপসর্গ খেয়াল করুন।','শিশুদের বাইরের খেলা কমিয়ে ঘরে খেলার কথা বিবেচনা করুন।'],pollutant:['ড্যাশবোর্ডে দূষকের বিবরণ দেখুন। প্রধান দূষক: ']}
};
const known=Object.freeze({mask:true,windows:true,time:true,child:true,pollutant:true,general:true});
function intent(q){return patterns.find(([,re])=>re.test(String(q||'')))?.[0]||'general';}
const unavailableText={en:'AI is unavailable or its response could not be verified. This is limited rule-based guidance, not medical advice.',hi:'एआई उपलब्ध नहीं है या उत्तर सत्यापित नहीं हो सका। यह सीमित नियम आधारित मार्गदर्शन है, चिकित्सा सलाह नहीं।',te:'ఏఐ అందుబాటులో లేదు లేదా జవాబును ధృవీకరించలేకపోయాము. ఇది పరిమిత నియమ ఆధారిత సూచన, వైద్య సలహా కాదు.',ta:'ஏஐ கிடைக்கவில்லை அல்லது பதிலைச் சரிபார்க்க முடியவில்லை. இது வரையறுக்கப்பட்ட விதி சார்ந்த வழிகாட்டுதல், மருத்துவ ஆலோசனை அல்ல.',bn:'এআই উপলব্ধ নয় বা উত্তর যাচাই করা যায়নি। এটি সীমিত নিয়মভিত্তিক নির্দেশনা, চিকিৎসা পরামর্শ নয়।'};
module.exports=(ctx,question,failure='provider_rate_limit')=>{
 const lang=Object.hasOwn(messages,ctx.lang)?ctx.lang:'en',m=messages[lang],topic=intent(question),high=S.effectiveLevel(ctx.aqi,ctx.profile)>=2,childHigh=S.effectiveLevel(ctx.aqi,'child')>=2;
 const dom=Object.hasOwn(S.POLLUTANTS,ctx.dominant)?S.POLLUTANTS[ctx.dominant].name:null;
 let recommendation=m[high?1:0],reason=m[2]+Math.round(ctx.aqi)+' (US AQI).';
 if(topic==='general'&&lang==='en')recommendation=S.advice(ctx.aqi,ctx.profile).go;
 if(lang==='en'){
   const a=S.advice(ctx.aqi,ctx.profile);
   if(topic==='mask')recommendation=(/\b(child|children|kid|baby|infant|toddler)\b/i.test(question)?S.mask(ctx.aqi,'child'):a.mask)+' Respirators do not protect against gases.';
   if(topic==='windows')recommendation=a.windows+' Maintain safe temperature and ventilation.';
   if(topic==='child')recommendation=S.advice(ctx.aqi,'child').exercise+' Watch for symptoms.';
   if(topic==='time')recommendation='Review the next 24 hours and choose a lower-pollution window. If peak pollution remains high, consider indoor activity.';
   if(topic==='pollutant')recommendation=dom?'Modelled dominant pollutant: '+dom+'. See the dashboard for its concentration.':'A dominant pollutant could not be determined; see the dashboard.';
 }else if(topic!=='general'){
   const entries=topicText[lang][topic];if(entries)recommendation=topic==='pollutant'?(dom?entries[0]+dom+'.':entries[0].split(/[:：]/)[0]+'.'):entries[(topic==='child'?childHigh:high)&&entries.length>1?1:0];
 }
 if(topic==='time'&&ctx.window&&typeof ctx.window.start==='string'&&typeof ctx.window.end==='string'&&Number.isFinite(ctx.window.avg))reason+=' '+ctx.window.start.slice(0,16).replace('T',' ')+'–'+ctx.window.end.slice(11,16)+' UTC (US AQI '+ctx.window.avg+').';
 if(lang!=='en'&&topic==='mask'){
 const caveat={hi:'दो वर्ष से कम उम्र के बच्चों को मास्क न पहनाएँ; बड़े बच्चों के लिए सही फिट और वयस्क की निगरानी जरूरी है।',te:'రెండేళ్లలోపు పిల్లలకు మాస్క్ పెట్టవద్దు; పెద్ద పిల్లలకు సరైన ఫిట్, పెద్దల పర్యవేక్షణ అవసరం.',ta:'இரண்டு வயதுக்குக் குறைந்த குழந்தைகளுக்கு முகக்கவசம் அணிவிக்க வேண்டாம்; பெரிய குழந்தைகளுக்கு சரியான பொருத்தமும் பெரியவர் கண்காணிப்பும் தேவை.',bn:'দুই বছরের কম বয়সী শিশুকে মাস্ক পরাবেন না; বড় শিশুদের সঠিক ফিট ও প্রাপ্তবয়স্কের তত্ত্বাবধান প্রয়োজন।'};
 if(ctx.profile==='child'||/\b(child|children|kid|baby|infant|toddler)\b|बच्च|బిడ్డ|పిల్ల|குழந்தை|শিশু|বাচ্চা/iu.test(question))recommendation=caveat[lang];
 }
 if(lang!=='en'&&topic==='windows'){
 const caveat={hi:'सुरक्षित तापमान और वेंटिलेशन बनाए रखें।',te:'సురక్షిత ఉష్ణోగ్రత, గాలి ప్రసరణ ఉండేలా చూసుకోండి.',ta:'பாதுகாப்பான வெப்பநிலையையும் காற்றோட்டத்தையும் பராமரிக்கவும்.',bn:'নিরাপদ তাপমাত্রা ও বায়ুচলাচল বজায় রাখুন।'};recommendation+=' '+caveat[lang];
 }
 return {kind:'air',recommendation,reason,limitation:failure==='provider_rate_limit'?m[3]:unavailableText[lang]};
};
module.exports.intent=intent;
