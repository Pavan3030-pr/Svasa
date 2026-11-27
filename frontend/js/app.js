(function () {
'use strict';
const S = window.Svasa, $ = id => document.getElementById(id);
const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const WX = 'https://api.open-meteo.com/v1/forecast';
const VIEWS = ['today', 'hourly', 'plan', 'cities', 'breathe', 'ask', 'family', 'reports'];
const st = { profile: 'general', place: null, data: null, wx: null, demo: false, stale: null, ctx: null, lang: 'en', hist: [], serverAI: false };
let capabilities=null;
let busy = false, cmp = [], lastLvl = null, alertsOn = false, deferredInstall = null, suggTimer;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
};
async function jget(u, timeout=8000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
function banner(msg) { const b = $('banner'); b.classList.toggle('neutral',!msg); b.textContent = msg || 'Modelled air-quality estimates, not street-monitor readings.'; }
const legend = () => '<div class="legend">' + S.BANDS.map(b => `<span><i style="background:${b.color}"></i>${b.label}</span>`).join('') + '</div>';

/* ---------- data ---------- */
function demo() {
  const time = [], us = [], pm = [], day = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 48; i++) { const h = i % 24, w = Math.sin((h - 4) / 24 * 6.28); time.push(day + 'T' + String(h).padStart(2, '0') + ':00'); us.push(Math.round(95 + 55 * w)); pm.push(40 + 25 * w); }
  return { current: { time: day + 'T12:00', us_aqi: 132, pm2_5: 48.2, pm10: 90, nitrogen_dioxide: 38, ozone: 72, sulphur_dioxide: 12, carbon_monoxide: 610, us_aqi_pm2_5: 132, us_aqi_pm10: 70, us_aqi_nitrogen_dioxide: 30, us_aqi_ozone: 55, us_aqi_sulphur_dioxide: 8, us_aqi_carbon_monoxide: 7 }, hourly: { time, us_aqi: us, pm2_5: pm } };
}
let loadSequence = 0, historyReading=null, historyRequest=null;
const snapKey=p=>'svasa_snap_v2_'+Number(p.lat).toFixed(4)+','+Number(p.lon).toFixed(4);
async function load(p) {
  const seq = ++loadSequence;historyReading=null;historyRequest=null;
  if (!st.place || st.place.lat !== p.lat || st.place.lon !== p.lon) { st.hist = []; lastLvl = null; }
  st.ctx = null; st.data = null; invalidatePlan(); $('dayresult').textContent = 'Refresh the plan after the forecast loads.'; $('familyresults').textContent = 'Loading current air data…';
  $('gcard').hidden = false; $('gs').textContent='Monitoring station details appear when available.';
  $('aqiring').classList.add('loadingring');$('aqiring').setAttribute('aria-label','Air quality loading');$('aqiring').style.setProperty('--p',0);$('aqivalue').textContent='—';$('aqimeta').textContent='Retrieving model data';$('aqiverdict').textContent='Checking the air';$('aqilead').textContent='Loading current air data…';$('aqichips').innerHTML='<span class="chip2">Modelled data · Open-Meteo</span>';$('goplan').disabled=true;$('share').disabled=true;
  $('adv').textContent='Loading current guidance…';$('alert').textContent='';$('pol').textContent='Loading pollutant readings…';$('strip').textContent='Loading hourly forecast…';$('win').textContent='Loading forecast…';$('chart').textContent='';$('hist').textContent='';$('histtxt').textContent='Loading history…';$('disp').textContent='';st.hrs=[];
  st.place = p; pushRecent(p); $('q').value = ''; $('city').textContent = p.name; $('v-today').classList.add('loading'); banner('');
  st.wx=null;
  const cur = 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide';
  try {
    const d = await jget(`${AQ}?latitude=${p.lat}&longitude=${p.lon}&current=${cur}&hourly=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide&forecast_days=2&past_days=1&timezone=auto`);
    if (seq !== loadSequence) return;
    if (!d.current || !S.band(d.current.us_aqi)) throw new Error('No data for this location yet');
    const age=S.readingAge(d);if(age===null||age>3||age< -1)throw new Error('Provider reading is stale or has no valid timestamp');
    st.data = d; st.demo = false; st.stale = null; store.set(snapKey(p), { at: Date.now(), data: d });
  } catch (e) {
    if (seq !== loadSequence) return;
    const snap = store.get(snapKey(p), null);
    if (snap && snap.data) { st.data = snap.data; st.demo = false; st.stale = snap.at; banner('Offline. Showing the last saved reading from ' + new Date(snap.at).toLocaleString() + '.'); }
    else { st.data = demo(); st.demo = true; st.stale = null; banner('Live data is unavailable (' + e.message + '). Showing sample data.'); }
  }
  if (seq !== loadSequence) return;
  store.set('svasa_last', { p, profile: st.profile });
  $('v-today').classList.remove('loading');
  render(); loadStation();
  if(location.hash==='#cities')drawCities();
  const w=await jget(`${WX}?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`,5000).then(x=>x.current).catch(()=>null);
  if(seq!==loadSequence||!w||![w.temperature_2m,w.relative_humidity_2m,w.wind_speed_10m].every(Number.isFinite))return;
  st.wx={t:Math.round(w.temperature_2m),h:Math.round(w.relative_humidity_2m),w:Math.round(w.wind_speed_10m)};
  if(st.ctx)st.ctx.wx=st.wx;
  drawDisp(); const chip=$('weatherchip');if(chip){chip.hidden=false;chip.textContent=st.wx.t+'°C · '+st.wx.h+'% · '+st.wx.w+' km/h';}
}

/* ---------- render ---------- */
function render() {
  const c = st.data.current, aqi = c.us_aqi, b = S.band(aqi), a = S.advice(aqi, st.profile), dom = S.dominant(c);
  const hrs = S.hourlyFrom(st.data, c.time), win = S.bestWindow(hrs, 2), tr = S.trend(hrs);
  const root = document.querySelector('.main').style; root.setProperty('--c', b.color); root.setProperty('--t', b.bg); root.setProperty('--ci', b.ink);
  st.ctx = { aqi, profile: st.profile, dominant: dom, window: win, trend: tr, city: st.place.name, wx: st.wx };

  const ind = !st.demo&&!st.stale?S.indiaModel24(st.data,c.time):null, wn = S.windNote(st.wx && st.wx.w, aqi);
  const status = st.demo ? 'Sample data' : st.stale ? 'Offline snapshot' : 'Live';
  const trendLabel = { rising: '↗ Worsening', falling: '↘ Improving', steady: '→ Steady' }[tr];
  const ring=$('aqiring');ring.classList.remove('loadingring');ring.setAttribute('aria-label','US AQI '+Math.round(aqi));ring.style.setProperty('--p',Math.min(100,aqi/3));$('aqivalue').textContent=Math.round(aqi);
  $('aqimeta').textContent=st.place.name+' · '+status+' · '+c.time.replace('T',' ');
  $('aqiverdict').textContent=b.label+' · '+(st.demo||st.stale?'Reference only · not current':S.verdict(aqi,st.profile));
  $('aqilead').textContent=(st.demo||st.stale?'Current guidance is unavailable.':a.go)+(dom?' Main driver: '+S.POLLUTANTS[dom].name+'.':'')+(wn?' '+wn:'');
  $('aqichips').innerHTML=`<span class="chip2">${trendLabel}</span><span class="chip2" title="Modelled estimate, not a street monitor">Modelled data · Open-Meteo</span>${ind?`<span class="chip2" title="Partial model-based estimate using ${ind.pollutants.length} of eight pollutants, not official CPCB AQI">India scale (partial) ${ind.aqi} · ${esc(ind.label)}</span>`:''}${win?`<span class="chip2">Cleanest ${win.start.slice(11,16)}–${win.end.slice(11,16)}</span>`:''}<span class="chip2" id="weatherchip"${st.wx?'':' hidden'}>${st.wx?`${st.wx.t}°C · ${st.wx.h}% · ${st.wx.w} km/h`:''}</span>`;
  $('goplan').disabled=!!(st.demo||st.stale);$('share').disabled=false;
  $('goplan').onclick = () => show('plan');
  $('share').onclick = async () => {
    const t = `${st.place.name} (${status}): AQI ${Math.round(aqi)} (${b.label}). ${st.demo || st.stale ? 'Reference only.' : a.go} via Svasa`;
    try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); $('share').textContent = 'Copied'; setTimeout(() => { const s = $('share'); if (s) s.textContent = 'Share'; }, 1500); } } catch (_) {}
  };

  const rows = st.demo || st.stale ? [['Data unavailable', 'Current recommendations require fresh live data. Values above are for reference only.']] : [['Going out', a.go], ['Exercise', a.exercise], ['Mask', a.mask], ['Windows', a.windows], ['Air purifier', a.purifier], ...S.tips(st.profile, aqi).map(x => ['For you', x])];
  $('adv').innerHTML = rows.map(r => `<div class="tile"><h3>${esc(r[0])}</h3><p>${esc(r[1])}</p></div>`).join('');
  $('alert').innerHTML = !st.demo && !st.stale && a.symptoms ? `<div class="alert" role="alert">${esc(a.symptoms)}</div>` : '';

  const keys = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'sulphur_dioxide', 'carbon_monoxide'];
  $('pol').innerHTML = keys.filter(k => typeof c[k] === 'number').map(k => {
    const P = S.POLLUTANTS[k], mean=(!st.demo&&!st.stale&&['pm2_5','pm10','nitrogen_dioxide','sulphur_dioxide','carbon_monoxide'].includes(k))?S.historicalMean(st.data,k,c.time,24):null;
    return `<div class="pol ${k === dom ? 'dom' : ''}"><b>${P.name}</b><small>${c[k].toFixed(1)} ${P.unit} · model estimate</small><span class="note">${esc(P.note)}${mean?' · 24h model mean '+mean.mean.toFixed(1)+' '+P.unit+'; '+S.whoRatio(k,mean.mean)+'× WHO 24h guideline':''}</span></div>`;
  }).join('');

  $('win').textContent = win ? `Cleanest 2 hours: ${win.start.slice(11, 16)}–${win.end.slice(11, 16)} (AQI ~${win.avg})` : 'No forecast available';
  st.hrs = hrs; drawStrip(hrs); drawDisp(); if(location.hash==='#hourly'){drawChart(hrs,win);loadHistory();}
  $('btip').textContent = st.demo || st.stale ? 'Air quality is not current. Do not use these readings to decide where to exercise.' : S.effectiveLevel(aqi, st.profile) >= 2 ? `Air is poor right now (AQI ${Math.round(aqi)}). Practise indoors with windows closed.` : `Air is fine right now (AQI ${Math.round(aqi)}). Practise anywhere you feel calm.`;
  if (!st.demo && !st.stale) notifyCheck(aqi);
  if(location.hash==='#family')renderFamily(); if(location.hash==='#plan')renderActivityTimes();
}
function drawChart(h, win) {
  if (!h.length) { $('chart').innerHTML = '<p class="muted">No hourly forecast available.</p>'; return; }
  const L = 34, W = Math.max(680, h.length * 26 + L + 8), H = 220, top = 18, base = H - 28;
  const max = Math.max(150, ...h.map(x => x.aqi || 0)), Y = v => base - v / max * (base - top);
  const grid = [50, 100, 150, 200, 300].filter(v => v <= max).map(v => `<line x1="${L}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e4e8eb"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const bars = h.map((x, i) => {
    const known = S.band(x.aqi), v = known ? x.aqi : 0, bb = known || {color:'#a3afa8'}, inw = win && i >= win.index && i < win.index + 2, cx = L + i * 26 + 14, y = Y(v);
    return `<g data-i="${i}"><rect x="${L + i * 26 + 4}" y="${y}" width="20" height="${Math.max(2, base - y)}" rx="5" fill="${bb.color}"${inw ? ' stroke="#0f1f23" stroke-width="2.5"' : ''}/><text class="v" x="${cx}" y="${y - 4}" text-anchor="middle">${known ? Math.round(v) : '—'}</text>${i % 3 === 0 ? `<text x="${cx}" y="${H - 10}" text-anchor="middle">${x.time.slice(11, 13)}h</text>` : ''}</g>`;
  }).join('');
  $('chart').innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Hourly AQI for the next 24 hours with values. Outlined bars mark the cleanest window.">${grid}${bars}</svg>` + legend();
}
async function loadHistory(){
  if(!st.data||st.demo||st.stale){$('histtxt').textContent='Fresh history unavailable.';$('hist').textContent='';return;}
  const seq=loadSequence,p=st.place,c=st.data.current;
  if(historyReading){drawHistory(c,historyReading);return;}
  if(historyRequest)return;
  $('histtxt').textContent='Loading seven-day history…';$('hist').textContent='';
  historyRequest=jget(`${AQ}?latitude=${p.lat}&longitude=${p.lon}&hourly=us_aqi&forecast_days=1&past_days=7&timezone=auto`);
  try{const data=await historyRequest;if(seq!==loadSequence)return;historyReading=data;drawHistory(c,data);}catch(_){if(seq===loadSequence)$('histtxt').textContent='History temporarily unavailable. Reopen Forecast to retry.';}finally{if(seq===loadSequence)historyRequest=null;}
}
function drawHistory(c,data) {
  const days = S.lastDays(S.dailyAvg(data), c.time.slice(0, 10), 7), ins = S.insights(days), vw = S.vsWeek(days, c.time.slice(0, 10));
  $('histtxt').textContent = ins ? `Best day ${ins.best.date} (AQI ${ins.best.avg}), worst ${ins.worst.date} (AQI ${ins.worst.avg}). ${ins.over} of ${days.length} days averaged above 100.` + (vw === null ? '' : ` Today is ${Math.abs(vw)}% ${vw >= 0 ? 'higher' : 'lower'} than the average of the previous days.`) : 'No history available.';
  const max = Math.max(150, ...days.map(x => x.avg));
  $('hist').innerHTML = `<svg width="${Math.max(480, days.length * 64)}" height="170" role="img" aria-label="Daily average AQI">` + days.map((d, i) => {
    const bh = Math.max(3, d.avg / max * 110), bb = S.band(d.avg);
    return `<g><title>${d.date} AQI ${d.avg}</title><rect x="${i * 64 + 8}" y="${130 - bh}" width="46" height="${bh}" rx="6" fill="${bb.color}"/><text x="${i * 64 + 31}" y="${124 - bh}" text-anchor="middle">${d.avg}</text><text x="${i * 64 + 31}" y="150" text-anchor="middle">${esc(d.date.slice(5))}</text></g>`;
  }).join('') + '</svg>' + legend();
}

function drawStrip(hrs) {
  $('strip').innerHTML = hrs.slice(0, 12).map(x => `<div class="hr"><span>${esc(x.time.slice(11, 13))}h</span><i style="background:${(S.band(x.aqi)?.color || '#9ca3af')}"></i><b>${S.band(x.aqi) ? Math.round(x.aqi) : '—'}</b></div>`).join('') || '<p class="muted">No hourly data.</p>';
}
function drawDisp() {
  const d = S.dispersion(st.wx, st.ctx.aqi);
  $('disp').innerHTML = d ? `<p class="lead" style="margin:0">${esc(d.text)}</p><div class="drv"><div><small>Dispersion</small><b>${esc(d.level)}</b></div><div><small>Wind</small><b>${st.wx.w} km/h</b></div><div><small>Humidity</small><b>${st.wx.h}%</b></div><div><small>Temperature</small><b>${st.wx.t}°C</b></div></div>` : '<p class="muted">Weather data is unavailable right now.</p>';
}
function tip(e) {
  const g = e.target.closest && e.target.closest('g[data-i]'), t = $('tip');
  const x = g && st.hrs && st.hrs[+g.dataset.i]; if (!x) { t.hidden = true; return; }
  const b = S.band(x.aqi), v = b?Math.round(x.aqi):'Unavailable', h = +x.time.slice(11, 13);
  t.innerHTML = `<b>${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00</b><br>AQI ${v} · ${esc(b?b.label:'Missing data')}` + (typeof x.pm2_5 === 'number' ? `<br>PM2.5 ${x.pm2_5.toFixed(0)} µg/m³` : '');
  t.hidden = false; t.style.left = Math.max(8, Math.min(innerWidth - 240, e.clientX + 12)) + 'px'; t.style.top = Math.max(8, e.clientY - 70) + 'px';
}
['pointerover', 'pointermove', 'pointerdown'].forEach(ev => $('chart').addEventListener(ev, tip));
$('chart').addEventListener('pointerleave', () => { $('tip').hidden = true; });
async function reverse(lat, lon) {
  try { const r = await jget(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`); const n = r.city || r.locality || r.principalSubdivision; return n ? n + (r.countryName ? ', ' + r.countryName : '') : null; }
  catch (_) { return null; }
}

async function loadStation() {
  const p = st.place, gc = $('gcard'); gc.hidden = false; $('gs').textContent='Checking monitoring-station availability…'; if (!p || st.demo || st.stale || !location.protocol.startsWith('http')) { $('gs').textContent='Fresh model data required for a station comparison.'; return; }
  try {
    const cfg=await getCapabilities();if(st.place!==p)return;
    if(cfg&&cfg.stations===false){$('gs').textContent='Ground monitoring is not configured. Showing model estimates only.';return;}
    const r = await fetch(`/api/stations?lat=${p.lat}&lon=${p.lon}`); if (!r.ok) { if(st.place===p)$('gs').textContent='Station data unavailable. Showing model estimates only.';return; }
    const j = await r.json(); if (st.place === p&&st.data) drawStation(j.station);
  } catch (_) {if(st.place===p)$('gs').textContent='Station service unavailable. Showing model estimates only.';}
}
function drawStation(s) {
  const gc = $('gcard'), c = st.data.current; gc.hidden = false;
  if (!s || !Number.isFinite(s.pm25) || s.pm25<0) { $('gs').innerHTML = '<p class="muted" style="margin:0">No monitoring station reporting PM2.5 within 25 km. Showing the model estimate only.</p>'; return; }
  const model = c.pm2_5, diff = s.pm25 > 0 && typeof model === 'number' ? Math.round((model - s.pm25) / s.pm25 * 100) : null;
  const age = s.ageHours == null ? '' : s.ageHours < 1 ? 'less than an hour ago' : Math.round(s.ageHours) + ' h ago';
  const fresh=s.ageHours!=null&&s.ageHours<=3;
  const v=!fresh?'Station reading is stale or its time is unknown; no comparison made.':diff===null?'Comparison unavailable.':`Model concentration is ${Math.abs(diff)}% ${diff>=0?'higher':'lower'} than the latest station reading. Locations and averaging periods may differ.`;
  const b=null;
  $('gs').innerHTML = `<p class="lead" style="margin:0"><b>${esc(s.name)}</b> · ${Number.isFinite(s.distanceKm)?s.distanceKm+' km away':'distance unavailable'}${age ? ' · measured ' + esc(age) : ''}</p>
    <div class="drv"><div><small>Station PM2.5</small><b>${s.pm25.toFixed(1)} µg/m³</b></div><div><small>Model PM2.5</small><b>${typeof model === 'number' ? model.toFixed(1) + ' µg/m³' : 'n/a'}</b></div><div><small>Station freshness</small><b>${fresh?'Recent':'Stale / unknown'}</b></div></div>
    <p class="muted">${esc(v)} Station PM2.5 is not an official AQI. Source: OpenAQ.</p>`;
}

/* ---------- cities ---------- */
let comparisonSequence=0;
async function drawCities() {
  const seq=++comparisonSequence, places=cmp.slice();
  const out=await Promise.all(places.map(async p=>{try{const r=await jget(`${AQ}?latitude=${p.lat}&longitude=${p.lon}&current=us_aqi,pm2_5&timezone=auto`);const age=S.readingAge(r);if(age===null||age>3||age< -1||!S.band(r.current?.us_aqi))return null;return {name:p.name,aqi:r.current.us_aqi,pm:r.current.pm2_5,p};}catch(_){return null;}}));
  if(seq!==comparisonSequence)return;
  const rk = S.rank(out);
  $('cmp').innerHTML = rk.length ? rk.map((x, i) => { const b = S.band(x.aqi);
    return `<div class="cmprow"><button type="button" class="btn ghost" data-go="${i}">${esc(x.name)}</button><div class="bar" role="img" aria-label="AQI ${Math.round(x.aqi)}"><i style="width:${Math.min(100, x.aqi / 3)}%;background:${b.color}"></i></div><b style="color:${b.ink}">${Math.round(x.aqi)}</b><small>${esc(b.label)}${typeof x.pm === 'number' ? ' · PM2.5 ' + x.pm.toFixed(0) : ''}</small><button type="button" class="btn ghost" data-rm="${i}" aria-label="Remove ${esc(x.name)}">✕</button></div>`; }).join('')
    : '<p class="muted">No cities yet. Open a city, then tap “Add current city”.</p>';
  $('cmp').onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.go !== undefined) { load(rk[t.dataset.go].p); show('today'); }
    if (t.dataset.rm !== undefined) { cmp = cmp.filter(c => c.name !== rk[t.dataset.rm].name); store.set('svasa_cmp', cmp); drawCities(); }
  };
}

const POP = [['Delhi, India', 28.6139, 77.209], ['Mumbai, India', 19.076, 72.8777], ['Hyderabad, India', 17.385, 78.4867], ['Bengaluru, India', 12.9716, 77.5946], ['Kolkata, India', 22.5726, 88.3639], ['Chennai, India', 13.0827, 80.2707]];
$('pop').innerHTML = '<span class="muted" style="margin:0">Quick add:</span>' + POP.map((c, i) => `<button type="button" class="chip" data-p="${i}">${esc(c[0].split(',')[0])}</button>`).join('') + '<button type="button" class="chip" data-p="all">Add all</button>';
$('pop').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const mk = c => ({ name: c[0], lat: c[1], lon: c[2] });
  if (b.dataset.p === 'all') cmp = POP.map(mk); else { const c = mk(POP[+b.dataset.p]); if (!cmp.some(x => x.name === c.name)) cmp = cmp.slice(-5).concat([c]); }
  store.set('svasa_cmp', cmp); drawCities();
};
function pushRecent(p) {
  if (!p || p.name === 'Your location') return;
  const r = store.get('svasa_recent', []).filter(x => x.name !== p.name); r.unshift({ name: p.name, lat: p.lat, lon: p.lon }); store.set('svasa_recent', r.slice(0, 5));
}
function showRecent() {
  const r = store.get('svasa_recent', []), s = $('sugg'); if (!r.length || $('q').value) return;
  s.innerHTML = '<div class="sugghead">Recent</div>' + r.map((x, i) => `<button type="button" data-i="${i}">${esc(x.name)}</button>`).join(''); s.hidden = false;
  s.onclick = e => { const b = e.target.closest('button'); if (b) { s.hidden = true; load(r[b.dataset.i]); show('today'); } };
}
$('q').addEventListener('focus', showRecent);
window.addEventListener('error', e => { if (!/ResizeObserver/.test(e.message || '')) banner('Something went wrong. Please refresh the page.'); });
window.addEventListener('unhandledrejection', () => banner('Something went wrong. Please refresh the page.'));

/* ---------- planner ---------- */
function plan() {
  if (!st.data || st.demo || st.stale) { $('planout').textContent = 'Fresh live forecast required for planning.'; return; }
  const hrs = S.hourlyFrom(st.data, st.data.current.time), len = +$('dur').value, p = S.planTrip(hrs, len, +$('from').value, +$('to').value);
  $('planout').textContent = !p ? 'No clean slot fits inside that time range. Try widening it.'
    : `Lowest forecast average: ${p.win.start.replace('T',' ')} to ${p.win.end.replace('T',' ')} (AQI ${p.win.avg}; peak ${p.win.peak}). ${p.savedPct == null ? '' : p.savedPct + '% lower mean AQI than starting now. '}${S.effectiveLevel(p.win.peak,st.profile)>=2?'Consider an indoor alternative; even this window may be unsuitable.':'Conditions may change; check again before leaving.'}`;
}

/* ---------- assistant ---------- */
const QS = ['Can I run outside?', 'Do I need a mask?', 'Best time to go out?', 'Should I open windows?', 'Is it safe for my child?', 'What is polluting the air?'];
const UI = {
  en: { ph: 'Can I run outside today?', send: 'Send', qs: QS },
  hi: { ph: 'आज क्या मैं बाहर दौड़ सकता हूँ?', send: 'भेजें', qs: ['क्या मैं बाहर दौड़ सकता हूँ?', 'क्या मुझे मास्क चाहिए?', 'बाहर जाने का सबसे अच्छा समय?', 'क्या खिड़कियाँ खोलूँ?', 'क्या यह मेरे बच्चे के लिए सुरक्षित है?', 'हवा में क्या प्रदूषण है?'] },
  te: { ph: 'ఈ రోజు బయట పరిగెత్తవచ్చా?', send: 'పంపండి', qs: ['నేను బయట పరిగెత్తవచ్చా?', 'నాకు మాస్క్ అవసరమా?', 'బయటకు వెళ్లడానికి ఉత్తమ సమయం?', 'కిటికీలు తెరవాలా?', 'ఇది నా బిడ్డకు సురక్షితమా?', 'గాలిలో ఏ కాలుష్యం ఉంది?'] },
  ta: { ph: 'இன்று வெளியே ஓடலாமா?', send: 'அனுப்பு', qs: ['நான் வெளியே ஓடலாமா?', 'எனக்கு முகக்கவசம் தேவையா?', 'வெளியே செல்ல சிறந்த நேரம்?', 'ஜன்னல்களைத் திறக்கலாமா?', 'இது என் குழந்தைக்கு பாதுகாப்பானதா?', 'காற்றில் என்ன மாசு உள்ளது?'] },
  bn: { ph: 'আজ কি বাইরে দৌড়াতে পারি?', send: 'পাঠান', qs: ['আমি কি বাইরে দৌড়াতে পারি?', 'আমার কি মাস্ক দরকার?', 'বাইরে যাওয়ার সেরা সময় কখন?', 'জানালা খুলব কি?', 'এটা কি আমার সন্তানের জন্য নিরাপদ?', 'বাতাসে কী দূষণ আছে?'] }
};
function setAskLang(l) {
  const u = UI[l] || UI.en; $('aq').placeholder = u.ph; $('af').querySelector('button').textContent = u.send;
  $('qs').innerHTML = u.qs.map((q, i) => `<button type="button" class="chip" data-en="${esc(QS[i])}">${esc(q)}</button>`).join('');
}
function pushMsg(role, text, cls) {
  const m = document.createElement('div'); m.className = 'msg ' + role + (cls ? ' ' + cls : ''); m.textContent = text;
  $('log').appendChild(m); $('log').scrollTop = $('log').scrollHeight; return m;
}
async function viaServer(q) {
  const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, place:{lat:st.place.lat,lon:st.place.lon},ctx:{profile:st.profile,lang:st.lang,hist:st.hist} }) });
  if (!r.ok) throw new Error('server ' + r.status);
  return await r.json();
}
async function ask(q, en) {
  q = S.cleanQuestion(q); if (!q || busy) return;
  pushMsg('u', q);
  const sf = S.safety(q, st.lang); if (sf) { pushMsg('a', sf, 'urgent'); return; }
  if (!st.ctx || st.demo || st.stale) { pushMsg('a', 'Search a city first and I will answer from its live air data.'); return; }
  busy = true; const requestSeq=loadSequence, requestProfile=st.profile, requestLang=st.lang; const fb = S.answer(en || q, st.ctx), t = pushMsg('a', 'Thinking…', 'typing'); let result = null;
  if (location.protocol.startsWith('http')) { try { result = await viaServer(q); } catch (_) {} }
  if(requestSeq!==loadSequence||requestProfile!==st.profile||requestLang!==st.lang){t.textContent='Context changed. Please ask again.';t.classList.remove('typing');busy=false;return;}
  const a=result&&result.answer; const text=a||('Local rule-based fallback (English; model data): '+fb);
  t.textContent=text; if(result&&result.sections&&result.evidence){t.textContent='';for(const [label,key] of [['Recommendation','recommendation'],['Why','reason'],['Limitations','limitation']]){const row=document.createElement('div'),heading=document.createElement('strong'),body=document.createElement('p');heading.textContent=label;body.textContent=result.sections[key];row.append(heading,body);t.append(row);}const evidence=document.createElement('small');evidence.textContent='Open-Meteo / CAMS · US AQI '+Math.round(result.evidence.aqi)+' · '+result.evidence.observedAt+' (UTC)';t.append(evidence);} t.classList.remove('typing'); t.dataset.source=result&&result.source||'local';if(result?.source==='rules')$('aimode').textContent=result.reason==='provider_rate_limit'?'Rule-based · provider busy':'Rule-based · AI unavailable';else if(result?.source==='gemini')$('aimode').textContent='Gemini response'; $('log').scrollTop = $('log').scrollHeight;
  st.hist=st.hist.concat([{r:'u',t:q},{r:'a',t:text}]).slice(-8);busy=false;
}

/* ---------- alerts ---------- */
async function show_(t, b) {
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) return await reg.showNotification(t, { body: b, icon: 'icon.svg', tag: 'svasa' }); new Notification(t, { body: b }); } catch (_) {}
}
function notifyCheck(aqi) {
  const l = S.effectiveLevel(aqi, st.profile), thr = +($('thr').value || 2);
  if (alertsOn && lastLvl !== null && l !== lastLvl && (l >= thr || lastLvl >= thr))
    show_('Air quality ' + (l > lastLvl ? 'worsened' : 'improved') + ' in ' + st.place.name, 'AQI ' + Math.round(aqi) + ': ' + S.band(aqi).label + (l > lastLvl ? '. ' + S.advice(aqi, st.profile).go : ''));
  lastLvl = l;
}

/* ---------- search ---------- */
async function suggest(v) {
  v = S.cleanQuery(v); const s = $('sugg'); if (v.length < 2) { s.hidden = true; return; }
  try {
    const res = (await jget(`${GEO}?count=5&language=en&name=${encodeURIComponent(v)}`)).results || [];
    s.hidden = !res.length;
    s.innerHTML = res.map((x, i) => `<button type="button" data-i="${i}">${esc(x.name)}${x.admin1 ? ', ' + esc(x.admin1) : ''}, ${esc(x.country || '')}</button>`).join('');
    s.onclick = e => { const b = e.target.closest('button'); if (b) pick(res[b.dataset.i]); };
  } catch (_) { s.hidden = true; }
}
function pick(x) { $('sugg').hidden = true; $('q').value = ''; load({ name: x.name + (x.country ? ', ' + x.country : ''), lat: x.latitude, lon: x.longitude }); show('today'); }

/* ---------- breathe ---------- */
const PH = [['Inhale', 4000], ['Hold', 4000], ['Exhale', 6000]];
let bTimer = null, bPhase = 0, bCycles = 0;
function breatheStop() { clearTimeout(bTimer); bTimer = null; $('bstart').textContent = 'Start'; $('borb').className = 'orb'; $('bphase').textContent = 'Ready'; }
function breatheStep() {
  const n = PH[bPhase][0], ms = PH[bPhase][1], o = $('borb');
  $('bphase').textContent = n; o.style.setProperty('--d', ms + 'ms'); o.className = 'orb ' + (n === 'Exhale' ? 'out' : 'in');
  bTimer = setTimeout(() => { bPhase = (bPhase + 1) % PH.length; if (bPhase === 0) { bCycles++; $('bcount').textContent = bCycles + (bCycles === 1 ? ' cycle' : ' cycles'); } breatheStep(); }, ms);
}
$('bstart').onclick = () => { if (bTimer) { breatheStop(); return; } bPhase = 0; bCycles = 0; $('bcount').textContent = '0 cycles'; $('bstart').textContent = 'Stop'; breatheStep(); };

/* ---------- router ---------- */
function show(v) {
  if (!VIEWS.includes(v)) v = 'today';
  if (v !== 'breathe') breatheStop();
  document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  document.querySelectorAll('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'));
  if (history.replaceState) history.replaceState(null, '', '#' + v);
  if(v==='hourly'&&st.data){drawChart(st.hrs||[],st.ctx?.window);loadHistory();}
  if(v==='cities')drawCities();
  if(v==='family')renderFamily();
  if(v==='ask')refreshAIMode();
  if(v==='plan')renderActivityTimes();
  window.scrollTo(0, 0);
}

/* ---------- wiring ---------- */
$('nav').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) show(b.dataset.view); });
$('profile').innerHTML = Object.entries(S.PROFILES).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
$('profile').onchange = e => { st.profile = e.target.value; if (st.data) render(); };
$('q').addEventListener('input', e => { $('sugg').hidden = true; clearTimeout(suggTimer); suggTimer = setTimeout(() => suggest(e.target.value), 250); });
$('q').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { const b = $('sugg').querySelector('button'); if (b) { e.preventDefault(); b.focus(); } } if (e.key === 'Escape') $('sugg').hidden = true; });
$('sugg').addEventListener('keydown', e => { const b = e.target.closest('button'); if (!b) return; if (e.key === 'ArrowDown' && b.nextElementSibling) { e.preventDefault(); b.nextElementSibling.focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (b.previousElementSibling || $('q')).focus(); } if (e.key === 'Escape') { $('sugg').hidden = true; $('q').focus(); } });
$('f').addEventListener('submit', async e => {
  e.preventDefault(); const v = S.cleanQuery($('q').value); if (!v) return;
  try {
    const r = await jget(`${GEO}?count=1&language=en&name=${encodeURIComponent(v)}`);
    if (r.results && r.results[0]) pick(r.results[0]); else banner('No city found for “' + v + '”. Check the spelling or try a larger nearby city.');
  } catch (_) { banner('Search needs an internet connection. Check your network and try again.'); }
});
document.addEventListener('click', e => { if (!e.target.closest('.search')) $('sugg').hidden = true; });
$('loc').onclick = () => {
  if (!navigator.geolocation) { banner('Location is not supported in this browser. Search for a city instead.'); return; }
  navigator.geolocation.getCurrentPosition(async p => {
    const lat = p.coords.latitude, lon = p.coords.longitude, name = await reverse(lat, lon);
    load({ name: name || 'Your location', lat, lon }); show('today');
  }, () => banner('Location permission was denied. Search for a city instead.'), { timeout: 8000 });
};
$('plan').onclick = plan;
for (let i = 0; i < 24; i++) $('from').add(new Option(String(i).padStart(2, '0') + ':00', i));
for (let i = 1; i <= 24; i++) $('to').add(new Option(String(i % 24).padStart(2, '0') + ':00', i));
$('from').value = 5; $('to').value = 23;
cmp = store.get('svasa_cmp', []);
$('addc').onclick = () => { if (!st.place || st.demo || cmp.some(c => c.name === st.place.name)) return; cmp = cmp.slice(-5).concat([st.place]); store.set('svasa_cmp', cmp); drawCities(); };
$('clrc').onclick = () => { cmp = []; store.set('svasa_cmp', []); drawCities(); };
$('notif').onclick = async () => {
  if (!('Notification' in window)) { $('notif').textContent = 'Alerts unsupported'; return; }
  alertsOn = (await Notification.requestPermission()) === 'granted'; $('notif').textContent = alertsOn ? 'Alerts on' : 'Alerts blocked';
};
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('inst').hidden = false; });
$('inst').onclick = async () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; $('inst').hidden = true; } };
$('lang').innerHTML = Object.entries(S.LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('lang').onchange = e => { st.lang = e.target.value; setAskLang(st.lang); };
setAskLang('en');
$('qs').onclick = e => { const b = e.target.closest('button'); if (b) ask(b.textContent, b.dataset.en); };
$('af').onsubmit = e => { e.preventDefault(); const v = $('aq').value; $('aq').value = ''; ask(v); };
pushMsg('a', 'Hi, I am Svasa. Ask me about the air in your city, when to go out, or whether you need a mask.');
function getCapabilities(){if(!capabilities)capabilities=fetch('/api/health',{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw Error('Health unavailable');return r.json();}).catch(()=>{capabilities=null;return null;});return capabilities;}
function refreshAIMode(){getCapabilities().then(j=>{st.serverAI=!!j?.ai;$('aimode').textContent=st.serverAI?'Gemini available · fallback supported':'Rule-based answers';});}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
setInterval(() => { if (st.place && !document.hidden && !busy) load(st.place); }, 5 * 60 * 1000);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {const register=()=>navigator.serviceWorker.register('sw.js').catch(()=>{});window.addEventListener('load',()=>{if('requestIdleCallback'in window)requestIdleCallback(register,{timeout:2500});else setTimeout(register,100);},{once:true});}

$('onbchips').innerHTML = Object.entries(S.PROFILES).map(([k, v]) => `<button type="button" class="chip" data-k="${k}">${esc(v.name)}</button>`).join('');
$('onbchips').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.profile = b.dataset.k; $('profile').value = st.profile; store.set('svasa_onb', 1); $('onb').hidden = true; if (st.data) render(); };
$('onbskip').onclick = () => { store.set('svasa_onb', 1); $('onb').hidden = true; };
$('onb').hidden = !!store.get('svasa_onb', 0);


/* ---------- personal day and family ---------- */
let currentPlan=null;
let activities=[{name:'Commute',duration:1,preferred:0,flex:2}];
let family=store.get('svasa_family',[]);
if(!Array.isArray(family))family=[];
family=family.filter(x=>x&&typeof x.name==='string'&&Object.hasOwn(S.PROFILES,x.profile)).slice(0,6);
const forecast=()=>st.data&&!st.demo&&!st.stale?S.hourlyFrom(st.data,st.data.current.time):[];
function invalidatePlan(){currentPlan=null;$('saveplan').disabled=true;}
function renderActivityTimes(){
  invalidatePlan();
  const hrs=forecast(), box=$('activities');
  box.innerHTML=activities.map((x,i)=>{
    const choices=hrs.map((t,j)=>'<option value="'+j+'"'+(j===x.preferred?' selected':'')+'>'+esc(t.time.replace('T',' '))+'</option>').join('');
    return '<div class="activityrow"><label>Activity<select data-field="name" data-i="'+i+'">'+['Commute','Walk','Workout','School','Shopping','Other'].map(n=>'<option'+(x.name===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Preferred start<select data-field="preferred" data-i="'+i+'"'+(!hrs.length?' disabled':'')+'>'+(choices||'<option>Forecast unavailable</option>')+'</select></label><label>Hours<select data-field="duration" data-i="'+i+'">'+[1,2,3,4].map(n=>'<option'+(x.duration===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Flexibility<select data-field="flex" data-i="'+i+'">'+[0,1,2,4,6].map(n=>'<option value="'+n+'"'+(x.flex===n?' selected':'')+'>'+ (n?'±'+n+'h':'Fixed')+'</option>').join('')+'</select></label><button type="button" class="btn ghost sm" data-remove="'+i+'" aria-label="Remove activity '+(i+1)+'">Remove</button></div>';
  }).join('');
  $('addactivity').disabled=activities.length>=4;
  $('optimizeday').disabled=!hrs.length||!activities.length;
}
$('activities').onchange=e=>{const d=e.target.dataset;if(!d.field||!activities[d.i])return;activities[d.i][d.field]=d.field==='name'?e.target.value:Number(e.target.value);invalidatePlan();$('dayresult').textContent='Plan changed. Optimize again.';};
$('activities').onclick=e=>{const b=e.target.closest('[data-remove]');if(!b)return;activities.splice(Number(b.dataset.remove),1);renderActivityTimes();$('dayresult').textContent='Plan changed. Optimize again.';};
$('addactivity').onclick=()=>{if(activities.length>=4)return;activities.push({name:'Walk',duration:1,preferred:Math.min(23,activities.length*3),flex:2});renderActivityTimes();$('dayresult').textContent='Plan changed. Optimize again.';};
$('optimizeday').onclick=()=>{
  const hrs=forecast(), items=activities.map(x=>({...x,earliest:Math.max(0,x.preferred-x.flex),latest:Math.min(hrs.length,x.preferred+x.duration+x.flex)}));
  invalidatePlan();const plan=S.optimizeDay(hrs,items,st.profile);
  if(!plan){$('dayresult').textContent='No feasible schedule with complete data. Widen time flexibility, shorten durations or change preferred times.';return;}
  currentPlan={createdAt:new Date().toISOString(),city:st.place.name,profile:st.profile,exposure:plan.exposure,baseline:plan.baseline,changePct:plan.changePct,slots:plan.slots.map((x,i)=>({...x,activity:items[i].name})),source:'Open-Meteo / CAMS forecast',forecastTime:st.data.current.time};$('saveplan').disabled=false;
  const change=plan.changePct==null?'Original schedule unavailable or overlapping.':(plan.changePct>=0?plan.changePct+'% lower':Math.abs(plan.changePct)+'% higher')+' concentration-time proxy versus preferred schedule.';
  $('dayresult').innerHTML='<p class="section-kicker">YOUR PROPOSED SCHEDULE</p><h3>'+plan.exposure.toFixed(1)+' µg·h/m³</h3><p>'+esc(change)+'</p>'+plan.slots.map((x,i)=>'<div class="scheduleitem"><strong>'+esc(items[i].name)+'</strong><span>'+esc(x.start.replace('T',' '))+' – '+esc(x.end.replace('T',' '))+'</span><small>Peak AQI '+Math.round(x.peak)+' · '+(x.caution?'Consider indoor alternative':'Lower concern, not risk-free')+'</small></div>').join('')+(plan.risk?'<p class="alert">Some windows still need caution. Consider moving those activities indoors.</p>':'');
};
function renderFamily(){
  const box=$('familyresults'), live=st.data&&!st.demo&&!st.stale;
  box.innerHTML=family.length?family.map((x,i)=>'<article class="familymember"><p class="section-kicker">'+esc(S.PROFILES[x.profile].name)+'</p><h3>'+esc(x.name)+'</h3><p>'+esc(live?S.advice(st.data.current.us_aqi,x.profile).go:'Fresh data required for current advice.')+'</p><button type="button" class="btn ghost sm" data-family-use="'+i+'">Use profile</button> <button type="button" class="btn ghost sm" data-family-remove="'+i+'">Remove</button></article>').join(''):'<p class="muted">Add a profile to see personalized guidance here.</p>';
}
$('familyprofile').innerHTML=Object.entries(S.PROFILES).map(([k,v])=>'<option value="'+k+'">'+esc(v.name)+'</option>').join('');
$('familyform').onsubmit=e=>{e.preventDefault();const name=$('familyname').value.trim(),profile=$('familyprofile').value;if(!name||family.length>=6||!Object.hasOwn(S.PROFILES,profile)){banner('Add a nickname; up to six profiles are supported.');return;}family.push({name,profile});store.set('svasa_family',family);$('familyname').value='';renderFamily();};
$('familyresults').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.familyRemove!==undefined){family.splice(Number(b.dataset.familyRemove),1);store.set('svasa_family',family);renderFamily();}else if(b.dataset.familyUse!==undefined){const x=family[Number(b.dataset.familyUse)];if(!x)return;st.profile=x.profile;$('profile').value=x.profile;if(st.data)render();show('today');}};
$('clearfamily').onclick=()=>{family=[];store.set('svasa_family',family);renderFamily();};
// Populate non-visible feature views only when opened.

let reports=store.get('svasa_reports',[]);
if(!Array.isArray(reports))reports=[];
function recentReports(){const cutoff=Date.now()-7*86400000;return reports.filter(x=>x&&Date.parse(x.createdAt)>=cutoff&&Number.isFinite(x.exposure)&&typeof x.city==='string').slice(0,100);}
function renderReports(){
  const entries=recentReports();
  $('reportsummary').textContent=entries.length?entries.length+' saved projected schedules · '+entries.filter(x=>x.changePct>0).length+' lower than their preferred schedule.':'No saved plans yet. Optimize a day and choose Save projected schedule.';
  $('reportlist').innerHTML=entries.map(x=>'<article class="reportentry"><h3>'+esc(x.city)+'</h3><small>'+esc(new Date(x.createdAt).toLocaleString())+'</small><p><strong>'+x.exposure.toFixed(1)+' µg·h/m³</strong> projected concentration-time proxy'+(Number.isFinite(x.changePct)?' · '+x.changePct+'% reduction versus preferred schedule':'')+'</p><p class="muted">Model forecast, not measured personal exposure.</p></article>').join('');
  $('exportreport').disabled=!entries.length;$('clearreport').disabled=!reports.length;
}
$('saveplan').onclick=()=>{if(!currentPlan||!forecast().length)return;reports=[currentPlan,...recentReports()].slice(0,100);store.set('svasa_reports',reports);invalidatePlan();renderReports();show('reports');};
$('clearreport').onclick=()=>{reports=[];store.set('svasa_reports',reports);renderReports();};
$('exportreport').onclick=()=>{const data={method:'Projected outdoor PM2.5 concentration × hours; not actual exposure or inhaled dose',plans:recentReports()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='svasa-projected-plans.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
renderReports();

/* Optional local-only usability evidence. No analytics or remote submission. */
let feedback=store.get('svasa_feedback',[]);if(!Array.isArray(feedback))feedback=[];
function renderFeedback(){const n=feedback.length;$('feedbacksummary').textContent=n?n+' local responses saved. Export only if you choose to share them.':'No feedback submitted on this device.';$('exportfeedback').disabled=!n;$('clearfeedback').disabled=!n;}
$('feedbackform').onsubmit=e=>{e.preventDefault();const task=$('feedbacktask').value,trust=$('feedbacktrust').value,ease=Number($('feedbackease').value);if(!['yes','partly','no'].includes(task)||!['yes','partly','no'].includes(trust)||!Number.isInteger(ease)||ease<1||ease>5)return;feedback=[{task,trust,ease},...feedback].slice(0,100);store.set('svasa_feedback',feedback);e.target.reset();renderFeedback();};
$('exportfeedback').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({method:'Optional self-reported usability responses; local device; no clinical outcomes',responses:feedback},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='svasa-usability-feedback.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('clearfeedback').onclick=()=>{feedback=[];store.set('svasa_feedback',feedback);renderFeedback();};renderFeedback();

/* Optional opt-in Web Push. No background location tracking. */
let pushConfig=null;
const pushStatus=s=>{$('pushstatus').textContent=s;};
async function pushApi(body){const r=await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Background alert service unavailable');return r.json();}
async function initPush(){
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return;
 try{
  const r=await fetch('/api/push');if(!r.ok)return;pushConfig=await r.json();
  const existing=store.get('svasa_push',null);
  $('pushoff').hidden=!existing;$('pushtest').hidden=!existing||!pushConfig.enabled;
  $('pushon').hidden=!pushConfig.enabled;$('pushthreshold').hidden=!pushConfig.enabled;
  if(existing)pushStatus('Saved subscription for '+existing.city+' · US AQI '+existing.threshold+'+. Renew or disable it here.');
 }catch(_){}
}
$('pushon').onclick=async()=>{
 if(!pushConfig?.enabled||!st.place||!st.data||st.demo||st.stale){pushStatus('Load a fresh city reading first.');return;}
 const place={lat:st.place.lat,lon:st.place.lon},city=st.place.name,threshold=Number($('pushlevel').value),btn=$('pushon');btn.disabled=true;
 try{
  if(await Notification.requestPermission()!=='granted')throw Error('Notification permission not granted');
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  const old=store.get('svasa_push',null);
  if(sub&&!old){await sub.unsubscribe();sub=null;}
  const k=pushConfig.publicKey.replace(/-/g,'+').replace(/_/g,'/'),bytes=Uint8Array.from(atob(k+'='.repeat((4-k.length%4)%4)),c=>c.charCodeAt(0));
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  const token=old?.endpoint===sub.endpoint?old.token:Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  // Save ownership token before network submission so the user can retry or revoke it.
  store.set('svasa_push',{endpoint:sub.endpoint,token,city,threshold});
  $('pushoff').hidden=false;
  await pushApi({action:'subscribe',subscription:sub.toJSON(),token,place,threshold});
  $('pushtest').hidden=false;
  pushStatus('Background alerts enabled for '+city+' · US AQI '+threshold+'+. Scheduled checks, not real-time alerts.');
 }catch(e){pushStatus(e.message+'; you can retry or disable the subscription.');}finally{btn.disabled=false;}
};
$('pushoff').onclick=async()=>{
 const old=store.get('svasa_push',null);if(!old)return;
 try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();await pushApi({action:'unsubscribe',endpoint:old.endpoint,token:old.token});store.set('svasa_push',null);$('pushoff').hidden=true;$('pushtest').hidden=true;$('pushreceived').hidden=true;pushStatus('Background alerts disabled.');}catch(_){pushStatus('Local notifications may be disabled, but server deletion was not confirmed. Retry or wait for 30-day expiry.');}
};
$('pushtest').onclick=async()=>{const old=store.get('svasa_push',null);if(!old)return;const button=$('pushtest');button.disabled=true;try{await pushApi({action:'test',endpoint:old.endpoint,token:old.token});$('pushreceived').hidden=false;pushStatus('Test accepted by the push service. Check your device notifications, then confirm receipt only if you actually saw it.');}catch(_){pushStatus('Test could not be sent. Check your subscription or retry after five minutes.');}finally{button.disabled=false;}};
$('pushreceived').onclick=()=>{store.set('svasa_push_receipt',{confirmedAt:new Date().toISOString(),method:'user-confirmed'});$('pushreceived').hidden=true;pushStatus('Receipt confirmed by you on this device.');};
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='svasa-test-shown'){ $('pushreceived').hidden=false;pushStatus('The browser displayed a test notification. Confirm only if you saw it.');}});
const alertsPanel=$('pushon').closest('.card');
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){observer.disconnect();initPush();}},{rootMargin:'160px'});observer.observe(alertsPanel);}else initPush();

/* ---------- boot ---------- */
show(location.hash.slice(1));
const last = store.get('svasa_last', null);
if (last && last.p && Number.isFinite(last.p.lat)&&Number.isFinite(last.p.lon)&&Math.abs(last.p.lat)<=90&&Math.abs(last.p.lon)<=180&&typeof last.p.name==='string') { if (Object.hasOwn(S.PROFILES,last.profile)) { st.profile = last.profile; $('profile').value = last.profile; } load(last.p); }
else load({ name: 'Delhi, India', lat: 28.6139, lon: 77.209 });
})();
