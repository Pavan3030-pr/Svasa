'use strict';
// Local / container server: serves frontend/ and the same API handlers used on Vercel.
const http = require('http'), fs = require('fs'), path = require('path'), zlib=require('node:zlib');
const ask = require('./routes/ask'), stations = require('./routes/stations'), health = require('./routes/health'), g = require('./lib/guard');
const FRONT = path.resolve(__dirname, '../frontend');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'sha256-BvFMErCkUohRRilXxZWUGJSAcT18mAhysFW8sORG4W4=' 'sha256-fv6anqQMNleBaCS5XTMLAQp2/wwtZqQ8TzDOP2RZtLM='; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://*.open-meteo.com https://api.bigdatacloud.net; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'";
const HEAD = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains', 'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-cache' };
const staticCache=new Map();
function staticAsset(file){const stat=fs.statSync(file),old=staticCache.get(file);if(old&&old.mtime===stat.mtimeMs)return old;const raw=fs.readFileSync(file),type=MIME[path.extname(file)],compressible=/^(text\/|application\/json|image\/svg\+xml)/.test(type),gz=compressible&&raw.length>=1024?zlib.gzipSync(raw):null;const v={mtime:stat.mtimeMs,raw,gz,type};staticCache.set(file,v);return v;}
function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type || 'application/json' }, HEAD, extra || {}));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((ok, no) => {
    let b = '', n = 0, over = false;
    req.on('data', d => { if (over) return; n += d.length; if (n > 4096) { over = true; no(Object.assign(new Error('big'), { code: 413 })); return; } b += d; });
    req.on('end', () => { if (!over) ok(b); }); req.on('error', no);
  });
}
const server = http.createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];
    res.on('finish', () => { if (res.statusCode >= 400) console.log(JSON.stringify({ t: new Date().toISOString(), m: req.method, u: url, s: res.statusCode })); });
    if (url === '/api/health' && req.method === 'GET') { const r = health(); return send(res, r.status, r.body); }
    if (url === '/api/stations') {
      const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      const r = await stations({ method: req.method, query: q, headers: req.headers, ip: g.ip(req) });
      return send(res, r.status, r.body);
    }
    if (url === '/api/push-dispatch') {const r=await require('./routes/push')({method:req.method,headers:req.headers,query:{dispatch:'1'}});return send(res,r.status,r.body,null,{'Cache-Control':'no-store'});}
    if (url === '/api/push') {
      let body=null;if(req.method==='POST'){try{body=JSON.parse(await readBody(req));}catch(e){return send(res,e.code===413?413:400,{error:'Invalid request'});}}
      const r=await require('./routes/push')({method:req.method,headers:req.headers,query:Object.fromEntries(new URL(req.url,'http://x').searchParams),body,ip:g.ip(req)});return send(res,r.status,r.body,null,{'Cache-Control':'no-store'});
    }
    if (url === '/api/ask') {
      let body = null;
      if (req.method === 'POST') {
        try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'Request too large' : 'Invalid JSON' }); }
      }
      const r = await ask({ method: req.method, headers: req.headers, body, ip: g.ip(req) });
      return send(res, r.status, r.body, null, r.headers);
    }
    if (req.method === 'GET') {
      let f; try { f = path.resolve(FRONT, '.' + decodeURIComponent(url === '/' ? '/index.html' : url)); } catch (_) { return send(res, 400, { error: 'Bad request' }); }
      if (f.startsWith(FRONT + path.sep) && MIME[path.extname(f)] && fs.existsSync(f) && fs.statSync(f).isFile()) {const asset=staticAsset(f),gzip=asset.gz&&/(?:^|,\s*)gzip(?:\s*;\s*q=(?!0(?:\.0*)?(?:,|$))[^,]+)?(?:,|$)/i.test(req.headers['accept-encoding']||'');return send(res,200,gzip?asset.gz:asset.raw,asset.type,{Vary:'Accept-Encoding',...(gzip?{'Content-Encoding':'gzip'}:{})});}
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) { send(res, 500, { error: 'Server error' }); }
});
server.headersTimeout = 10000; server.requestTimeout = 15000; server.keepAliveTimeout = 5000; server.maxHeadersCount = 50;
module.exports = server;
if (require.main === module) {
  const port = process.env.PORT || 8080;
  server.listen(port, () => console.log('Svasa running on http://localhost:' + port + (process.env.GEMINI_API_KEY ? ' (AI on)' : ' (AI off: set GEMINI_API_KEY)')));
}
