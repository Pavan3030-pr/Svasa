// Vercel serverless entry. Logic lives in backend/routes/ask.js.
const ask = require('../backend/routes/ask'), g = require('../backend/lib/guard');
module.exports = async (req, res) => {
  const r = await ask({ method: req.method, headers: req.headers, body: req.body, ip: g.ip(req) });
  res.setHeader('Cache-Control', 'no-store');
  if (r.headers) for (const k in r.headers) res.setHeader(k, r.headers[k]);
  res.status(r.status).json(r.body);
};
