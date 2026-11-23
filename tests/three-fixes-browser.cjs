const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
 fs.mkdirSync('.qa-artifacts',{recursive:true});
 const pack={version:1,id:'three-fixes-qa',title:'驗收',chapters:[{id:'c1',title:'第一章',sections:[{id:'s',title:'節',content:'[官方](https://law.moj.gov.tw/)'}]}],questions:Array.from({length:3},(_,i)=>({id:'q'+i,chapterId:'c1',sectionId:'s',question:'題目'+i,type:'single-choice',options:['甲','乙'],answer:0,knowledgePoints:['主分類','次分類']}))};
 const html=compileStudyPackToHtml(pack).html,file=path.resolve('.qa-artifacts/three-fixes.html'),key='study-pack.three-fixes-qa.progress';fs.writeFileSync(file,html);
 const b=await chromium.launch(),p=await b.newPage({acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const goto=()=>p.goto(pathToFileURL(file).href);
 const reader=async()=>{await p.locator('[data-view="reader"]').click();if(!(await p.locator('#chapter-practice-panel').evaluate(e=>e.open)))await p.locator('#chapter-practice-title').click();};
 const answer=async(index=0,option=1)=>{const form=p.locator('.chapter-practice-question').nth(index);await form.locator('input').nth(option).check();await form.locator('button[type="submit"]').click();};
 try{
  await goto();await reader();await answer(0,0);
  assert.equal(await p.locator('#stat-accuracy-rate').textContent(),'100%');assert.equal(await p.locator('#stat-wrong-questions').textContent(),'0');
  await p.locator('#btn-toggle-complete').click();assert.equal(await p.locator('#stat-completed-chapters').textContent(),'1 / 1');
  await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').questionStats?.q0?.attempts===1,key);
  await p.evaluate(()=>{const real=window.StudyProgress.replace;window.realReplace=real;let failed=false;window.StudyProgress.replace=(...a)=>{if(!failed&&JSON.parse(a[2]).questionStats.q1){failed=true;return Promise.reject(Error('temporary write failure'));}return real(...a);};});
  await answer(1);assert.equal(await p.locator('#stat-accuracy-rate').textContent(),'50%');assert.equal(await p.locator('#stat-wrong-questions').textContent(),'1');await p.locator('#storage-warning-banner').waitFor({state:'visible'});await p.locator('#btn-storage-retry').click();
  await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').questionStats?.q1?.attempts===1,key);
  await answer(2);await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').questionStats?.q2?.attempts===1,key);
  await p.reload();await reader();assert.equal(await p.locator('#stat-wrong-questions').textContent(),'2');
  await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.settings.theme='dark';localStorage.setItem(k,JSON.stringify(s));},key);
  await p.locator('.chapter-practice-question .question-hide').first().click();await p.locator('#storage-warning-banner').waitFor({state:'visible'});await p.locator('#btn-storage-overwrite').click();
  await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).hiddenQuestionIds.includes('q0'),key);
  const download=p.waitForEvent('download');await p.locator('#btn-storage-recovery-export').click();const d=await download;const dest=path.resolve('.qa-artifacts/conflict-both.json');await d.saveAs(dest);const copies=JSON.parse(fs.readFileSync(dest));assert.equal(JSON.parse(copies[0].saved).settings.theme,'dark');assert(!JSON.parse(copies[0].saved).hiddenQuestionIds.includes('q0'));assert(JSON.parse(copies[0].local).hiddenQuestionIds.includes('q0'));
  assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k+'.recovery')).length,key),1);await p.reload();await reader();assert(await p.locator('#btn-storage-recovery-export').isVisible());
  await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.hiddenQuestionIds=[];s.settings.theme='light';localStorage.setItem(k,JSON.stringify(s));},key);
  await p.locator('.chapter-practice-question .question-hide').first().click();await p.locator('#storage-warning-banner').waitFor({state:'visible'});await p.locator('#btn-storage-discard').click();await p.waitForFunction(()=>document.getElementById('storage-warning-banner').style.display==='none');await reader();assert.equal(await p.locator('.chapter-practice-question [data-question-id="q0"]').count(),1);
  for(const course of ['防制洗錢與打擊資恐重點教材','永續發展基礎能力重點教材']){
   const url=pathToFileURL(path.resolve('dist',course+'.html')).href;
   for(let i=0;i<5;i++){await p.goto(url+'?view=home');for(const heading of ['學習統計','官方連結','合格標準'])assert(await p.locator('#view-home').getByRole('heading',{name:heading,exact:true}).isVisible());await p.reload();assert(await p.locator('#home-statistics').isVisible());}
   if(course.startsWith('防制')){const amlQs=JSON.parse(fs.readFileSync(path.resolve('01_教材來源/防制洗錢與打擊資恐重點教材/questions.json'),'utf8'));const amlList=Array.isArray(amlQs)?amlQs:amlQs.questions;const amlExpected=['aml01','aml02','aml03','aml04','aml05'].map(id=>amlList.filter(q=>q.chapterId===id).length);const amlTotal=amlList.length;await p.locator('[data-view="quiz"]').click();const counts=await p.locator('#quiz-select-chapter option').evaluateAll(opts=>opts.map(o=>Number(o.textContent.match(/（(\d+) 題）$/)[1])));assert.deepEqual(counts,amlExpected);assert.equal(counts.reduce((a,b)=>a+b,0),amlTotal);await p.locator('[data-view="progress"]').click();const panelCounts=await p.locator('.weakness-item').evaluateAll(items=>items.map(el=>Number(el.textContent.match(/已練 \d+ \/ (\d+) 題/)[1])).filter(n=>n>0));assert.deepEqual(panelCounts,counts);const knowledge=await p.locator('#quiz-select-knowledge-point option').evaluateAll(opts=>opts.reduce((n,o)=>n+Number(o.textContent.match(/（(\d+) 題）$/)[1]),0));assert.equal(knowledge,amlTotal);}
  }
  const transientContext=await b.newContext();await transientContext.addInitScript(key=>{const get=Storage.prototype.getItem;let failed=false;Storage.prototype.getItem=function(k){if(!failed&&k===key){failed=true;throw Error('transient read failure');}return get.call(this,k);};},key);
  const transient=await transientContext.newPage();await transient.goto(pathToFileURL(file).href);await transient.locator('#storage-warning-banner').waitFor({state:'visible'});await transient.locator('#btn-storage-retry').click();await transient.waitForFunction(k=>!!localStorage.getItem(k),key);await transient.reload();assert.equal(await transient.locator('#stat-question-total').textContent(),'3');await transientContext.close();
  const broken=path.resolve('.qa-artifacts/three-fixes-no-source.html');fs.writeFileSync(broken,html.replace(/window\.__STUDY_PACK__\s*=\s*({.*});/,'window.__STUDY_PACK__ = null;'));await p.goto(pathToFileURL(broken).href+'?view=home');assert(await p.locator('#home-data-error').isVisible());assert((await p.locator('#view-home').innerText()).includes('載入失敗'));
  assert.deepEqual(errors,[]);console.log('PASS: AML 2776 partition, live reading statistics, 5 home visits/reloads for AML/ESG, missing embedded source, retry then later save/reload, explicit conflict overwrite/discard with both snapshots');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
