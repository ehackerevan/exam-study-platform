const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {htmlFiles}=await import('../scripts/harmonize-ui.js');
 const files=htmlFiles().filter(file=>file.replaceAll('\\','/')!=='src/renderer/template.html');
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),errors=[],external=[],results=[];
 await context.route(/^https?:/,r=>{external.push(r.request().url());return r.abort();});
 try{
  for(const file of files){
   const page=await context.newPage();page.on('pageerror',e=>errors.push(file+': '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push(file+': '+m.text());});
   await page.goto(pathToFileURL(path.resolve(file)).href);
   assert.equal(await page.locator('#study-ui-theme').count(),1,file);
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,file+' at '+width);
   }
   const palettes=[];
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const values=await page.evaluate(()=>{const style=getComputedStyle(document.body);return{background:style.backgroundColor,color:style.color,font:style.fontFamily};});
    assert.equal(values.background,theme==='light'?'rgb(248, 250, 252)':'rgb(15, 23, 42)',file+' '+theme);
    assert.equal(values.color,theme==='light'?'rgb(15, 23, 42)':'rgb(248, 250, 252)',file+' '+theme);
    palettes.push(values);
   }
   if(file.includes('金融科技力重點教材')||file.endsWith('index.html')||file.includes('歷屆考古題')){
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join('.qa-artifacts','uniform-'+path.basename(path.dirname(file))+'-'+path.basename(file)+'.png'),animations:'disabled'});
   }
   if(await page.locator('#categorySelect').count()){
    await page.locator('#categorySelect').selectOption({index:1});
    assert(await page.locator('.q-card').count()>0);
    await page.locator('.btn-reveal').first().click();
    assert(await page.locator('.tag-ans').first().isVisible());
   }
   results.push({file,status:'PASS',palettes});await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(`PASS: ${files.length} runtime pages, four widths, light/dark shared palette; legacy filters and answers; zero Console/external requests`);
 }finally{fs.mkdirSync('.qa-artifacts',{recursive:true});fs.writeFileSync('.qa-artifacts/ui-consistency.json',JSON.stringify({date:new Date().toISOString(),results,errors,external},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
