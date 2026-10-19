import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStudyPack } from '../src/core/validator/index.js';

function getValidPack() {
  return {
    version: 1,
    schemaVersion: 1,
    contentVersion: '1.0.0',
    id: 'valid-pack',
    title: '合法學習包',
    chapters: [
      {
        id: 'ch-01',
        title: '第一章',
        sections: [
          {
            id: 'sec-01',
            title: '第一節',
            content: '內文',
            keyPoints: ['重點一']
          }
        ]
      }
    ],
    questions: [
      {
        id: 'q01',
        chapterId: 'ch-01',
        type: 'single-choice',
        question: '測試問題',
        options: ['選項A', '選項B'],
        answer: 0,
        explanation: '詳解說明'
      }
    ]
  };
}

test('Validator: 正常合規的 Pack 應驗證通過 (PASS)', () => {
  const pack = getValidPack();
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, true);
  assert.equal(report.errorCount, 0);
});

test('Validator: 缺少 Pack ID 應判定失敗 (FAIL)', () => {
  const pack = getValidPack();
  delete pack.id;
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, false);
  assert.ok(report.issues.some(i => i.code === 'MISSING_PACK_ID'));
});

test('Validator: 重複 Chapter ID 應判定失敗 (FAIL)', () => {
  const pack = getValidPack();
  pack.chapters.push({
    id: 'ch-01', // 重複
    title: '另一個第一章',
    sections: []
  });
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, false);
  assert.ok(report.issues.some(i => i.code === 'DUPLICATE_CHAPTER_ID'));
});

test('Validator: Question 指向不存在的 Chapter 應判定失敗 (FAIL)', () => {
  const pack = getValidPack();
  pack.questions[0].chapterId = 'non-existent-ch';
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, false);
  assert.ok(report.issues.some(i => i.code === 'INVALID_QUESTION_CHAPTER'));
});

test('Validator: Answer 索引超出 Options 範圍應判定失敗 (FAIL)', () => {
  const pack = getValidPack();
  pack.questions[0].answer = 5; // 只有 2 個選項 (0, 1)
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, false);
  assert.ok(report.issues.some(i => i.code === 'ANSWER_OUT_OF_BOUNDS'));
});

test('Validator: 未知的 Question Type 應判定失敗 (FAIL)', () => {
  const pack = getValidPack();
  pack.questions[0].type = 'essay'; // 不支援的題型
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, false);
  assert.ok(report.issues.some(i => i.code === 'INVALID_QUESTION_TYPE'));
});

test('Validator: 題目不提供解析不影響 isValid，也不產生警告', () => {
  const pack = getValidPack();
  delete pack.questions[0].explanation;
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, true);
  assert.ok(!report.issues.some(i => i.code === 'MISSING_EXPLANATION'));
});

test('Validator: accepts valid exam source metadata and rejects incomplete metadata', () => {
  const pack = getValidPack();
  pack.questions[0].sourceExam = {term:'第 55 期', subject:'信託實務', number:12};
  assert.equal(validateStudyPack(pack).isValid, true);
  pack.questions[0].sourceExam.number = 0;
  const report = validateStudyPack(pack);
  assert.equal(report.isValid, false);
  assert.ok(report.issues.some(i => i.code === 'INVALID_SOURCE_EXAM'));
});

test('Validator: requires complete featured question metadata', () => {
  const pack = getValidPack();
  pack.questions[0].featuredGroup = 'c01';
  pack.questions[0].featuredRank = 1;
  assert.equal(validateStudyPack(pack).isValid, true);
  pack.questions[0].featuredRank = 0;
  assert(validateStudyPack(pack).issues.some(i => i.code === 'INVALID_FEATURED_QUESTION'));
});
