import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSourceExam } from '../src/core/utils/source-exam.js';
import { loadTrustCourse } from '../src/core/utils/trust-course.js';
import { parseStudyPackJson } from '../src/core/parser/json-parser.js';

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

  const statistics = JSON.parse(fs.readFileSync('tasks/exam_frequency_20261020.json', 'utf8')).courses;
  for (const [subject, count] of counts) {
    const course = Object.entries(statistics).find(([name]) => name.startsWith(subject));
    assert(course, subject);
    assert.equal(count, course[1].question_record_count, `${subject}: source count and statistics must agree`);
  }
});

test('question source metadata survives JSON sanitization', () => {
  const sourceExam = {term:'證基會116年版（2027-01-01起適用）',subject:'金融市場常識',number:558};
  const pack = parseStudyPackJson({
    id:'source-metadata',title:'來源 metadata',
    chapters:[{id:'c01',title:'第一章',sections:[]}],
    questions:[{id:'q01',chapterId:'c01',type:'single-choice',question:'題目',options:['A','B'],answer:0,sourceExam}]
  });
  assert.deepEqual(pack.questions[0].sourceExam,sourceExam);
});

test('financial market and ethics source bank preserves all official question numbers and normalized answer indexes', () => {
  const questions = JSON.parse(fs.readFileSync('教材/金融市場常識與職業道德題庫/questions.json', 'utf8')).questions;
  assert.equal(questions.length, 1174);

  for (const [chapterId, count] of [['financial-market', 558], ['professional-ethics', 616]]) {
    const chapterQuestions = questions.filter(question => question.chapterId === chapterId);
    assert.equal(chapterQuestions.length, count);
    assert.deepEqual(chapterQuestions.map(question => question.sourceExam.number), Array.from({length: count}, (_, index) => index + 1));
  }

  assert.equal(new Set(questions.map(question => question.id)).size, 1174);
  assert(questions.every(question => question.type === 'single-choice' && question.options.length === 4 && question.answer >= 0 && question.answer < 4));
  assert(questions.every(question => [question.question, ...question.options].every(text => !/\p{Script=Han} +\p{Script=Han}/u.test(text))));
  assert(questions.every(question => !/^【(?:金融市場常識|職業道德)】/.test(question.question)));
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
  assert.equal(pack.questions.length, unique.length);
  assert.equal(new Set(pack.questions.map((question) => question.id)).size, unique.length);
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
