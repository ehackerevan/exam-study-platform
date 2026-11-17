const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
 const pack={version:1,id:'hidden-save-qa',title:'隱藏保存',chapters:[{id:'c',title:'章',sections:[{id:'s',title:'節',content:'正文'}]}],questions:Array.from({length:3},(_,i)=>({id:'q'+i,chapterId:'c',sectionId:'s',question:i<2?'相同題幹':'其他題目',type:'single-choice',options:['甲','乙'],answer:0}))};
 fs.mkdirSync('.qa-artifacts',{recursive:true});const file=path.resolve('.qa-artifacts/hidden-save.html');fs.writeFileSync(file,compileStudyPackToHtml(pack).html);
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(file).href,key='study-pack.hidden-save-qa.progress';
 const open=async()=>{await page.goto(url);await page.locator('#chapter-practice-title').click();};
 try{
  page.setDefaultTimeout(10000);
  await open();await page.evaluate(()=>{
   const replace=window.StudyProgress.replace;let held=false;
   window.StudyProgress.replace=(...args)=>{
    if(held||!JSON.parse(args[2]).hiddenQuestionIds.includes('q0'))return replace(...args);
    held=true;return new Promise((resolve,reject)=>{window.finishSave=()=>replace(...args).then(resolve,reject);});
   };
  });
  // Reader-position saves may enter the same queue before the hide snapshot.
  await page.locator('#reader-section-select').dispatchEvent('change');
  await page.locator('.question-hide').first().click();
  assert((await page.locator('#question-mark-notice').innerText()).includes('保存中'));
  assert(!(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').hiddenQuestionIds?.includes('q0'),key)));
  await page.waitForFunction(()=>typeof window.finishSave==='function');await page.evaluate(()=>window.finishSave());
  await page.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('已隱藏，之後不再出題'));
  await page.reload();await page.locator('#chapter-practice-title').click();
  assert.deepEqual(await page.locator('.chapter-practice-question .question-favorite').evaluateAll(bs=>bs.map(b=>b.dataset.questionId)),['q1','q2']);
  // A second writer causes a real snapshot conflict, not an injected success/failure flag.
  await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.settings.theme='dark';localStorage.setItem(k,JSON.stringify(s));},key);
  await page.locator('.question-hide').first().click();await page.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('尚未保存'));
  assert(!(await page.locator('#question-mark-notice').innerText()).includes('之後不再出題'));
  assert(!(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).hiddenQuestionIds,key)).includes('q1'));
  await page.locator('#question-mark-notice button').first().click();await page.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('恢復尚未保存'));
  await page.reload();await page.locator('#chapter-practice-title').click();assert.equal(await page.locator('[data-question-id="q1"]').count(),1);
  // Undo while a hide is still pending must not be overwritten by its later completion.
  await page.evaluate(()=>{const replace=window.StudyProgress.replace;window.pendingSaves=[];window.StudyProgress.replace=(...args)=>new Promise((resolve,reject)=>window.pendingSaves.push(()=>replace(...args).then(resolve,reject)));});
  await page.locator('.question-hide').first().click();await page.locator('#question-mark-notice button').first().click();
  let releases=0;
  while((await page.locator('#question-mark-notice').innerText()).includes('恢復中')){
   assert(releases++<6,'save queue did not finish');await page.waitForFunction(()=>window.pendingSaves.length>=1);
   await page.evaluate(async()=>{await window.pendingSaves.shift()();await new Promise(requestAnimationFrame);});
  }
  assert((await page.locator('#question-mark-notice').innerText()).includes('已恢復，可再次出題'));
  assert(!(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).hiddenQuestionIds,key)).includes('q1'));
  await page.reload();await page.locator('#chapter-practice-title').click();
  await page.evaluate(()=>{window.StudyProgress.replace=()=>Promise.reject(new DOMException('full','QuotaExceededError'));});
  await page.locator('.question-hide').first().click();await page.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('尚未保存'));
  assert(!(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).hiddenQuestionIds,key)).includes('q1'));
  await page.locator('#question-mark-notice').getByRole('button',{name:'關閉',exact:true}).click();
  await page.locator('[data-view="quiz"]').click();await page.locator('#personal-question-panel>summary').click();await page.locator('#personal-question-panel details>summary').click();
  await page.locator('#hidden-question-list button').first().click();await page.waitForFunction(()=>document.querySelector('#question-restore-status')?.textContent.includes('恢復尚未保存'));
  assert((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).hiddenQuestionIds,key)).includes('q0'));
  await page.reload();await page.locator('[data-view="quiz"]').click();await page.locator('#personal-question-panel>summary').click();await page.locator('#personal-question-panel details>summary').click();
  await page.locator('#hidden-question-list button').first().click();await page.waitForFunction(()=>document.querySelector('#question-restore-status')?.textContent.includes('已恢復，可再次出題'));
  assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).hiddenQuestionIds,key),[]);assert.deepEqual(errors,[]);
  console.log('PASS: pending, persisted hide, duplicate ID scope, conflict failure, failed undo, pending undo race, write failure, manager restore failure/success');
 }catch(error){console.log(await page.evaluate(()=>({notice:document.querySelector('#question-mark-notice')?.textContent,pending:window.pendingSaves?.length,warning:document.querySelector('#storage-warning-message')?.textContent})));throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
