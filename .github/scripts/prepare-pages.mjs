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

const analytics = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "59713a6319a6493194058911d9a9a96d"}'></script><!-- End Cloudflare Web Analytics -->`;
const eventClient = readFileSync(path.join(root, 'analytics/client.js'), 'utf8');
const syncClient = readFileSync(path.join(root, 'sync/client.js'), 'utf8');

function copyFile(relativePath, destinationPath = relativePath, recordEvents = false) {
  const source = path.join(root, relativePath);
  if (!existsSync(source)) throw new Error(`Missing site file: ${relativePath}`);
  const destination = path.join(output, destinationPath);
  mkdirSync(path.dirname(destination), { recursive: true });
  const html = readFileSync(source, 'utf8');
  if (!/<\/body>/i.test(html)) throw new Error(`Missing closing body: ${relativePath}`);
  if (html.includes('static.cloudflareinsights.com/beacon.min.js')) throw new Error(`Analytics already present: ${relativePath}`);
  const withMetrics = recordEvents ? html.replace(/<\/head>/i, () => `<script>${eventClient}\n${syncClient}</script>\n</head>`) : html;
  writeFileSync(destination, withMetrics.replace(/<\/body>/i, () => analytics + '\n</body>'));
}

const coursePages = [
  '信託業務人員重點教材.html',
  '金融科技力重點教材.html',
  '消費金融內部控制與稽核重點教材.html',
  '永續發展基礎能力重點教材.html',
  '防制洗錢與打擊資恐重點教材.html',
  '金融市場常識與職業道德題庫.html',
  '金融市場常識與職業道德題庫_116年版.html',
  '投資型保險題庫.html',
  '衍生性金融商品題庫.html',
];
const publicPages = ['index.html', ...coursePages, '歷屆考古題_完整題庫大全.html'];
copyFile('dist/index.html', 'index.html', true);
for (const page of coursePages) copyFile(`dist/${page}`, page, true);
copyFile('dist/歷屆考古題_完整題庫大全.html', '歷屆考古題_完整題庫大全.html');

const indexPath = path.join(output, 'index.html');
const index = readFileSync(indexPath, 'utf8');
if (/\bhref=["'][^"']+\.md(?:[#?][^"']*)?["']/i.test(index)) throw new Error('Markdown document link remains in the public catalog');

for (const page of publicPages.map((relativePath) => path.join(output, relativePath))) {
  const html = readFileSync(page, 'utf8');
  if (/<a\b[^>]*\bhref=["'][^"']+\.md(?:[#?][^"']*)?["']/i.test(html)) {
    throw new Error(`Markdown document link remains in published page: ${path.relative(output, page)}`);
  }
}

const localHtmlLinks = [...index.matchAll(/href=["']([^"']+\.html)(?:[?#][^"']*)?["']/g)].map((match) => match[1]);
for (const href of localHtmlLinks) {
  if (!existsSync(path.join(output, href))) throw new Error(`Catalog page is missing: ${href}`);
}
if (coursePages.length !== 9) throw new Error('Expected five course pages, two bank editions, and two new banks');
process.stdout.write(`Prepared ${publicPages.length} pages from the unified offline build.\n`);
