'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const core=fs.readFileSync('frontend/js/core.js','utf8'),landing=fs.readFileSync('frontend/js/landing.js','utf8');
function part(from,to){const i=core.indexOf(from),j=core.indexOf(to,i+from.length);assert.ok(i>=0&&j>i,'Core extraction anchors changed: '+from);return core.slice(i,j);}
const pieces=[part('  const BANDS = [','  const POLLUTANTS = {'),part('  function band(aqi)','  function dominant(cur)'),part('  function bestWindow(hours, len)','  function cleanQuestion(q)'),part('  function plusHour(t)','  function isOffTopic(t)'),part('  function verdict(aqi,p)','  const PM_BP=')];
const bundle='// Generated from core.js and landing.js. Run npm run sync:landing.\\n'.replace('\\n','\n')+'(function(){\n'+pieces.join('\n')+'\n  const S={band,readingAge,verdict,bestWindow,hourlyFrom};\n'+landing.replace('const S = window.Svasa, $ =','const $ =')+'\n})();\n';
const file='frontend/js/landing.bundle.js';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),bundle,'Run npm run sync:landing');else fs.writeFileSync(file,bundle);
console.log('Landing bundle matches shared air-quality functions');
