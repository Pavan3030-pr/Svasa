
const S=window.Svasa,$=id=>document.getElementById(id);
const st={profile:'general',place:null,data:null,demo:false};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const AQ='https://air-quality-api.open-meteo.com/v1/air-quality';
async function jget(u){const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
function demo(){const time=[],us=[],pm=[];const d=new Date();const day=d.toISOString().slice(0,10);
 for(let i=0;i<48;i++){const h=i%24;time.push(day+'T'+String(h).padStart(2,'0')+':00');us.push(Math.round(95+55*Math.sin((h-4)/24*6.28)));pm.push(40+25*Math.sin((h-4)/24*6.28))}
 return{current:{time:day+'T12:00',us_aqi:132,pm2_5:48.2,pm10:90,nitrogen_dioxide:38,ozone:72,sulphur_dioxide:12,carbon_monoxide:610,us_aqi_pm2_5:132,us_aqi_pm10:70,us_aqi_nitrogen_dioxide:30,us_aqi_ozone:55,us_aqi_sulphur_dioxide:8,us_aqi_carbon_monoxide:7},hourly:{time,us_aqi:us,pm2_5:pm}}}
async function load(p){
 st.place=p;$('hero').classList.add('skeleton');$('err').hidden=true;
 try{const u=AQ+`?latitude=${p.lat}&longitude=${p.lon}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide&hourly=us_aqi,pm2_5&forecast_days=2&past_days=7&timezone=auto`;
  st.data=await jget(u);st.demo=false;if(!st.data.current||st.data.current.us_aqi==null)throw new Error('No data for this location yet');st.stale=null;try{localStorage.setItem('svasa_snap_'+p.name,JSON.stringify({at:Date.now(),data:st.data}))}catch(_){}}
 catch(e){let snap=null;try{snap=JSON.parse(localStorage.getItem('svasa_snap_'+p.name))}catch(_){}
  if(snap&&snap.data){st.data=snap.data;st.demo=false;st.stale=snap.at;$('err').hidden=false;$('err').textContent='Live data is unavailable. Showing the last saved reading from '+new Date(snap.at).toLocaleString()+'.'}
  else{st.data=demo();st.demo=true;$('err').hidden=false;$('err').textContent='Live data is unavailable ('+e.message+'). Showing sample data so you can explore the app.'}}
 try{localStorage.setItem('svasa',JSON.stringify({p,profile:st.profile}))}catch(_){}
 await loadWx(p);render()}
function render(){
 const c=st.data.current,aqi=c.us_aqi,b=S.band(aqi),a=S.advice(aqi,st.profile),dom=S.dominant(c);
 const root=document.documentElement.style;root.setProperty('--c',b.color);root.setProperty('--t',b.bg);
 const hrs=S.hourlyFrom(st.data,c.time),win=S.bestWindow(hrs,2);st.ctx={aqi,profile:st.profile,dominant:dom,window:win};
 $('hero').classList.remove('skeleton');
 $('hero').innerHTML=`<div class="dial" style="--p:${Math.min(100,aqi/3)}" role="img" aria-label="AQI ${Math.round(aqi)}"><div><b>${Math.round(aqi)}</b><span>US AQI</span></div></div>
 <div><span class="eyebrow">${esc(st.place.name)}</span><h2>${b.label}</h2><p>${esc(a.go)} ${dom?`Main driver is ${S.POLLUTANTS[dom].name}.`:''}</p>${win?`<span class="pill">Cleanest hours ${win.start.slice(11,16)}–${win.end.slice(11,16)}</span>`:''}${(()=>{const n=S.indiaAqi(c);return n?`<p class="meta">India NAQI (estimate): <b>${n.aqi}</b> · ${esc(n.label)}</p>`:''})()}<p class="meta">Updated ${esc(c.time.replace('T',' '))} local time${st.demo?' · sample data':''}</p></div>`;
 const rows=[['Going out',a.go],['Exercise',a.exercise],['Mask',a.mask],['Windows',a.windows],['Air purifier',a.purifier],...S.tips(st.profile,aqi).map(x=>['For you',x])];
 $('adv').innerHTML=rows.map(r=>`<div class="adv"><h3>${r[0]}</h3><p>${esc(r[1])}</p></div>`).join('');
 $('alert').innerHTML=a.symptoms?`<div class="alert" role="alert">${esc(a.symptoms)}</div>`:'';
 $('win').textContent=win?`Cleanest 2 hours: ${win.start.slice(11,16)}–${win.end.slice(11,16)} (AQI about ${win.avg}). Best for a walk or run.`:'No hourly forecast available.';
 chart(hrs,win);
 const keys=['pm2_5','pm10','nitrogen_dioxide','ozone','sulphur_dioxide','carbon_monoxide'];
 $('pol').innerHTML=keys.filter(k=>typeof c[k]==='number').map(k=>{const P=S.POLLUTANTS[k],r=S.whoRatio(k,c[k]),pct=Math.min(100,(r/4)*100);
  return`<div class="pol ${k===dom?'dom':''}"><b>${P.name}</b><div class="bar" role="img" aria-label="${r} times WHO guideline"><i style="width:${pct}%"></i></div><small>${c[k].toFixed(1)} ${P.unit} · ${r}× WHO</small><span class="note">${esc(P.note)}</span></div>`}).join('');
 $('reply').textContent='Pick a question or type your own.';
 const tr=S.trend(hrs);st.ctx.trend=tr;st.ctx.city=st.place.name;st.ctx.wx=st.wx;
 const wn=S.windNote(st.wx&&st.wx.w,aqi),arrow={rising:'↗ rising',falling:'↘ falling',steady:'→ steady'}[tr];
 $('live').innerHTML=`<span style="color:${st.demo?'#c9a400':'#2e9e6b'}">●</span> ${st.demo?'Sample data':(st.stale?'Offline snapshot':'Live, refreshes every 5 min')} · Trend: ${arrow}`+(st.wx&&st.wx.t!=null?` · ${st.wx.t}°C, ${st.wx.h}% humidity, wind ${st.wx.w} km/h`:'')+(wn?` · ${esc(wn)}`:'');
 $('aimode').textContent=st.serverAI?'Gemini on':'Rule-based answers';
 const days=S.dailyAvg(st.data).slice(-8),ins=S.insights(days);
 const vw=S.vsWeek(days,c.time.slice(0,10));$('histtxt').textContent=ins?`Best day ${ins.best.date} (AQI ${ins.best.avg}), worst ${ins.worst.date} (AQI ${ins.worst.avg}). ${ins.over} of ${days.length} days averaged above 100.`+(vw===null?'':` Today is ${Math.abs(vw)}% ${vw>=0?'higher':'lower'} than the average of the previous days.`):'No history available.';
 $('hist').innerHTML=`<svg width="${Math.max(480,days.length*64)}" height="170" role="img" aria-label="Daily average AQI for the last days">`+days.map((d,i)=>{const bh=Math.max(3,d.avg/Math.max(150,...days.map(x=>x.avg))*110),bb=S.band(d.avg);return`<g><title>${d.date} AQI ${d.avg}</title><rect x="${i*64+8}" y="${130-bh}" width="46" height="${bh}" rx="5" fill="${bb.color}"/><text x="${i*64+31}" y="${124-bh}" text-anchor="middle">${d.avg}</text><text x="${i*64+31}" y="150" text-anchor="middle">${esc(d.date.slice(5))}</text></g>`}).join('')+'</svg>'
 notifyCheck(aqi)}
function chart(h,win){if(!h.length){$('chart').innerHTML='';return}
 const W=Math.max(640,h.length*26),H=190,max=Math.max(150,...h.map(x=>x.aqi||0));
 const bars=h.map((x,i)=>{const bh=Math.max(2,(x.aqi/max)*(H-40)),bb=S.band(x.aqi),inw=win&&i>=win.index&&i<win.index+2;
  return`<g><title>${x.time.slice(11,16)} AQI ${x.aqi}</title><rect x="${i*26+4}" y="${H-24-bh}" width="20" height="${bh}" rx="4" fill="${bb.color}" ${inw?'stroke="#14302f" stroke-width="2.5"':''}/>${i%3==0?`<text x="${i*26+14}" y="${H-6}" text-anchor="middle">${x.time.slice(11,13)}</text>`:''}</g>`}).join('');
 $('chart').innerHTML=`<svg width="${W}" height="${H}" role="img" aria-label="Hourly AQI forecast; outlined bars mark the cleanest window">${bars}<text x="6" y="12">Now</text></svg>`+'<div class="legend">'+S.BANDS.map(b=>'<span><i style="background:'+b.color+'"></i>'+b.label+'</span>').join('')+'</div>'}
// search
let tm;async function suggest(v){v=S.cleanQuery(v);const s=$('sugg');if(v.length<2){s.hidden=true;return}
 try{const r=await jget('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name='+encodeURIComponent(v));
  const res=r.results||[];s.hidden=!res.length;s.innerHTML=res.map((x,i)=>`<button type="button" data-i="${i}">${esc(x.name)}${x.admin1?', '+esc(x.admin1):''}, ${esc(x.country||'')}</button>`).join('');
  s.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{const x=res[btn.dataset.i];pick(x)})}catch(_){s.hidden=true}}
function pick(x){$('sugg').hidden=true;$('q').value=x.name;load({name:x.name+(x.country?', '+x.country:''),lat:x.latitude,lon:x.longitude})}
$('q').addEventListener('input',e=>{clearTimeout(tm);tm=setTimeout(()=>suggest(e.target.value),250)});
$('f').addEventListener('submit',async e=>{e.preventDefault();const v=S.cleanQuery($('q').value);if(!v)return;
 try{const r=await jget('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name='+encodeURIComponent(v));
  if(r.results&&r.results[0])pick(r.results[0]);else{$('err').hidden=false;$('err').textContent='No city found for “'+v+'”. Check the spelling or try a larger nearby city.'}}
 catch(_){$('err').hidden=false;$('err').textContent='Search needs an internet connection. Check your network and try again.'}});
$('loc').onclick=()=>{if(!navigator.geolocation){$('err').hidden=false;$('err').textContent='Location is not supported in this browser. Search for a city instead.';return}
 navigator.geolocation.getCurrentPosition(p=>load({name:'Your location',lat:p.coords.latitude,lon:p.coords.longitude}),()=>{$('err').hidden=false;$('err').textContent='Location permission was denied. Search for a city instead.'},{timeout:8000})};
// profile chips
$('chips').innerHTML=Object.entries(S.PROFILES).map(([k,v])=>`<button type="button" class="chip" data-k="${k}" aria-pressed="${k==='general'}">${v.name}</button>`).join('');
$('chips').onclick=e=>{const k=e.target.dataset&&e.target.dataset.k;if(!k)return;st.profile=k;[...$('chips').children].forEach(c=>c.setAttribute('aria-pressed',c.dataset.k===k));if(st.data)render()};
// ask
const QS=['Can I run outside?','Do I need a mask?','When is the best time to go out?','Should I open windows?','Is it safe for my child?','What is polluting the air?'];
$('qs').innerHTML=QS.map(q=>`<button type="button" class="chip">${q}</button>`).join('');
let busy=false;
const pay=()=>{const c=st.ctx;return{aqi:c.aqi,city:c.city,profile:c.profile,dominant:c.dominant,trend:c.trend,window:c.window,wx:c.wx,lang:st.lang,hist:st.hist||[]}};
async function viaServer(q){const r=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q,ctx:pay()})});if(!r.ok)throw new Error('server '+r.status);return(await r.json()).answer}
const ask=async q=>{const sf=S.safety(q);if(sf){$('reply').textContent=sf;return}
 const fb=S.answer(q,st.data?st.ctx:null);if(!st.data||busy){$('reply').textContent=fb;return}
 busy=true;$('reply').textContent='Thinking…';
 let a=null;
 if(location.protocol.startsWith('http')){try{a=await viaServer(q)}catch(_){}}
 $('reply').textContent=a||fb;st.hist=(st.hist||[]).concat([{r:'u',t:q},{r:'a',t:a||fb}]).slice(-8);busy=false};
st.lang='en';$('lang').innerHTML=Object.entries(S.LANGS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$('lang').onchange=e=>{st.lang=e.target.value};
$('plan').onclick=()=>{if(!st.data)return;const hrs=S.hourlyFrom(st.data,st.data.current.time),len=+$('dur').value,p=S.planTrip(hrs,len,+$('from').value,+$('to').value);
 $('planout').textContent=!p?'No clean slot fits inside that time range. Try widening it.':(p.win.index===0?`Go now. The next ${len} hour(s) are already the cleanest (AQI about ${p.win.avg}).`:`Start at ${p.win.start.slice(11,16)} (finish by ${p.win.end.slice(11,16)}). AQI about ${p.win.avg} instead of ${p.now} if you go now, ${p.savedPct}% lower.`)};
async function loadWx(p){try{const r=await jget(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`);const c=r.current;st.wx={t:Math.round(c.temperature_2m),h:Math.round(c.relative_humidity_2m),w:Math.round(c.wind_speed_10m)}}catch(_){st.wx=null}}
// compare
let cmp=[];try{cmp=JSON.parse(localStorage.getItem('svasa_cmp'))||[]}catch(_){}
async function drawCmp(){const out=[];for(const p of cmp){try{const r=await jget(AQ+`?latitude=${p.lat}&longitude=${p.lon}&current=us_aqi,pm2_5`);out.push({name:p.name,aqi:r.current.us_aqi,pm:r.current.pm2_5,p})}catch(_){}}
 const rk=S.rank(out);$('cmp').innerHTML=rk.length?rk.map((x,i)=>{const b=S.band(x.aqi);return`<div class="cmprow"><button type="button" class="ghost" data-go="${i}">${esc(x.name)}</button><div class="bar" role="img" aria-label="AQI ${Math.round(x.aqi)}"><i style="width:${Math.min(100,x.aqi/3)}%;background:${b.color}"></i></div><b style="color:${b.color}">${Math.round(x.aqi)}</b><small>${b.label}${typeof x.pm==='number'?' · PM2.5 '+x.pm.toFixed(0):''}</small><button type="button" class="ghost" data-rm="${i}" aria-label="Remove ${esc(x.name)}">✕</button></div>`}).join(''):'<p class="meta">No cities added yet.</p>';
 $('cmp').onclick=e=>{const t=e.target;if(t.dataset.go!==undefined)load(rk[t.dataset.go].p);if(t.dataset.rm!==undefined){cmp=cmp.filter(c=>c.name!==rk[t.dataset.rm].name);try{localStorage.setItem('svasa_cmp',JSON.stringify(cmp))}catch(_){}drawCmp()}}}
$('addc').onclick=()=>{if(!st.place||st.demo||cmp.some(c=>c.name===st.place.name))return;cmp=cmp.slice(-5).concat([st.place]);try{localStorage.setItem('svasa_cmp',JSON.stringify(cmp))}catch(_){}drawCmp()};
$('clrc').onclick=()=>{cmp=[];try{localStorage.removeItem('svasa_cmp')}catch(_){}drawCmp()};
// alerts
let lastLvl=null,alertsOn=false;
$('notif').onclick=async()=>{if(!('Notification' in window)){$('notif').textContent='Alerts unsupported';return}const p=await Notification.requestPermission();alertsOn=p==='granted';$('notif').textContent=alertsOn?'Alerts on (keep tab open)':'Alerts blocked'};
function notifyCheck(aqi){const l=S.effectiveLevel(aqi,st.profile),thr=+($('thr').value||2);if(alertsOn&&lastLvl!==null&&l!==lastLvl&&(l>=thr||lastLvl>=thr))show('Air quality '+(l>lastLvl?'worsened':'improved')+' in '+st.place.name,'AQI '+Math.round(aqi)+': '+S.band(aqi).label+(l>lastLvl?'. '+S.advice(aqi,st.profile).go:''));lastLvl=l}
async function show(t,b){try{const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg)return await reg.showNotification(t,{body:b,icon:'icon.svg',tag:'svasa'});new Notification(t,{body:b})}catch(_){}}
drawCmp();
fetch('/api/health').then(r=>r.json()).then(j=>{st.serverAI=!!j.ai;if(st.data&&st.serverAI)$('aimode').textContent='Gemini on'}).catch(()=>{});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
$('qs').onclick=e=>{if(e.target.tagName==='BUTTON')ask(e.target.textContent)};
$('af').onsubmit=e=>{e.preventDefault();ask($('aq').value)};
$('share').onclick=async()=>{if(!st.data)return;const c=st.data.current,t=`${st.place.name}: AQI ${Math.round(c.us_aqi)} (${S.band(c.us_aqi).label}). ${S.advice(c.us_aqi,st.profile).go} via Svasa`;
 try{await navigator.clipboard.writeText(t);$('share').textContent='Copied'}catch(_){$('share').textContent='Copy failed'}setTimeout(()=>$('share').textContent='Copy summary',1800)};
setInterval(()=>{if(st.place&&!document.hidden)load(st.place)},5*60*1000);
// boot
let saved=null;try{saved=JSON.parse(localStorage.getItem('svasa'))}catch(_){}
if(saved&&saved.p){if(S.PROFILES[saved.profile]){st.profile=saved.profile;[...$('chips').children].forEach(c=>c.setAttribute('aria-pressed',c.dataset.k===st.profile))}load(saved.p)}
else load({name:'Delhi, India',lat:28.6139,lon:77.209});

for(let i=0;i<24;i++)$('from').add(new Option(String(i).padStart(2,'0')+':00',i));
for(let i=1;i<=24;i++)$('to').add(new Option(String(i%24).padStart(2,'0')+':00',i));
$('from').value=5;$('to').value=23;
let dp;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('inst').hidden=false});
$('inst').onclick=async()=>{if(dp){dp.prompt();dp=null;$('inst').hidden=true}};
