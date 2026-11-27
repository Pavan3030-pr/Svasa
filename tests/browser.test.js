'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs');
const origin='http://localhost:8080';
async function accessibility(page,name){
  await page.evaluate(require('axe-core').source);
  const report=await page.evaluate(()=>window.axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  const violations=report.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,targets:v.nodes.map(n=>n.target)}));
  fs.writeFileSync('test-artifacts/axe-'+name+'.json',JSON.stringify({passes:report.passes.length,violations},null,2));
  console.log('Accessibility '+name+': '+report.passes.length+' passing rules, '+violations.length+' violation rules');
}
const current=new Date();current.setUTCMinutes(0,0,0);
const stamp=d=>d.toISOString().slice(0,16);
const hour=3600000;
const times=Array.from({length:96},(_,i)=>stamp(new Date(current.getTime()+(i-48)*hour)));
const aqi=times.map((_,i)=>45+(i%12)*8),pm=aqi.map(x=>Math.round(x/3));
const fixture={utc_offset_seconds:0,timezone:'GMT',current:{time:stamp(current),us_aqi:112,pm2_5:38,pm10:61,nitrogen_dioxide:16,ozone:40,sulphur_dioxide:4,carbon_monoxide:220,us_aqi_pm2_5:112},hourly:{time:times,us_aqi:aqi,pm2_5:pm}};
const cors={'access-control-allow-origin':'*'};
async function stub(page){
  await page.route('**/api/health',r=>r.fulfill({json:{ok:true,ai:true,stations:true,backgroundPush:false}}));
  await page.route('https://air-quality-api.open-meteo.com/**',r=>{const u=new URL(r.request().url()),lat=u.searchParams.get('latitude').split(','),lon=u.searchParams.get('longitude').split(',');if(lat.length>1)return r.fulfill({json:lat.map((v,i)=>({...fixture,latitude:Number(v),longitude:Number(lon[i]),current:{...fixture.current,us_aqi:61+i}})).reverse(),headers:cors});return r.fulfill({json:fixture,headers:cors});});
  await page.route('https://api.open-meteo.com/**',r=>r.fulfill({json:{current:{temperature_2m:26,relative_humidity_2m:62,wind_speed_10m:10}},headers:cors}));
  await page.route('**/api/stations?**',r=>r.fulfill({json:{station:{name:'Fixture monitor',pm25:35,pm10:62,distanceKm:3,ageHours:1,time:new Date().toISOString()}}}));
  await page.route('**/api/ask',r=>{const data=r.request().postDataJSON();assert.equal(typeof data.place.lat,'number');return r.fulfill({json:{answer:'Fixture assistant response. Model data is an estimate.',source:'gemini'}});});
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  fs.mkdirSync('test-artifacts',{recursive:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await stub(page);
    await page.goto(origin+'/');await page.waitForFunction(()=>document.querySelector('#hAqi').textContent==='112');
    await page.locator('#ticker').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('#tickNote').textContent.includes('6 of 6'));assert.deepEqual(await page.locator('#ticker .tk b').allTextContents(),['112','61','62','63','64','65']);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-artifacts/landing-desktop.png',fullPage:true});await accessibility(page,'landing');
    await page.goto(origin+'/app.html');await page.waitForFunction(()=>document.querySelector('#hero').textContent.includes('112'));
    if(await page.locator('#onbskip').isVisible())await page.locator('#onbskip').click();
    await page.waitForFunction(()=>document.querySelector('#gs').textContent.includes('Fixture monitor'));assert.match(await page.locator('#railavg').textContent(),/^\d+$/);assert.equal(await page.locator('.actionpriority').count(),1);assert.equal(await page.locator('.pollutantprimary').count(),1);assert.equal(await page.locator('.forecastpreview .hourtrack').count(),12);assert.equal(await page.locator('#scalebands .scaleactive').count(),1);assert.equal(await page.locator('#scalebands .scaleactive').getAttribute('data-band'),'usg');await page.locator('#refreshair').click();await page.waitForFunction(()=>document.querySelector('#aqivalue').textContent==='112'&&!document.querySelector('#refreshair').disabled);assert.equal(await page.locator('#scalebands .scaleactive').getAttribute('data-band'),'usg');assert.ok(await page.locator('.guidelinetrack').count()>0);await page.locator('#railsave').click();await page.locator('#railplaces [data-place]').waitFor();await page.locator('#railplaces [data-unsave]').click();assert.equal(await page.locator('#railplaces [data-place]').count(),0);await page.locator('#notificationbell').click();await page.locator('#notificationsettings').click();assert.equal(await page.locator('#notif').isVisible(),true);await page.locator('#notificationclose').click();
    await page.screenshot({path:'test-artifacts/dashboard-desktop.png',fullPage:true});await accessibility(page,'dashboard');
    await page.locator('[data-view="hourly"]').click();await page.locator('#chart svg').waitFor();await page.locator('#hist svg').waitFor();await page.locator('[data-view="plan"]').click();await page.locator('#optimizeday').click();await page.waitForFunction(()=>document.querySelector('#dayresult').textContent.includes('YOUR PROPOSED SCHEDULE'));
    await page.screenshot({path:'test-artifacts/planner-desktop.png',fullPage:true});await accessibility(page,'planner');
    await page.locator('#saveplan').click();await page.waitForFunction(()=>document.querySelector('#reportsummary').textContent.includes('1 saved'));
    await page.locator('#notificationbell').click();await page.getByText('Schedule saved',{exact:true}).waitFor();await page.locator('#notificationread').click();assert.match(await page.locator('#notificationbell').getAttribute('aria-label'),/0 unread/);await page.locator('#notificationclose').click();await page.reload();await page.locator('#notificationbell').click();await page.getByText('Schedule saved',{exact:true}).waitFor();await page.getByText('Schedule saved',{exact:true}).click();assert.equal(await page.locator('#v-reports').isVisible(),true);
    const download=page.waitForEvent('download');await page.locator('#exportreport').click();assert.equal((await download).suggestedFilename(),'svasa-projected-plans.json');
    await page.locator('#feedbacktask').selectOption('yes');await page.locator('#feedbacktrust').selectOption('partly');await page.locator('#feedbackease').selectOption('4');await page.locator('#feedbackform button[type=submit]').click();assert.match(await page.locator('#feedbacksummary').textContent(),/1 local responses/);const fd=page.waitForEvent('download');await page.locator('#exportfeedback').click();assert.equal((await fd).suggestedFilename(),'svasa-usability-feedback.json');await page.locator('#clearfeedback').click();assert.equal(await page.locator('#exportfeedback').isDisabled(),true);
    await page.locator('[data-view="family"]').click();await page.locator('#familyname').fill('Family member');await page.locator('#familyprofile').selectOption('child');await page.locator('#familyform button[type=submit]').click();await page.locator('.familymember').waitFor();assert.ok((await page.locator('.familymember').textContent()).includes('Family member'));
    await page.locator('[data-view="ask"]').click();await page.locator('#aq').fill('Can I go outside?');await page.locator('#af button').click();await page.getByText('Fixture assistant response. Model data is an estimate.',{exact:true}).waitFor();
    await page.locator('#aq').fill('I cannot breathe');await page.locator('#af button').click();await page.locator('.msg.urgent').waitFor();
    await page.screenshot({path:'test-artifacts/assistant-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.locator('[data-view="today"]').click();await page.screenshot({path:'test-artifacts/dashboard-mobile.png',fullPage:true});await accessibility(page,'dashboard-mobile');
    await page.locator('[data-view="plan"]').click();assert.equal(await page.locator('#optimizeday').isVisible(),true);await page.screenshot({path:'test-artifacts/planner-mobile.png',fullPage:true});await accessibility(page,'planner-mobile');
    await page.locator('[data-view="reports"]').click();assert.equal(await page.locator('#reportsummary').isVisible(),true);
    assert.deepEqual(errors,[],'Uncaught browser errors');await context.close();
    const offline=await browser.newContext({serviceWorkers:'block'}),p=await offline.newPage();await p.route('https://air-quality-api.open-meteo.com/**',r=>r.abort());await p.route('https://api.open-meteo.com/**',r=>r.abort());await p.goto(origin+'/app.html');await p.waitForFunction(()=>document.querySelector('#hero').textContent.includes('Sample data'));assert.ok((await p.locator('#adv').textContent()).includes('Data unavailable'));await p.locator('[data-view="plan"]').click();assert.equal(await p.locator('#optimizeday').isDisabled(),true);await offline.close();
    const corrupt=await browser.newContext({serviceWorkers:'block'}),bad=await corrupt.newPage(),badErrors=[];bad.on('pageerror',e=>badErrors.push(e.message));
    await bad.addInitScript(()=>{localStorage.setItem('svasa_recent',JSON.stringify({bad:true}));localStorage.setItem('svasa_snap_v2_28.6139,77.2090',JSON.stringify({at:Date.now(),data:{current:{us_aqi:112,time:'invalid'}}}));});
    await bad.route('https://air-quality-api.open-meteo.com/**',r=>r.abort());await bad.route('https://api.open-meteo.com/**',r=>r.abort());await bad.goto(origin+'/app.html');
    await bad.waitForFunction(()=>document.querySelector('#hero').textContent.includes('Sample data'));assert.equal(await bad.locator('#goplan').isDisabled(),true);assert.deepEqual(badErrors,[]);await corrupt.close();
    console.log('Corrupt snapshot recovery and stale planning protection passed.');
    console.log('Desktop/mobile browser workflows passed with explicit provider fixtures.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
