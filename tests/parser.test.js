import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownToChapters } from '../src/core/parser/markdown-parser.js';
import { parseQuestionsCsv, normalizeAnswer } from '../src/core/parser/csv-parser.js';
import { parseStudyPackJson } from '../src/core/parser/json-parser.js';
import { parseQuestionsTxt } from '../src/core/parser/txt-parser.js';

test('Markdown Parser: 能正確將 H1, H2, H3 重點轉換為章節結構', () => {
  const md = `---
title: "測試章節"
id: "test-pack"
---
# 第一章 總論

## 基本觀念
這是內文段落。

### 重點
- 重點一：不可忘記
- 重點二：核心觀念

### 備註
- 額外補充注意事項

## 第二小節 進階探討
進階內容段落。
`;

  const { metadata, chapters } = parseMarkdownToChapters(md);

  assert.equal(metadata.title, '測試章節');
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].title, '第一章 總論');
  assert.equal(chapters[0].sections.length, 2);

  const sec1 = chapters[0].sections[0];
  assert.equal(sec1.title, '基本觀念');
  assert.ok(sec1.content.includes('這是內文段落'));
  assert.equal(sec1.keyPoints.length, 2);
  assert.equal(sec1.keyPoints[0], '重點一：不可忘記');
  assert.equal(sec1.notes.length, 1);
  assert.equal(sec1.notes[0], '額外補充注意事項');
});

test('CSV Parser: 能解析標準 CSV 並正規化單選、是非與多選答案', () => {
  const csv = `id,chapter,section,type,question,option_a,option_b,option_c,option_d,answer,explanation
q1,ch1,sec1,single-choice,單選測試,A選項,B選項,C選項,D選項,B,單選解析
q2,ch1,sec1,true-false,是非測試,正確,錯誤,,,O,是非解析
q3,ch1,sec1,multiple-choice,多選測試,選項1,選項2,選項3,選項4,"A,C",多選解析`;

  const qs = parseQuestionsCsv(csv);

  assert.equal(qs.length, 3);
  // q1
  assert.equal(qs[0].id, 'q1');
  assert.equal(qs[0].type, 'single-choice');
  assert.equal(qs[0].answer, 1); // B -> 1
  assert.equal(qs[0].explanation, '單選解析');

  // q2
  assert.equal(qs[1].id, 'q2');
  assert.equal(qs[1].type, 'true-false');
  assert.equal(qs[1].answer, 0); // O -> 0

  // q3
  assert.equal(qs[2].id, 'q3');
  assert.equal(qs[2].type, 'multiple-choice');
  assert.deepEqual(qs[2].answer, [0, 2]); // A,C -> [0, 2]
});

test('JSON Parser: 能解析合法的 Study Pack JSON 並給予防禦性預設值', () => {
  const rawJson = JSON.stringify({
    id: 'json-pack',
    title: 'JSON 測試',
    chapters: [
      { id: 'ch-01', title: '章節1', sections: [{ id: 's1', title: '小節1' }] }
    ],
    questions: [
      { id: 'q1', chapterId: 'ch-01', question: '題目', options: ['A', 'B'], answer: 0 }
    ]
  });

  const pack = parseStudyPackJson(rawJson);
  assert.equal(pack.id, 'json-pack');
  assert.equal(pack.title, 'JSON 測試');
  assert.equal(pack.chapters.length, 1);
  assert.equal(pack.questions.length, 1);
});

test('TXT Parser: 能解析純文字題幹與選項', () => {
  const txt = `1. 這是測試題目內文
(A) 第一個選項
(B) 第二個選項
(C) 第三個選項
(D) 第四個選項
答案：C
解析：因為C是正確的。`;

  const qs = parseQuestionsTxt(txt, 'chapter-01');
  assert.equal(qs.length, 1);
  assert.equal(qs[0].question, '這是測試題目內文');
  assert.equal(qs[0].options.length, 4);
  assert.equal(qs[0].answer, 2); // C -> 2
  assert.equal(qs[0].explanation, '因為C是正確的。');
});
