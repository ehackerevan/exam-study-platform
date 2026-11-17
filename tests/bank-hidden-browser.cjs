const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const {attachBankAchievements}=await import(pathToFileURL(path.resolve(process.env.BANK_ATTACH_SOURCE||'scripts/bank-achievements.js')));
 const questions=Array.from({length:301},(_,i)=>({category:'金融科技力',period:'1',subject:'測試',number:i+1,text:i<2?'相同題幹':'題目'+i,options:['甲','乙'],answer:'1',type:'single-choice'}));
 questions.push({...questions[0],category:'未對照',text:'未對照題目'});
 const pack={id:'bank-hidden-qa',title:'測試',contentVersion:'qa',chapters:[],questions:questions.slice(0,301).map((q,i)=>({id:'q'+i,question:q.text,options:q.options,answer:0,sourceExam:{term:'1',subject:'測試',number:i+1}}))};
 let html=fs.readFileSync('考古題/歷屆考古題_完整題庫大全.html','utf8').replace(/const RAW_QUESTIONS = (\[.*\]);/,'const RAW_QUESTIONS = '+JSON.stringify(questions)+';');
 const read=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).startsWith('dist/'))return 'window.__STUDY_PACK__ = '+JSON.stringify(String(file).includes('金融科技力')?pack:{...pack,id:String(file),questions:[]})+';';return read.call(this,file,...args);};
 try{html=attachBankAchievements(html);}finally{fs.readFileSync=read;}
 fs.mkdirSync('.qa-artifacts',{recursive:true});const file=path.resolve('.qa-artifacts/bank-hidden.html');fs.writeFileSync(file,html);
 const browser=await chromium.launch(),context=await browser.newContext(),p=await context.newPage(),errors=[];p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:/,r=>r.abort());
 const key='study-pack.bank-hidden-qa.progress',state={format:'study-pack-progress-v1',packId:pack.id,completedChapters:[],questionStats:{},quizHistory:[],lastPosition:{chapterId:'',sectionId:''},hiddenQuestionIds:['q0']};
 try{
  await p.goto(pathToFileURL(file).href);await p.evaluate(({key,state})=>{localStorage.setItem(key,JSON.stringify(state));dispatchEvent(new StorageEvent('storage',{key}));},{key,state});
  assert.equal(await p.locator('#displayCount').innerText(),'301');assert.equal(await p.locator('#questionsContainer>.q-card').count(),300);
  const cards=p.locator('#questionsContainer>.q-card');assert((await cards.first().innerText()).replace(/\s/g,'').includes('第2題'));assert((await cards.nth(299).innerText()).replace(/\s/g,'').includes('第301題'));
  // The same content at q1 remains; after filtering its answer still saves to q1, not q0.
  await cards.first().locator('input').first().check();await cards.first().locator('button[type="submit"]').click();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).questionStats.q1?.attempts===1,key);
  assert(!(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).questionStats,key)).q0);
  // Focus without hidden changes must not discard/recreate an in-progress form.
  await cards.nth(1).locator('input').first().check();await p.evaluate(()=>{document.querySelectorAll('#questionsContainer>.q-card')[1].dataset.keep='yes';dispatchEvent(new Event('focus'));});assert.equal(await cards.nth(1).getAttribute('data-keep'),'yes');assert(await cards.nth(1).locator('input').first().isChecked());
  await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.hiddenQuestionIds=[];localStorage.setItem(k,JSON.stringify(s));dispatchEvent(new Event('focus'));},key);assert.equal(await p.locator('#displayCount').innerText(),'302');
  await p.evaluate(()=>{currentCategory='未對照';applyFilters();});assert.equal(await cards.count(),1);assert((await cards.first().innerText()).includes('未對照題目'));
  await p.evaluate(k=>{localStorage.setItem(k,'broken');dispatchEvent(new StorageEvent('storage',{key:k}));currentCategory='all';applyFilters();},key);assert.equal(await p.locator('#displayCount').innerText(),'302');assert((await p.locator('#bank-hidden-note').innerText()).includes('無法讀取'));assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),'broken');
  await p.evaluate(({key,state})=>{localStorage.setItem(key,JSON.stringify({...state,hiddenQuestionIds:Array.from({length:301},(_,i)=>'q'+i)}));currentCategory='金融科技力';applyFilters();},{key,state});assert.equal(await p.locator('#displayCount').innerText(),'0');assert.equal(await cards.count(),0);assert((await p.locator('#questionsContainer').innerText()).includes('無符合條件'));
  await p.reload();assert.equal(await p.locator('#displayCount').innerText(),'1');assert.deepEqual(errors,[]);
  console.log('PASS: hidden before 300 limit, count/card identity, duplicate ID retained, answer alignment, restore/focus, unmapped, corrupt preservation, empty state, reload');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
