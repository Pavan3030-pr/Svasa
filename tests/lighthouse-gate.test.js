'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{evaluate}=require('./lighthouse-gate');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'svasa-audit-')),log=console.log;console.log=()=>{};
const write=(file,p=100,a=100)=>fs.writeFileSync(path.join(dir,file+'.json'),JSON.stringify({categories:{performance:{score:p/100},accessibility:{score:a/100},'best-practices':{score:1},seo:{score:1}}}));
try{for(const p of ['index','app'])for(const m of ['desktop','mobile'])write(p+'-'+m);write('index-mobile',89);write('index-mobile-sample-2',98);write('index-mobile-sample-3',99);evaluate(dir);
write('index-mobile-sample-2',89);assert.throws(()=>evaluate(dir),/quality floor failed/);
write('index-mobile-sample-2',98);write('index-mobile',84);assert.throws(()=>evaluate(dir),/quality floor failed/);
write('index-mobile',99,99);assert.throws(()=>evaluate(dir),/quality floor failed/);
fs.unlinkSync(path.join(dir,'index-mobile-sample-3.json'));assert.throws(()=>evaluate(dir));
}finally{console.log=log;fs.rmSync(dir,{recursive:true,force:true});}
console.log('Lighthouse fixed-sample median gate, individual regression limit and accessibility tests passed');
