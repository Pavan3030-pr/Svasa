'use strict';
const {execFileSync}=require('node:child_process');
const repo=process.env.GITHUB_REPOSITORY,sha=process.env.GITHUB_SHA;
const common=/^(package(-lock)?\.json|vercel\.json|frontend\/|backend\/|api\/|scripts\/wait-deployment\.js)/;
const paths=execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8'}).trim().split('\n');
const expected=[];
if(paths.some(p=>common.test(p)||p==='tests/production-smoke.js'||p==='.github/workflows/production.yml'))expected.push('SVASA production smoke');
if(paths.some(p=>common.test(p)||p==='tests/production-browser.js'||p==='.github/workflows/production-browser.yml'))expected.push('SVASA real production browser');
if(paths.some(p=>common.test(p)||p==='tests/production-capacity.js'||p==='.github/workflows/production-quality.yml'))expected.push('SVASA deployed quality and bounded capacity');
if(paths.some(p=>['backend/lib/gemini.js','frontend/js/intelligence.js','tests/ai-contract.test.js','tests/production-smoke.js','tests/live-ai-pacing.js','.github/workflows/live-ai-evaluation.yml'].includes(p)))expected.push('SVASA strict live Gemini evaluation');
(async()=>{
 if(!paths.some(p=>/^frontend\/|^tests\/browser\.test\.js$|^scripts\/publish-gallery\.js$/.test(p))||!expected.length)return;
 for(let i=0;i<95;i++){
  const head=execFileSync('git',['ls-remote','origin','refs/heads/main'],{encoding:'utf8'}).split(/\s+/)[0];
  if(head!==sha){console.log('Newer main commit; gallery publication will skip.');return;}
  const r=await fetch('https://api.github.com/repos/'+repo+'/actions/runs?head_sha='+sha,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Could not verify production workflow status');
  const runs=(await r.json()).workflow_runs||[];
  const statuses=expected.map(name=>({name,status:runs.find(x=>x.name===name)?.status||'not started'}));
  console.log(JSON.stringify(statuses));
  if(statuses.every(x=>x.status==='completed'))return;
  await new Promise(r=>setTimeout(r,20000));
 }
 throw Error('Production verification did not finish; no screenshot commit made');
})().catch(e=>{console.error(e.message);process.exitCode=1});
