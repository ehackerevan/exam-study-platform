import fs from 'node:fs';
import path from 'node:path';
import { loadSourcesFromDirectory } from '../src/cli/index.js';
import { buildNormalizedStudyPack } from '../src/core/parser/index.js';
import { compileAndWriteToFile } from '../src/core/compiler/index.js';

const examples = [
  'general-exam',
  'language-learning',
  'technical-learning',
  'trust-exam-migration'
];

console.log('=== 開始編譯所有 Example Packs ===\n');

for (const ex of examples) {
  const dir = path.resolve(process.cwd(), 'examples', ex);
  const out = path.resolve(process.cwd(), 'dist', `${ex}.html`);
  const sources = loadSourcesFromDirectory(dir);
  const pack = buildNormalizedStudyPack(sources);
  const res = compileAndWriteToFile(pack, out);

  const sizeKb = (res.sizeBytes / 1024).toFixed(1);
  console.log(`[OK] ${ex} -> ${out} (${sizeKb} KB, ${res.chaptersCount} 章節, ${res.questionsCount} 題目)`);
}

console.log('\n=== 全部範例編譯完成 ===');
