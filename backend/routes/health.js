'use strict';
module.exports = () => ({ status: 200, body: { ok: true, ai: require('../lib/gemini').enabled(), stations: require('../lib/openaq').enabled() } });
