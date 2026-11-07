import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../sync/worker.js';
import vm from 'node:vm';
const origin='https://ehackerevan.github.io';
function makeEnv(){const db=new DatabaseSync(':memory:');db.exec(readFileSync('sync/schema.sql','utf8'));return {SYNC_PEPPER:'test-only-secret',RATE_LIMITER:{limit:async()=>({success:true})},AUTH_LIMITER:{limit:async()=>({success:true})},DB:{prepare(sql){const stmt=db.prepare(sql);return {bind(...args){return {async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}}}}}}},db};}
const call=(env,data,cookie='',source=origin)=>worker.fetch(new Request('https://example.test/',{method:'POST',headers:{Origin:source,'CF-Connecting-IP':'192.0.2.1',Cookie:cookie},body:JSON.stringify(data)}),env);
test('codes authenticate, accounts stay isolated, and conflicting writes do not overwrite',async()=>{
 const env=makeEnv(),code='Strong-code-1234';
 assert.equal((await call(env,{action:'register',code:'weak'})).status,400);
 const a=await call(env,{action:'register',code});assert.equal(a.status,200);const aa=(await a.json()).account;const ac=a.headers.get('set-cookie').split(';')[0];
 assert.equal((await call(env,{action:'register',code})).status,409);
 assert.equal((await call(env,{action:'login',code:'Strong-code-1235'})).status,401);
 const b=await call(env,{action:'register',code:'Other-code-5678'});const ba=(await b.json()).account;const bc=b.headers.get('set-cookie').split(';')[0];
 assert.equal((await call(env,{action:'read',course:'trust-exam'},'',origin)).status,401);
 assert.equal((await call(env,{action:'session'},ac,'https://other.example')).status,403);
 const progress={format:'study-pack-progress-v1',packId:'trust-exam',completedChapters:['a']};
 assert.equal((await call(env,{action:'write',account:aa,course:'trust-exam',revision:0,progress},ac)).status,200);
 assert.equal((await call(env,{action:'write',account:aa,course:'trust-exam',revision:0,progress:{...progress,completedChapters:[]}},ac)).status,409);
 assert.deepEqual((await (await call(env,{action:'read',account:aa,course:'trust-exam'},ac)).json()).data,progress);
 assert.deepEqual((await (await call(env,{action:'read-all',account:aa},ac)).json()).items,[{course:'trust-exam',revision:1,data:progress}]);
 assert.deepEqual((await (await call(env,{action:'read-all',account:ba},bc)).json()).items,[]);
 assert.equal((await (await call(env,{action:'read',account:ba,course:'trust-exam'},bc)).json()).data,null);
 const row=env.db.prepare('SELECT * FROM sync_accounts LIMIT 1').get();assert(!JSON.stringify(row).includes(code));
 assert.equal((await call(env,{action:'logout',account:aa},ac)).status,200);
 assert.equal((await call(env,{action:'session'},ac)).status,401);
});

for(const revision of [0,1]) test(`共享Cookie切換帳號時不串寫，原版本${revision}`,async()=>{
 const env=makeEnv();
 try {
  const a=await call(env,{action:'register',code:'Shared-Account-A123'}),b=await call(env,{action:'register',code:'Shared-Account-B456'});
  const aa=(await a.json()).account,ba=(await b.json()).account,ac=a.headers.get('set-cookie').split(';')[0],bc=b.headers.get('set-cookie').split(';')[0];
  const progress={format:'study-pack-progress-v1',packId:'trust-exam',completedChapters:['A-private'],questionStats:{},lastPosition:{chapterId:''}};
  if(revision) for(const [account,cookie] of [[aa,ac],[ba,bc]]) assert.equal((await call(env,{action:'write',account,course:'trust-exam',revision:0,progress:{...progress,completedChapters:[account]}},cookie)).status,200);
  let activeCookie=ac,writes=0;
  const storage=new Map(),localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const context={window:{addEventListener(){}},document:{querySelector:()=>null,getElementById:()=>null,addEventListener(){}},localStorage,AbortSignal,setTimeout:()=>1,clearTimeout(){},confirm:()=>false,fetch:async(url,options)=>{const data=JSON.parse(options.body);if(data.action==='write')writes++;return call(env,data,activeCookie)}};
  vm.runInNewContext(readFileSync('sync/client.js','utf8'),context);
  const key=await context.window.StudySync.bootstrap('trust-exam','guest',v=>v);assert(key.includes(aa));
  localStorage.setItem(key,JSON.stringify(progress));context.window.StudySync.markDirty();activeCookie=bc;
  await context.window.StudySync.flush();await context.window.StudySync.flush();
  assert.equal(writes,1,'帳號不符應暫停而非重試');
  assert.deepEqual(JSON.parse(localStorage.getItem(key)),progress);assert.equal(JSON.parse(localStorage.getItem(key+'.sync')).dirty,true);
  for(const [account,cookie] of [[aa,ac],[ba,bc]]) {
   const remote=await(await call(env,{action:'read',account,course:'trust-exam'},cookie)).json();
   assert.equal(remote.revision,revision);assert.deepEqual(remote.data?.completedChapters??null,revision?[account]:null);
  }
  for(const action of ['read','read-all','write','logout']) {
   assert.equal((await call(env,{action,account:aa,course:'trust-exam',revision,progress},bc)).status,403);
   assert.equal((await call(env,{action,course:'trust-exam',revision,progress},bc)).status,403,'舊客戶端缺帳號必須安全拒絕');
  }
  assert.equal((await call(env,{action:'session'},bc)).status,200,'舊分頁不可登出新帳號');
 } finally {env.db.close();}
});

test('啟動讀取途中帳號改變，不能載入另一帳號進度或重新啟用上傳',async()=>{
 const env=makeEnv();try {
  const a=await call(env,{action:'register',code:'Bootstrap-Account-A123'}),b=await call(env,{action:'register',code:'Bootstrap-Account-B456'});
  const account=(await a.json()).account,ac=a.headers.get('set-cookie').split(';')[0],bc=b.headers.get('set-cookie').split(';')[0];
  const key=`study-pack.account.${account}.trust-exam.progress`,storage=new Map([[key,JSON.stringify({marker:'A-local'})],[key+'.sync',JSON.stringify({revision:0,dirty:false})]]);
  let requests=0;
  const context={window:{addEventListener(){}},document:{querySelector:()=>null,getElementById:()=>null,addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},AbortSignal,setTimeout:()=>1,clearTimeout(){},fetch:async(url,options)=>{const data=JSON.parse(options.body);requests++;return call(env,data,data.action==='session'?ac:bc)}};
  vm.runInNewContext(readFileSync('sync/client.js','utf8'),context);
  assert.equal(await context.window.StudySync.bootstrap('trust-exam','guest',v=>v),key);
  storage.set(key,JSON.stringify({marker:'A-new-local'}));context.window.StudySync.markDirty();
  await context.window.StudySync.flush();assert.equal(requests,2);assert.equal(JSON.parse(storage.get(key+'.sync')).dirty,true);assert.deepEqual(JSON.parse(storage.get(key)),{marker:'A-new-local'});
 }finally {env.db.close();}
});

for(const switchAt of ['read-all','write']) test(`整合備份${switchAt}時切換帳號，保留原帳號本機紀錄且不串寫`,async()=>{
 const env=makeEnv();try {
  const a=await call(env,{action:'register',code:'Backup-Account-A123'}),b=await call(env,{action:'register',code:'Backup-Account-B456'});
  const account=(await a.json()).account,ac=a.headers.get('set-cookie').split(';')[0],bc=b.headers.get('set-cookie').split(';')[0];
  const progress={format:'study-pack-progress-v1',packId:'trust-exam',completedChapters:['imported-A'],questionStats:{},lastPosition:{chapterId:''}};
  const backup={format:'study-pack-complete-backup-v1',materials:{'教材.html':'教材'},records:{guest:{},account:{'trust-exam':progress}}};
  const nodes=Object.fromEntries(['backup-status','backup-export','backup-file','backup-import'].map(id=>[id,{}]));nodes['backup-file'].files=[{size:100,text:async()=>JSON.stringify(backup)}];
  const storage=new Map(),context={document:{getElementById:id=>nodes[id]},location:{protocol:'https:',origin},window:{dispatchEvent(){}},Event,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},AbortSignal,confirm:()=>true,fetch:async(url,options)=>{const data=JSON.parse(options.body);return call(env,data,data.action===switchAt?bc:ac)}};
  vm.runInNewContext(readFileSync('src/renderer/complete-backup.js','utf8'),context);await nodes['backup-file'].onchange();
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM sync_progress').get().n,0);
  if(switchAt==='write') {const key=`study-pack.account.${account}.trust-exam.progress`;assert.deepEqual(JSON.parse(storage.get(key)),progress);assert.equal(JSON.parse(storage.get(key+'.sync')).dirty,true);assert.match(nodes['backup-status'].textContent,/尚未同步/);}
  else {assert.equal(storage.size,0);assert.match(nodes['backup-status'].textContent,/無法讀取完整/);}
 }finally {env.db.close();}
});

test('改用雲端進度時帳號改變，不把新帳號資料覆蓋到舊帳號本機',async()=>{
 const env=makeEnv();try {
  const a=await call(env,{action:'register',code:'Usecloud-Account-A123'}),b=await call(env,{action:'register',code:'Usecloud-Account-B456'});
  const account=(await a.json()).account,other=(await b.json()).account,ac=a.headers.get('set-cookie').split(';')[0],bc=b.headers.get('set-cookie').split(';')[0];
  for(const [id,cookie] of [[account,ac],[other,bc]]) await call(env,{action:'write',account:id,course:'trust-exam',revision:0,progress:{format:'study-pack-progress-v1',packId:'trust-exam',completedChapters:[id]}},cookie);
  const nodes=new Map(),node=selector=>{if(!nodes.has(selector))nodes.set(selector,{style:{}});return nodes.get(selector);};
  const box={setAttribute(){},querySelector:node},target={querySelector:()=>({after(){}})};
  const storage=new Map(),localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};let activeCookie=ac,reloaded=false;
  const context={window:{addEventListener(){}},document:{querySelector:selector=>selector==='#view-settings > div'?target:null,getElementById:()=>null,createElement:()=>box,addEventListener(){}},localStorage,location:{reload(){reloaded=true;}},AbortSignal,setTimeout:()=>1,clearTimeout(){},confirm:()=>true,fetch:async(url,options)=>call(env,JSON.parse(options.body),activeCookie)};
  vm.runInNewContext(readFileSync('sync/client.js','utf8'),context);
  const key=await context.window.StudySync.bootstrap('trust-exam','guest',v=>v);localStorage.setItem(key,JSON.stringify({marker:'A-local-new'}));context.window.StudySync.markDirty();activeCookie=bc;
  await node('#sync-use-cloud').onclick();assert.equal(reloaded,false);assert.deepEqual(JSON.parse(localStorage.getItem(key)),{marker:'A-local-new'});assert.equal(JSON.parse(localStorage.getItem(key+'.sync')).dirty,true);assert.equal([...storage.keys()].some(k=>k.includes('.backup.')),false);
 }finally {env.db.close();}
});
