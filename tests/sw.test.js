'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
const handlers={},notifications=[],messages=[],opens=[];
const stored=[];const env={crypto:require('node:crypto').webcrypto,Response,caches:{open:async()=>({put:async(k,v)=>stored.push({k,v}),keys:async()=>stored.map(x=>x.k),delete:async()=>true})},self:{addEventListener:(n,fn)=>handlers[n]=fn,registration:{scope:'https://example.test/',showNotification:async(...args)=>notifications.push(args)}},clients:{matchAll:async()=>[{postMessage:m=>messages.push(m.type)}],openWindow:async u=>opens.push(String(u))},URL};
vm.runInNewContext(fs.readFileSync('frontend/sw.js','utf8'),env);
let work;const event={data:{json:()=>({title:'Svasa · Test notification',body:'A real test message'})},waitUntil:p=>work=p};
handlers.push(event);await work;assert.equal(notifications.length,1);assert.deepEqual(messages,['svasa-inbox-update','svasa-test-shown']);assert.equal(stored.length,1);assert.equal((await stored[0].v.json()).title,'Svasa · Test notification');
handlers.push({data:{json:()=>({title:42})},waitUntil:()=>{throw Error('invalid payload accepted');}});assert.equal(notifications.length,1);
let closed=false;handlers.notificationclick({notification:{close:()=>closed=true},waitUntil:p=>work=p});await work;assert.equal(closed,true);assert.equal(opens[0],'https://example.test/app.html');
console.log('Service worker notification lifecycle fixture passed; physical delivery not tested');
})().catch(e=>{console.error(e);process.exitCode=1;});
