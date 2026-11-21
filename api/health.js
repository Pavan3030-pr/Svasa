// Vercel serverless entry. Logic lives in backend/routes/health.js.
const health = require('../backend/routes/health');
module.exports = (req, res) => { const r = health(); res.setHeader('Cache-Control', 'no-store'); res.status(r.status).json(r.body); };
