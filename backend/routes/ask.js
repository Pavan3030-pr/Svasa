'use strict';
const S = require('../../frontend/js/core.js'), g = require('../lib/guard'), gemini = require('../lib/gemini');
let inflight = 0;
const R = (status, body, headers) => ({ status, body, headers });
module.exports = async function ask(req) {
  if (req.method !== 'POST') return R(405, { error: 'POST only' }, { Allow: 'POST' });
  if (!g.sameOrigin(req.headers)) return R(403, { error: 'Forbidden origin' });
  if (!g.isJson(req.headers)) return R(415, { error: 'JSON required' });
  if (g.limited(req.ip)) return R(429, { error: 'Too many requests. Try again in a minute.' });
  const b = req.body;
  if (g.tooBig(b)) return R(413, { error: 'Request too large' });
  if (!b || typeof b !== 'object') return R(400, { error: 'Invalid JSON' });
  const ctx = S.validateCtx(b.ctx), q = S.cleanQuery(b.q);
  if (!ctx || !q) return R(400, { error: 'Missing or invalid question or air data' });
  const sf = S.safety(q, ctx.lang); if (sf) return R(200, { answer: sf, source: 'safety' });
  if (inflight >= 20) return R(503, { error: 'Busy, try again' });
  inflight++;
  try {
    const r = await gemini.generate(q, ctx);
    if (r.error) return R(r.status, { error: r.error });
    if (S.isOffTopic(r.text)) return R(200, { answer: 'I can only help with air quality, health and outdoor planning.', source: 'offtopic' });
    return R(200, { answer: r.text + '\n' + S.sources(ctx, ctx.lang), source: 'gemini' });
  } catch (e) { return R(502, { error: 'AI request failed' }); } finally { inflight--; }
};
