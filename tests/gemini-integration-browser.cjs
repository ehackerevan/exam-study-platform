const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const {compileStudyPackToHtml}=await import('../src/core/compiler/index.js');
 const pack={version:1,schemaVersion:1,id:'gemini-integration',title:'整合測試',chapters:['empty','chapter','other'].map(id=>({id,title:id,sections:[{id:id+'-s',title:'教材',content:'參考段落',keyPoints:[],notes:[]}]})),questions:Array.from({length:27},(_,i)=>({id:'q'+i,chapterId:i<25?'chapter':'other',sectionId:(i<25?'chapter':'other')+'-s',type:'single-choice',question:'問題 '+i,options:['A','B','C','D'],answer:0}))};
 const html=compileStudyPackToHtml(pack).html,browser=await chromium.launch();fs.mkdirSync('.qa-artifacts',{recursive:true});
 try{
  const context=await browser.newContext(),errors=[];
  await context.route('**/*',r=>r.request().url().startsWith('https://integration.invalid/')?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:900});await p.goto('https://integration.invalid/?view=progress');await p.locator('#study-progress').evaluate(e=>e.open=true);
   const rows=p.locator('.weakness-item');assert(await rows.nth(0).locator('.btn-chapter-quiz').isDisabled());await rows.nth(1).locator('.btn-chapter-quiz').click();assert(await p.locator('#quiz-running-panel').isVisible());
   assert.match(await p.locator('#quiz-progress-text').innerText(),/20/);assert.equal(await p.locator('#quiz-chapter-tag').textContent(),'chapter');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
   await p.locator('body').click({position:{x:1,y:1}});await p.keyboard.press('Control+a');assert.equal(await p.locator('.option-item.selected').count(),0,'modified key is not quiz input');
   await p.evaluate(()=>{const e=document.createElement('div');e.contentEditable='true';e.id='editing-fixture';e.textContent='編輯';document.body.prepend(e);e.focus();});await p.keyboard.press('a');assert.equal(await p.locator('.option-item.selected').count(),0,'editable text is not quiz input');
   await p.evaluate(()=>{document.getElementById('editing-fixture').remove();document.activeElement.blur();});await p.keyboard.press('a');assert.equal(await p.locator('.option-item.selected').count(),1);await p.keyboard.press('Enter');assert(await p.locator('#quiz-feedback-box').isVisible());await p.keyboard.press('Enter');assert(await p.locator('#quiz-feedback-box').isHidden());
   await p.locator('.option-item').first().dblclick();assert(await p.locator('#quiz-feedback-box').isVisible(),'double click submits single choice');await p.screenshot({path:'.qa-artifacts/gemini-integration-'+width+'.png'});
  }
  await p.reload();await p.locator('#study-progress').evaluate(e=>e.open=true);assert.equal(await p.locator('.weakness-item').count(),3);assert.deepEqual(errors,[]);console.log('PASS: chapter-only 20-question quiz, empty chapter disabled, keyboard/editable controls, double click, 320/390/1440 layout and reload; zero page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
