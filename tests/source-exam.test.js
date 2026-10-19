import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSourceExam } from '../src/core/utils/source-exam.js';
import { loadTrustCourse } from '../src/core/utils/trust-course.js';

test('source exam metadata parses every existing course question without changing its identity', () => {
  const subjects = fs.readdirSync('教材').filter(name => fs.existsSync(path.join('教材', name, 'questions.json')));
  const counts = new Map();

  for (const subject of subjects) {
    const questions = JSON.parse(fs.readFileSync(path.join('教材', subject, 'questions.json'), 'utf8')).questions;
    for (const question of questions) {
      const source = parseSourceExam(question, subject);
      assert.ok(source, `unparsed question source: ${question.id}`);
      assert.ok(source.term);
      assert.ok(source.subject);
      assert.ok(Number.isSafeInteger(source.number) && source.number > 0);
      assert.ok(question.id);
      counts.set(subject, (counts.get(subject) || 0) + 1);
    }
  }

  assert.deepEqual([...counts.values()].sort((a, b) => a - b), [839, 1267, 2388, 2989]);
});

test('source exam parser maps Trust question records and rejects missing exam labels', () => {
  assert.deepEqual(parseSourceExam({p:55,s:2,n:12}), {
    term: '第 55 期', subject: '信託實務', number: 12
  });
  assert.deepEqual(parseSourceExam('【第 55 屆 信託實務 第 12 題】題幹'), {
    term: '第 55 屆', subject: '信託實務', number: 12
  });
  assert.equal(parseSourceExam('無考期標記的題目'), null);
});

test('Trust course imports unique source questions and offline chapter diagrams without explanations', () => {
  const pack = loadTrustCourse('教材/信託業務人員重點教材');
  const source = JSON.parse(fs.readFileSync('教材/信託業務人員重點教材/full_exam_bank.json', 'utf8'));
  const curated = JSON.parse(fs.readFileSync('教材/信託業務人員重點教材/curated_top10_bank.json', 'utf8'));
  const unique = [...new Map(Object.values(source).flat().map((question) => [question.id, question])).values()];

  assert.equal(pack.chapters.length, 9);
  assert.equal(pack.questions.length, 2722);
  assert.equal(new Set(pack.questions.map((question) => question.id)).size, 2722);
  const actual = Object.fromEntries(pack.questions.map(({ id, chapterId, question, options, answer }) => [id, { chapterId, question, options, answer }]));
  const expected = Object.fromEntries(unique.map(({ id, chapter, stem, options, answer }) => [id, { chapterId: chapter, question: stem, options, answer }]));
  assert.deepEqual(actual, expected);
  assert(pack.questions.every((question) => question.sourceExam?.term && question.sourceExam.subject && Number.isSafeInteger(question.sourceExam.number)));
  assert(pack.chapters.some((chapter) => chapter.sections.some((section) => section.content.includes('data:image/svg+xml;base64,'))));
  assert(pack.questions.every((question) => !('explanation' in question) && !('note' in question)));
  const expectedFeatured = new Map(Object.entries(curated).flatMap(([group, questions]) => questions.map((question, index) =>
    [`${question.term}|${question.subject}|${question.number}`, {group, rank:index + 1, answer:question.answer - 1}])));
  const actualFeatured = pack.questions.filter((question) => question.featuredGroup).map((question) => {
    const sourceExam = question.sourceExam;
    const source = expectedFeatured.get(`${Number(sourceExam.term.match(/\d+/)[0])}|${sourceExam.subject}|${sourceExam.number}`);
    assert(source, question.id);
    assert.equal(question.answer, source.answer);
    assert.equal(question.featuredGroup, source.group);
    assert.equal(question.featuredRank, source.rank);
    return question.id;
  });
  assert.equal(actualFeatured.length, 80);
});
