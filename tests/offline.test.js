import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Offline Validation: 驗證輸出的 HTML 完全零外部 CDN 與零外部腳本載入', () => {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    return; // 若尚未執行 build 則略過
  }

  const files = fs.readdirSync(distDir).filter(f => f.endsWith('.html'));
  assert.ok(files.length > 0, 'dist 目錄下應存在編譯好的 HTML 檔案');

  for (const file of files) {
    const filePath = path.join(distDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 檢查標籤引用的外鏈 (script src, link href, img src, iframe src)
    const scriptSrcMatches = content.match(/<script[^>]+src=["'](https?:|\/\/)[^"']+["']/gi);
    assert.equal(scriptSrcMatches, null, `${file} 不得包含外部 script src 依賴: ${scriptSrcMatches}`);

    const cssLinkMatches = content.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:|\/\/)[^"']+["']/gi);
    assert.equal(cssLinkMatches, null, `${file} 不得包含外部樣式表 link 依賴: ${cssLinkMatches}`);

    // 檢查外部字型引用 (例如 fonts.googleapis.com, cdnjs, unpkg, bootstrap)
    const cdnMatches = content.match(/(?:googleapis|cdnjs|unpkg|jsdelivr|bootstrap|tailwind)/gi);
    assert.equal(cdnMatches, null, `${file} 不得包含常見外部 CDN 關鍵字`);
  }
});
