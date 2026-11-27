'use strict';const assert=require('node:assert/strict'),push=require('../backend/lib/push'),route=require('../backend/routes/push');
(async()=>{
const valid={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}};
assert.ok(push.validSubscription(valid));for(const endpoint of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://fcm.googleapis.com:444/a','https://user@fcm.googleapis.com/a'])assert.equal(push.validSubscription({...valid,endpoint}),false);
const body={subscription:valid,token:'a'.repeat(64),place:{lat:17.4567,lon:78.4567},threshold:151};
assert.deepEqual(push.validate(body).place,{lat:17.46,lon:78.46});assert.equal(push.validate({...body,threshold:0}),null);assert.equal(push.validate({...body,token:'bad'}),null);
delete process.env.CRON_SECRET;assert.equal(push.configured(),false);assert.equal((await route({method:'GET',headers:{},query:{}})).body.enabled,false);
assert.equal((await route({method:'GET',headers:{},query:{dispatch:'1'}})).status,403);
process.env.CRON_SECRET='fixture';assert.equal(push.authorized('Bearer fixture'),true);assert.equal(push.authorized('Bearer wrong'),false);
console.log('Web Push validation and disabled-mode tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
