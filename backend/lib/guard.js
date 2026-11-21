'use strict';
const hits = new Map();
const ip = req => String((req.headers && req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
function limited(key, max = 20) {
  const n = Date.now(), a = (hits.get(key) || []).filter(t => n - t < 60000);
  a.push(n); hits.set(key, a); if (hits.size > 5000) hits.clear();
  return a.length > max;
}
function sameOrigin(h) { const o = h.origin; if (!o) return true; try { return new URL(o).host === h.host; } catch (_) { return false; } }
const isJson = h => /^application\/json/i.test(h['content-type'] || '');
function tooBig(b) { try { return JSON.stringify(b).length > 4096; } catch (_) { return true; } }
module.exports = { ip, limited, sameOrigin, isJson, tooBig };
