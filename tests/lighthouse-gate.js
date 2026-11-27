'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=process.argv[2];assert.ok(dir,'Audit directory required');
const floors={performance:90,accessibility:100,'best-practices':95,seo:95};
const failures=[];
for(const page of ['index','app'])for(const mode of ['mobile','desktop']){
 const file=page+'-'+mode+'.json',r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));assert.ok(!r.runtimeError,file+' runtime error');
 for(const [key,min] of Object.entries(floors)){const v=r.categories?.[key]?.score,score=Number.isFinite(v)?Math.round(v*100):null;console.log(file,key,score,'floor',min);if(score===null||score<min)failures.push({file,key,score,min});}
}
assert.deepEqual(failures,[],'Lighthouse release quality floor failed');
