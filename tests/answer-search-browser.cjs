const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {htmlFiles}=await import('../scripts/harmonize-ui.js');
 const browser=await chromium.launch({headless:true}),context=await browser.newContext(),errors=[],results=[];
 await context.route('https://www.google.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Search URL verification</title>'}));
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  const files=htmlFiles().filter(file=>file.replaceAll('\\','/')!=='src/renderer/template.html');
  let clicked=false;
  for(const file of files){
   await p.goto(pathToFileURL(path.resolve(file)).href);
   const pack=await p.evaluate(()=>!!window.__STUDY_PACK__);
   if(pack){await p.locator('#shortcut-random-quiz').click();}
   const questions=p.locator(pack?'#quiz-stem':'.q-text');
   if(!await questions.count())continue;
   await p.waitForFunction(()=>[...document.querySelectorAll('#quiz-stem,.q-text')].every(q=>q.nextElementSibling?.classList.contains('answer-search')));
   const invalid=await questions.evaluateAll(nodes=>nodes.filter(question=>{
    const link=question.nextElementSibling;
    const stem=question.textContent.replace(/^\s*【(?:場次\s*[^】]*|第\s*\d+\s*屆[^】]*)第\s*\d+\s*題】\s*/, '').trim();
    return link.textContent!=='查答案'||new URL(link.href).searchParams.get('q')!==stem||link.target!=='_blank';
   }).length);
   assert.equal(invalid,0,file);
   if(pack&&!clicked){
    const snapshot=await p.evaluate(()=>JSON.stringify(localStorage)),originalUrl=p.url();
    assert.equal(await p.locator('.answer-search').first().isVisible(),true);const popupPromise=context.waitForEvent('page');await p.locator('.answer-search').first().click();const popup=await popupPromise;await popup.waitForLoadState();
    assert.equal(new URL(popup.url()).searchParams.get('q'),await p.locator('.answer-search').first().evaluate(a=>new URL(a.href).searchParams.get('q')));
    assert.equal(p.url(),originalUrl);assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)),snapshot);await popup.close();
    await p.locator('.option-item').first().click();await p.locator('#btn-quiz-submit').click();await p.locator('#btn-quiz-next').click();
    await p.waitForFunction(()=>new URL(document.querySelector('#quiz-stem+.answer-search').href).searchParams.get('q')===document.getElementById('quiz-stem').textContent.replace(/^\s*【(?:場次\s*[^】]*|第\s*\d+\s*屆[^】]*)第\s*\d+\s*題】\s*/, '').trim());
    assert.equal(await p.locator('#quiz-stem+.answer-search').count(),1);clicked=true;
   }
   results.push({file,questions:await questions.count()});
  }
  for(const [input,expected] of [
   ['【場次 115-4 第 23 題】依規定何者正確？','依規定何者正確？'],
   ['【第 8 屆第 1 題】何者正確？','何者正確？'],
   ['【第 25 屆 法規 第 1 題】何者正確？','何者正確？'],
   ['【場次 107年第1次 第 1 題】何者正確？','何者正確？'],
   ['【複選題】何者正確？','【複選題】何者正確？'],
   ['依【第23條】規定何者正確？','依【第23條】規定何者正確？']
  ]){
   await p.evaluate(text=>{document.body.innerHTML='<div class="q-text"></div>';document.querySelector('.q-text').textContent=text;},input);
   await p.waitForFunction(expected=>{const a=document.querySelector('.q-text+.answer-search');return a&&new URL(a.href).searchParams.get('q')===expected;},expected);
   assert.equal(await p.locator('.q-text').textContent(),input);
  }
   const questionPages=files.filter(file=>path.basename(file)!=='index.html'&&file!=='src/renderer/template.html');
   assert.equal(results.length,questionPages.length);assert(clicked);assert.deepEqual(errors,[]);
   console.log(`PASS: all ${results.length} question-bearing pages have exact Google question URLs; popup, unchanged storage and next-question update verified`);
 }finally{fs.writeFileSync('.qa-artifacts/answer-search.json',JSON.stringify({results,errors,date:new Date().toISOString()},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
