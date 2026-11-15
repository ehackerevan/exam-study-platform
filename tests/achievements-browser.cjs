const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const {openView}=require('./study-ui-helper.cjs');
(async()=>{
 const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
 const dir=path.resolve('.qa-artifacts/achievements');fs.mkdirSync(dir,{recursive:true});
 const pack={version:1,schemaVersion:1,id:'achievements-qa',contentVersion:'qa-v1',title:'成就驗收',chapters:[{id:'c1',title:'章節',sections:[{id:'s1',title:'內容',content:'概念',keyPoints:[],notes:[]}]}],questions:Array.from({length:6},(_,i)=>({id:'q'+i,chapterId:'c1',sectionId:'s1',type:'single-choice',question:'成就題目'+i,options:['甲','乙'],answer:0}))};
 const file=path.join(dir,'fixture.html');fs.writeFileSync(file,compileStudyPackToHtml(pack).html);const url=pathToFileURL(file).href,key='study-pack.achievements-qa.progress';
 const b=await chromium.launch(),context=await b.newContext(),p=await context.newPage(),errors=[],external=[];
 context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await context.route(/^https?:/,r=>{external.push(r.request().url());return r.abort();});
 const answerOne=async()=>{await p.locator('#quiz-options-container button').first().click();await p.locator('#btn-quiz-submit').click();};
 try {
  await p.goto(url+'?view=progress');await p.locator('#study-achievements summary').click();
  assert.equal(await p.locator('#achievement-list .achievement-badge').count(),7);assert((await p.locator('.achievement-level').textContent()).includes('0 / 30 EXP'));
  await p.locator('#btn-achievement-practice').click();await p.locator('#btn-quick-ten').click();await answerOne();
  assert((await p.locator('.achievement-level').textContent()).includes('5 / 30 EXP'));assert(await p.locator('#achievement-unlocks').isHidden());
  await p.locator('#btn-exit-quiz').click();assert((await p.locator('#achievement-unlocks').textContent()).includes('開始探索'));
  const saved=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert(!Object.hasOwn(saved,'achievements'));
  await p.reload();assert(await p.locator('#achievement-unlocks').isHidden());assert((await p.locator('.achievement-level').textContent()).includes('5 / 30 EXP'));
  await openView(p,'settings');const legacy={...saved,questionStats:Object.fromEntries(pack.questions.map(q=>[q.id,{attempts:1,wrongCount:0,correctCount:1,lastResult:true}]))};
  await Promise.all([p.waitForEvent('domcontentloaded'),p.locator('#import-file-input').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))})]);
  await openView(p,'progress');await p.locator('#study-achievements summary').click();assert.equal(await p.locator('.achievement-badge.unlocked').count(),4);assert((await p.locator('.achievement-level').textContent()).includes('L4'));assert(await p.locator('#achievement-unlocks').isHidden());
  for(const width of [320,390,768,1024,1440]){await p.setViewportSize({width,height:900});for(const theme of ['light','dark']){await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert(await p.locator('html').evaluate(e=>e.scrollWidth<=e.clientWidth));if([390,1440].includes(width))await p.screenshot({path:path.join(dir,`achievements-${width}-${theme}.png`),fullPage:true});}}
  await p.locator('#study-achievements summary').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#study-achievements').evaluate(e=>e.open),false);await p.keyboard.press('Enter');assert(await p.locator('#btn-achievement-practice').isVisible());
  await openView(p,'settings');await Promise.all([p.waitForEvent('domcontentloaded'),p.locator('#btn-reset-progress').click()]);assert((await p.locator('.achievement-level').textContent()).includes('0 / 30 EXP'));
  await p.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='study-pack.achievements-qa.progress')throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};});
  await openView(p,'quiz');await p.locator('#btn-quick-ten').click();await answerOne();await p.locator('#btn-exit-quiz').click();assert(await p.locator('#achievement-unlocks').isHidden());assert.equal(await p.locator('.achievement-level').count(),0);assert((await p.locator('#achievement-list').textContent()).includes('暫不可用'));
  await p.reload();await p.evaluate(key=>localStorage.setItem(key,'{corrupt'),key);await p.reload();assert((await p.locator('#achievement-list').textContent()).includes('暫不可用'));assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),'{corrupt');
  await p.evaluate(key=>localStorage.removeItem(key),key);await p.reload();

  const accountPage=await context.newPage();accountPage.on('dialog',d=>d.accept());const account='11111111-1111-4111-8111-111111111111';
  await accountPage.addInitScript(({account,legacy})=>{localStorage.setItem('study-pack.sync.account',account);localStorage.setItem(`study-pack.account.${account}.achievements-qa.progress`,JSON.stringify(legacy));window.StudySync={async bootstrap(){return `study-pack.account.${account}.achievements-qa.progress`;},markDirty(){},changed(){}};},{account,legacy});
  await accountPage.goto(url+'?view=progress');assert((await accountPage.locator('.achievement-level').textContent()).includes('30 / 30 EXP'));
  await p.evaluate(()=>localStorage.setItem('study-pack.sync.account','22222222-2222-4222-8222-222222222222'));await accountPage.waitForFunction(()=>!document.querySelector('.achievement-level'));assert((await accountPage.locator('#achievement-list').textContent()).includes('暫不可用'));assert(await accountPage.locator('#achievement-unlocks').isHidden());await accountPage.close();

  const race=await context.newPage();await race.addInitScript(({account,legacy})=>{const key=`study-pack.account.${account}.achievements-qa.progress`;localStorage.setItem(key,JSON.stringify(legacy));window.StudySync={async bootstrap(){localStorage.setItem('study-pack.sync.account','22222222-2222-4222-8222-222222222222');return key;},markDirty(){},changed(){}};},{account,legacy});
  await race.goto(url+'?view=progress');assert.equal(await race.locator('.achievement-level').count(),0,'bootstrap identity race must not show the previous account');await race.close();
  await p.goto(pathToFileURL(path.resolve('dist/永續發展基礎能力重點教材.html')).href+'?view=progress');
  await p.evaluate(()=>{const pack=window.__STUDY_PACK__;localStorage.setItem(`study-pack.${pack.id}.progress`,JSON.stringify({format:'study-pack-progress-v1',packId:pack.id,completedChapters:[],questionStats:Object.fromEntries(pack.questions.slice(0,75).map((q,i)=>[q.id,{attempts:1,wrongCount:i<50?0:1,correctCount:i<50?1:0,lastResult:i<50}])),lastPosition:{chapterId:'',sectionId:''},settings:{theme:'system'}}));});await p.reload();await p.locator('#study-achievements summary').click();
  for(const [width,theme] of [[390,'light'],[1440,'dark']]){await p.setViewportSize({width,height:1000});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await p.screenshot({path:path.join(dir,`real-esg-${width}-${theme}.png`),fullPage:true});assert(await p.locator('html').evaluate(e=>e.scrollWidth<=e.clientWidth));}
  await p.evaluate(()=>localStorage.removeItem(`study-pack.${window.__STUDY_PACK__.id}.progress`));
  await p.goto(pathToFileURL(path.resolve('dist/歷屆考古題_完整題庫大全.html')).href);
  const coverage=await p.evaluate(()=>window.__BANK_ACHIEVEMENT_COVERAGE__);assert(coverage.mapped>6000);assert(coverage.excluded>0);fs.writeFileSync(path.join(dir,'mapping.json'),JSON.stringify(coverage,null,2));
  await p.selectOption('#categorySelect','金融科技力');await p.locator('#searchInput').fill('鯰魚');await p.waitForTimeout(350);
  const card=p.locator('.q-card[data-saved-practice]').first();assert.equal(await card.locator('form').count(),1);assert.equal(await card.locator('.options-list').count(),0);
  await card.locator('.btn-reveal').click();assert((await card.locator('.bank-feedback').textContent()).includes('不計入'));
  const correct=await p.evaluate(()=>RAW_QUESTIONS.find(q=>q.category==='金融科技力'&&q.text.includes('鯰魚'))?.answer);for(const index of String(correct).split(',').map(n=>Number(n)-1))await card.locator('input').nth(index).check();await card.locator('button[type=submit]').click();
  await p.locator('.study-achievements summary').click();assert((await p.locator('#bank-achievement-list .achievement-level').textContent()).includes('5 /'));
  assert((await p.locator('#bank-achievement-list').textContent()).includes('未納入帳號同步'));await p.reload();assert((await p.locator('#bank-achievement-list .achievement-level').textContent()).includes('5 /'));
  await p.selectOption('#categorySelect','金融科技力');await p.locator('#searchInput').fill('鯰魚');await p.waitForTimeout(350);await p.locator('.study-achievements summary').click();
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert(await p.locator('html').evaluate(e=>e.scrollWidth<=e.clientWidth));if([390,1440].includes(width))await p.screenshot({path:path.join(dir,`bank-${width}.png`),fullPage:true});}
  await p.evaluate(()=>{localStorage.setItem('study-pack.fintech-exam-pack.progress','{broken');window.dispatchEvent(new Event('focus'));});assert((await p.locator('#bank-achievement-list').textContent()).includes('暫不可用'));assert.equal(await p.evaluate(()=>localStorage.getItem('study-pack.fintech-exam-pack.progress')),'{broken');
  await p.evaluate(()=>localStorage.removeItem('study-pack.fintech-exam-pack.progress'));
  const bankSource=fs.readFileSync('dist/歷屆考古題_完整題庫大全.html','utf8'),linkMap=JSON.parse(bankSource.match(/const links=(.*), packs=(.*);/)[1]),rawQuestions=JSON.parse(bankSource.match(/const RAW_QUESTIONS = (\[.*\]);/)[1]);
  const legacyQuestion=rawQuestions.find(q=>!linkMap[JSON.stringify([q.category,String(q.period),q.subject,Number(q.number)])]);assert(legacyQuestion);
  await p.selectOption('#categorySelect',legacyQuestion.category);await p.selectOption('#periodSelect',String(legacyQuestion.period));await p.locator('#searchInput').fill(legacyQuestion.text.slice(0,20));await p.waitForTimeout(350);
  const oldCard=p.locator('.q-card:not([data-saved-practice])').first();await oldCard.locator('.opt-chip').first().click();assert((await oldCard.locator('.opt-chip').first().getAttribute('class')).includes('opt-selected'));await oldCard.locator('.btn-reveal').click();assert(await oldCard.locator('.opt-chip.is-official-correct .opt-check').first().isVisible());
  await p.goto(pathToFileURL(path.resolve('dist/學習平台_單檔整合版.html')).href+'#'+new URLSearchParams({page:'金融科技力重點教材.html',query:'?view=progress'}));
  const frame=p.frameLocator('#study-frame');await frame.locator('#study-achievements summary').click();assert.equal(await frame.locator('.achievement-badge').count(),7);await p.reload();assert.equal(await frame.locator('.achievement-badge').count(),7);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: seven badges/EXP, saved answers and summary-only unlocks, legacy import/reset, quota/corrupt data, cross-tab identity mask, keyboard, 320–1440 light/dark, mapped guest bank/reveal/reload, single HTML and no network/errors');
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
