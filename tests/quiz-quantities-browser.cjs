const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {htmlFiles}=await import('../scripts/harmonize-ui.js');
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),errors=[],results=[];
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  for(const file of htmlFiles().filter(file=>file.startsWith('dist'))){
   await p.goto(pathToFileURL(path.resolve(file)).href);
   if(!await p.evaluate(()=>!!window.__STUDY_PACK__))continue;
   const expected=await p.evaluate(()=>window.__STUDY_PACK__.chapters.filter(ch=>window.__STUDY_PACK__.questions.some(q=>q.chapterId===ch.id)).map(ch=>ch.id));
   const options=await p.locator('#quiz-select-chapter option').evaluateAll(nodes=>nodes.map(node=>node.value));
   assert.deepEqual(options,expected,file);assert(!await p.getByText('用語提示：',{exact:false}).count());
   results.push({file,questionChapters:options.length});
  }
  await p.goto(pathToFileURL(path.resolve('dist/永續發展基礎能力重點教材.html')).href+'?view=reader');
  const text='期限三年內，金額新臺幣1,000萬元以上，30日內、十個工作日、六個月、24小時、百分之五、25%，依第12條。';
  await p.evaluate(text=>{const box=document.createElement('div');box.className='section-body';box.id='quantity-fixture';box.textContent=text;document.getElementById('sections-container').append(box);},text);
  await p.waitForFunction(()=>document.querySelectorAll('#quantity-fixture .legal-quantity').length===10);
  assert.deepEqual(await p.locator('#quantity-fixture .legal-quantity').allTextContents(),['期限','三年內','金額','新臺幣1,000萬元以上','30日內','十個工作日','六個月','24小時','百分之五','25%']);
  assert.equal(await p.locator('#quantity-fixture').textContent(),text);
  assert.equal(await p.locator('#quantity-fixture mark mark').count(),0);
  for(const theme of ['light','dark']){
   await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const color=await p.locator('#quantity-fixture mark').first().evaluate(node=>getComputedStyle(node).color);
   assert.equal(color,theme==='light'?'rgb(91, 33, 182)':'rgb(221, 214, 254)');
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${results.length} packs show only chapters with questions; legend removed; time/amount/percentage highlighting preserves text in both themes`);
 }finally{fs.writeFileSync('.qa-artifacts/quiz-quantities.json',JSON.stringify({results,errors,date:new Date().toISOString()},null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
