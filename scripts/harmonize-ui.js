import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applySharedUi} from '../src/core/compiler/ui-theme.js';
export function htmlFiles(root = process.cwd()) {
  const files = [];
  function walk(dir) {for (const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
    const name = path.join(dir,entry.name);
    if (entry.isDirectory()) walk(name); else if (entry.name.endsWith('.html')) files.push(name);
  }}
  walk('dist');
  files.push('src/renderer/template.html');
  if (fs.existsSync(path.join(root, '考古題/歷屆考古題_完整題庫大全.html'))) files.push('考古題/歷屆考古題_完整題庫大全.html');
  return files.sort();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const file of htmlFiles()) {
    const normalized = file.replaceAll('\\','/');
    const home = normalized === 'dist/index.html' ? null : normalized.startsWith('src/') ? '../../dist/index.html' : normalized.startsWith('考古題/') ? '../dist/index.html' : 'index.html';
    // Older standalone packs retain their own app script; update only the quiz selector setup.
    const html = fs.readFileSync(file,'utf8').replace(
      /(const quizChSelect = document\.getElementById\('quiz-select-chapter'\);\s*if \(quizChSelect\) \{\s*)pack\.chapters\.forEach\(c =>/,
      '$1pack.chapters.filter(c => pack.questions.some(q => q.chapterId === c.id)).forEach(c =>'
    );
    fs.writeFileSync(file, applySharedUi(html, home));
  }
  console.log(`Applied shared offline UI to ${htmlFiles().length} HTML pages`);
}
