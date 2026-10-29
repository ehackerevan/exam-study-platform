import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../sync/worker.js';
const origin='https://ehackerevan.github.io';
function makeEnv(){const db=new DatabaseSync(':memory:');db.exec(readFileSync('sync/schema.sql','utf8'));return {SYNC_PEPPER:'test-only-secret',RATE_LIMITER:{limit:async()=>({success:true})},AUTH_LIMITER:{limit:async()=>({success:true})},DB:{prepare(sql){const stmt=db.prepare(sql);return {bind(...args){return {async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}}}}}}},db};}
const call=(env,data,cookie='',source=origin)=>worker.fetch(new Request('https://example.test/',{method:'POST',headers:{Origin:source,'CF-Connecting-IP':'192.0.2.1',Cookie:cookie},body:JSON.stringify(data)}),env);
test('codes authenticate, accounts stay isolated, and conflicting writes do not overwrite',async()=>{
 const env=makeEnv(),code='Strong-code-1234';
 assert.equal((await call(env,{action:'register',code:'weak'})).status,400);
 const a=await call(env,{action:'register',code});assert.equal(a.status,200);const ac=a.headers.get('set-cookie').split(';')[0];
 assert.equal((await call(env,{action:'register',code})).status,409);
 assert.equal((await call(env,{action:'login',code:'Strong-code-1235'})).status,401);
 const b=await call(env,{action:'register',code:'Other-code-5678'});const bc=b.headers.get('set-cookie').split(';')[0];
 assert.equal((await call(env,{action:'read',course:'trust-exam'},'',origin)).status,401);
 assert.equal((await call(env,{action:'session'},ac,'https://other.example')).status,403);
 const progress={format:'study-pack-progress-v1',packId:'trust-exam',completedChapters:['a']};
 assert.equal((await call(env,{action:'write',course:'trust-exam',revision:0,progress},ac)).status,200);
 assert.equal((await call(env,{action:'write',course:'trust-exam',revision:0,progress:{...progress,completedChapters:[]}},ac)).status,409);
 assert.deepEqual((await (await call(env,{action:'read',course:'trust-exam'},ac)).json()).data,progress);
 assert.deepEqual((await (await call(env,{action:'read-all'},ac)).json()).items,[{course:'trust-exam',revision:1,data:progress}]);
 assert.deepEqual((await (await call(env,{action:'read-all'},bc)).json()).items,[]);
 assert.equal((await (await call(env,{action:'read',course:'trust-exam'},bc)).json()).data,null);
 const row=env.db.prepare('SELECT * FROM sync_accounts LIMIT 1').get();assert(!JSON.stringify(row).includes(code));
 assert.equal((await call(env,{action:'logout'},ac)).status,200);
 assert.equal((await call(env,{action:'session'},ac)).status,401);
});
