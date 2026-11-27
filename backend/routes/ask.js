'use strict';
const S = require('../../frontend/js/core.js'), g = require('../lib/guard'), gemini = require('../lib/gemini');
const air = require('../lib/air-context');
let inflight = 0;
const R = (status, body, headers) => ({ status, body, headers });
module.exports = async function ask(req) {
  if (req.method !== 'POST') return R(405, { error: 'POST only' }, { Allow: 'POST' });
  if (!g.sameOrigin(req.headers)) return R(403, { error: 'Forbidden origin' });
  if (!g.isJson(req.headers)) return R(415, { error: 'JSON required' });
  const b = req.body;
  if (g.tooBig(b)) return R(413, { error: 'Request too large' });
  if (!b || typeof b !== 'object') return R(400, { error: 'Invalid JSON' });
  const q = S.cleanQuestion(b.q);
  const sf = S.safety(typeof b.q==='string'?b.q:'', b.ctx && b.ctx.lang); if (sf) return R(200, { answer: sf, source: 'safety' });
  try {if(await g.rateLimit('ask:'+req.ip))return R(429,{error:'Too many requests. Try again in a minute.'});}catch(_){return R(503,{error:'Rate limit service unavailable'});}
  if (!q || !air.coordinates(b.place)) return R(400, {error:'Question and valid coordinates required'});
  if (inflight >= 20) return R(503, { error: 'Busy, try again' });
  inflight++;
  try {
    let ctx;
    try { ctx=await air.verifiedContext(b.place,b.ctx&&b.ctx.profile,b.ctx&&b.ctx.lang,b.ctx&&b.ctx.hist); } catch (_) { return R(503,{error:'Verified air data unavailable'}); }
    const r = await gemini.generate(q, ctx);
    if (r.error) return R(r.status, { error: r.error });
    if (r.value.kind === 'offtopic') return R(200, { answer: 'I can only help with air quality, health and outdoor planning.', source: 'offtopic' });
    return R(200, { sections:r.value, answer: [r.value.recommendation,r.value.reason,r.value.limitation].join('\n') + '\n' + S.sources(ctx, ctx.lang) + ' (UTC) · Open-Meteo / CAMS · ' + ctx.observedAt, source: 'gemini', evidence:{aqi:ctx.aqi,pm25:ctx.pm25,observedAt:ctx.observedAt,source:ctx.source,timezone:'UTC',window:ctx.window} });
  } catch (e) { return R(502, { error: 'AI request failed' }); } finally { inflight--; }
};
