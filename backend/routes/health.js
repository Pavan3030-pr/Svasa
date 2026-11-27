'use strict';
module.exports = () => ({ status: 200, body: { ok: true, ai: require('../lib/gemini').enabled(), stations: require('../lib/openaq').enabled(), distributedRateLimit:require('../lib/guard').distributedConfigured(),backgroundPush:require('../lib/push').configured(),build:process.env.VERCEL_GIT_COMMIT_SHA||null } });
