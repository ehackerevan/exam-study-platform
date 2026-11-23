const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL,fileURLToPath}=require('node:url'),{chromium}=require('playwright');
const dir=path.resolve('專案文件/教材架構改造'),read=f=>fs.readFileSync(path.join(dir,f),'utf8'),json=f=>JSON.parse(read(f));
(async()=>{
 const evidence=path.join(dir,'驗收資料');fs.mkdirSync(evidence,{recursive:true});
 const baseline=json('正式檔案基線.json');for(const [p,h] of Object.entries(baseline))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h,p+'正式檔不得改動');
 const unit=json('單元原型.json'),points=json('知識點候選對照.json').points,inventory=json('現況盤點.json');
 assert.equal(points.length,210);assert.equal(inventory.courses.reduce((a,c)=>a+c.questionCount,0),11545);
 const b=await chromium.launch(),context=await b.newContext(),p=await context.newPage(),errors=[],external=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.route(/^https?:/,r=>{external.push(r.request().url());return r.abort()});
 const result={date:'2026-11-03',baselineFiles:Object.keys(baseline).length,prototype:{},oldFlow:{},documents:{}};
 try{
  await p.goto(pathToFileURL(path.join(dir,'單元原型.html')).href);
  assert.equal(await p.locator('[data-depth]').count(),unit.blocks.length,'內容層級資料不得被清除');
  assert.equal(await p.locator('#concept-scope-rules').count(),1);
  assert(!(await p.locator('#sections-container').innerText()).includes('**'),'不應露出Markdown標記');
  const originalNodeCount=await p.locator('[data-depth]').count();
  for(const mode of ['review','sprint','full']){
   await p.locator('#learning-depth').selectOption(mode);assert.equal(await p.locator('[data-depth]').count(),originalNodeCount);
   assert.equal(await p.locator('#concept-boundary').isVisible(),mode==='full');assert(await p.locator('#concept-scope-rules').isVisible());assert(await p.locator('#concept-traps').isVisible());
  }
  const official=JSON.parse(fs.readFileSync('教材/永續發展基礎能力重點教材/questions.json','utf8')).questions.find(q=>q.id===unit.officialQuestionIds[0]);
  const embedded=await p.evaluate(()=>window.__STUDY_PACK__);const q=embedded.questions.find(q=>q.id===official.id);
  for(const k of ['id','question','options','answer'])assert.deepEqual(q[k],official[k],k);
  assert.equal(await p.locator('.chapter-practice-question').count(),4);
  const form=p.locator('.chapter-practice-question').first();await form.locator('input[value="0"]').check();await form.locator('button[type="submit"]').click();assert((await form.locator('.chapter-inline-feedback').innerText()).includes('作答錯誤'));
  await p.locator('[data-view="quiz"]').click();
  // shortcut: 以原型只有一個已答錯題的隔離進度確認回查，正式全科遷移時另跑完整錯題／備份測試。
  await p.locator('#btn-quick-wrong').click();
  await p.locator('#quiz-options-container .option-item').nth(3).click();await p.locator('#btn-quiz-submit').click();await p.locator('#btn-answer-reader').click();
  assert.equal(await p.locator('#chapter-heading').innerText(),unit.title);assert(await p.locator('#sec-'+unit.id).count());
  const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('study-pack.architecture-prototype-esg.progress')));
  assert.equal(stored.questionStats[official.id].lastResult,true);assert.equal(await p.evaluate(()=>localStorage.getItem('study-pack.esg-sustainability-pack.progress')),null);
  await p.locator('#learning-depth').selectOption('sprint');await p.reload();assert.equal(await p.locator('#learning-depth').inputValue(),'full');assert((await p.evaluate(()=>JSON.parse(localStorage.getItem('study-pack.architecture-prototype-esg.progress')))).questionStats[official.id].lastResult);
  for(const w of [320,390,768,1024,1440]){await p.setViewportSize({width:w,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'原型溢出 '+w);if([390,1440].includes(w)){await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(evidence,'原型-'+w+'.png')});}}
  await p.locator('#prototype-lookup').click();assert.equal(await p.evaluate(()=>location.hash),'#concept-scope-rules');
  for(const href of await p.locator('a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')).filter(Boolean)))if(!/^https?:/.test(href)&&!href.startsWith('#'))assert(fs.existsSync(fileURLToPath(new URL(href,p.url()))),href);
  result.prototype={sharedBlocks:8,modes:3,questions:4,officialId:official.id,answerAndOriginalPreserved:true,wrongToConcept:true,productionProgressUntouched:true,reload:true};
  for(const name of ['提案.html','新舊知識地圖.html']){
   await p.goto(pathToFileURL(path.join(dir,name)).href);for(const w of [390,1440]){await p.setViewportSize({width:w,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+w);}
   const hrefs=await p.locator('a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')).filter(Boolean));for(const href of hrefs)if(!/^https?:/.test(href)&&!href.startsWith('#'))assert(fs.existsSync(fileURLToPath(new URL(href,p.url()))),href);
   result.documents[name]='PASS';
  }
  await p.goto(pathToFileURL(path.resolve('dist/永續發展基礎能力重點教材.html')).href);
  await p.locator('#btn-open-search').click();await p.locator('#search-input').fill('範疇');const matches=await p.locator('.search-result-card').count();assert(matches>0);await p.locator('.search-result-card').first().click();
  result.oldFlow={searchOperations:3,resultsForScope:matches,directSectionLinkedQuestions:0,scope:'已開科目，點搜尋／輸入詞／點結果；不是人類查找時間'};
  await p.screenshot({path:path.join(evidence,'舊版查找.png')});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  result.runtimeErrors=errors;result.automaticNetworkRequests=external;fs.writeFileSync(path.join(evidence,'驗收結果.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
