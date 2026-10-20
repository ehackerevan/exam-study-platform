import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/renderer/catalog-progress.js', import.meta.url), 'utf8');
function render(raw, blocked = false) {
  const cards = ['reader', 'quiz'].map(view => ({dataset: {pack: 'example', progressView: view}, label: {}, bar: {}, querySelector(selector) {return selector === 'progress' ? this.bar : this.label;}}));
  const listeners = {};
  vm.runInNewContext(source, {window: {__CATALOG_PROGRESS__: [{id: 'example', chapters: ['c1', 'c2'], questions: ['q1', 'q2']}], addEventListener(name, callback) {listeners[name] = callback;}}, document: {querySelectorAll() {return cards;}}, localStorage: {getItem() {if (blocked) throw Error('unavailable');return raw;}}});
  return {cards, listeners};
}
test('Catalogue progress counts distinct current chapters and questions, not attempts or stale IDs', () => {
  const {cards, listeners} = render(JSON.stringify({format: 'study-pack-progress-v1', packId: 'example', completedChapters: ['c1', 'c1', 'old'], questionStats: {q1: {attempts: 8}, old: {attempts: 4}}}));
  assert.equal(cards[0].bar.value, 50);
  assert.equal(cards[1].bar.value, 50);
  for (const event of ['storage', 'focus', 'pageshow']) assert.equal(typeof listeners[event], 'function');
});
test('Catalogue progress distinguishes no progress from unreadable data', () => {
  assert.equal(render(null).cards[0].bar.value, 0);
  for (const raw of ['{', JSON.stringify({completedChapters: 3})]) assert.equal(render(raw).cards[0].bar.hidden, true);
  assert.equal(render(null, true).cards[0].bar.hidden, true);
});
