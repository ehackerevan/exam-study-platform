const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
(async()=>{
 const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
 const pack={version:1,schemaVersion:1,id:'marks-qa',title:'個人題目',chapters:[{id:'c1',title:'第一章',sections:[{id:'s1',title:'概念',content:'學習內容'}]}],questions:Array.from({length:12},(_,i)=>({id:'q'+i,chapterId:'c1',sectionId:'s1',question:'題目'+i,type:'single-choice',options:['甲','乙'],answer:0}))};
 const file=path.resolve('.qa-artifacts/marks-fixture.html');fs.writeFileSync(file,compileStudyPackToHtml(pack).html);
 const browser=await chromium.launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const key='study-pack.marks-qa.progress';const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 try{
 await page.goto(pathToFileURL(file).href);await page.locator('[data-view="reader"]').click();
 const forms=page.locator('.chapter-practice-question');assert.equal(await forms.count(),10);
 await forms.first().locator('.question-favorite').click();await forms.first().locator('.question-hide').click();
 assert.equal(await forms.count(),10);assert.equal(await forms.first().locator('.question-favorite').getAttribute('data-question-id'),'q1');
 assert.deepEqual((await state()).hiddenQuestionIds,['q0']);assert.deepEqual((await state()).favoriteQuestionIds,['q0']);assert.equal(Object.keys((await state()).questionStats).length,0);
 await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.hiddenQuestionIds.push('missing','q0');s.favoriteQuestionIds.push('missing','q0');localStorage.setItem(k,JSON.stringify(s));},key);
 await page.reload();await page.locator('[data-view="quiz"]').click();
 assert.deepEqual((await state()).hiddenQuestionIds,['q0']);assert.deepEqual((await state()).favoriteQuestionIds,['q0']);assert(await page.locator('#btn-personal-favorites').isDisabled());
 await page.locator('#personal-question-panel details summary').click();await page.locator('#hidden-question-search').fill('題目0');await page.locator('#hidden-question-list button').click();
 await page.locator('#btn-personal-favorites').click();assert.equal(await page.locator('#quiz-stem').innerText(),'題目0');await page.locator('#quiz-question-actions .question-hide').click();
 assert.equal((await state()).quizHistory.length,0);assert.equal(Object.keys((await state()).questionStats).length,0);
 await page.locator('#question-mark-notice button').first().click();await page.locator('#btn-quiz-back-menu').click();await page.locator('#btn-personal-favorites').click();
 await page.locator('#quiz-options-container .option-item').first().click();await page.locator('#btn-quiz-submit').click();await page.locator('#quiz-question-actions .question-hide').click();
 assert.equal((await state()).quizHistory[0].questionCount,1);assert.equal((await state()).questionStats.q0.attempts,1);
 await page.locator('#btn-quiz-back-menu').click();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await page.locator('#question-mark-notice').getByRole('button',{name:'關閉',exact:true}).click();
 await page.screenshot({path:'.qa-artifacts/personal-marks-mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: favorites, hidden precedence, reload, restore, chapter backfill, unanswered skip, submitted history, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
