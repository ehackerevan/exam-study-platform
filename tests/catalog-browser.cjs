const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {htmlFiles}=await import('../scripts/harmonize-ui.js');
 const b=await chromium.launch({headless:true}),c=await b.newContext(),errors=[],external=[],results=[];
 c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});});
 await c.route(/^https?:/,r=>{external.push(r.request().url());return r.abort();});
 const p=await c.newPage(),catalog=pathToFileURL(path.resolve('dist/index.html')).href;
 try{
  await p.goto(catalog);
  const statistics=JSON.parse(fs.readFileSync('tasks/exam_frequency_20261020.json','utf8')).courses;
  const total=Object.entries(statistics).filter(([name])=>!name.includes('證基會')).reduce((sum,[,course])=>sum+course.question_record_count,0);
  assert((await p.locator('.catalog-header').innerText()).includes(`5 科教材 · ${total.toLocaleString('zh-TW')} 題練習 · 1 個獨立題庫`));
  assert.equal(await p.locator('.subject-card').count(),6);
  assert((await p.locator('[data-action=quiz]').first().boundingBox()).height<80,'catalogue actions are compact');
  assert.equal(await p.locator('[data-action=reader]').count(),6);
  assert.equal(await p.locator('[data-action=quiz]').count(),6);
  const readerLinks=await p.locator('[data-action=reader]').evaluateAll(nodes=>nodes.map(a=>a.href));
  const quizLinks=await p.locator('[data-action=quiz]').evaluateAll(nodes=>nodes.map(a=>a.href));
  for(const url of readerLinks){
   await p.goto(url);assert(await p.locator('#view-reader').isVisible());
   const before=await p.locator('#chapter-heading').innerText();assert(before);
   let marked=false;
   for(let i=0;i<await p.locator('#reader-toc-list li').count();i++){
    await p.locator('#reader-toc-list li').nth(i).click();
    await p.waitForTimeout(30);
    if(await p.locator('#sections-container mark.legal-term').count()){marked=true;break;}
   }
   assert(marked,'Legal terminology must be highlighted in each course');
   await p.locator('#study-catalog-nav a').click();assert.equal(p.url(),catalog);
  }
  for(const url of quizLinks){await p.goto(url);assert(await p.locator('#view-quiz').isVisible());assert(await p.locator('#quiz-setup-panel').isVisible());}
  results.push('PASS: one card per subject with reading and quiz actions; correct reader/quiz deep links and return flow');
  const files=htmlFiles().filter(f=>!['dist/index.html','src/renderer/template.html'].includes(f.replaceAll('\\','/')));
  for(const file of files){
   await p.goto(pathToFileURL(path.resolve(file)).href);
   const href=await p.locator('#study-catalog-nav a').getAttribute('href');
   const destination=new URL(href,p.url());assert(fs.existsSync(fileURLToPath(destination)),file);
   assert.equal(path.resolve(fileURLToPath(destination)),path.resolve('dist/index.html'),file);
  }
  results.push(`PASS: all ${files.length} non-catalogue runtime pages resolve their return links to the existing catalogue`);
  await p.goto(readerLinks[0]);
  const original='得 可 不得 不可 不可以 應 必須 可以 取得 所得 可能 應用 不得已 不可或缺。';
  await p.evaluate(text=>{const box=document.createElement('div');box.className='section-body';box.id='term-fixture';box.textContent=text;const code=document.createElement('code');code.textContent='不得';box.append(code);document.getElementById('sections-container').append(box);},original);
  await p.waitForFunction(()=>document.querySelectorAll('#term-fixture mark').length===8);
  assert.deepEqual(await p.locator('#term-fixture mark').allTextContents(),['得','可','不得','不可','不可以','應','必須','可以']);
  assert.equal(await p.locator('#term-fixture').textContent(),original+'不得');
  assert.equal(await p.locator('#term-fixture code mark').count(),0);
  assert.equal(await p.locator('.legal-term .legal-term').count(),0);
  for(const theme of ['light','dark']){
   await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const colors=await p.evaluate(()=>['legal-prohibit','legal-duty','legal-permit'].map(type=>getComputedStyle(document.querySelector('#term-fixture .'+type)).color));
   assert.equal(new Set(colors).size,3);
  }
  await p.reload();assert(await p.locator('#view-reader').isVisible());
  results.push('PASS: longest-match color categories, ordinary-word exclusions, code exclusion, original text preserved and no nested highlights');
  for(const width of [320,390,768,1440]){
   await p.setViewportSize({width,height:900});
   for(const url of [catalog,readerLinks[0],quizLinks[0]]){
    await p.goto(url);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
   }
  }
  await p.goto(catalog);await p.setViewportSize({width:390,height:844});await p.screenshot({path:'.qa-artifacts/catalog-mobile.png',animations:'disabled',fullPage:true});
  await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:'.qa-artifacts/catalog-desktop.png',animations:'disabled'});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  results.push('PASS: 320/390/768/1440 layouts, reload, zero Console errors and external requests');
 }finally{fs.writeFileSync('.qa-artifacts/catalog-report.json',JSON.stringify({date:new Date().toISOString(),results,errors,external},null,2));console.log(results.join('\n'));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
