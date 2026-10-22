const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const file=path.join(__dirname,'各科教材_ELI5_獨立預覽.html');
const evidence=path.resolve('.qa-artifacts/eli5-preview');
fs.mkdirSync(evidence,{recursive:true});
const isolated=path.join(evidence,'isolated','preview.html');
fs.mkdirSync(path.dirname(isolated),{recursive:true});fs.copyFileSync(file,isolated);
const url=pathToFileURL(isolated).href;
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1040}});
 const errors=[],external=[],results=[];
 await context.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 try{
  await page.goto(url);await page.locator('html.enhanced').waitFor();
  assert.equal(await page.locator('.lesson.is-active').count(),1);
  assert.equal(await page.locator('.lesson.is-active').getAttribute('id'),'aml-aml02');
  assert.equal(await page.locator('#subject-select option').count(),6);
  assert.equal(await page.locator('.lesson').count(),37);
  assert.equal(await page.locator('.practice-form').count(),370);
  await page.screenshot({path:path.join(evidence,'desktop.png')});
  await page.locator('.skip-link').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');
  assert.equal(await page.locator('.lesson.is-active').getAttribute('id'),'aml-aml02');

  const courseList=await page.locator('#subject-select option').evaluateAll(nodes=>nodes.map(node=>node.value));
  for(const course of courseList){
   await page.locator('#subject-select').selectOption(course);
   await page.waitForFunction(course=>document.querySelector('.lesson.is-active')?.dataset.course===course,course);
   assert.equal(await page.locator('.course-navigation.is-active').count(),1);
   const current=await page.locator('.lesson.is-active').getAttribute('id');
   await page.locator('.lesson.is-active .check-answer summary').focus();
   await page.keyboard.press('Enter');
   assert(await page.locator('.lesson.is-active .check-answer').evaluate(node=>node.open));
   await page.locator('.lesson.is-active .source-block summary').click();
   assert(await page.locator('.lesson.is-active .source-section').first().isVisible());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1440,current);
   await page.locator('.lesson.is-active .source-block summary').click();
  }
  results.push('Six subjects, source comparisons and native keyboard answer disclosure');

  const ids=await page.locator('.lesson').evaluateAll(nodes=>nodes.map(node=>node.id));
  for(const id of ids){
   await page.evaluate(id=>location.hash=id,id);
   await page.waitForFunction(id=>document.querySelector('.lesson.is-active')?.id===id,id);
   const nodes=page.locator('.lesson.is-active .map-node');
   await nodes.last().focus();await page.keyboard.press('Enter');
   assert.equal(await nodes.last().getAttribute('aria-pressed'),'true',id);
   assert.equal(await page.locator('.lesson.is-active .step-detail.is-selected').count(),1,id);
   await page.locator('.lesson.is-active .next-step').click();
   assert.equal(await nodes.first().getAttribute('aria-pressed'),'true',id);
   for(const width of [320,768,1024,1440]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,id+' / '+width);
   }
   await page.setViewportSize({width:320,height:1000});
   await page.locator('.lesson.is-active .source-block summary').click();
   await page.locator('.lesson.is-active .practice-block summary').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320,id+' expanded original and practice');
   await page.locator('.lesson.is-active .source-block summary').click();
   await page.locator('.lesson.is-active .practice-block summary').click();
  }
  results.push('All 37 chapters: step selection, restart and 320/768/1024/1440 widths');

  await page.evaluate(()=>location.hash='aml-aml02');
  await page.waitForFunction(()=>document.querySelector('.lesson.is-active')?.id==='aml-aml02');
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});
  await page.locator('.lesson.is-active .practice-block summary').click();
  const first=page.locator('.lesson.is-active .practice-form').first();
  await first.locator('.check-question').click();
  assert.match(await first.locator('.quiz-feedback').textContent(),/先選擇答案/);
  const answer=JSON.parse(await first.getAttribute('data-answer'));
  for(const index of answer)await first.locator(`input[value="${index}"]`).check();
  await first.locator('.check-question').click();
  assert.match(await first.locator('.quiz-feedback').textContent(),/與來源答案一致/);
  const multi=page.locator('.lesson.is-active .practice-form').filter({has:page.locator('input[type=checkbox]')}).first();
  if(await multi.count()){
   const answers=JSON.parse(await multi.getAttribute('data-answer'));
   for(const index of answers)await multi.locator(`input[value="${index}"]`).check();
   await multi.locator('.check-question').click();
   assert.match(await multi.locator('.quiz-feedback').textContent(),/與來源答案一致/);
  }
  results.push('Inline source-answer checking and unanswered feedback');

  const {courses}=await import('./lessons.mjs');
  for(const course of courses){
   const source=fs.readFileSync(path.join('dist',course.source+'.html'),'utf8');
   const pack=JSON.parse(source.match(/window\.__STUDY_PACK__\s*=\s*({.*});/)[1]);
   const actual=await page.locator(`.lesson[data-course="${course.key}"] .practice-form`).evaluateAll(forms=>forms.map(form=>({id:form.dataset.questionId,answer:JSON.parse(form.dataset.answer),options:[...form.querySelectorAll('.option>span:last-child')].map(node=>node.textContent),question:[...form.querySelector('legend').childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('')})));
   for(const row of actual){
    const original=pack.questions.find(question=>question.id===row.id);
    assert(original,row.id);assert.equal(row.question,original.question,row.id);
    assert.deepEqual(row.options,original.options,row.id);
    assert.deepEqual(row.answer,Array.isArray(original.answer)?original.answer:[original.answer],row.id);
   }
  }
  results.push('All 370 displayed questions/options/answers match existing compiled sources');

  const noJS=await browser.newContext({javaScriptEnabled:false});
  const basic=await noJS.newPage();await basic.goto(url);
  assert(await basic.locator('.lesson').first().isVisible());
  assert(await basic.locator('.lesson').last().isVisible());
  await basic.locator('.check-answer summary').first().click();
  assert(await basic.locator('.check-answer p').first().isVisible());
  await noJS.close();results.push('Core concepts and native answer disclosures readable without JavaScript');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify({status:'PASS',results,errors,external},null,2));
  console.log(results.join('\n'));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
