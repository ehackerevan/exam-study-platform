const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const {tmpdir}=require('node:os'), {execFileSync}=require('node:child_process');
(async()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'study-metrics-test-'));
 execFileSync(process.execPath,['.github/scripts/prepare-pages.mjs'],{env:{...process.env,PAGES_OUTPUT_DIR:dir}});
 const b=await chromium.launch(), p=await b.newPage({viewport:{width:390,height:844}}), events=[], errors=[];
 p.on('pageerror', e=>errors.push(e.message));
 await p.route('https://study-pack-metrics.ehackerevan.workers.dev/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/event') { events.push(JSON.parse(route.request().postData())); await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'},body:''}); }
  else await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body:JSON.stringify({totals:[{course:'fintech-exam-pack',type:'view',total:5},{course:'fintech-exam-pack',type:'answer',total:10},{course:'financial-market-ethics-official-bank-116',type:'view',total:7}],questions:[]})});
 });
 await p.route('https://study-pack-sync.ehackerevan.workers.dev/**',route=>route.abort());
 await p.route('https://static.cloudflareinsights.com/**',route=>route.fulfill({status:200,body:''}));
 try {
  await p.goto(pathToFileURL(path.resolve(dir,'index.html')).href);
  const card=p.locator('[data-metrics-course="fintech-exam-pack"]');
  await card.locator('.study-metrics-course').getByText('瀏覽 5 次 · 作答 10 次').waitFor();
  await p.locator('#catalog-edition').selectOption('金融市場常識與職業道德題庫_116年版.html');
  await p.locator('[data-metrics-course="financial-market-ethics-official-bank-116"] .study-metrics-course').getByText('瀏覽 7 次 · 作答 0 次').waitFor();
  assert.equal(events.length,0,'catalog is not a course view');
  await p.screenshot({path:'.qa-artifacts/metrics-catalog-mobile.png',fullPage:true,animations:'disabled'});
  await p.goto(pathToFileURL(path.resolve(dir,'金融科技力重點教材.html')).href+'?view=reader');
  const f=p.locator('.chapter-practice-question').first();
  await f.locator('[data-metrics-question]').getByText('作答 0 次').waitFor();
  assert.deepEqual(events,[{type:'view',course:'fintech-exam-pack'}]);
  await f.scrollIntoViewIfNeeded(); await f.locator('button[type=submit]').click(); assert.equal(events.length,1,'empty answer does not count');
  await f.locator('input').first().check(); await f.locator('button[type=submit]').click();
  await f.locator('[data-metrics-question]').getByText('作答 1 次').waitFor(); assert.equal(events.length,2); assert.equal(events[1].type,'answer'); assert(events[1].question);
  await f.locator('button[type=submit]').click(); assert.equal(events.length,2,'reset does not count');
  await p.locator('[data-view=quiz]').click();await p.locator('#btn-quick-ten').click();
  await p.locator('#quiz-stem [data-metrics-question]').waitFor();
  await p.screenshot({path:'.qa-artifacts/metrics-question-mobile.png',animations:'disabled'});
  await p.locator('#quiz-options-container .option-item').first().click(); await p.locator('#btn-quiz-submit').click();
  await p.waitForTimeout(100); assert.equal(events.length,3); assert.equal(events[2].type,'answer');
  assert(events.every(e=>Object.keys(e).every(k=>['type','course','question'].includes(k))));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390); assert.deepEqual(errors,[]);
  await p.unroute('https://study-pack-metrics.ehackerevan.workers.dev/**');
  await p.route('https://study-pack-metrics.ehackerevan.workers.dev/**',route=>route.abort());
  await p.reload(); await p.locator('[data-view=quiz]').click(); await p.locator('#btn-quick-ten').click();
  await p.locator('#quiz-stem [data-metrics-question]').getByText('作答次數暫時無法取得').waitFor();
  await p.locator('#quiz-options-container .option-item').first().click(); await p.locator('#btn-quiz-submit').click();
  assert(await p.locator('#quiz-feedback-box').isVisible(), 'tracking failure must not block practice'); assert.deepEqual(errors,[]);
  console.log('PASS: published counts, chapter and quiz events, retries, offline-safe failure and mobile layout');
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
