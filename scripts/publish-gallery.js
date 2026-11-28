'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sha=process.argv[2],run=process.argv[3],source=process.argv[4]||'gallery-artifacts';
assert.match(sha||'',/^[a-f0-9]{40}$/);assert.match(run||'',/^\d+$/);
const files=['landing-desktop','dashboard-desktop','planner-desktop','parallel-futures','forecast-resilience','decision-certificate','constraint-resolution','adaptive-day','airtrust','family-protection','impact-ledger','forecast-desktop','assistant-desktop','cities-desktop','breathe-desktop','landing-mobile','dashboard-mobile','planner-mobile'];
const target='docs/screenshots/current';fs.mkdirSync(target,{recursive:true});
for(const name of files){
 const bytes=fs.readFileSync(path.join(source,name+'.png'));
 assert.ok(bytes.length>=1024&&bytes.length<=10000000,'Unexpected screenshot size: '+name);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Expected PNG: '+name);
 fs.writeFileSync(path.join(target,name+'.png'),bytes);
}
const image=(alt,name)=>'!['+alt+']('+target+'/'+name+'.png)';
const mobile=(alt,name)=>'<img src="'+target+'/'+name+'.png" width="280" alt="'+alt+'">';
const lines=[
 'Actual application UI captured by automated Chromium on commit '+sha.slice(0,7)+'. **Controlled test data**, not live pollution readings or participant evidence. [Capture workflow](https://github.com/Pavan3030-pr/Svasa/actions/runs/'+run+').',
 '',
 '### Landing experience',image('SVASA landing page','landing-desktop'),'',
 '### Personal air dashboard',image('Dashboard with air quality and decision rail','dashboard-desktop'),'',
 '### Parallel Futures — compare two routines',image('Personal air decision workspace','planner-desktop'),'',
 image('Side-by-side original and optimized exposure projections','parallel-futures'),'',
 '### Forecast resilience and decision proof',image('Four deterministic forecast stress scenarios','forecast-resilience'),'',
 '| Decision certificate | Constraint resolution |','|:---:|:---:|','| '+image('Recomputed optimality certificate','decision-certificate')+' | '+image('Explicit conflict resolution','constraint-resolution')+' |','',
 '| Adaptive Day | AirTrust |','|:---:|:---:|','| '+image('Adaptive day forecast review','adaptive-day')+' | '+image('AirTrust evidence quality','airtrust')+' |','',
 '### Family Protection',image('Shared forecast window and family profiles','family-protection'),'',
 '### Impact Ledger',image('Saved plans and self-reported completion','impact-ledger'),'',
 '| Forecast | AI assistant |','|:---:|:---:|','| '+image('Hourly and historical forecast','forecast-desktop')+' | '+image('Multilingual assistant with safety bypass','assistant-desktop')+' |','',
 '| City comparison | Guided breathing |','|:---:|:---:|','| '+image('City comparison view','cities-desktop')+' | '+image('Guided breathing view','breathe-desktop')+' |','',
 '### Responsive mobile experience','| Landing | Dashboard | Planner |','|:---:|:---:|:---:|','| '+mobile('Mobile landing','landing-mobile')+' | '+mobile('Mobile dashboard','dashboard-mobile')+' | '+mobile('Mobile planner','planner-mobile')+' |'
];
const readme=fs.readFileSync('README.md','utf8'),start='<!-- SVASA_GALLERY_START -->',end='<!-- SVASA_GALLERY_END -->';
assert.equal(readme.split(start).length,2);assert.equal(readme.split(end).length,2);
const i=readme.indexOf(start)+start.length,j=readme.indexOf(end);assert.ok(j>i);
fs.writeFileSync('README.md',readme.slice(0,i)+'\n'+lines.join('\n')+'\n'+readme.slice(j));
fs.writeFileSync(path.join(target,'source.json'),JSON.stringify({commit:sha,run,source:'Chromium fixture browser suite; controlled data'},null,2)+'\n');
console.log('Gallery prepared: '+files.length+' actual Chromium screenshots');
