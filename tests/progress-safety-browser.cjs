const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {openView}=require('./study-ui-helper.cjs');
(async()=>{
 const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
 const dir=path.resolve('.qa-artifacts/review-fixes');fs.mkdirSync(dir,{recursive:true});
 const pack={version:1,schemaVersion:1,id:'review-qa',title:'保存安全驗收',chapters:[{id:'c1',title:'章節',sections:[{id:'s1',title:'內容',content:'內容',keyPoints:[],notes:[]}]}],questions:[0,1,2].map(i=>({id:'q'+i,chapterId:'c1',sectionId:'s1',type:'single-choice',question:'Question'+i,options:['A','B'],answer:0}))};
 const html=compileStudyPackToHtml(pack).html,bank=fs.readFileSync('dist/歷屆考古題_完整題庫大全.html','utf8'),key='study-pack.review-qa.progress';
 const b=await chromium.launch(),c=await b.newContext({acceptDownloads:true}),errors=[];
 let mappedHtml=html;
 await c.route('**/*',r=>r.request().url().startsWith('https://review.invalid/')?r.fulfill({status:200,contentType:'text/html',body:r.request().url().includes('/bank')?bank:r.request().url().includes('/mapped')?mappedHtml:html}):r.abort());
 c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());});
 const a=await c.newPage(),d=await c.newPage();
 const submit=async(p,id)=>{await p.locator('#chapter-practice-panel').evaluate(e=>e.open=true);const card=p.locator('.chapter-practice-question').filter({hasText:'Question'+id});await card.locator('input').first().check();await card.locator('button[type=submit]').click();await p.waitForTimeout(80);};
 try{
  await a.goto('https://review.invalid/?view=reader');await d.goto('https://review.invalid/?view=reader');await submit(a,0);await submit(d,1);
  const stale=await a.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);const failures=[];
  if(!stale.questionStats.q0)failures.push('REV-01: stale page overwrote saved q0');
  const p=await c.newPage();await p.goto('https://review.invalid/bank');
  const raw=JSON.parse(bank.match(/const RAW_QUESTIONS = (\[.*\]);/)[1]),links=JSON.parse(bank.match(/const links=(.*), packs=(.*);/)[1]);const q=raw.find(q=>links[JSON.stringify([q.category,String(q.period),q.subject,q.number])]),link=links[JSON.stringify([q.category,String(q.period),q.subject,q.number])],bankKey=`study-pack.${link.packId}.progress`;
  const original=JSON.stringify({format:'study-pack-progress-v1',packId:link.packId,completedChapters:[123],questionStats:{},lastPosition:{chapterId:'',sectionId:''},settings:{theme:'system'},quizHistory:[]});
  await p.evaluate(({bankKey,original,q})=>{localStorage.setItem(bankKey,original);renderQuestions([q]);},{bankKey,original,q});
  for(const index of String(q.answer).split(',').map(n=>Number(n)-1))await p.locator('.q-card input').nth(index).check();await p.locator('.q-card button[type=submit]').click();await p.waitForTimeout(80);
  if(await p.evaluate(key=>localStorage.getItem(key),bankKey)!==original)failures.push('REV-02: malformed progress was overwritten');
  fs.writeFileSync(path.join(dir,'probe-observations.json'),JSON.stringify({failures,storedQuestions:Object.keys(stale.questionStats),errors},null,2));
  assert.deepEqual(failures,[]);
  await d.locator('#storage-warning-banner').waitFor({state:'visible'});
  const downloadPromise=d.waitForEvent('download');await d.locator('#btn-storage-warning-export').click();
  const download=await downloadPromise,exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert(exported.questionStats.q1);
  const racing=await Promise.all([a,d].map((page,index)=>page.evaluate(async index=>{
   try{await window.StudyProgress.replace('review-concurrent',null,String(index));return 'saved';}catch(e){return e.code;}
  },index)));assert.deepEqual(racing.sort(),['progress-conflict','saved']);
  await a.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
  assert.equal(await a.evaluate(()=>window.StudyProgress.replace('review-no-weblocks',null,'safe')),'safe');
  const denied=await c.newPage();await denied.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw Error('blocked');}}));
  await denied.goto('https://review.invalid/?view=progress');
  assert.equal(await denied.evaluate(async()=>{try{await window.StudyProgress.replace('review-no-idb',null,'unsafe');return false;}catch{return localStorage.getItem('review-no-idb')===null;}}),true);
  await denied.close();
  const base={format:'study-pack-progress-v1',packId:link.packId,completedChapters:[],questionStats:{},lastPosition:{chapterId:'',sectionId:''},settings:{theme:'system'},quizHistory:[]};
  for(const change of [{completedChapters:[123]},{lastPosition:{chapterId:7}},{quizHistory:{}},{favoriteQuestionIds:[9]},{hiddenQuestionIds:[9]},{questionStats:{bad:{attempts:1,wrongCount:0,correctCount:0,lastResult:true}}}]){
   const before=JSON.stringify({...base,...change});await p.evaluate(({bankKey,before})=>localStorage.setItem(bankKey,before),{bankKey,before});await p.reload();await p.evaluate(q=>renderQuestions([q]),q);
   await p.locator('.q-card input').first().check();await p.locator('.q-card button[type=submit]').click();
   await p.waitForFunction(()=>document.querySelector('.bank-feedback').textContent.includes('失敗'));
   assert.equal(await p.evaluate(k=>localStorage.getItem(k),bankKey),before);
  }
  const samePack=raw.filter(item=>{const value=links[JSON.stringify([item.category,String(item.period),item.subject,item.number])];return value?.packId===link.packId;}).slice(0,2);
  mappedHtml=compileStudyPackToHtml({...pack,id:link.packId,questions:samePack.map((item,index)=>({id:links[JSON.stringify([item.category,String(item.period),item.subject,item.number])].id,chapterId:'c1',sectionId:'s1',type:'single-choice',question:'Question'+index,options:['A','B'],answer:0}))}).html;
  await p.evaluate(k=>localStorage.removeItem(k),bankKey);const m=await c.newPage();await m.goto('https://review.invalid/mapped?view=reader');
  await p.reload();await p.evaluate(q=>renderQuestions([q]),q);await p.locator('.q-card input').first().check();await p.locator('.q-card button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('.bank-feedback').textContent.includes('作答'));
  const bankSaved=await p.evaluate(k=>localStorage.getItem(k),bankKey);assert(bankSaved);
  await submit(m,1);await m.locator('#storage-warning-banner').waitFor({state:'visible'});assert.equal(await m.evaluate(k=>localStorage.getItem(k),bankKey),bankSaved);
  await a.evaluate(k=>localStorage.removeItem(k),key);await a.goto('https://review.invalid/?view=reader');await a.locator('#chapter-practice-panel').evaluate(e=>e.open=true);
  const first=a.locator('.chapter-practice-question').first();await first.locator('input').first().check();await first.evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await a.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'null')?.questionStats.q0?.attempts===1,key);
  await a.evaluate(()=>window.StudyProgress.exclusive(()=>true));assert.equal(await a.evaluate(k=>JSON.parse(localStorage.getItem(k)).questionStats.q0.attempts,key),1);
  assert.deepEqual(errors,[]);console.log('PASS: stale and simultaneous writes, main/bank shared lock, unsaved export, invalid structures, no WebLocks, blocked IDB and double submit');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
