/* Reports and local usability data; no network requests. */
(function(root){'use strict';root.SvasaReports={init({$,store,esc,forecast,getPlan,invalidatePlan,show,banner}){
let reports=store.get('svasa_reports',[]);
if(!Array.isArray(reports))reports=[];
function recentReports(){const now=Date.now(),cutoff=now-7*86400000;return reports.filter(x=>x&&Date.parse(x.createdAt)>=cutoff&&Date.parse(x.createdAt)<=now+60000&&Number.isFinite(x.exposure)&&x.exposure>=0&&typeof x.city==='string').slice(0,100);}
function renderReports(){
  const entries=recentReports();
  $('reportsummary').textContent=entries.length?entries.length+' saved projected schedules · '+entries.filter(x=>x.changePct>0).length+' lower than their preferred schedule.':'No saved plans yet. Optimize a day and choose Save projected schedule.';
  $('reportlist').innerHTML=entries.map(x=>'<article class="reportentry"><h3>'+esc(x.city)+'</h3><small>'+esc(new Date(x.createdAt).toLocaleString())+'</small><p><strong>'+x.exposure.toFixed(1)+' µg·h/m³</strong> projected concentration-time proxy'+(Number.isFinite(x.changePct)?' · '+x.changePct+'% reduction versus preferred schedule':'')+'</p><p class="muted">Model forecast, not measured personal exposure.</p></article>').join('');
  $('exportreport').disabled=!entries.length;$('clearreport').disabled=!reports.length;
}
$('saveplan').onclick=()=>{const plan=getPlan();if(!plan||!forecast().length)return;const next=[plan,...recentReports()].slice(0,100);if(!store.set('svasa_reports',next)){banner('Device storage unavailable. Your schedule was not saved.');return;}reports=next;invalidatePlan();renderReports();show('reports');};
$('clearreport').onclick=()=>{if(!store.set('svasa_reports',[])){banner('Could not clear saved plans. Check browser storage.');return;}reports=[];renderReports();};
$('exportreport').onclick=()=>{const data={method:'Projected outdoor PM2.5 concentration × hours; not actual exposure or inhaled dose',plans:recentReports()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='svasa-projected-plans.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
renderReports();

/* Optional local-only usability evidence. No analytics or remote submission. */
let feedback=store.get('svasa_feedback',[]);if(!Array.isArray(feedback))feedback=[];
function renderFeedback(){const n=feedback.length;$('feedbacksummary').textContent=n?n+' local responses saved. Export only if you choose to share them.':'No feedback submitted on this device.';$('exportfeedback').disabled=!n;$('clearfeedback').disabled=!n;}
$('feedbackform').onsubmit=e=>{e.preventDefault();const task=$('feedbacktask').value,trust=$('feedbacktrust').value,ease=Number($('feedbackease').value);if(!['yes','partly','no'].includes(task)||!['yes','partly','no'].includes(trust)||!Number.isInteger(ease)||ease<1||ease>5)return;const next=[{task,trust,ease},...feedback].slice(0,100);if(!store.set('svasa_feedback',next)){$('feedbacksummary').textContent='Device storage unavailable; feedback not saved.';return;}feedback=next;e.target.reset();renderFeedback();};
$('exportfeedback').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({method:'Optional self-reported usability responses; local device; no clinical outcomes',responses:feedback},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='svasa-usability-feedback.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('clearfeedback').onclick=()=>{if(!store.set('svasa_feedback',[])){$('feedbacksummary').textContent='Feedback could not be cleared from device storage.';return;}feedback=[];renderFeedback();};renderFeedback();


}};})(window);
