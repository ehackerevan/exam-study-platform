import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../src/renderer/achievements.js', import.meta.url), 'utf8'), scope);
const evaluate = scope.window.StudyAchievements.evaluate;
const pack = count => ({id:'achievement-test', questions:Array.from({length:count}, (_, i) => ({id:'q'+i}))});
const stats = (correct = 1, wrong = 0) => ({attempts:correct+wrong, correctCount:correct, wrongCount:wrong, lastResult:correct>0});
const progress = questionStats => ({format:'study-pack-progress-v1', packId:'achievement-test', questionStats});
test('distinct current questions earn 2+3 EXP once; wrong-to-correct adds only three', () => {
  const rows = Object.fromEntries(Array.from({length:10}, (_, i) => ['q'+i, i<6 ? stats() : stats(0,1)]));
  let result = evaluate(pack(100), progress(rows)); assert.equal(result.xp,38); assert.equal(result.level,1);
  rows.q0=stats(21); assert.equal(evaluate(pack(100),progress(rows)).xp,38);
  rows.q6=stats(1,1); result=evaluate(pack(100),progress(rows)); assert.equal(result.xp,41);
  assert.deepEqual(Array.from(result.badges.filter(b=>b.unlocked),b=>b.id),['first-step','explorer-10']);
});
test('duplicates, stale IDs, hidden IDs and repeated evaluation cannot inflate scores', () => {
  const p={...progress({q0:stats(),retired:stats(100)}),hiddenQuestionIds:['q0']};
  const q={id:'achievement-test',questions:[{id:'q0'},{id:'q0'},{id:'q1'}]};
  const before=JSON.stringify(p); const result=evaluate(q,p);
  assert.equal(result.total,2);assert.equal(result.xp,5);assert.equal(JSON.stringify(p),before);
  assert.equal(JSON.stringify(result),JSON.stringify(evaluate(q,p)));
});
test('empty and small packs exclude impossible badges; half thresholds round up', () => {
  assert.equal(evaluate(pack(0),progress({})).level,0);
  assert(evaluate(pack(0),progress({})).badges.every(b=>!b.applicable&&!b.unlocked));
  const result=evaluate(pack(3),progress({q0:stats()}));
  assert.equal(result.badges.find(b=>b.id==='correct-10').applicable,false);
  assert.equal(result.badges.find(b=>b.id==='coverage-half').target,2);
  assert.equal(result.next.id,'coverage-half');
});
test('all seven badges and level thresholds use unrounded fractions', () => {
  for(const [count,level] of [[19,1],[20,2],[49,2],[50,3],[79,3],[80,4]]) {
    assert.equal(evaluate(pack(100),progress(Object.fromEntries(Array.from({length:count},(_,i)=>['q'+i,stats()])))).level,level);
  }
  assert(evaluate(pack(50),progress(Object.fromEntries(Array.from({length:50},(_,i)=>['q'+i,stats()])))).badges.every(b=>b.unlocked));
});
test('invalid envelopes and counters are rejected instead of showing success or zero progress', () => {
  for(const invalid of [null,{...progress({}),packId:'another'},progress([]),progress({q0:stats(-1)}),progress({q0:{...stats(),attempts:2}}),progress({q0:{...stats(),correctCount:Infinity}}),progress({q0:{...stats(),lastResult:'true'}})])assert.throws(()=>evaluate(pack(3),invalid));
});
test('old backup and changed canonical set recalculate without persistent achievement fields', () => {
  const saved=progress({q0:stats(),q1:stats()});const before=JSON.stringify(saved);
  assert.equal(evaluate(pack(2),saved).badges.find(b=>b.id==='coverage-all').unlocked,true);
  assert.equal(evaluate(pack(3),saved).badges.find(b=>b.id==='coverage-all').unlocked,false);
  assert.equal(evaluate(pack(3),progress({})).xp,0);assert.equal(JSON.stringify(saved),before);
});
