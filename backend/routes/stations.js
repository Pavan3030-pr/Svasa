'use strict';
const g = require('../lib/guard'), openaq = require('../lib/openaq');
const R = (status, body) => ({ status, body });
module.exports = async function stations(req) {
  if (req.method !== 'GET') return R(405, { error: 'GET only' });
  if (!openaq.enabled()) return R(503, { error: 'Ground stations not configured' });
  const q = req.query || {};
  if(!['lat','lon'].every(k=>(typeof q[k]==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(q[k]))||(typeof q[k]==='number'&&Number.isFinite(q[k]))))return R(400,{error:'Invalid coordinates'});
  const lat = Number(q.lat), lon = Number(q.lon);
  if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return R(400, { error: 'Invalid coordinates' });
  try{if(await g.rateLimit('st:'+req.ip,30))return R(429,{error:'Too many requests. Try again in a minute.'});}catch(_){return R(503,{error:'Rate limit service unavailable'});}
  try { return R(200, { station: await openaq.nearest(lat, lon) }); }
  catch (e) { if(['UPSTREAM_BUSY','UPSTREAM_TIMEOUT','UPSTREAM_COOLDOWN'].includes(e.code)||e.name==='TimeoutError')return R(503,{error:'Station service temporarily unavailable'});return R(502, { error: 'Station lookup failed' }); }
};

module.exports=require('../lib/operational-log').observe('stations',module.exports);
