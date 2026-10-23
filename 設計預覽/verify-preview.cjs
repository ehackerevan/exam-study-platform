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
 const {readableText,emphasizeHtml}=await import('./text-format.mjs');
 const manifest=JSON.parse(fs.readFileSync('.qa-artifacts/eli5-v4/coverage.json','utf8'));
 for(const [input,expected] of [['$CO_2e$','CO₂e'],['$SF_6$','SF₆'],['$N_2O$','N₂O'],['$CH_4$','CH₄'],['$NF_3$','NF₃'],['$O('+String.fromCharCode(92)+'log N)$','O(log N)'],['$3 '+String.fromCharCode(92)+'times 2$','3 × 2']])assert.equal(readableText(input),expected);
 for(const text of ['超過 25%','2 個營業日','4 月 30 日前','三分之二以上','1,000 萬元'])assert.equal(emphasizeHtml(text),'<strong class="legal-value">'+text+'</strong>');
 assert.equal(emphasizeHtml('<a href="https://example.com/2026">5 年</a>'),'<a href="https://example.com/2026"><strong class="legal-value">5 年</strong></a>');
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
  assert.equal(await page.locator('.reading-aid').count(),0);
  assert.equal(await page.locator('#aml-aml02 .topic-diagram').count(),8);
  assert.equal(await page.locator('.knowledge-topic').count(),manifest.reduce((sum,chapter)=>sum+chapter.topics.length,0));
  for(const selector of ['.topic-core','.topic-diagram'])assert.equal(await page.locator('.knowledge-topic '+selector).count(),await page.locator('.knowledge-topic').count());
  assert.equal(await page.locator('details.source-block').count(),0);
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
   assert(await page.locator('.lesson.is-active .source-section').first().isVisible());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1440,current);
  }
  results.push('Six subjects, knowledge-topic reading and native keyboard answer disclosure');

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
   await page.locator('.lesson.is-active .practice-block summary').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320,id+' expanded original and practice');
   await page.locator('.lesson.is-active .practice-block summary').click();
  }
  results.push('All 37 chapters: step selection, restart and 320/768/1024/1440 widths');

  await page.evaluate(()=>location.hash='aml-aml02');
  await page.waitForFunction(()=>document.querySelector('.lesson.is-active')?.id==='aml-aml02');
  await page.setViewportSize({width:1440,height:1040});
  await page.locator('.lesson.is-active .source-block').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(evidence,'law-desktop.png')});
  assert.equal(await page.locator('.source-comparison').count(),0);
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:false});
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
   for(const chapter of pack.chapters){
    const entry=manifest.find(row=>row.chapter===course.key+'-'+chapter.id);
    const expected=entry.topics;
    const originalSections=chapter.sections.filter(section=>String(section.content||'').replace(/[-#*_>\s]/g,'')||section.keyPoints?.length||section.notes?.length);
    for(const section of originalSections){
     const kept=expected.some(topic=>topic.id===section.id),removed=entry.removed.some(row=>row.id===section.id);
     assert(kept!==removed,course.key+'/'+section.id+' exactly one kept/removal record');
     if(removed&&!chapter.id.endsWith('00')&&course.key!=='ethics')assert(/本章學習導航與核心地圖|本章使用說明/.test(section.title));
    }
    const bodies=await page.locator(`#${course.key}-${chapter.id} .knowledge-topic`).evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.sourceId,text:node.querySelector('.rule-content').textContent.replace(/\s/g,'')})));
    for(const topic of expected){
     const sourceSection=originalSections.find(section=>section.id===topic.id);
     if(!sourceSection||sourceSection.title==='本章學習導航與核心地圖')continue;
     const raw=sourceSection.content.replace(/!\[[^\]]*\]\(data:image[^)]+\)/g,'').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1');
     const quantities=[...readableText(raw).matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:個營業日|個月|小時|萬元|億元|公噸|美元|元|年|月|日|天|倍|%|條)/g)].map(match=>match[0].replace(/\s/g,''));
     const text=bodies.find(body=>body.id===topic.id).text;
     for(const quantity of quantities)assert(text.includes(quantity),topic.id+' preserves '+quantity);
    }
    const displayed=await page.locator(`#${course.key}-${chapter.id} .chapter-reading .source-section`).evaluateAll(nodes=>nodes.map(node=>node.dataset.sourceId));
    assert.deepEqual(displayed,expected.map(section=>section.id),course.key+'/'+chapter.id+' source section preservation');
   }
   const actual=await page.locator(`.lesson[data-course="${course.key}"] .practice-form`).evaluateAll(forms=>forms.map(form=>({id:form.dataset.questionId,answer:JSON.parse(form.dataset.answer),options:[...form.querySelectorAll('.option>span:last-child')].map(node=>node.textContent),question:[...form.querySelector('legend').childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('')})));
   for(const row of actual){
    const original=pack.questions.find(question=>question.id===row.id);
    assert(original,row.id);assert.equal(row.question,readableText(original.question),row.id);
    assert.deepEqual(row.options,original.options.map(readableText),row.id);
    assert.deepEqual(row.answer,Array.isArray(original.answer)?original.answer:[original.answer],row.id);
   }
  }
  results.push('All 370 questions/options match source after typography normalization; answer indexes unchanged');

  const brokenImages=await page.locator('.knowledge-topic img').evaluateAll(async nodes=>{const failed=[];for(const node of nodes){try{const copy=new Image();copy.src=node.src;await copy.decode();}catch{failed.push(node.alt);}}return failed;});
  assert.deepEqual(brokenImages,[],'All embedded source diagrams decode');
  const prose=await page.locator('.knowledge-topic').allTextContents();
  for(const text of prose){assert(!/[�\uFFFD]/.test(text),'No replacement character');assert(!/\$[^$]+\$|CO_2|SF_6|N_2O|\\(?:times|log|ge|le)\b/.test(text),'No raw formula syntax');}
  assert.equal(await page.locator('.practice-form .legal-value').count(),0,'No highlighted answer clues');
  await page.evaluate(()=>location.hash='esg-esg02');
  await page.waitForFunction(()=>document.querySelector('.lesson.is-active')?.id==='esg-esg02');
  await page.setViewportSize({width:1440,height:1040});
  const chemistry=page.locator('.lesson.is-active .knowledge-topic').filter({hasText:'七種主要列管'}).first();
  await chemistry.scrollIntoViewIfNeeded();
  for(const formula of ['CO₂','CH₄','N₂O','SF₆','NF₃'])assert((await chemistry.textContent()).includes(formula),formula);
  await page.screenshot({path:path.join(evidence,'chemistry-desktop.png')});
  await page.setViewportSize({width:390,height:900});
  await chemistry.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(evidence,'chemistry-mobile.png')});
  const style=await page.locator('.lesson.is-active .legal-value').first().evaluate(node=>({weight:getComputedStyle(node).fontWeight,color:getComputedStyle(node).color}));
  assert(Number(style.weight)>=700);assert.equal(style.color,'rgb(135, 80, 0)');
  results.push('All sections deepened; chemical/math typography normalized; numeric conditions bold with distinct color; answers have no color clues');
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
