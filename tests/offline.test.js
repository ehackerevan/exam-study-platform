import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {findExternalResources} from '../src/core/utils/offline.js';

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

    assert.deepEqual(findExternalResources(content), [], `${file} 不得載入外部資源`);
  }
});

test('Offline checks resource URLs regardless of attribute order without rejecting teaching text', () => {
  assert.deepEqual(findExternalResources('<p>Bootstrap、Tailwind 與 CDN 教學</p><a href="https://example.com">參考</a>'), []);
  assert.deepEqual(findExternalResources('<link href="//cdn.example/style.css" rel="stylesheet"><script src="https://example.com/app.js"></script><img src="https://example.com/p.png">'), ['//cdn.example/style.css','https://example.com/app.js','https://example.com/p.png']);
  assert.deepEqual(findExternalResources('<style>@import "https://example.com/style.css"; .a{background:url(//example.com/a.png)}</style>'), ['https://example.com/style.css','//example.com/a.png']);
});
