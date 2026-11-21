'use strict';
const S = require('../../frontend/js/core.js');
async function generate(q, ctx) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return { status: 503, error: 'AI not configured' };
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const base = process.env.GEMINI_BASE || 'https://generativelanguage.googleapis.com';
  const cfg = Object.assign({ temperature: 0.3, maxOutputTokens: 600 }, /2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {});
  const r = await fetch(base + '/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: S.buildPrompt(q, ctx) }] }], generationConfig: cfg }),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) return { status: 502, error: 'AI provider error ' + r.status };
  const t = S.parseGemini(await r.json());
  return t ? { status: 200, text: t.slice(0, 800) } : { status: 502, error: 'Empty AI answer' };
}
module.exports = { generate, enabled: () => !!process.env.GEMINI_API_KEY };
