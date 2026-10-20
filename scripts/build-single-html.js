import fs from 'node:fs';
import path from 'node:path';

const outputName = '學習平台_單檔整合版.html';
const files = ['index.html', '信託業務人員重點教材.html', '金融科技力重點教材.html',
  '消費金融內部控制與稽核重點教材.html', '永續發展基礎能力重點教材.html',
  '防制洗錢與打擊資恐重點教材.html', '歷屆考古題_完整題庫大全.html'];
const pages = Object.fromEntries(files.map(file => {
  let html = fs.readFileSync(path.join('dist', file), 'utf8');
  html = html.replace('new URLSearchParams(location.search)', "new URLSearchParams(window.__BUNDLE_SEARCH__ || '')");
  return [file, html];
}));
const data = JSON.stringify(pages).replace(/</g, '\\u003c');
const html = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>五科教材與題庫｜單檔整合版</title>
<link rel="icon" href="data:,">
<style>html,body{margin:0;height:100%;background:#F5FAEF}iframe{display:block;width:100%;height:100%;border:0}</style>
</head><body>
<script id="embedded-pages" type="application/json">${data}</script>
<script>
const pages = JSON.parse(document.getElementById('embedded-pages').textContent);
const frame = document.createElement('iframe');
frame.id = 'study-frame'; frame.title = '五科教材與題庫';
function showPage() {
  const route = new URLSearchParams(location.hash.slice(1));
  const page = Object.hasOwn(pages, route.get('page')) ? route.get('page') : 'index.html';
  const search = route.get('query') || '';
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
  frame.srcdoc = pages[page].replace(/<head[^>]*>/i, head => head + bridge);
  if (!frame.isConnected) document.body.append(frame);
}
window.openStudyPage = (page, query = '') => {
  if (!Object.hasOwn(pages, page)) return false;
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
