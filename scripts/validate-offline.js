import fs from 'node:fs';
import path from 'node:path';

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

  // 檢查外部 script src
  const scriptMatch = content.match(/<script[^>]+src=["'](https?:|\/\/)[^"']+["']/gi);
  if (scriptMatch) {
    console.error(`[FAIL] ${file} 包含外部腳本:`, scriptMatch);
    failed = true;
  }

  // 檢查外部 link stylesheet
  const linkMatch = content.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:|\/\/)[^"']+["']/gi);
  if (linkMatch) {
    console.error(`[FAIL] ${file} 包含外部樣式表:`, linkMatch);
    failed = true;
  }

  // 檢查外部 CDN 關鍵字
  const cdnMatch = content.match(/(?:googleapis|cdnjs|unpkg|jsdelivr|bootstrap|tailwind)/gi);
  if (cdnMatch) {
    console.error(`[FAIL] ${file} 包含外部 CDN 關鍵字:`, cdnMatch);
    failed = true;
  }

  if (!failed) {
    const sizeKb = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1);
    console.log(`[PASS] ${file} (${sizeKb} KB) - 零外部依賴、純本機離線可用`);
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('\n✓ 所有生成之 HTML 離線驗證全部通過！');
}
