import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compileStudyPackToHtml, compileAndWriteToFile } from '../src/core/compiler/index.js';
import { loadSourcesFromDirectory } from '../src/cli/index.js';
import { buildNormalizedStudyPack } from '../src/core/parser/index.js';

test('Compiler: 字串替換保留教材中的美元符號與安全腳本字串', () => {
  const content = '$& $1 <script>範例</script> <!-- <script>未閉合範例';
  const pack = {version:1,id:'literal-data',title:'$& 教材',chapters:[{id:'c01',title:'第一章',sections:[{id:'s01',title:'內容',content,keyPoints:[],notes:[]}]}],questions:[]};
  const html = compileStudyPackToHtml(pack).html;
  const serialized = html.match(/window\.__STUDY_PACK__ = ([\s\S]*?);\s*<\/script>/)[1];
  assert.equal(JSON.parse(serialized).chapters[0].sections[0].content, content);
  assert(!serialized.includes('<'));
  assert(html.includes('<title>$&amp; 教材</title>'));
});

test('Compiler: 能將合法的 Study Pack 編譯為單一 HTML 並包含必要結構', () => {
  const pack = {
    version: 1,
    schemaVersion: 1,
    contentVersion: '1.0.0',
    id: 'test-compile',
    title: '編譯測試教材',
    chapters: [
      {
        id: 'ch-01',
        title: '第一章 測試',
        sections: [{ id: 's1', title: '小節1', content: '內容文字', keyPoints: ['重點'] }]
      }
    ],
    questions: [
      {
        id: 'q1',
        chapterId: 'ch-01',
        type: 'single-choice',
        question: '編譯是否成功？',
        options: ['是', '否'],
        answer: 0,
        explanation: '必定成功'
      }
    ]
  };

  const result = compileStudyPackToHtml(pack);
  assert.ok(result.html.length > 1000);
  assert.ok(result.sizeBytes > 0);
  assert.equal(result.chaptersCount, 1);
  assert.equal(result.questionsCount, 1);

  // 檢查結構
  assert.ok(result.html.includes('<!DOCTYPE html>'));
  assert.ok(result.html.includes('<meta charset="UTF-8">'));
  assert.ok(result.html.includes('name="viewport"'));
  assert.ok(result.html.includes('<title>編譯測試教材</title>'));
  assert.ok(result.html.includes('window.__STUDY_PACK__ ='));
  const serializedPack = JSON.parse(result.html.match(/window\.__STUDY_PACK__ = ([\s\S]*?);\s*<\/script>/)[1]);
  assert.equal(serializedPack.questions[0].question, '編譯是否成功？');
  assert.equal(serializedPack.questions[0].answer, 0);
  assert.ok(!Object.hasOwn(serializedPack.questions[0], 'explanation'));
  const withExplanations = compileStudyPackToHtml(pack, {includeExplanations:true});
  const explainedPack = JSON.parse(withExplanations.html.match(/window\.__STUDY_PACK__ = ([\s\S]*?);\s*<\/script>/)[1]);
  assert.equal(explainedPack.questions[0].explanation, '必定成功');
  assert.ok(result.html.includes('/* Study Pack Compiler - 現代化無外部依賴設計系統 */'));
  assert.ok(result.html.includes('Study Pack Client-side Application Core'));
});

test('Compiler: 成功編譯三組 Example Packs 與 Migration Pack', () => {
  const examples = [
    'general-exam',
    'language-learning',
    'technical-learning',
    'trust-exam-migration'
  ];

  for (const ex of examples) {
    const dir = path.resolve(process.cwd(), 'examples', ex);
    const sources = loadSourcesFromDirectory(dir);
    const pack = buildNormalizedStudyPack(sources);
    const outPath = path.resolve(process.cwd(), '.qa-artifacts', 'compiler-test', `${ex}.html`);

    const result = compileAndWriteToFile(pack, outPath);
    assert.ok(fs.existsSync(outPath));
    assert.ok(result.sizeBytes > 0);
    assert.ok(result.chaptersCount >= 1);
    assert.ok(result.questionsCount >= 1);
  }
});
