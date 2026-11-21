(function () {
'use strict';
const S = window.Svasa, $ = id => document.getElementById(id);
const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const WX = 'https://api.open-meteo.com/v1/forecast';
const VIEWS = ['today', 'hourly', 'plan', 'cities', 'ask'];
const st = { profile: 'general', place: null, data: null, wx: null, demo: false, stale: null, ctx: null, lang: 'en', hist: [], serverAI: false };
let busy = false, cmp = [], lastLvl = null, alertsOn = false, deferredInstall = null, suggTimer;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
};
async function jget(u) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
  try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
function banner(msg) { const b = $('banner'); b.hidden = !msg; b.textContent = msg || ''; }
const legend = () => '<div class="legend">' + S.BANDS.map(b => `<span><i style="background:${b.color}"></i>${b.label}</span>`).join('') + '</div>';

/* ---------- data ---------- */
function demo() {
  const time = [], us = [], pm = [], day = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 48; i++) { const h = i % 24, w = Math.sin((h - 4) / 24 * 6.28); time.push(day + 'T' + String(h).padStart(2, '0') + ':00'); us.push(Math.round(95 + 55 * w)); pm.push(40 + 25 * w); }
  return { current: { time: day + 'T12:00', us_aqi: 132, pm2_5: 48.2, pm10: 90, nitrogen_dioxide: 38, ozone: 72, sulphur_dioxide: 12, carbon_monoxide: 610, us_aqi_pm2_5: 132, us_aqi_pm10: 70, us_aqi_nitrogen_dioxide: 30, us_aqi_ozone: 55, us_aqi_sulphur_dioxide: 8, us_aqi_carbon_monoxide: 7 }, hourly: { time, us_aqi: us, pm2_5: pm } };
}
async function load(p) {
  st.place = p; $('v-today').classList.add('loading'); banner('');
  const cur = 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide';
  try {
    const d = await jget(`${AQ}?latitude=${p.lat}&longitude=${p.lon}&current=${cur}&hourly=us_aqi,pm2_5&forecast_days=2&past_days=7&timezone=auto`);
    if (!d.current || d.current.us_aqi == null) throw new Error('No data for this location yet');
    st.data = d; st.demo = false; st.stale = null; store.set('svasa_snap_' + p.name, { at: Date.now(), data: d });
  } catch (e) {
    const snap = store.get('svasa_snap_' + p.name, null);
    if (snap && snap.data) { st.data = snap.data; st.demo = false; st.stale = snap.at; banner('Offline. Showing the last saved reading from ' + new Date(snap.at).toLocaleString() + '.'); }
    else { st.data = demo(); st.demo = true; st.stale = null; banner('Live data is unavailable (' + e.message + '). Showing sample data.'); }
  }
  try {
    const w = (await jget(`${WX}?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`)).current;
    st.wx = { t: Math.round(w.temperature_2m), h: Math.round(w.relative_humidity_2m), w: Math.round(w.wind_speed_10m) };
  } catch (_) { st.wx = null; }
  store.set('svasa_last', { p, profile: st.profile });
  $('v-today').classList.remove('loading');
  render(); drawCities();
}

/* ---------- render ---------- */
function render() {
  const c = st.data.current, aqi = c.us_aqi, b = S.band(aqi), a = S.advice(aqi, st.profile), dom = S.dominant(c);
  const hrs = S.hourlyFrom(st.data, c.time), win = S.bestWindow(hrs, 2), tr = S.trend(hrs);
  const root = document.documentElement.style; root.setProperty('--c', b.color); root.setProperty('--t', b.bg);
  st.ctx = { aqi, profile: st.profile, dominant: dom, window: win, trend: tr, city: st.place.name, wx: st.wx };

  const ind = S.indiaAqi(c), wn = S.windNote(st.wx && st.wx.w, aqi);
  const status = st.demo ? 'Sample data' : st.stale ? 'Offline snapshot' : 'Live';
  const trendLabel = { rising: '↗ Worsening', falling: '↘ Improving', steady: '→ Steady' }[tr];
  $('hero').innerHTML =
    `<div class="ring" style="--p:${Math.min(100, aqi / 3)}" role="img" aria-label="US AQI ${Math.round(aqi)}"><div><b>${Math.round(aqi)}</b><span>US AQI</span></div></div>
     <div><p class="eyebrow">${esc(st.place.name)} · ${status} · ${esc(c.time.slice(11, 16))}</p>
     <h1>${esc(b.label)}</h1>
     <p class="lead">${esc(a.go)}${dom ? ' Main driver: ' + S.POLLUTANTS[dom].name + '.' : ''}${wn ? ' ' + esc(wn) : ''}</p>
     <div class="chips-row">
       <span class="chip2">${trendLabel}</span>
       ${ind ? `<span class="chip2">India NAQI ${ind.aqi} · ${esc(ind.label)}</span>` : ''}
       ${win ? `<span class="chip2">Cleanest ${win.start.slice(11, 16)}–${win.end.slice(11, 16)}</span>` : ''}
       ${st.wx ? `<span class="chip2">${st.wx.t}°C · ${st.wx.h}% · ${st.wx.w} km/h</span>` : ''}
       <button type="button" class="btn ghost sm" id="share">Share</button>
     </div></div>`;
  $('share').onclick = async () => {
    const t = `${st.place.name}: AQI ${Math.round(aqi)} (${b.label}). ${a.go} via Svasa`;
    try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); $('share').textContent = 'Copied'; setTimeout(() => { const s = $('share'); if (s) s.textContent = 'Share'; }, 1500); } } catch (_) {}
  };

  const rows = [['Going out', a.go], ['Exercise', a.exercise], ['Mask', a.mask], ['Windows', a.windows], ['Air purifier', a.purifier], ...S.tips(st.profile, aqi).map(x => ['For you', x])];
  $('adv').innerHTML = rows.map(r => `<div class="tile"><h3>${esc(r[0])}</h3><p>${esc(r[1])}</p></div>`).join('');
  $('alert').innerHTML = a.symptoms ? `<div class="alert" role="alert">${esc(a.symptoms)}</div>` : '';

  const keys = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'sulphur_dioxide', 'carbon_monoxide'];
  $('pol').innerHTML = keys.filter(k => typeof c[k] === 'number').map(k => {
    const P = S.POLLUTANTS[k], r = S.whoRatio(k, c[k]);
    return `<div class="pol ${k === dom ? 'dom' : ''}"><b>${P.name}</b><div class="bar" role="img" aria-label="${r} times WHO guideline"><i style="width:${Math.min(100, r / 4 * 100)}%"></i></div><small>${c[k].toFixed(1)} ${P.unit} · ${r}× WHO</small><span class="note">${esc(P.note)}</span></div>`;
  }).join('');

  $('win').textContent = win ? `Cleanest 2 hours: ${win.start.slice(11, 16)}–${win.end.slice(11, 16)} (AQI ~${win.avg})` : 'No forecast available';
  drawChart(hrs, win); drawHistory(c);
  notifyCheck(aqi);
}
function drawChart(h, win) {
  if (!h.length) { $('chart').innerHTML = '<p class="muted">No hourly forecast available.</p>'; return; }
  const W = Math.max(640, h.length * 26), H = 200, max = Math.max(150, ...h.map(x => x.aqi || 0));
  const bars = h.map((x, i) => {
    const v = x.aqi || 0, bh = Math.max(3, v / max * (H - 44)), bb = S.band(v), inw = win && i >= win.index && i < win.index + 2;
    return `<g><title>${x.time.slice(11, 16)} · AQI ${v}</title><rect x="${i * 26 + 4}" y="${H - 26 - bh}" width="20" height="${bh}" rx="5" fill="${bb.color}"${inw ? ' stroke="#0f1f23" stroke-width="2.5"' : ''}/>${i % 3 === 0 ? `<text x="${i * 26 + 14}" y="${H - 8}" text-anchor="middle">${x.time.slice(11, 13)}</text>` : ''}</g>`;
  }).join('');
  $('chart').innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Hourly AQI for the next 24 hours. Outlined bars mark the cleanest window.">${bars}</svg>` + legend();
}
function drawHistory(c) {
  const days = S.dailyAvg(st.data).slice(-8), ins = S.insights(days), vw = S.vsWeek(days, c.time.slice(0, 10));
  $('histtxt').textContent = ins ? `Best day ${ins.best.date} (AQI ${ins.best.avg}), worst ${ins.worst.date} (AQI ${ins.worst.avg}). ${ins.over} of ${days.length} days averaged above 100.` + (vw === null ? '' : ` Today is ${Math.abs(vw)}% ${vw >= 0 ? 'higher' : 'lower'} than the average of the previous days.`) : 'No history available.';
  const max = Math.max(150, ...days.map(x => x.avg));
  $('hist').innerHTML = `<svg width="${Math.max(480, days.length * 64)}" height="170" role="img" aria-label="Daily average AQI">` + days.map((d, i) => {
    const bh = Math.max(3, d.avg / max * 110), bb = S.band(d.avg);
    return `<g><title>${d.date} AQI ${d.avg}</title><rect x="${i * 64 + 8}" y="${130 - bh}" width="46" height="${bh}" rx="6" fill="${bb.color}"/><text x="${i * 64 + 31}" y="${124 - bh}" text-anchor="middle">${d.avg}</text><text x="${i * 64 + 31}" y="150" text-anchor="middle">${esc(d.date.slice(5))}</text></g>`;
  }).join('') + '</svg>' + legend();
}

/* ---------- cities ---------- */
async function drawCities() {
  const out = [];
  for (const p of cmp) { try { const r = await jget(`${AQ}?latitude=${p.lat}&longitude=${p.lon}&current=us_aqi,pm2_5`); out.push({ name: p.name, aqi: r.current.us_aqi, pm: r.current.pm2_5, p }); } catch (_) {} }
  const rk = S.rank(out);
  $('cmp').innerHTML = rk.length ? rk.map((x, i) => { const b = S.band(x.aqi);
    return `<div class="cmprow"><button type="button" class="btn ghost" data-go="${i}">${esc(x.name)}</button><div class="bar" role="img" aria-label="AQI ${Math.round(x.aqi)}"><i style="width:${Math.min(100, x.aqi / 3)}%;background:${b.color}"></i></div><b style="color:${b.color}">${Math.round(x.aqi)}</b><small>${esc(b.label)}${typeof x.pm === 'number' ? ' · PM2.5 ' + x.pm.toFixed(0) : ''}</small><button type="button" class="btn ghost" data-rm="${i}" aria-label="Remove ${esc(x.name)}">✕</button></div>`; }).join('')
    : '<p class="muted">No cities yet. Open a city, then tap “Add current city”.</p>';
  $('cmp').onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.go !== undefined) { load(rk[t.dataset.go].p); show('today'); }
    if (t.dataset.rm !== undefined) { cmp = cmp.filter(c => c.name !== rk[t.dataset.rm].name); store.set('svasa_cmp', cmp); drawCities(); }
  };
}

/* ---------- planner ---------- */
function plan() {
  if (!st.data) return;
  const hrs = S.hourlyFrom(st.data, st.data.current.time), len = +$('dur').value, p = S.planTrip(hrs, len, +$('from').value, +$('to').value);
  $('planout').textContent = !p ? 'No clean slot fits inside that time range. Try widening it.'
    : p.win.index === 0 ? `Go now. The next ${len} hour(s) are already the cleanest (AQI about ${p.win.avg}).`
    : `Start at ${p.win.start.slice(11, 16)} and finish by ${p.win.end.slice(11, 16)}. AQI about ${p.win.avg} instead of ${p.now} if you go now, ${p.savedPct}% lower.`;
}

/* ---------- assistant ---------- */
const QS = ['Can I run outside?', 'Do I need a mask?', 'Best time to go out?', 'Should I open windows?', 'Is it safe for my child?', 'What is polluting the air?'];
function pushMsg(role, text, cls) {
  const m = document.createElement('div'); m.className = 'msg ' + role + (cls ? ' ' + cls : ''); m.textContent = text;
  $('log').appendChild(m); $('log').scrollTop = $('log').scrollHeight; return m;
}
const pay = () => ({ aqi: st.ctx.aqi, city: st.ctx.city, profile: st.ctx.profile, dominant: st.ctx.dominant, trend: st.ctx.trend, window: st.ctx.window, wx: st.ctx.wx, lang: st.lang, hist: st.hist });
async function viaServer(q) {
  const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, ctx: pay() }) });
  if (!r.ok) throw new Error('server ' + r.status);
  return (await r.json()).answer;
}
async function ask(q) {
  q = S.cleanQuery(q); if (!q || busy) return;
  pushMsg('u', q);
  const sf = S.safety(q); if (sf) { pushMsg('a', sf, 'urgent'); return; }
  if (!st.ctx) { pushMsg('a', 'Search a city first and I will answer from its live air data.'); return; }
  busy = true; const fb = S.answer(q, st.ctx), t = pushMsg('a', 'Thinking…', 'typing'); let a = null;
  if (location.protocol.startsWith('http')) { try { a = await viaServer(q); } catch (_) {} }
  t.textContent = a || fb; t.classList.remove('typing'); $('log').scrollTop = $('log').scrollHeight;
  st.hist = st.hist.concat([{ r: 'u', t: q }, { r: 'a', t: a || fb }]).slice(-8); busy = false;
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
function pick(x) { $('sugg').hidden = true; $('q').value = x.name; load({ name: x.name + (x.country ? ', ' + x.country : ''), lat: x.latitude, lon: x.longitude }); show('today'); }

/* ---------- router ---------- */
function show(v) {
  if (!VIEWS.includes(v)) v = 'today';
  document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  document.querySelectorAll('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'));
  if (history.replaceState) history.replaceState(null, '', '#' + v);
  window.scrollTo(0, 0);
}

/* ---------- wiring ---------- */
$('nav').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) show(b.dataset.view); });
$('profile').innerHTML = Object.entries(S.PROFILES).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
$('profile').onchange = e => { st.profile = e.target.value; if (st.data) render(); };
$('q').addEventListener('input', e => { clearTimeout(suggTimer); suggTimer = setTimeout(() => suggest(e.target.value), 250); });
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
  navigator.geolocation.getCurrentPosition(p => { load({ name: 'Your location', lat: p.coords.latitude, lon: p.coords.longitude }); show('today'); }, () => banner('Location permission was denied. Search for a city instead.'), { timeout: 8000 });
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
$('lang').onchange = e => { st.lang = e.target.value; };
$('qs').innerHTML = QS.map(q => `<button type="button" class="chip">${q}</button>`).join('');
$('qs').onclick = e => { const b = e.target.closest('button'); if (b) ask(b.textContent); };
$('af').onsubmit = e => { e.preventDefault(); const v = $('aq').value; $('aq').value = ''; ask(v); };
pushMsg('a', 'Hi, I am Svasa. Ask me about the air in your city, when to go out, or whether you need a mask.');
fetch('/api/health').then(r => r.json()).then(j => { st.serverAI = !!j.ai; $('aimode').textContent = j.ai ? 'Gemini on' : 'Rule-based answers'; }).catch(() => { $('aimode').textContent = 'Rule-based answers'; });
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
setInterval(() => { if (st.place && !document.hidden) load(st.place); }, 5 * 60 * 1000);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- boot ---------- */
show(location.hash.slice(1));
const last = store.get('svasa_last', null);
if (last && last.p) { if (S.PROFILES[last.profile]) { st.profile = last.profile; $('profile').value = last.profile; } load(last.p); }
else load({ name: 'Delhi, India', lat: 28.6139, lon: 77.209 });
})();
