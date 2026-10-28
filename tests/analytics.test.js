import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../analytics/worker.js';

const origin = 'https://ehackerevan.github.io';
const request = (body, headers = {}) => new Request('https://worker.example/event', {method:'POST', headers:{Origin:origin, 'CF-Connecting-IP':'192.0.2.1', ...headers}, body:typeof body === 'string' ? body : JSON.stringify(body)});
function environment() {
  const rows = [];
  return {rows, RATE_LIMITER:{limit: async () => ({success:true})}, DB:{prepare(sql) { return {async all() {return {results:[]};}, bind(...values) {return {async run() {assert.match(sql, /ON CONFLICT/); rows.push(values);}, async all() {return {results: sql.includes('GROUP BY course, type') ? [{course:'trust-exam', type:'view', total:3}] : [{question:'past-63-law-1', total:2}]};}};}};}}};
}

test('anonymous counters accept only bounded view and answer events', async () => {
  const env = environment();
  assert.equal((await worker.fetch(request({type:'view', course:'trust-exam'}), env)).status, 204);
  assert.equal((await worker.fetch(request({type:'answer', course:'trust-exam', question:'past-63-law-1'}), env)).status, 204);
  assert.deepEqual(env.rows.map(row => row.slice(1)), [['view','trust-exam',''], ['answer','trust-exam','past-63-law-1']]);
  for (const event of [null, {}, {type:'answer',course:'trust-exam'}, {type:'view',course:'trust-exam',question:'x'}, {type:'answer',course:'trust-exam',question:'x',answer:1}, {type:'view',course:'../secret'}]) {
    assert.equal((await worker.fetch(request(event),env)).status,400);
  }
  assert.equal((await worker.fetch(request('x'.repeat(513)),env)).status,413);
  assert.equal((await worker.fetch(request({}, {Origin:'https://other.example'}),env)).status,403);
  assert.equal(env.rows.length,2);
  env.RATE_LIMITER.limit = async () => ({success:false});
  assert.equal((await worker.fetch(request({type:'view',course:'trust-exam'}),env)).status,429);
  assert.equal(env.rows.length,2);
});

test('public aggregate reads enforce the site origin and return only counts', async () => {
  const env = environment();
  const req = (url, source=origin) => new Request(url, {headers:{Origin:source, 'CF-Connecting-IP':'192.0.2.1'}});
  const result = await worker.fetch(req('https://worker.example/counts?course=trust-exam'),env);
  assert.equal(result.status,200); assert.equal(result.headers.get('Access-Control-Allow-Origin'),origin);
  assert.deepEqual(await result.json(), {totals:[{course:'trust-exam',type:'view',total:3}], questions:[{question:'past-63-law-1',total:2}]});
  assert.equal((await worker.fetch(req('https://worker.example/counts','https://other.example'),env)).status,403);
  assert.equal((await worker.fetch(req('https://worker.example/counts?course=other'),env)).status,400);
});
