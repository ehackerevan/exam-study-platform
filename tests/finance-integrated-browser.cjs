const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const b=await chromium.launch(),p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
await p.goto(pathToFileURL(path.resolve('dist/index.html')).href);assert.equal(await p.getByRole('link',{name:'永續金融補充教材',exact:true}).count(),0);
await p.goto(pathToFileURL(path.resolve('dist/永續發展基礎能力重點教材.html')).href+'?view=reader');
const questions=JSON.parse(fs.readFileSync('教材/教學單元/永續金融練習.json'));assert.equal(questions.length,40);assert.equal(new Set(questions.map(q=>q.id)).size,40);
const expected={3:['混合金融','影響力','六成','SPT','CBS','SLL','18個月','綠色存款'],4:['森林圖片'],6:['AAA','就業99','長壽','基差']};
for(const width of [390,1440]){await p.setViewportSize({width,height:900});let total=0;for(const [index,terms] of Object.entries(expected)){
if(await p.locator('#reader-toc-list').isHidden())await p.locator(width<768?'#btn-section-toc':'#btn-toggle-sidebar').click();await p.locator('#reader-toc-list li').nth(Number(index)).click();const body=await p.locator('#sections-container').innerText();for(const term of terms)assert(body.includes(term),term);
const block=p.locator('.finance-practice');assert.equal(await block.count(),1);assert.equal(await block.getAttribute('open'),null);await block.locator(':scope > summary').click();const entries=block.locator('.finance-question');const expectedQuestions=questions.filter(q=>q.chapterId==='esg0'+index);assert.equal(await entries.count(),expectedQuestions.length);total+=expectedQuestions.length;
for(const q of expectedQuestions){const detail=p.locator('#'+q.id+' details');assert.equal(await detail.getAttribute('open'),null);await detail.locator('summary').click();assert((await detail.innerText()).includes(q.answer));}
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await p.locator('.chapter-practice-question').count(),10);
}assert.equal(total,40);}assert.deepEqual(errors,[]);console.log('PASS: integrated finance topics, 40 collapsed applications with intact answers, no duplicate entry, mobile/desktop and chapter practice');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
