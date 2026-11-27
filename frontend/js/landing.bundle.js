// Generated from core.js and landing.js. Run npm run sync:landing.
(function(){
  const BANDS = [
    { max: 50, key: 'good', label: 'Good', color: '#2e9e6b', bg: '#e6f6ee', ink: '#1f724d' },
    { max: 100, key: 'moderate', label: 'Moderate', color: '#c9a400', bg: '#fbf6dc', ink: '#7f6700' },
    { max: 150, key: 'usg', label: 'Unhealthy for sensitive groups', color: '#e8801a', bg: '#fdeedd', ink: '#9d560f' },
    { max: 200, key: 'unhealthy', label: 'Unhealthy', color: '#d9453b', bg: '#fbe6e4', ink: '#b2382f' },
    { max: 300, key: 'very', label: 'Very unhealthy', color: '#8e4aa8', bg: '#f1e5f6', ink: '#85459d' },
    { max: Infinity, key: 'hazard', label: 'Hazardous', color: '#7a1f3d', bg: '#f4e1e8', ink: '#7a1f3d' }
  ];
  const PROFILES = {
    general: { name: 'Everyone', shift: 0 },
    asthma: { name: 'Asthma / lung condition', shift: 1 },
    heart: { name: 'Heart condition', shift: 1 },
    child: { name: 'Child', shift: 1 },
    elder: { name: 'Older adult', shift: 1 },
    pregnant: { name: 'Pregnant', shift: 1 },
    athlete: { name: 'Runner / outdoor exercise', shift: 0.5 }
  };

  function band(aqi) {
    if (typeof aqi !== 'number') return null;
    const v = aqi;
    if (!isFinite(v) || v < 0) return null;
    return BANDS.find(b => v <= b.max);
  }
  function bandIndex(aqi) { const b = band(aqi); return b ? BANDS.indexOf(b) : -1; }
  function effectiveLevel(aqi, profile) {
    const p = Object.hasOwn(PROFILES,profile) ? PROFILES[profile] : PROFILES.general;
    const i = bandIndex(aqi); if (i < 0) return -1;
    return Math.min(BANDS.length - 1, Math.round(i + p.shift));
  }

  function bestWindow(hours, len) {
    len = len == null ? 2 : len;
    if (!Array.isArray(hours) || !Number.isInteger(len) || len < 1 || hours.length < len) return null;
    let best = null;
    for (let i = 0; i + len <= hours.length; i++) {
      let sum = 0, ok = true;
      for (let j = 0; j < len; j++) { const v = hours[i + j].aqi; if (!band(v) || (j && plusHour(hours[i+j-1].time) !== hours[i+j].time)) { ok = false; break; } sum += v; }
      if (!ok) continue;
      const avg = sum / len;
      if (!best || avg < best.rawAvg) best = { start: hours[i].time, end: plusHour(hours[i + len - 1].time), avg: Math.round(avg), rawAvg: avg, peak: Math.max(...hours.slice(i,i+len).map(x=>x.aqi)), index: i };
    }
    return best;
  }
  function hourlyFrom(data, fromTime) {
    if (!data || !data.hourly || !Array.isArray(data.hourly.time)) return [];
    const h = data.hourly, out = [];
    for (let i = 0; i < h.time.length; i++) {
      if (fromTime && h.time[i] < fromTime) continue;
      out.push({ time: h.time[i], aqi: h.us_aqi ? h.us_aqi[i] : null, pm2_5: h.pm2_5 ? h.pm2_5[i] : null });
      if (out.length >= 24) break;
    }
    return out;
  }
  function readingAge(data, now=Date.now()) {
    if(!data||!data.current||typeof data.current.time!=='string'||!Number.isFinite(data.utc_offset_seconds))return null;
    const t=Date.parse(data.current.time+'Z')-data.utc_offset_seconds*1000;
    return Number.isFinite(t)?(now-t)/3600000:null;
  }

  function plusHour(t){const d=Date.parse(t+'Z');return isFinite(d)?new Date(d+3600000).toISOString().slice(0,16):t}

  function verdict(aqi,p){
    const l=effectiveLevel(aqi,p);
    return l<0?'No data':l===0?'Good to go outside':l===1?'Fine for most outdoor plans':l===2?'Limit time outside':l===3?'Avoid outdoor exercise':'Stay indoors';
  }


  const S={band,readingAge,verdict,bestWindow,hourlyFrom};
(function () {
'use strict';
const $ = id => document.getElementById(id);
const CITIES = [['Delhi', 28.6139, 77.209], ['Mumbai', 19.076, 72.8777], ['Hyderabad', 17.385, 78.4867], ['Bengaluru', 12.9716, 77.5946], ['Kolkata', 22.5726, 88.3639], ['Chennai', 13.0827, 80.2707]];
const tickerCells=Array.from($('ticker').querySelectorAll('.tk'));
const URL_ = (la, lo, extra) => `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${la}&longitude=${lo}&current=us_aqi${extra || ''}&timezone=auto`;
async function get(u) { const c = new AbortController(), t = setTimeout(() => c.abort(), 10000); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); } }

// Static editorial content is visible without animation or observers.

function paintHero(aqi, win) {
  const b = S.band(aqi); if (!b) return;
  // Scope dynamic color changes to the reading, not the whole page.
  $('hAqi').style.color=b.ink;
  $('hAqi').textContent = Math.round(aqi); $('hLabel').textContent = b.label; $('hVerdict').textContent = S.verdict(aqi, 'asthma');
  if (win) $('hWin').textContent = win.start.slice(11, 16) + '–' + win.end.slice(11, 16);
}
async function cityReading(c,i){
  try {const d=await get(URL_(c[1],c[2],i===0?'&hourly=us_aqi&forecast_days=2':''));const age=S.readingAge(d);if(age===null||age>3||age< -1||!S.band(d.current.us_aqi))return null;if(i===0)paintHero(d.current.us_aqi,S.bestWindow(S.hourlyFrom(d,d.current.time),2));return {name:c[0],aqi:d.current.us_aqi};}catch(_){return null;}
}
let heroReading=null;
const loadHero=()=>heroReading||(heroReading=cityReading(CITIES[0],0));
if('IntersectionObserver'in window){const heroObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){heroObserver.disconnect();loadHero();}},{rootMargin:'160px'});heroObserver.observe($('hAqi'));}else loadHero();
let started=false;
async function run(){
  if(started)return;started=true;
  const out=[await loadHero()];
  // Limit concurrent provider requests to two and update the ticker once.
  for(let i=1;i<CITIES.length;i+=2)out.push(...await Promise.all(CITIES.slice(i,i+2).map((c,j)=>cityReading(c,i+j))));
  const ok=out.filter(x=>x&&S.band(x.aqi));
  out.forEach((x,i)=>{const cell=tickerCells[i],b=x&&S.band(x.aqi);if(!cell)return;const number=cell.querySelector('b'),label=cell.querySelector('span');if(!number||!label)return;number.textContent=b?Math.round(x.aqi):'—';label.textContent=b?b.label:'Unavailable';if(b){cell.style.setProperty('--c',b.color);number.style.color=b.ink;}});

  $('tickNote').textContent=ok.length?'Modelled estimates from Open-Meteo / CAMS, refreshed when you open the page. Not a street monitor.':'Live readings are unavailable right now. Open the app to try again.';
}
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){observer.disconnect();run();}},{rootMargin:'80px'});observer.observe($('ticker'));}else run();

})();

})();
