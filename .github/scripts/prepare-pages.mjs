import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputValue = process.env.PAGES_OUTPUT_DIR;
if (!outputValue) throw new Error('PAGES_OUTPUT_DIR is required');

const output = path.resolve(outputValue);
const outputRelativeToRoot = path.relative(root, output);
if (outputRelativeToRoot === '' || (!outputRelativeToRoot.startsWith('..') && !path.isAbsolute(outputRelativeToRoot))) {
  throw new Error('Pages output must be outside the repository');
}
mkdirSync(output, { recursive: true });
if (readdirSync(output).length) throw new Error('Pages output directory must be empty');

function copyFile(relativePath) {
  const source = path.join(root, relativePath);
  if (!existsSync(source)) throw new Error(`Missing site file: ${relativePath}`);
  const destination = path.join(output, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, readFileSync(source));
}

function copyMatchingFiles(relativePath, extensions) {
  const source = path.join(root, relativePath);
  if (!existsSync(source)) throw new Error(`Missing site directory: ${relativePath}`);
  let count = 0;
  function visit(current, destinationRoot) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const sourcePath = path.join(current, entry.name);
      const destinationPath = path.join(destinationRoot, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath, destinationPath);
      } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        mkdirSync(path.dirname(destinationPath), { recursive: true });
        writeFileSync(destinationPath, readFileSync(sourcePath));
        count += 1;
      }
    }
  }
  visit(source, path.join(output, relativePath));
  return count;
}

const publicPages = [
  '01_信託業務人員/06_答案核對版/信託業務人員教材與題庫_核對版.html',
  '02_金融科技力/02_離線教材題庫包/金融科技力重點教材.html',
  '03_消費金融內控稽核/02_離線教材題庫包/消費金融內部控制與稽核重點教材.html',
  '04_永續發展基礎能力/02_離線教材題庫包/永續發展基礎能力重點教材.html',
  '05_防制洗錢與打擊資恐/02_離線教材題庫包/防制洗錢與打擊資恐重點教材.html',
  '06_四科彙整題庫/歷屆考古題_完整題庫大全.html',
];

copyFile('index.html');
for (const page of publicPages) copyFile(page);

const indexPath = path.join(output, 'index.html');
let index = readFileSync(indexPath, 'utf8');
if (/\bhref=["'][^"']+\.md(?:[#?][^"']*)?["']/i.test(index)) {
  throw new Error('Markdown document link remains in the public catalog');
}
writeFileSync(indexPath, index);

const trustPage = path.join(output, publicPages[0]);
const trustHtml = readFileSync(trustPage, 'utf8');
if (!trustHtml.includes("new URL('../01_教材來源/信託業務人員重點教材/', location.href).href")) {
  throw new Error('Trust iframe must resolve study assets relative to the embedded course source');
}

for (const page of [indexPath, ...publicPages.map((relativePath) => path.join(output, relativePath))]) {
  const html = readFileSync(page, 'utf8');
  if (/<a\b[^>]*\bhref=["'][^"']+\.md(?:[#?][^"']*)?["']/i.test(html)) {
    throw new Error(`Markdown document link remains in published page: ${path.relative(output, page)}`);
  }
}

const sourceRoots = [
  '01_信託業務人員/01_教材來源/信託業務人員重點教材',
  '02_金融科技力/01_教材與題庫來源',
  '03_消費金融內控稽核/01_教材與題庫來源',
  '04_永續發展基礎能力/01_教材與題庫來源',
  '05_防制洗錢與打擊資恐/01_教材與題庫來源',
];
let materialCount = 0;
for (const source of sourceRoots) {
  materialCount += copyMatchingFiles(source, new Set(source.startsWith('01_信託') ? ['.md', '.js'] : ['.md']));
}
const diagramCount = copyMatchingFiles('01_信託業務人員/03_既有教材與題庫頁/教材圖解', new Set(['.svg']));

const localHtmlLinks = [...index.matchAll(/href=["']([^"']+\.html)(?:#[^"']*)?["']/g)].map((match) => match[1]);
for (const href of localHtmlLinks) {
  if (!existsSync(path.join(output, href))) throw new Error(`Catalog page is missing: ${href}`);
}
for (const required of [
  '01_信託業務人員/01_教材來源/信託業務人員重點教材/exam_bank_data.js',
  '01_信託業務人員/03_既有教材與題庫頁/教材圖解',
]) {
  if (!existsSync(path.join(output, required))) throw new Error(`Trust study asset is missing: ${required}`);
}
if (!materialCount || !diagramCount) throw new Error('Expected course materials and trust diagrams in the site artifact');
if (/.(?:pdf|json|csv|ipynb|py|docx)$/i.test(publicPages.join('\n'))) throw new Error('A private source file entered the page allowlist');

process.stdout.write(`Prepared ${publicPages.length + 1} pages, ${materialCount} Markdown/JS materials, and ${diagramCount} SVG diagrams.\n`);
