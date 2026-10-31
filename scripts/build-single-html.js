import fs from 'node:fs';
import path from 'node:path';

const outputName = '學習平台_單檔整合版.html';
const files = ['index.html', '信託業務人員重點教材.html', '金融科技力重點教材.html',
  '消費金融內部控制與稽核重點教材.html', '永續發展基礎能力重點教材.html',
  '防制洗錢與打擊資恐重點教材.html', '投資型保險題庫.html', '衍生性金融商品題庫.html', '歷屆考古題_完整題庫大全.html', '金融市場常識與職業道德題庫.html', '金融市場常識與職業道德題庫_116年版.html'];
const pages = Object.fromEntries(files.map(file => {
  let html = fs.readFileSync(path.join('dist', file), 'utf8');
  html = html.replace('new URLSearchParams(location.search)', "new URLSearchParams(window.__BUNDLE_SEARCH__ || '')");
  if (file === 'index.html') {
    const notice = /<p id="catalog-usage-notice">[\s\S]*?<\/p>/;
    if (!notice.test(html)) throw new Error('Missing catalog usage notice');
    html = html.replace(notice, `<p id="catalog-usage-notice">瀏覽器資料可能定期清除。練習前請匯入備份，練習後請匯出並保存備份檔。<a href="#complete-backup" onclick="document.getElementById('complete-backup').open=true">匯入／匯出備份</a></p>`);
  }
  return [file, html];
}));
const embeddedPages = files.map((file, index) =>
  `<script id="embedded-page-${index}" type="application/json">${JSON.stringify(pages[file]).replace(/</g, '\\u003c')}</script>`
).join('\n');
const html = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>教材與題庫｜單檔整合版</title>
<link rel="icon" href="data:,">
<style>html,body{margin:0;height:100%;background:#F5FAEF}iframe{display:block;width:100%;height:100%;border:0}</style>
</head><body>
<script id="embedded-page-list" type="application/json">${JSON.stringify(files)}</script>
${embeddedPages}
<script>
const fileNames = JSON.parse(document.getElementById('embedded-page-list').textContent);
const frame = document.createElement('iframe');
frame.id = 'study-frame'; frame.title = '教材與題庫';
function readPage(page) {
  const index = fileNames.indexOf(page);
  return index < 0 ? null : JSON.parse(document.getElementById('embedded-page-' + index).textContent);
}
function showPage() {
  const route = new URLSearchParams(location.hash.slice(1));
  const page = fileNames.includes(route.get('page')) ? route.get('page') : 'index.html';
  const search = route.get('query') || '';
  const content = readPage(page);
  const bridge = '<script>window.__BUNDLE_SEARCH__=' + JSON.stringify(search).replace(/</g,'\\u003c') + ';' +
    '(' + function () {
      document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || link.hasAttribute('download') || link.target === '_blank') return;
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
          const target = document.getElementById(decodeURIComponent(href.slice(1)));
          if (target) { event.preventDefault(); target.scrollIntoView({block:'start'}); }
          return;
        }
        if (/^(?:https?:|mailto:|data:)/i.test(href)) return;
        const url = new URL(href, 'https://offline.invalid/');
        if (parent.openStudyPage(decodeURIComponent(url.pathname.split('/').pop()), url.search)) event.preventDefault();
      });
    }.toString() + ')();<\\/script>';
  frame.srcdoc = content.replace(/<head[^>]*>/i, head => head + bridge);
  if (!frame.isConnected) document.body.append(frame);
}
window.openStudyPage = (page, query = '') => {
  if (!fileNames.includes(page)) return false;
  const route = new URLSearchParams({page, query}).toString();
  if (location.hash.slice(1) === route) showPage(); else location.hash = route;
  return true;
};
frame.addEventListener('load', () => { document.title = frame.contentDocument.title + '｜單檔整合版'; });
window.addEventListener('hashchange', showPage);
showPage();
</script></body></html>`;
fs.writeFileSync(path.join('dist', outputName), html);
fs.writeFileSync(outputName, html);
console.log(`Built ${outputName}: ${files.length} embedded pages, ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
