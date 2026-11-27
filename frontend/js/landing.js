(function () {
'use strict';
const S = window.Svasa, $ = id => document.getElementById(id);
const CITIES = [['Delhi', 28.6139, 77.209], ['Mumbai', 19.076, 72.8777], ['Hyderabad', 17.385, 78.4867], ['Bengaluru', 12.9716, 77.5946], ['Kolkata', 22.5726, 88.3639], ['Chennai', 13.0827, 80.2707]];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const URL_ = (la, lo, extra) => `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${la}&longitude=${lo}&current=us_aqi${extra || ''}&timezone=auto`;
async function get(u) { const c = new AbortController(), t = setTimeout(() => c.abort(), 10000); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); } }

// Static editorial content is visible without animation or observers.

function paintHero(aqi, win) {
  const b = S.band(aqi); if (!b) return;
  document.documentElement.style.setProperty('--c', b.ink); document.documentElement.style.setProperty('--t', b.bg);
  $('hAqi').textContent = Math.round(aqi); $('hLabel').textContent = b.label; $('hVerdict').textContent = S.verdict(aqi, 'asthma');
  if (win) $('hWin').textContent = win.start.slice(11, 16) + '–' + win.end.slice(11, 16);
}
async function cityReading(c,i){
  try {const d=await get(URL_(c[1],c[2],i===0?'&hourly=us_aqi&forecast_days=2':''));const age=S.readingAge(d);if(age===null||age>3||age< -1||!S.band(d.current.us_aqi))return null;if(i===0)paintHero(d.current.us_aqi,S.bestWindow(S.hourlyFrom(d,d.current.time),2));return {name:c[0],aqi:d.current.us_aqi};}catch(_){return null;}
}
const heroReading=cityReading(CITIES[0],0);
let started=false;
async function run(){
  if(started)return;started=true;
  const out=await Promise.all([heroReading,...CITIES.slice(1).map((c,i)=>cityReading(c,i+1))]);
  const ok=out.filter(x=>x&&S.band(x.aqi));
  $('ticker').innerHTML=CITIES.map((city,i)=>{const x=out[i],b=x&&S.band(x.aqi);return b?`<div class="tk" style="--c:${b.color}"><small>${esc(x.name)}</small><b style="color:${b.ink}">${Math.round(x.aqi)}</b><span>${esc(b.label)}</span></div>`:`<div class="tk"><small>${esc(city[0])}</small><b>—</b><span>Unavailable</span></div>`;}).join('');
  $('tickNote').textContent=ok.length?'Modelled estimates from Open-Meteo / CAMS, refreshed when you open the page. Not a street monitor.':'Live readings are unavailable right now. Open the app to try again.';
}
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){observer.disconnect();run();}},{rootMargin:'240px'});observer.observe($('ticker'));}else run();

})();
