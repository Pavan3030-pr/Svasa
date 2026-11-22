'use strict';
// Ground-station lookup via OpenAQ v3. The key is read from the OPENAQ_API_KEY environment variable only.
const BASE = () => process.env.OPENAQ_BASE || 'https://api.openaq.org';
const enabled = () => !!process.env.OPENAQ_API_KEY;
const cache = new Map();
const rad = d => d * Math.PI / 180;
function km(a, b, c, d) {
  const R = 6371, dl = rad(c - a), dn = rad(d - b);
  const x = Math.sin(dl / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
async function oq(path) {
  const r = await fetch(BASE() + '/v3' + path, { headers: { 'X-API-Key': process.env.OPENAQ_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Object.assign(new Error('openaq ' + r.status), { status: r.status });
  return r.json();
}
const pname = s => String((s && s.parameter && s.parameter.name) || '').toLowerCase();
// The docs show both lat,lon and lon,lat. Try lat,lon first, then lon,lat, and verify distance ourselves.
async function findLocations(lat, lon) {
  for (const c of [lat + ',' + lon, lon + ',' + lat]) {
    const j = await oq('/locations?coordinates=' + c + '&radius=25000&limit=20');
    const ok = (j.results || [])
      .filter(l => l && l.coordinates && typeof l.coordinates.latitude === 'number' && typeof l.coordinates.longitude === 'number')
      .map(l => ({ l, d: km(lat, lon, l.coordinates.latitude, l.coordinates.longitude) }))
      .filter(x => x.d <= 26);
    if (ok.length) return ok.sort((a, b) => a.d - b.d);
  }
  return [];
}
async function nearest(lat, lon) {
  const key = lat.toFixed(1) + ',' + lon.toFixed(1), hit = cache.get(key);
  if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.v;
  let out = null;
  for (const { l, d } of (await findLocations(lat, lon)).slice(0, 5)) {
    let sensors = l.sensors;
    if (!Array.isArray(sensors) || !sensors.length) { try { sensors = (await oq('/locations/' + l.id + '/sensors')).results || []; } catch (_) { sensors = []; } }
    const map = {}; for (const s of sensors) map[s.id] = pname(s);
    if (!Object.values(map).includes('pm25')) continue;
    const vals = {}; let time = null;
    for (const r of (await oq('/locations/' + l.id + '/latest')).results || []) {
      const n = map[r.sensorsId];
      if ((n === 'pm25' || n === 'pm10') && typeof r.value === 'number' && r.value >= 0 && r.value < 2000) {
        vals[n] = r.value; const t = typeof r.datetime === 'string' ? r.datetime : r.datetime && r.datetime.utc;
        if (t && (!time || t > time)) time = t;
      }
    }
    if (typeof vals.pm25 === 'number') {
      const age = time && isFinite(Date.parse(time)) ? Math.max(0, Math.round((Date.now() - Date.parse(time)) / 360000) / 10) : null;
      out = { id: l.id, name: String(l.name || 'Monitoring station').slice(0, 80), distanceKm: Math.round(d * 10) / 10, pm25: vals.pm25, pm10: typeof vals.pm10 === 'number' ? vals.pm10 : null, time, ageHours: age };
      break;
    }
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { t: Date.now(), v: out });
  return out;
}
module.exports = { enabled, nearest, km };
