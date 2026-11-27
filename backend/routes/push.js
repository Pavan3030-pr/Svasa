'use strict';
const push=require('../lib/push'),g=require('../lib/guard');
const R=(status,body)=>({status,body});
module.exports=async function route(req){
 if(req.method==='GET'&&req.query?.dispatch==='1'){
  if(!push.authorized(req.headers.authorization))return R(403,{error:'Forbidden'});
  if(!push.configured())return R(503,{error:'Push not configured'});
  try{return R(200,await push.dispatch());}catch(_){return R(503,{error:'Dispatch unavailable'});}
 }
 if(req.method==='GET')return R(200,{enabled:push.configured(),publicKey:push.configured()?process.env.VAPID_PUBLIC_KEY:null});
 if(req.method!=='POST')return R(405,{error:'GET or POST only'});
 if(!g.sameOrigin(req.headers)||!g.isJson(req.headers))return R(403,{error:'Invalid request origin or type'});
 if(g.tooBig(req.body))return R(413,{error:'Request too large'});
 if(!push.configured())return R(503,{error:'Push not configured'});
 try{
  if(await g.rateLimit('push:'+req.ip,5))return R(429,{error:'Too many requests'});
  const status=req.body?.action==='subscribe'?await push.subscribe(req.body):req.body?.action==='unsubscribe'?await push.unsubscribe(req.body):400;
  return R(status,{ok:status===200});
 }catch(_){return R(503,{error:'Push storage unavailable'});}
};
