const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd(), evidence = path.join(root,'.qa-artifacts');
fs.mkdirSync(evidence,{recursive:true});
const pack = {version:1,schemaVersion:1,id:'learner-qa',title:'學習流程驗收',chapters:[{id:'c01',title:'第一章',sections:[{id:'s01',title:'概念表',content:'**重要概念**\n\n| 名稱 | 比較 |\n| --- | --- |\n| A | B |\n\n[第二章](02_第二章.md)\n\n<img src="https://example.invalid/image" onerror="window.injected=1"><script>window.injected=1</script>',keyPoints:['**自我檢核**'],notes:[]},{id:'s02',title:'下一小節',content:'<p>小節內容</p>'.repeat(40),keyPoints:[],notes:[]}]},{id:'c02',title:'第二章',sections:[{id:'s03',title:'延伸概念',content:'比較與歸納',keyPoints:[],notes:[]}]}],questions:Array.from({length:6},(_,i)=>({id:'q'+i,chapterId:'c01',sectionId:'s02',type:i===5?'multiple-choice':'single-choice',question:'驗收題'+i,options:['正確概念','混淆選項','另一正確概念'],answer:i===5?[0,2]:0,explanation:'歷屆官方正確解答為第 (1) 項。'}))};
const results=[], errors=[], external=[];
pack.chapters[1].sections[0].content += '\n\n<!-- <script>未閉合的教材範例';
(async()=>{
  const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
  const fixture=path.join(evidence,'learner-fixture.html');
  fs.writeFileSync(fixture,compileStudyPackToHtml(pack).html);
  const url=pathToFileURL(fixture).href, key='study-pack.learner-qa.progress';
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const context=await browser.newContext({acceptDownloads:true});
  await context.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
  context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',dialog=>dialog.accept());});
  try {
    const page=await context.newPage();
    await page.goto(url);
    await page.locator('[data-view="search"]').click();
    await page.locator('#search-input').fill('自我檢核');
    assert(await page.locator('.search-result-card').count() > 0, '全文搜尋應可找到教材重點');
    await page.locator('[data-view="reader"]').click();
    assert.equal(await page.locator('.section-body table').count(),1);
    assert(await page.locator('.section-body strong').first().isVisible());
    assert.equal(await page.locator('a[href*=".md"]').count(),0);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    await page.locator('[data-chapter="c02"]').click();
    assert.equal(await page.locator('#chapter-heading').innerText(),'第二章');
    await page.locator('#reader-toc-list li').first().click();
    await page.locator('#btn-chapter-practice').click();
    let firstQuestion='';
    for(let i=0;i<6;i++){
      const stem=await page.locator('#quiz-stem').innerText();
      if(!i)firstQuestion=stem;
      const multiple=stem==='驗收題5';
      if(!i)await page.locator('.option-item').nth(1).click();
      else {await page.locator('.option-item').nth(0).click();if(multiple)await page.locator('.option-item').nth(2).click();}
      await page.locator('#btn-quiz-submit').click();
      if(!i){
        const feedback=await page.locator('#quiz-feedback-box').innerText();
        assert(feedback.includes('作答錯誤'));
        assert(!feedback.includes('歷屆官方正確解答'));
        await page.evaluate(()=>document.getElementById('btn-quiz-submit').click());
        const attempts=await page.evaluate(key=>Object.values(JSON.parse(localStorage.getItem(key)).questionStats).reduce((n,s)=>n+s.attempts,0),key);
        assert.equal(attempts,1);
        await page.locator('[data-view="dashboard"]').click();
        assert((await page.locator('#weakness-list').innerText()).includes('資料不足'));
        await page.locator('[data-view="quiz"]').click();
      }
      await page.locator('#btn-quiz-next').click();
    }
    assert.equal(await page.locator('#quiz-summary-count').innerText(),'6 / 6');
    assert.equal(await page.locator('#quiz-summary-wrong').innerText(),'1');
    await page.locator('#btn-quiz-retry-wrong').click();
    assert.equal(await page.locator('#quiz-stem').innerText(),firstQuestion);
    const multi=firstQuestion==='驗收題5';
    await page.locator('.option-item').nth(0).focus();await page.keyboard.press('Enter');
    if(multi)await page.locator('.option-item').nth(2).click();
    await page.locator('#btn-quiz-submit').click();
    await page.locator('#btn-answer-reader').click();
    assert(await page.locator('#view-reader').isVisible());
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).lastPosition.sectionId,key),'s02');
    await page.reload();
    await page.locator('[data-view="reader"]').click();
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).lastPosition.sectionId,key),'s02');
    await page.evaluate(()=>{window.dispatchEvent(new Event('scroll'));document.querySelector('[data-view="dashboard"]').click();});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).lastPosition.sectionId,key),'s02','pending scroll after leaving reader must preserve position');
    assert.equal(await page.locator('#stat-wrong-questions').innerText(),'0');
    results.push('PASS: Markdown rendering, no MD links, native keyboard answers, first-answer count, multi-choice, summary, wrong resolution, related section and reload');
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      for(const view of ['dashboard','reader','search','quiz','settings']){
        await page.locator(`[data-view="${view}"]`).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`${view} overflow at ${width}`);
      }
    }
    await page.setViewportSize({width:390,height:844});await page.locator('[data-view="reader"]').click();
    await page.locator('#btn-toggle-sidebar').click();assert(await page.locator('#reader-toc-list').isHidden());
    await page.screenshot({path:path.join(evidence,'learner-mobile.png'),fullPage:false});
    results.push('PASS: 320/390/768/1440 layouts, collapsible mobile TOC');
    for(const failure of ['corrupt','quota','blocked']){
      const c=await browser.newContext();
      await c.addInitScript(({failure,key})=>{if(failure==='corrupt')localStorage.setItem(key,'{bad');if(failure==='quota')Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};if(failure==='blocked')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});},{failure,key});
      const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
      assert(await p.locator('#storage-warning-banner').isVisible());
      await p.locator('#shortcut-random-quiz').click();await p.locator('.option-item').first().click();await p.locator('#btn-quiz-submit').click();
      if(failure==='corrupt')assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),'{bad');
      await c.close();
    }
    results.push('PASS: corrupted data preserved, quota and blocked storage visible and practice usable');
    await page.locator('[data-view="settings"]').click();
    const saved=await page.evaluate(key=>localStorage.getItem(key),key);
    const invalid={...JSON.parse(saved),questionStats:{q0:{attempts:-1,wrongCount:0,correctCount:0,lastResult:false}}};
    const rejected=page.waitForEvent('dialog');
    await page.locator('#import-file-input').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
    assert((await rejected).message().includes('不正確'));
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
    const restore={...JSON.parse(saved),completedChapters:['c01']};
    const reloaded=page.waitForEvent('domcontentloaded');
    await page.locator('#import-file-input').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(restore))});
    await reloaded;
    assert((await page.locator('#stat-completed-chapters').innerText()).startsWith('1 /'));
    results.push('PASS: invalid progress import rejected without writes; valid restore saved and reloaded');
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    results.push('PASS: zero uncaught JS/Console errors and zero external requests');
  } finally {fs.writeFileSync(path.join(evidence,'learner-report.json'),JSON.stringify({date:new Date().toISOString(),results,errors,external},null,2));console.log(results.join('\n'));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
