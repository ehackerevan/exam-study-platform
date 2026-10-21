import fs from 'node:fs';
import path from 'node:path';
import {findExternalResources} from '../src/core/utils/offline.js';

const distDir = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.error('dist 目錄不存在，請先執行 npm run build:examples');
  process.exit(1);
}

const htmlFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.html'));
if (htmlFiles.length === 0) {
  console.error('dist 目錄中未找到任何 HTML 檔案');
  process.exit(1);
}

let failed = false;

for (const file of htmlFiles) {
  const fullPath = path.join(distDir, file);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const resources = findExternalResources(content);
  if (resources.length) {
    console.error(`[FAIL] ${file} 包含外部資源:`, resources);
    failed = true;
  } else {
    const sizeKb = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1);
    console.log(`[PASS] ${file} (${sizeKb} KB) - 無外部資源依賴`);
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('\n✓ 所有生成之 HTML 離線驗證全部通過！');
}
