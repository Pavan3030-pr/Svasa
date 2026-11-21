'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),S=require('./core.js');
const KEY=process.env.GEMINI_API_KEY,MODEL=process.env.GEMINI_MODEL||'gemini-2.5-flash';
const BASE=process.env.GEMINI_BASE||'https://generativelanguage.googleapis.com';
const FILES={'/':'index.html','/index.html':'index.html','/core.js':'core.js','/sw.js':'sw.js','/app.js':'app.js','/styles.css':'styles.css','/manifest.json':'manifest.json','/icon.svg':'icon.svg'};
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
const CSP="default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.open-meteo.com; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'";
const hits=new Map();let inflight=0;setInterval(()=>{const n=Date.now();for(const[k,v]of hits)if(!v.some(t=>n-t<60000))hits.delete(k)},60000).unref();
function limited(ip){const n=Date.now(),a=(hits.get(ip)||[]).filter(t=>n-t<60000);a.push(n);hits.set(ip,a);return a.length>20}
function send(res,code,obj,type){res.writeHead(code,{'Content-Type':type||'application/json','X-Content-Type-Options':'nosniff','Content-Security-Policy':CSP,'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Strict-Transport-Security':'max-age=63072000; includeSubDomains','Permissions-Policy':'geolocation=(self), camera=(), microphone=(), payment=()','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-cache'});res.end(typeof obj==='string'||Buffer.isBuffer(obj)?obj:JSON.stringify(obj))}
function body(req){return new Promise((ok,no)=>{let b='',n=0,over=false;req.on('data',d=>{if(over)return;n+=d.length;if(n>4096){over=true;no(Object.assign(new Error('big'),{code:413}));return}b+=d});req.on('end',()=>{if(!over)ok(b)});req.on('error',no)})}
const server=http.createServer(async(req,res)=>{
  try{
    const url=req.url.split('?')[0];
    res.on('finish',()=>{if(res.statusCode>=400)console.log(JSON.stringify({t:new Date().toISOString(),ip:String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim(),m:req.method,u:url,s:res.statusCode}))});
    if(req.method==='GET'&&url==='/api/health')return send(res,200,{ok:true,ai:!!KEY});
    if(req.method==='POST'&&url==='/api/ask'){
      const og=req.headers.origin;if(og){let ok=false;try{ok=new URL(og).host===req.headers.host}catch(_){}if(!ok)return send(res,403,{error:'Forbidden origin'})}
      if(!/^application\/json/i.test(req.headers['content-type']||''))return send(res,415,{error:'JSON required'});
      const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim();
      if(limited(ip))return send(res,429,{error:'Too many requests. Try again in a minute.'});
      let j;try{j=JSON.parse(await body(req))}catch(e){return send(res,e.code===413?413:400,{error:e.code===413?'Request too large':'Invalid JSON'})}
      const ctx=S.validateCtx(j&&j.ctx),q=S.cleanQuery(j&&j.q);
      if(!ctx||!q)return send(res,400,{error:'Missing or invalid question or air data'});
      const sf=S.safety(q);if(sf)return send(res,200,{answer:sf,source:'safety'});
      if(!KEY)return send(res,503,{error:'AI not configured'});
      if(inflight>=20)return send(res,503,{error:'Busy, try again'});inflight++;let r;try{r=await fetch(BASE+'/v1beta/models/'+encodeURIComponent(MODEL)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':KEY},
        body:JSON.stringify({contents:[{parts:[{text:S.buildPrompt(q,ctx)}]}],generationConfig:{temperature:.3,maxOutputTokens:300}}),signal:AbortSignal.timeout(10000)})}finally{inflight--}
      if(!r.ok)return send(res,502,{error:'AI provider error '+r.status});
      const t=S.parseGemini(await r.json());if(!t)return send(res,502,{error:'Empty AI answer'});
      return send(res,200,{answer:t.slice(0,800)+'\n'+S.sources(ctx),source:'gemini'});
    }
    if(req.method==='GET'&&FILES[url]){const f=FILES[url];return send(res,200,fs.readFileSync(path.join(__dirname,f)),MIME[path.extname(f)])}
    send(res,404,{error:'Not found'});
  }catch(e){send(res,500,{error:'Server error'})}
});
server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;server.maxHeadersCount=50;
module.exports=server;
if(require.main===module)server.listen(process.env.PORT||8080,()=>console.log('Svasa on :'+(process.env.PORT||8080)+(KEY?' (AI on)':' (AI off: set GEMINI_API_KEY)')));
