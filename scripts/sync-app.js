'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const paths=['core.js','reports.js','push-ui.js','app.js'];
const bundle="// Generated from core.js, reports.js, push-ui.js and app.js. Run npm run sync:app.\n"+paths.map(p=>fs.readFileSync('frontend/js/'+p,'utf8')).join('\n;\n')+'\n';
const out='frontend/js/app.bundle.js';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(out,'utf8'),bundle,'Run npm run sync:app');else fs.writeFileSync(out,bundle);
console.log('Application bundle matches modular sources');
