'use strict';const assert=require('node:assert/strict'),push=require('../backend/lib/push'),route=require('../backend/routes/push');
(async()=>{
const valid={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}};
assert.ok(push.validSubscription(valid));for(const endpoint of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://fcm.googleapis.com:444/a','https://user@fcm.googleapis.com/a'])assert.equal(push.validSubscription({...valid,endpoint}),false);
const body={subscription:valid,token:'a'.repeat(64),place:{lat:17.4567,lon:78.4567},threshold:151};
assert.deepEqual(push.validate(body).place,{lat:17.46,lon:78.46});assert.equal(push.validate({...body,threshold:0}),null);assert.equal(push.validate({...body,token:'bad'}),null);
delete process.env.CRON_SECRET;assert.equal(push.configured(),false);assert.equal((await route({method:'GET',headers:{},query:{}})).body.enabled,false);
assert.equal((await route({method:'GET',headers:{},query:{dispatch:'1'}})).status,403);
process.env.CRON_SECRET='fixture';assert.equal(push.authorized('Bearer fixture'),true);assert.equal(push.authorized('Bearer wrong'),false);
assert.equal((await route({method:'GET',headers:{authorization:'Bearer fixture'},query:{dispatch:'1'}})).body.skipped,'Background push not configured');
let record=JSON.stringify({...push.validate(body),last:null}),lock=false,claim=false,sends=0;
const storage=async cmd=>{const [op,key,...args]=cmd;if(op==='ZREMRANGEBYSCORE')return 0;if(op==='ZRANGE')return ['fixture'];if(op==='GET')return record;if(op==='SET'){if(key.includes('dispatch-lock')){if(lock)return null;lock=true;return 'OK';}if(claim)return null;claim=true;return 'OK';}if(op==='EVAL'){if(args[2]===record){record=args[3];return 'OK';}return null;}throw Error('Unexpected '+op);};
const transport={setVapidDetails(){},async sendNotification(subscription,payload){assert.equal(subscription.endpoint,valid.endpoint);assert.match(JSON.parse(payload).body,/180/);sends++;}};
const deps={storage,transport,context:async()=>({aqi:180})};
let result=await push.dispatch(deps);assert.equal(result.sent,1);assert.equal(sends,1);
result=await push.dispatch(deps);assert.equal(result.busy,true);assert.equal(sends,1);
lock=false;claim=false;result=await push.dispatch(deps);assert.equal(result.sent,0);assert.equal(sends,1);
console.log('Web Push validation, disabled mode, dispatch and deduplication tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
