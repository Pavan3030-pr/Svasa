'use strict';
// Ground-station lookup via OpenAQ v3. The key is read from the OPENAQ_API_KEY environment variable only.
const BASE = () => process.env.OPENAQ_BASE || 'https://api.openaq.org';
const enabled = () => !!process.env.OPENAQ_API_KEY;
const cache = new Map(),pool=require('./upstream-pool').createPool(8);
let cooldownUntil=0;
const rad = d => d * Math.PI / 180;
function km(a, b, c, d) {
  const R = 6371, dl = rad(c - a), dn = rad(d - b);
  const x = Math.sin(dl / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.max(0,Math.min(1,x))));
}
async function oq(path,deadline) {
  const remaining=deadline-Date.now();
  if(remaining<=0)throw Object.assign(Error('Station deadline exceeded'),{code:'UPSTREAM_TIMEOUT'});
  if(Date.now()<cooldownUntil)throw Object.assign(Error('Station provider cooldown'),{code:'UPSTREAM_COOLDOWN'});
  const r = await fetch(BASE() + '/v3' + path, { headers: { 'X-API-Key': process.env.OPENAQ_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(Math.min(3500,remaining)), redirect: 'error' });
  if(r.status===429){cooldownUntil=Math.max(cooldownUntil,Date.now()+require('./guard').retryAfterSeconds(r.headers?.get?.('retry-after'))*1000);throw Object.assign(Error('Station provider cooldown'),{code:'UPSTREAM_COOLDOWN'});}
  if (!r.ok) throw Object.assign(new Error('openaq ' + r.status), { status: r.status });
  return r.json();
}
const pname = s => String((s && s.parameter && s.parameter.name) || '').toLowerCase();
// The docs show both lat,lon and lon,lat. Try lat,lon first, then lon,lat, and verify distance ourselves.
async function findLocations(lat, lon, deadline) {
  for (const c of [lat + ',' + lon, lon + ',' + lat]) {
    const j = await oq('/locations?coordinates=' + c + '&radius=25000&limit=20',deadline);
    const ok = (j.results || [])
      .filter(l => l && Number.isSafeInteger(l.id)&&l.id>0&&l.coordinates&&Number.isFinite(l.coordinates.latitude)&&Number.isFinite(l.coordinates.longitude)&&Math.abs(l.coordinates.latitude)<=90&&Math.abs(l.coordinates.longitude)<=180)
      .map(l => ({ l, d: km(lat, lon, l.coordinates.latitude, l.coordinates.longitude) }))
      .filter(x => x.d <= 25);
    if (ok.length) return ok.sort((a, b) => a.d - b.d);
  }
  return [];
}
async function nearest(lat, lon) {
  const key = lat.toFixed(4) + ',' + lon.toFixed(4), hit = cache.get(key);
  if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.v ? {...hit.v,ageHours:hit.v.time?Math.max(0,(Date.now()-Date.parse(hit.v.time))/3600000):null}:null;
  return pool.run(key,()=>lookup(lat,lon,key));
}
async function lookup(lat,lon,key){
  const deadline=Date.now()+8000;let out=null;
  for (const { l, d } of (await findLocations(lat, lon,deadline)).slice(0, 5)) {
    if(Date.now()>=deadline){if(out)break;throw Object.assign(Error('Station deadline exceeded'),{code:'UPSTREAM_TIMEOUT'});}
    let sensors = l.sensors;
    if (!Array.isArray(sensors) || !sensors.length) { try { sensors = (await oq('/locations/' + l.id + '/sensors',deadline)).results || []; } catch (e) { if(e.code||!e.status||e.status>=500){if(out)break;throw e;}sensors = []; } }
    const map = Object.create(null); for (const s of sensors) {const unit=String(s?.parameter?.units||'').replace(/μ/g,'µ').replace(/\s/g,'').toLowerCase();if(Number.isSafeInteger(s?.id)&&s.id>0&&['µg/m³','µg/m3','ug/m3','ug/m³'].includes(unit))map[s.id] = pname(s);}
    if (!Object.values(map).includes('pm25')) continue;
    const vals = {}, times = {}; 
    let latest;try{latest=(await oq('/locations/' + l.id + '/latest',deadline)).results||[];}catch(e){if(out)break;throw e;}
    for (const r of latest) {
      const n = map[r.sensorsId];
      if ((n === 'pm25' || n === 'pm10') && typeof r.value === 'number' && r.value >= 0 && r.value < 2000) {
        const t = typeof r.datetime === 'string' ? r.datetime : r.datetime && r.datetime.utc;
        if(!t||!Number.isFinite(Date.parse(t))||Date.parse(t)>Date.now()+300000)continue;
        if(!times[n]||Date.parse(t)>Date.parse(times[n])){vals[n]=r.value;times[n]=t;}
      }
    }
    if (typeof vals.pm25 === 'number') {
      const time=times.pm25; const age = time && isFinite(Date.parse(time)) ? Math.max(0, (Date.now() - Date.parse(time)) / 3600000) : null;
      const candidate = { id: l.id, name: String(l.name || 'Monitoring station').slice(0, 80), distanceKm: Math.round(d * 10) / 10, latitude:l.coordinates.latitude, longitude:l.coordinates.longitude, pm25: vals.pm25, pm10: typeof vals.pm10 === 'number' ? vals.pm10 : null, pm10Time:times.pm10||null, time, ageHours: age };
      if(!out||Date.parse(candidate.time)>Date.parse(out.time))out=candidate;
      if(Date.now()-Date.parse(candidate.time)<=3*3600000){out=candidate;break;}
    }
  }
  if (cache.size >= 500&&!cache.has(key)) cache.delete(cache.keys().next().value);
  cache.set(key, { t: Date.now(), v: out });
  return out;
}
module.exports = { enabled, nearest, km };
