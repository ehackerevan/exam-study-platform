const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const frequency=JSON.parse(fs.readFileSync('tasks/exam_frequency_20261020.json','utf8')).courses;
const visibleQuestion=q=>q.question.replace(/^\s*【(?:場次\s*[^】]*|第\s*\d+\s*屆[^】]*)第\s*(\d+)\s*題】\s*/, (label,number)=>Number(number)===q.sourceExam?.number?'':label);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),errors=[],external=[],results=[];
 await context.route(/^https?:/,route=>{external.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  for(const course of fs.readdirSync('教材',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name)){
   const quizOnly=course==='金融市場常識與職業道德題庫';
   const file=path.join('dist',course+'.html');if(!fs.existsSync(file))continue;
   await page.goto(pathToFileURL(path.resolve(file)).href);
   const pack=await page.evaluate(()=>window.__STUDY_PACK__);
   const original=course==='信託業務人員重點教材'
    ? [...new Map(Object.values(JSON.parse(fs.readFileSync(path.join('教材',course,'full_exam_bank.json'),'utf8'))).flat().map(q=>[q.id,{id:q.id,chapterId:q.chapter,type:'single-choice',question:q.stem,options:q.options,answer:q.answer}])).values()]
    : (()=>{const source=JSON.parse(fs.readFileSync(path.join('教材',course,'questions.json'),'utf8'));return Array.isArray(source)?source:source.questions;})();
   const core=questions=>questions.map(q=>({id:q.id,chapterId:q.chapterId,type:q.type,question:q.question,options:q.options,answer:q.answer}));
   assert.deepEqual(core(pack.questions).sort((a,b)=>a.id.localeCompare(b.id)),core(original).sort((a,b)=>a.id.localeCompare(b.id)),'Original question data: '+course);
   const stats=frequency[course==='金融市場常識與職業道德題庫'?'金融市場常識與職業道德題庫（證基會116年版）':course];
   assert(stats,`Updated knowledge-point statistics exist: ${course}`);
   assert.equal(stats.question_record_count,original.length,`Statistics use current canonical question count: ${course}`);
   const originalIds=new Set(original.map(q=>q.id));
   const expectedKnowledge=new Map(original.map(q=>[q.id,new Set()]));
   for(const point of stats.concept_ranking){
    assert.equal(point.question_ids.length,point.question_count,`Exact point mapping count: ${course} / ${point.concept}`);
    assert.deepEqual(point.question_ids,[...new Set(point.question_ids)],`No repeated question IDs in point mapping: ${course} / ${point.concept}`);
    for(const id of point.question_ids){assert(originalIds.has(id),`Point ID belongs to current bank: ${course} / ${id}`);expectedKnowledge.get(id).add(point.concept);}
   }
   assert.equal(stats.unclassified_question_ids.length,stats.unclassified_question_count,`Unclassified ID count: ${course}`);
   for(const id of stats.unclassified_question_ids){
    assert(originalIds.has(id),`Unclassified ID belongs to current bank: ${course} / ${id}`);
    assert(!expectedKnowledge.get(id).size,`Unclassified question has no known point: ${course} / ${id}`);
    expectedKnowledge.get(id).add(stats.unclassified_knowledge_point);
   }
   for(const row of [...stats.law_ranking,...stats.official_reference_ranking]){
    assert.equal(row.question_ids.length,row.question_count,`Reference match count: ${course} / ${row.law_or_rule||row.reference}`);
    assert(row.question_ids.every(id=>originalIds.has(id)),`Reference IDs belong to current bank: ${course}`);
   }
   for(const question of pack.questions){
    assert.deepEqual([...question.knowledgePoints].sort(),[...expectedKnowledge.get(question.id)].sort(),`Knowledge points match exact current-bank mapping: ${course} / ${question.id}`);
   }
   if(course==='信託業務人員重點教材'){
    const bank=JSON.parse(fs.readFileSync(path.join('教材',course,'full_exam_bank.json'),'utf8'));
    const topics=new Map(Object.values(bank).flat().map(q=>[q.id,q.topic]));
    assert.equal(new Set(topics.values()).size,stats.concept_ranking.length,'Trust uses the complete existing topic taxonomy');
    for(const row of stats.concept_ranking)for(const id of row.question_ids)assert.equal(topics.get(id),row.concept,`Trust topic source mapping: ${id}`);
   }
   if(course==='金融市場常識與職業道德題庫'){
    assert.deepEqual(stats.concept_ranking.map(row=>row.concept).sort(),['職業道德','金融市場常識'].sort(),'SFI keeps only the two official knowledge points');
    assert.deepEqual(Object.fromEntries(stats.concept_ranking.map(row=>[row.concept,row.question_count])),{'金融市場常識':558,'職業道德':616});
    for(const question of original){
     const expected=question.chapterId==='financial-market'?'金融市場常識':'職業道德';
     assert.deepEqual(pack.questions.find(q=>q.id===question.id).knowledgePoints,[expected],`SFI official chapter mapping: ${question.id}`);
    }
   }
   assert(pack.questions.every(q=>q.sourceExam?.term&&q.sourceExam.subject&&Number.isSafeInteger(q.sourceExam.number)),'Exam source metadata: '+course);
   assert.equal(new Set(pack.chapters.map(ch=>ch.id)).size,pack.chapters.length);
   let inlineDiagramCount=0;
   for(const width of [320,768,1440]){
    await page.setViewportSize({width,height:900});await page.locator('[data-view="reader"]').click();
   for(let i=0;i<pack.chapters.length;i++){
     await page.locator('#reader-toc-list li').nth(i).click();
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`${course} chapter ${i} at ${width}`);
     if(quizOnly)assert(await page.locator('#chapter-practice-panel').isHidden(),`${course} is a standalone bank, not a reading chapter`);
     else {
      const expected=pack.chapters[i].practiceQuestionIds||[];
      assert.equal(expected.length,10,`${course} chapter ${i} should retain 10 relevant practice questions`);
      assert.equal(await page.locator('#chapter-practice-preview .chapter-practice-question').count(),expected.length,`${course} chapter ${i} practice count`);
      assert.equal(await page.locator('#btn-chapter-practice').count(),0,'Chapter practice has no separate quiz-mode button');
     }
     inlineDiagramCount+=await page.locator('.section-body img').count();
     assert.equal(await page.locator('.section-body img:not([src^="data:image/svg+xml;base64,"])').count(),0,'Offline diagram images: '+course);
     assert.equal(await page.locator('.section-body a[href*=".md"]').count(),0);
     assert.equal(await page.locator('code.language-mermaid').count(),0);
    }
   }
   if(course==='信託業務人員重點教材')assert(inlineDiagramCount>0,'Trust diagrams render offline');
   assert(pack.questions.every(q=>Array.isArray(q.knowledgePoints)&&q.knowledgePoints.length>0),'Every question has a knowledge point: '+course);
   const pointLabels=[...new Set(pack.questions.flatMap(q=>q.knowledgePoints))],pointQuestions=pack.questions.filter(q=>q.knowledgePoints.includes(pointLabels[0]));
   if(!quizOnly){
    const frequencySection=pack.chapters[0].sections.find(section=>section.title==='歷屆高頻觀念與法規排行');
    assert(frequencySection,'Course materials include shared frequency data: '+course);
    assert(frequencySection.content.includes(stats.concept_ranking[0].concept),'Top point comes from updated stats: '+course);
    if(stats.law_ranking.length)assert(frequencySection.content.includes(stats.law_ranking[0].law_or_rule),'Top law comes from updated stats: '+course);
   }
   await page.locator('[data-view="quiz"]').click();await page.locator('#quiz-advanced').evaluate(el=>el.open=true);
   assert.equal(await page.locator('#quiz-select-knowledge-point option').count(),pointLabels.length,'Knowledge point options: '+course);
   await page.locator('#quiz-select-knowledge-point').selectOption(pointLabels[0]);
   await page.locator('#btn-start-knowledge-point-quiz').click();
   assert.equal(await page.locator('#quiz-progress-text').textContent(),`第 1 / ${Math.min(20,pointQuestions.length)} 題`,'Knowledge point quiz count: '+course);
   const knowledgePointStem=await page.locator('#quiz-stem').textContent();
   assert(pointQuestions.some(q=>visibleQuestion(q)===knowledgePointStem),'Knowledge point only includes tagged questions: '+course);
   if(quizOnly){
    const question=pack.questions.find(q=>visibleQuestion(q)===knowledgePointStem);
    await page.locator(`[data-option="${question.answer}"]`).click();await page.locator('#btn-quiz-submit').click();
    assert.equal(await page.locator('#btn-answer-reader').count(),0,'Question-only banks have no empty reader link');
   }
   await page.reload();
   const exam=pack.questions.find(q=>q.sourceExam);
   const examKey=JSON.stringify([exam.sourceExam.term,exam.sourceExam.subject]);
   const examQuestions=pack.questions.filter(q=>q.sourceExam.term===exam.sourceExam.term&&q.sourceExam.subject===exam.sourceExam.subject);
   await page.locator('[data-view="quiz"]').click();await page.locator('#quiz-advanced').evaluate(el=>el.open=true);
   await page.locator('#quiz-select-exam').selectOption(examKey);
   await page.locator('#btn-start-exam-quiz').click();
   assert.equal(await page.locator('#quiz-progress-text').textContent(),'第 1 / '+examQuestions.length+' 題');
   assert.equal(await page.locator('#quiz-exam-tag').textContent(),exam.sourceExam.term+' · '+exam.sourceExam.subject);
   const displayedQuestion=await page.locator('#quiz-stem').textContent();
   assert(examQuestions.some(q=>visibleQuestion(q)===displayedQuestion),'Exam filter selection: '+course);
   assert.equal(displayedQuestion,visibleQuestion([...examQuestions].sort((a,b)=>a.sourceExam.number-b.sourceExam.number)[0]),'Exam mode preserves original question order');
   if(course==='信託業務人員重點教材'){
    await page.reload();await page.locator('[data-view="quiz"]').click();await page.locator('#quiz-advanced').evaluate(el=>el.open=true);
    const group=pack.questions.find(q=>q.featuredGroup).featuredGroup;
    const featuredQuestions=pack.questions.filter(q=>q.featuredGroup===group).sort((a,b)=>a.featuredRank-b.featuredRank);
    await page.locator('#quiz-select-featured').selectOption(group);
    await page.locator('#btn-start-featured-quiz').click();
    assert.equal(await page.locator('#quiz-progress-text').textContent(),`第 1 / ${featuredQuestions.length} 題`);
    assert.equal(await page.locator('#quiz-stem').textContent(),visibleQuestion(featuredQuestions[0]),'Featured ranking is preserved');
    for(const question of featuredQuestions){
     await page.locator(`[data-option="${question.answer}"]`).click();
     await page.locator('#btn-quiz-submit').click();
     await page.locator('#btn-quiz-next').click();
    }
    assert.equal(await page.locator('#quiz-summary-accuracy').textContent(),'100%');
    await page.reload();await page.locator('[data-view="quiz"]').click();await page.locator('#quiz-advanced').evaluate(el=>el.open=true);
    assert((await page.locator('#quiz-history-list').textContent()).includes(`精選題組 ${group.replace(/^c/, '')}｜100%（10/10）`));
   }
   await page.setViewportSize({width:390,height:844});
   await page.locator('[data-view="dashboard"]').click();
   assert(await page.locator('#view-dashboard').isVisible());
   await page.screenshot({path:path.join('.qa-artifacts',course+'-mobile.png'),animations:'disabled'});
   results.push({course,questions:pack.questions.length,chapters:pack.chapters.length,status:'PASS'});
  }
  assert.equal(results.length,6);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: six courses, all chapters at 320/768/1440; original questions/options/answers unchanged; no MD links or external requests');
 }finally{fs.writeFileSync('.qa-artifacts/coursepacks-report.json',JSON.stringify({results,errors,external,date:new Date().toISOString()},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
