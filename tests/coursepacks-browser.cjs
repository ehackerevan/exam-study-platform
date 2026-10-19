const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),errors=[],external=[],results=[];
 await context.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  for(const course of fs.readdirSync('教材',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name)){
   const file=path.join('dist',course+'.html');if(!fs.existsSync(file))continue;
   await page.goto(pathToFileURL(path.resolve(file)).href);
   const pack=await page.evaluate(()=>window.__STUDY_PACK__);
   const original=course==='信託業務人員重點教材'
    ? [...new Map(Object.values(JSON.parse(fs.readFileSync(path.join('教材',course,'full_exam_bank.json'),'utf8'))).flat().map(q=>[q.id,{id:q.id,chapterId:q.chapter,type:'single-choice',question:q.stem,options:q.options,answer:q.answer}])).values()]
    : (()=>{const source=JSON.parse(fs.readFileSync(path.join('教材',course,'questions.json'),'utf8'));return Array.isArray(source)?source:source.questions;})();
   const core=questions=>questions.map(q=>({id:q.id,chapterId:q.chapterId,type:q.type,question:q.question,options:q.options,answer:q.answer}));
   assert.deepEqual(core(pack.questions).sort((a,b)=>a.id.localeCompare(b.id)),core(original).sort((a,b)=>a.id.localeCompare(b.id)),'Original question data: '+course);
   assert(pack.questions.every(q=>q.sourceExam?.term&&q.sourceExam.subject&&Number.isSafeInteger(q.sourceExam.number)),'Exam source metadata: '+course);
   assert.equal(new Set(pack.chapters.map(ch=>ch.id)).size,pack.chapters.length);
   let inlineDiagramCount=0;
   for(const width of [320,768,1440]){
    await page.setViewportSize({width,height:900});await page.locator('[data-view="reader"]').click();
   for(let i=0;i<pack.chapters.length;i++){
     await page.locator('#reader-toc-list li').nth(i).click();
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`${course} chapter ${i} at ${width}`);
     inlineDiagramCount+=await page.locator('.section-body img').count();
     assert.equal(await page.locator('.section-body img:not([src^="data:image/svg+xml;base64,"])').count(),0,'Offline diagram images: '+course);
     assert.equal(await page.locator('.section-body a[href*=".md"]').count(),0);
     assert.equal(await page.locator('code.language-mermaid').count(),0);
    }
   }
   if(course==='信託業務人員重點教材')assert(inlineDiagramCount>0,'Trust diagrams render offline');
   const exam=pack.questions.find(q=>q.sourceExam);
   const examKey=JSON.stringify([exam.sourceExam.term,exam.sourceExam.subject]);
   const examQuestions=pack.questions.filter(q=>q.sourceExam.term===exam.sourceExam.term&&q.sourceExam.subject===exam.sourceExam.subject);
   await page.locator('[data-view="quiz"]').click();
   await page.locator('#quiz-select-exam').selectOption(examKey);
   await page.locator('#btn-start-exam-quiz').click();
   assert.equal(await page.locator('#quiz-progress-text').textContent(),'第 1 / '+examQuestions.length+' 題');
   assert.equal(await page.locator('#quiz-exam-tag').textContent(),exam.sourceExam.term+' · '+exam.sourceExam.subject);
   const displayedQuestion=await page.locator('#quiz-stem').textContent();
   assert(examQuestions.some(q=>q.question===displayedQuestion),'Exam filter selection: '+course);
   if(course==='信託業務人員重點教材'){
    await page.reload();await page.locator('[data-view="quiz"]').click();
    const group=pack.questions.find(q=>q.featuredGroup).featuredGroup;
    const featuredQuestions=pack.questions.filter(q=>q.featuredGroup===group).sort((a,b)=>a.featuredRank-b.featuredRank);
    await page.locator('#quiz-select-featured').selectOption(group);
    await page.locator('#btn-start-featured-quiz').click();
    assert.equal(await page.locator('#quiz-progress-text').textContent(),`第 1 / ${featuredQuestions.length} 題`);
    assert.equal(await page.locator('#quiz-stem').textContent(),featuredQuestions[0].question,'Featured ranking is preserved');
    for(const question of featuredQuestions){
     await page.locator(`[data-option="${question.answer}"]`).click();
     await page.locator('#btn-quiz-submit').click();
     await page.locator('#btn-quiz-next').click();
    }
    assert.equal(await page.locator('#quiz-summary-accuracy').textContent(),'100%');
    await page.reload();await page.locator('[data-view="quiz"]').click();
    assert((await page.locator('#quiz-history-list').textContent()).includes(`精選題組 ${group.replace(/^c/, '')}｜100%（10/10）`));
   }
   await page.setViewportSize({width:390,height:844});
   await page.locator('[data-view="dashboard"]').click();
   assert(await page.locator('#view-dashboard').isVisible());
   await page.screenshot({path:path.join('.qa-artifacts',course+'-mobile.png'),animations:'disabled'});
   results.push({course,questions:pack.questions.length,chapters:pack.chapters.length,status:'PASS'});
  }
  assert.equal(results.length,5);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: five courses, all chapters at 320/768/1440; original questions/options/answers unchanged; no MD links or external requests');
 }finally{fs.writeFileSync('.qa-artifacts/coursepacks-report.json',JSON.stringify({results,errors,external,date:new Date().toISOString()},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
