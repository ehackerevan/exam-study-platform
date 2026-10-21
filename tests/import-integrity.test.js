import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {loadSourcesFromDirectory} from '../src/cli/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStudyPackJson, parseQuestionsCsv, parseQuestionsTxt, parseMarkdownToChapters, buildNormalizedStudyPack} from '../src/core/parser/index.js';
import {normalizeAnswer, parseCsvRows} from '../src/core/parser/csv-parser.js';
import {validateStudyPack} from '../src/core/validator/index.js';

const packFor = questions => ({id:'integrity',title:'測試',chapters:[{id:'chapter-01',title:'教材',sections:[]}],questions});

test('Missing and malformed source answers never silently become option A', () => {
  for (const value of [undefined, null, '', '???', '1abc', '1.5']) assert.equal(normalizeAnswer(value), undefined);
  assert.equal(normalizeAnswer('A,???','multiple-choice'), undefined);
  assert.equal(normalizeAnswer('B','true-false'),1);
  assert.deepEqual(normalizeAnswer('A，C','multiple-choice'), [0,2]);
  for (const questions of [
    parseStudyPackJson([{question:'未提供答案',options:['甲','乙']}]).questions,
    parseQuestionsCsv('question,option_a,option_b,answer\n未提供答案,甲,乙,'),
    parseQuestionsTxt('1. 未提供答案\n(A) 甲\n(B) 乙')
  ]) assert.equal(validateStudyPack(packFor(questions)).isValid, false);
});

test('CSV preserves middle option slots and rejects unfinished quoted records', () => {
  const questions = parseQuestionsCsv('question,option_a,option_b,option_c,answer\n選項缺漏,甲,,丙,C');
  assert.deepEqual(questions[0].options,['甲','','丙']);
  assert.equal(questions[0].answer,2);
  assert(validateStudyPack(packFor(questions)).issues.some(issue=>issue.code==='EMPTY_OPTION'));
  assert.throws(()=>parseCsvRows('question,answer\n"未閉合,A'),/引號未閉合/);
});

test('UTF-8 BOM and exported practice/knowledge metadata survive imports', () => {
  const source=packFor([{id:'q1',chapterId:'chapter-01',type:'single-choice',question:'題目',options:['甲','乙'],answer:0,knowledgePoints:['觀念'],featuredGroup:'c01',featuredRank:1}]);
  source.chapters[0].practiceQuestionIds=['q1'];source.chapters[0].practiceConcepts=['觀念'];
  const parsed=parseStudyPackJson('\uFEFF'+JSON.stringify(source));
  assert.deepEqual(parsed.chapters[0].practiceQuestionIds,['q1']);
  assert.deepEqual(parsed.questions[0].knowledgePoints,['觀念']);
  assert.equal(parsed.questions[0].featuredRank,1);
  assert.equal(parseMarkdownToChapters('\uFEFF---\nid: bom-pack\n---\n# 教材').metadata.id,'bom-pack');
  assert.equal(parseQuestionsCsv('\uFEFFid,question,option_a,option_b,answer\nx,題目,甲,乙,B')[0].id,'x');
});

test('Validator reports bad data rather than accepting non-integer answers or crashing', () => {
  for(const answer of [NaN,Infinity,0.5,undefined]) {
    const pack=parseStudyPackJson(packFor([{question:'題目',options:['甲','乙'],answer}]));
    assert.equal(validateStudyPack(pack).isValid,false);
  }
  for(const field of ['chapters','questions']) {
    const pack=packFor([]);pack[field]=[null];
    assert.doesNotThrow(()=>validateStudyPack(pack));assert.equal(validateStudyPack(pack).isValid,false);
  }
  const pack=packFor([{id:'q1',chapterId:'chapter-01',question:'亂碼\uFFFD',type:'multiple-choice',options:['甲','乙'],answer:[0,0]}]);
  assert(validateStudyPack(pack).issues.some(issue=>issue.code==='INVALID_TEXT'));
  assert(validateStudyPack(pack).issues.some(issue=>issue.code==='DUPLICATE_ANSWER'));
});

test('Question-array and teaching sources sharing a chapter ID merge without duplicate empty chapters', () => {
  const pack=buildNormalizedStudyPack({jsons:[[{question:'題目',options:['甲','乙'],answer:0}]],markdowns:['---\nchapterId: chapter-01\n---\n# 教材\n\n## 觀念\n內容']});
  assert.equal(pack.chapters.length,1);
  assert(pack.chapters[0].sections.some(section=>section.content==='內容'));
  assert.equal(validateStudyPack(pack).isValid,true);
});


test('Multiple H1 chapters under one frontmatter ID receive distinct stable chapter IDs', () => {
  const parsed=parseMarkdownToChapters('---\nid: multi\n---\n# 第一章\n內容一\n# 第二章\n內容二');
  assert.deepEqual(parsed.chapters.map(chapter=>chapter.id),['multi','multi-2']);
});


test('Invalid UTF-8 source bytes fail before importing or replacing text', () => {
  const file=path.join(tmpdir(), `study-import-${randomUUID()}.json`);
  try {fs.writeFileSync(file,Buffer.from([0x7b,0x22,0xc3,0x28,0x22,0x7d]));assert.throws(()=>loadSourcesFromDirectory(file),/UTF-8/);}
  finally {if(fs.existsSync(file))fs.unlinkSync(file);}
});


test('CSV section titles resolve to teaching section IDs and broken references are rejected', () => {
  const pack=buildNormalizedStudyPack({markdowns:['# 第一章\n\n## 核心概念\n內容'],csvQuestions:['id,chapter,section,question,option_a,option_b,answer\nq1,第一章,核心概念,題目,甲,乙,B']});
  assert.equal(pack.questions[0].sectionId,pack.chapters[0].sections[0].id);
  assert.equal(validateStudyPack(pack).isValid,true);
  pack.questions[0].sectionId='missing';
  assert(validateStudyPack(pack).issues.some(issue=>issue.code==='INVALID_QUESTION_SECTION'));
  assert.throws(()=>parseStudyPackJson({questions:{wrong:'shape'}}),/questions 必須為陣列/);
});
