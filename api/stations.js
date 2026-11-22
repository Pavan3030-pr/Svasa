// Vercel serverless entry. Logic lives in backend/routes/stations.js.
const stations = require('../backend/routes/stations'), g = require('../backend/lib/guard');
module.exports = async (req, res) => {
  const r = await stations({ method: req.method, query: req.query || {}, headers: req.headers, ip: g.ip(req) });
  res.setHeader('Cache-Control', 'no-store'); res.status(r.status).json(r.body);
};
