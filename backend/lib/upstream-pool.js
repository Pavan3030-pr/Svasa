'use strict';
// Per-instance admission control, not a distributed throughput guarantee.
// Identical requests coalesce before the capacity check; never enqueue unlimited work.
function createPool(limit){
 if(!Number.isInteger(limit)||limit<1)throw Error('Invalid upstream limit');
 const pending=new Map();let active=0,peak=0,joined=0,rejected=0,completed=0,failed=0;
 async function run(key,task){
  if(pending.has(key)){joined++;return pending.get(key);}
  if(active>=limit){rejected++;throw Object.assign(Error('Upstream capacity reached'),{code:'UPSTREAM_BUSY'});}
  active++;peak=Math.max(peak,active);
  const work=Promise.resolve().then(task).then(value=>{completed++;return value;},error=>{failed++;throw error;}).finally(()=>{active--;pending.delete(key);});
  pending.set(key,work);return work;
 }
 return {run,stats:()=>({limit,active,peak,joined,rejected,completed,failed})};
}
module.exports={createPool};
