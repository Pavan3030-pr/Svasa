'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const pairs=[['frontend/app.html','css/styles.css'],['frontend/index.html','css/landing.css']],check=process.argv.includes('--check'),hashes=[];
for(const [html,css] of pairs){const before=fs.readFileSync(html,'utf8'),body='\n'+fs.readFileSync('frontend/'+css,'utf8').replace(/\r\n/g,'\n');const start='<style data-svasa-css="'+css+'">',i=before.indexOf(start),j=before.indexOf('</style>',i);assert.ok(i>=0&&j>i);const after=before.slice(0,i+start.length)+body+before.slice(j);if(check)assert.equal(before,after,'Run npm run sync:styles');else fs.writeFileSync(html,after);hashes.push("'sha256-"+crypto.createHash('sha256').update(body).digest('base64')+"'");}
const clause="style-src 'self' "+hashes.join(' ')+";";
for(const path of ['vercel.json','backend/server.js']){const before=fs.readFileSync(path,'utf8'),after=before.replace(/style-src 'self'[^;]*;/,clause);if(check)assert.equal(before,after,'Style CSP hash mismatch: '+path);else fs.writeFileSync(path,after);}
console.log('Embedded styles and CSP hashes match');
