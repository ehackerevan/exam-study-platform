import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../src/renderer/app.js', import.meta.url), 'utf8');
const code = app.slice(app.indexOf('  const chapterPracticeAnswers ='), app.indexOf('  // ===== 2. 教材閱讀'));
function practice(question) {
  const progress = {questionStats: {}};
  let saves = 0;
  const container = {children: [], replaceChildren() {this.children = [];}, appendChild(form) {this.children.push(form);}};
  const context = vm.createContext({pack: {chapters: []}, currentChapterId: "", progress, saveProgress() {saves++;}, escapeHtml: value => value, window: {StudyContent: {render: value => value}}, document: {createElement() {return {selectedValues: [], nodes: {}, querySelectorAll() {return this.selectedValues.map(value => ({value}));}, querySelector(selector) {return this.nodes[selector] ||= {focus() {}};}};}}});
  vm.runInContext(code, context);
  context.container = container;context.questions = [question];
  vm.runInContext('renderChapterPractice(container, questions)', context);
  return {progress, container, saves: () => saves, submit(values) {const form = container.children[0];form.selectedValues = values;form.onsubmit({preventDefault() {}});}};
}
test('Inline chapter practice requires selection, records one result, and supports retry', () => {
  const p = practice({id: 'q1', question: '題目', type: 'single-choice', options: ['甲', '乙'], answer: 1});
  p.submit([]);assert.equal(p.saves(), 0);
  p.submit([1]);assert.equal(p.progress.questionStats.q1.correctCount, 1);assert.equal(p.saves(), 1);
  assert(p.container.children[0].innerHTML.includes('作答正確'));
  p.submit([]);assert.equal(p.saves(), 1);
  p.submit([0]);assert.equal(p.progress.questionStats.q1.attempts, 2);assert.equal(p.progress.questionStats.q1.wrongCount, 1);
  assert(p.container.children[0].innerHTML.includes('正確答案：B'));
});
test('Inline multiple-choice practice requires the full answer set and ignores order', () => {
  const q = {id: 'q2', question: '多選題', type: 'multiple-choice', options: ['甲', '乙', '丙'], answer: [0, 2]};
  const partial = practice(q);partial.submit([0]);assert.equal(partial.progress.questionStats.q2.lastResult, false);
  const full = practice(q);full.submit([2, 0]);assert.equal(full.progress.questionStats.q2.lastResult, true);
});
