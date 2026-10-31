const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url'),{tmpdir}=require('node:os'),{execFileSync}=require('node:child_process');
(async()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'study-sync-test-'));execFileSync(process.execPath,['.github/scripts/prepare-pages.mjs'],{env:{...process.env,PAGES_OUTPUT_DIR:dir}});
 const browser=await chromium.launch(), errors=[], db={account:'11111111-1111-4111-8111-111111111111',revision:0,data:null,code:''};
 async function context(){
  const c=await browser.newContext({viewport:{width:390,height:844}});let signed=false,offline=false;
  await c.route('https://static.cloudflareinsights.com/**',r=>r.fulfill({status:200,body:''}));
  await c.route('https://study-pack-metrics.ehackerevan.workers.dev/**',r=>r.fulfill({status:r.request().method()==='POST'?204:200,headers:{'Access-Control-Allow-Origin':'*'},body:r.request().method()==='POST'?'':JSON.stringify({totals:[],questions:[]})}));
  await c.route('https://study-pack-sync.ehackerevan.workers.dev/**',async r=>{
   if(offline)return r.abort();const {action,code,revision,progress}=JSON.parse(r.request().postData());let status=200,body={};
   if(action==='register'){if(db.code)status=409;else {db.code=code;signed=true;body={account:db.account}}}
   else if(action==='login'){if(code!==db.code)status=401;else {signed=true;body={account:db.account}}}
   else if(!signed)status=401;
   else if(action==='session')body={account:db.account};
   else if(action==='logout')signed=false;
   else if(action==='read')body={revision:db.revision,data:db.data};
   else if(action==='write'){if(revision!==db.revision)status=409;else{db.revision++;db.data=progress;body={revision:db.revision}}}
   await r.fulfill({status,headers:{'Access-Control-Allow-Origin':'null','Access-Control-Allow-Credentials':'true','Content-Type':'application/json'},body:JSON.stringify(body)});
  });
  const p=await c.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));
  return {c,p,setOffline:v=>offline=v};
 }
 try{
  const a=await context(), url=pathToFileURL(path.join(dir,'金融科技力重點教材.html')).href;
  await a.p.goto(url);await a.p.locator('[data-view=settings]').click();await a.p.locator('#sync-status').getByText('未登入').waitFor();
  await a.p.locator('#sync-code').fill('Strong-code-1234');await Promise.all([a.p.waitForEvent('framenavigated'),a.p.locator('#sync-register').click()]);
  await a.p.locator('[data-view=settings]').click();await a.p.locator('#sync-logout').waitFor();
  await a.p.locator('[data-view=reader]').click();const f=a.p.locator('.chapter-practice-question').first();await f.locator('input').first().check();await f.locator('button[type=submit]').click();
  await a.p.waitForFunction(()=>document.querySelector('#sync-status')?.textContent==='進度已同步。',{timeout:15000});assert(db.data&&Object.keys(db.data.questionStats).length>0);
  const beforeOffline=db.revision;a.setOffline(true);await a.p.reload();await a.p.waitForFunction(()=>typeof document.querySelector('[data-view=reader]').onclick==='function');await a.p.locator('[data-view=reader]').click();const off=a.p.locator('.chapter-practice-question').nth(1);await off.locator('input').first().check();await off.locator('button[type=submit]').click();a.setOffline(false);await a.p.evaluate(()=>window.dispatchEvent(new Event('online')));await a.p.waitForFunction(()=>document.querySelector('#sync-status')?.textContent==='進度已同步。');assert(db.revision>beforeOffline,'offline progress retries on reconnect');
  const b=await context();await b.p.goto(url);await b.p.locator('[data-view=settings]').click();await b.p.locator('#sync-code').fill('Strong-code-1234');await Promise.all([b.p.waitForEvent('framenavigated'),b.p.locator('#sync-login').click()]);await b.p.locator('[data-view=settings]').click();await b.p.locator('#sync-logout').waitFor();
  const second=await b.p.evaluate(()=>JSON.parse(localStorage.getItem('study-pack.account.11111111-1111-4111-8111-111111111111.fintech-exam-pack.progress')));assert.deepEqual(second.questionStats,db.data.questionStats);
  db.revision++;await b.p.locator('[data-view=reader]').click();const f2=b.p.locator('.chapter-practice-question').nth(1);await f2.locator('input').first().check();await f2.locator('button[type=submit]').click();await b.p.locator('#sync-status').getByText(/同步已暫停/).waitFor({state:'attached'});
  await b.p.locator('[data-view=settings]').click();await Promise.all([b.p.waitForEvent('framenavigated'),b.p.locator('#sync-use-cloud').click()]);await b.p.waitForFunction(()=>typeof document.querySelector('[data-view=reader]').onclick==='function');assert(await b.p.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('.progress.backup.'))),'conflict recovery retains a local backup');
  const catalog=await context();await catalog.p.goto(pathToFileURL(path.join(dir,'index.html')).href);
  await catalog.p.locator('#catalog-usage-notice a').click();await catalog.p.locator('#sync-code').fill('Strong-code-1234');
  await Promise.all([catalog.p.waitForEvent('framenavigated'),catalog.p.locator('#sync-login').click()]);
  await catalog.p.locator('#catalog-usage-notice a').click();await catalog.p.locator('#sync-logout').waitFor();
  const dirtyKey='study-pack.account.'+db.account+'.fintech-exam-pack.progress.sync';
  await catalog.p.evaluate(key=>localStorage.setItem(key,JSON.stringify({revision:1,dirty:true})),dirtyKey);
  catalog.p.removeAllListeners('dialog');let warned=false;catalog.p.once('dialog',d=>{warned=true;void d.dismiss()});
  await catalog.p.locator('#sync-logout').click();assert(warned,'catalog warns before leaving dirty records');assert(await catalog.p.locator('#sync-logout').isVisible());
  catalog.p.once('dialog',d=>d.accept());await Promise.all([catalog.p.waitForEvent('framenavigated'),catalog.p.locator('#sync-logout').click()]);
  assert(await catalog.p.evaluate(key=>JSON.parse(localStorage.getItem(key)).dirty,dirtyKey),'logout preserves pending records');
  assert.equal(await b.p.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(errors,[]);
  console.log('PASS: registration, progress upload and cross-device restore, conflict safety and mobile');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
