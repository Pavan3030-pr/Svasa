(function () {
'use strict';
const S = window.Svasa, $ = id => document.getElementById(id);
const CITIES = [['Delhi', 28.6139, 77.209], ['Mumbai', 19.076, 72.8777], ['Hyderabad', 17.385, 78.4867], ['Bengaluru', 12.9716, 77.5946], ['Kolkata', 22.5726, 88.3639], ['Chennai', 13.0827, 80.2707]];
// Keep optional preview work off the critical render path. Start when visible and idle;
// the timeout ensures that continuous interaction cannot starve the live preview.
const idle=fn=>{if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(fn,{timeout:1000});else setTimeout(fn,0);};
let tickerCells=null;
const getTickerCells=()=>tickerCells||(tickerCells=Array.from($('ticker').querySelectorAll('.tk')));
const URL_ = (la, lo, extra) => `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${la}&longitude=${lo}&current=us_aqi${extra || ''}&timezone=auto`;
async function get(u) { const c = new AbortController(), t = setTimeout(() => c.abort(), 10000); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); } }
function reading(d){
 const age=S.readingAge(d);return age!==null&&age<=3&&age>=-1&&S.band(d?.current?.us_aqi)?d.current.us_aqi:null;
}
function paintHero(aqi, win) {
  const b = S.band(aqi);
  $('hAqi').textContent=b?Math.round(aqi):'—';
  $('hLabel').textContent=b?b.label:'Unavailable';
  $('hVerdict').textContent=b?S.verdict(aqi,'asthma'):'Live data unavailable';
  $('hWin').textContent=win?win.start.slice(11,16)+'–'+win.end.slice(11,16):'—';
  if(b)$('hAqi').style.color=b.ink;
}
function paintCell(i,aqi){
 const cell=getTickerCells()[i],b=S.band(aqi);if(!cell)return;
 const number=cell.querySelector('b'),label=cell.querySelector('span');
 number.textContent=b?Math.round(aqi):'—';label.textContent=b?b.label:'Unavailable';
 if(b){cell.style.setProperty('--c',b.color);number.style.color=b.ink;}
}
let heroReading=null;
function loadHero(){
 if(heroReading)return heroReading;
 heroReading=(async()=>{let aqi=null,win=null;
 try{const d=await get(URL_(CITIES[0][1],CITIES[0][2],'&hourly=us_aqi&forecast_days=2'));aqi=reading(d);if(aqi!==null)win=S.bestWindow(S.hourlyFrom(d,d.current.time),2);}catch(_){}
 paintHero(aqi,win);paintCell(0,aqi);return aqi;})();
 return heroReading;
}
if('IntersectionObserver'in window){const heroObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){heroObserver.disconnect();idle(loadHero);}},{rootMargin:'0px'});heroObserver.observe($('hAqi'));}else loadHero();
let started=false;
async function run(){
 if(started)return;started=true;
 // One request for the remaining five cities. Model grid centres can differ from requested coordinates;
 // validate proximity before assigning a returned value to a city.
 const cities=CITIES.slice(1),matches=(d,c)=>Number.isFinite(d?.latitude)&&Number.isFinite(d?.longitude)&&Math.abs(d.latitude-c[1])<=1.5&&Math.abs(d.longitude-c[2])<=1.5;
 const other=(async()=>{let rows=[];try{const d=await get(URL_(cities.map(c=>c[1]).join(','),cities.map(c=>c[2]).join(','),'&forecast_days=1'));if(Array.isArray(d))rows=d;}catch(_){}
 const values=cities.map(c=>{const d=rows.find(r=>matches(r,c));return reading(d);});
 // A failed batch is reported honestly; use no stale or invented readings.
 values.forEach((v,i)=>paintCell(i+1,v));return values;})();
 const [hero,rest]=await Promise.all([loadHero(),other]);
 const count=[hero,...rest].filter(v=>v!==null).length;
 $('tickNote').textContent=count?count+' of 6 cities reporting · Modelled estimates from Open-Meteo / CAMS. Not street-monitor readings.':'Live readings are unavailable right now. Open the app to try again.';
}
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){observer.disconnect();idle(run);}},{rootMargin:'0px'});observer.observe($('ticker'));}else run();
})();
