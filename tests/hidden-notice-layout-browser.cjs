const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
 const pack={version:1,id:'notice-layout-qa',title:'隱藏提示版面',chapters:[{id:'c',title:'章',sections:[{id:'s',title:'節',content:'正文內容。'.repeat(30)}]}],questions:Array.from({length:3},(_,i)=>({id:'q'+i,chapterId:'c',sectionId:'s',question:'第'+i+'題：請判斷正確選項。',type:'single-choice',options:['甲：這是第一個選項','乙：這是第二個選項'],answer:0}))};
 fs.mkdirSync('.qa-artifacts',{recursive:true});const file=path.resolve('.qa-artifacts/hidden-notice-layout.html');fs.writeFileSync(file,compileStudyPackToHtml(pack).html);
 const browser=await chromium.launch(),results=[],errors=[];
 const geometry=async(page,selector)=>{
  const result=await page.evaluate(selector=>{
   const notice=document.getElementById('question-mark-notice'),n=notice.getBoundingClientRect();
   const overlaps=[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return n.left<r.right&&n.right>r.left&&n.top<r.bottom&&n.bottom>r.top;}).length;
   return {position:getComputedStyle(notice).position,overlaps,width:document.documentElement.scrollWidth,viewport:innerWidth,buttons:[...notice.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height),parent:notice.parentElement.id};
  },selector);
  assert.notEqual(result.position,'fixed');assert.notEqual(result.position,'absolute');assert.equal(result.overlaps,0);assert.equal(result.width,result.viewport);assert(result.buttons.every(h=>h>=44));return result;
 };
 const reachable=async locator=>{await locator.scrollIntoViewIfNeeded();assert(await locator.evaluate(e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return at===e||e.contains(at)||at?.contains(e);}));};
 try{
  for(const width of [320,390,1440])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(file).href);await page.locator('#chapter-practice-title').click();
   await page.evaluate(()=>{const replace=window.StudyProgress.replace;window.StudyProgress.replace=(...args)=>JSON.parse(args[2]).hiddenQuestionIds.includes('q0')?new Promise((resolve,reject)=>{window.releaseHide=()=>{window.StudyProgress.replace=replace;return replace(...args).then(resolve,reject);};}):replace(...args);});
   await page.locator('.question-hide').first().click();await page.waitForFunction(()=>typeof window.releaseHide==='function');
   assert((await page.locator('#question-mark-notice').innerText()).includes('保存中'));assert.equal(await page.locator('#question-mark-notice').evaluate(e=>e.parentElement.id),'chapter-practice-preview');
   const pending=await geometry(page,'.chapter-practice-question input,.chapter-practice-question button[type="submit"]');
   await page.evaluate(()=>window.releaseHide());await page.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('已隱藏，之後不再出題'));
   const option=page.locator('.chapter-practice-question input').first();await reachable(option);await option.check();
   const submit=page.locator('.chapter-practice-question button[type="submit"]').first();await reachable(submit);
   await page.locator('#question-mark-notice').getByRole('button',{name:'關閉',exact:true}).click();await submit.click();
   await page.evaluate(()=>{window.StudyProgress.replace=()=>Promise.reject(new DOMException('full','QuotaExceededError'));});
   await page.locator('.question-hide').first().click();await page.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('尚未保存'));
   const failed=await geometry(page,'.chapter-practice-question input,.chapter-practice-question button[type="submit"]');
   await page.locator('#question-mark-notice').scrollIntoViewIfNeeded();await page.screenshot({path:'.qa-artifacts/notice-reader-'+width+'-'+theme+'.png'});
   await page.locator('#question-mark-notice').getByRole('button',{name:'復原',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('恢復尚未保存'));await page.locator('#question-mark-notice').getByRole('button',{name:'關閉',exact:true}).click();
   let hides=0;while(await page.locator('.chapter-practice-question').count()){assert(hides++<3);await page.locator('.question-hide').first().click();}
   assert.equal(await page.locator('#question-mark-notice').evaluate(e=>e.parentElement.id),'chapter-practice-preview');await reachable(page.locator('#question-mark-notice').getByRole('button',{name:'復原',exact:true}));
   await page.locator('#question-mark-notice').getByRole('button',{name:'關閉',exact:true}).click();
   await page.locator('[data-view="quiz"]').click();const personal=page.locator('#personal-question-panel>summary');await reachable(personal);await personal.click();
   await context.close();
   const quizContext=await browser.newContext({viewport:{width,height:900},colorScheme:theme}),quiz=await quizContext.newPage();quiz.setDefaultTimeout(10000);quiz.on('pageerror',e=>errors.push(e.message));
   await quiz.goto(pathToFileURL(file).href+'?view=quiz');await quiz.locator('#btn-quick-ten').click();await quiz.locator('#quiz-question-actions .question-hide').click();
   await quiz.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('已隱藏，之後不再出題'));
   const running=await geometry(quiz,'#quiz-options-container button,#quiz-options-container label,#btn-quiz-submit');assert(await quiz.locator('#quiz-running-panel #question-mark-notice').isVisible());
   const quizOption=quiz.locator('#quiz-options-container .option-item').first();await reachable(quizOption);await quizOption.click();await reachable(quiz.locator('#btn-quiz-submit'));await quiz.locator('#btn-quiz-submit').click();
   await quiz.locator('#quiz-question-actions .question-hide').click();await quiz.locator('#quiz-question-actions .question-hide').click();await quiz.locator('#quiz-summary-panel').waitFor({state:'visible'});
   assert(await quiz.locator('#quiz-summary-panel #question-mark-notice').isVisible());await quiz.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('已隱藏，之後不再出題'));
   const summary=await geometry(quiz,'#quiz-summary-panel .quiz-card button');await quiz.screenshot({path:'.qa-artifacts/notice-quiz-'+width+'-'+theme+'.png'});
   await reachable(quiz.locator('#question-mark-notice').getByRole('button',{name:'復原',exact:true}));await quiz.locator('#question-mark-notice').getByRole('button',{name:'復原',exact:true}).click();await quiz.waitForFunction(()=>document.querySelector('#question-mark-notice').textContent.includes('已恢復，可再次出題'));
   await quiz.locator('#question-mark-notice').getByRole('button',{name:'關閉',exact:true}).click();await quiz.locator('#btn-quiz-back-menu').click();await reachable(quiz.locator('#personal-question-panel>summary'));await quiz.locator('#personal-question-panel>summary').click();
   await quizContext.close();results.push({width,theme,pending,failed,running,summary});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('.qa-artifacts/notice-layout-results.json',JSON.stringify(results,null,2));console.log('PASS: inline notice geometry, reader/quiz pending/failure/empty/summary, reachable answer/personal controls; 320/390/1440 light/dark');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
