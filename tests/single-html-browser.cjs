const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const dir=path.resolve('.qa-artifacts/standalone');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'學習平台_單檔整合版.html');fs.copyFileSync('學習平台_單檔整合版.html',file);
 const browser=await chromium.launch({channel:'msedge',headless:true}),p=await browser.newPage(),errors=[],external=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(!process.env.SINGLE_HTML_URL)await p.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
 try {
  await p.goto(process.env.SINGLE_HTML_URL||pathToFileURL(file).href);
  const frame=p.frameLocator('#study-frame');
  assert.equal(await frame.locator('.subject-card').count(),6);
  const pages=await p.evaluate(()=>Object.keys(JSON.parse(document.getElementById('embedded-pages').textContent)));
  assert.equal(pages.length,8);
  for(const page of pages.filter(name=>name!=='index.html')){
   await p.evaluate(name=>window.openStudyPage(name,'?view=quiz'),page);
   if(page==='歷屆考古題_完整題庫大全.html'){await frame.locator('.q-text').first().waitFor();continue;}
   await frame.locator('#btn-quick-ten').click();
   assert.equal(await frame.locator('#quiz-progress-text').innerText(),'第 1 / 10 題');
   assert(await frame.locator('.answer-search').first().isVisible());
   await frame.locator('#quiz-options-container .option-item').first().click();
   await frame.locator('#btn-quiz-submit').click();
   assert(await frame.locator('#quiz-feedback-box').isVisible());
   const packId=await frame.locator('body').evaluate(()=>window.__STUDY_PACK__.id);
   await frame.locator('#study-catalog-nav a').click();
   await frame.locator('.subject-card').first().waitFor();
   assert(await p.evaluate(id=>Object.values(JSON.parse(localStorage.getItem(`study-pack.${id}.progress`)).questionStats).some(s=>s.attempts===1),packId));
  }
  await p.evaluate(()=>window.openStudyPage('防制洗錢與打擊資恐重點教材.html','?view=reader'));
  for(const item of await frame.locator('#reader-toc-list li').all()){
   await item.click();assert.equal(await frame.locator('table caption').filter({hasText:'概念關係對照'}).count(),0);
  }
  await p.setViewportSize({width:390,height:844});
  await p.evaluate(()=>window.openStudyPage('金融市場常識與職業道德題庫.html','?view=quiz'));
  await frame.locator('#btn-quick-ten').click();
  assert.equal(await frame.locator('html').evaluate(el=>el.scrollWidth),390);
  await frame.locator('#quiz-options-container .option-item').first().click();await frame.locator('#btn-quiz-submit').click();
  await p.screenshot({path:'.qa-artifacts/standalone-mobile.png',animations:'disabled'});
  await p.reload();await frame.locator('#quiz-setup-panel').waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync('.qa-artifacts/standalone-report.json',JSON.stringify({status:'PASS',pages:8,errors,external,isolatedFile:!process.env.SINGLE_HTML_URL},null,2));
  console.log('PASS: isolated single HTML, eight pages, six subject quizzes, direct search, retained progress, reload and mobile layout; no JS errors or external dependencies');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
