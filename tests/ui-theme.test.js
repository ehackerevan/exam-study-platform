import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applySharedUi,themePath} from '../src/core/compiler/ui-theme.js';
import {htmlFiles} from '../scripts/harmonize-ui.js';
test('Shared UI: idempotent, inline and leaves scripts unchanged',()=>{
 const script='<script>window.example="題目與答案";</script>';
 for(const html of [`<html><head><title>測試</title></head><body>${script}</body></html>`,`<html><style>body{color:black}</style>${script}</html>`]){
  const themed=applySharedUi(html);
  assert.equal(applySharedUi(themed),themed);
  assert(themed.includes(script));
  assert.equal(themed.match(/<style id="study-ui-theme">/g).length,1);
 }
});
test('Shared UI: all project HTML contains the exact shared stylesheet',()=>{
 const css=fs.readFileSync(themePath,'utf8').trim();
 const files=htmlFiles();assert(files.length>=11);
 for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  const match=html.match(/<style id="study-ui-theme">([\s\S]*?)<\/style>/);
  assert(match, file);assert.equal(match[1].trim(),css,file);
 }
});
test('Shared UI: brand palette preserves offline use and reduced-motion support',()=>{
 const css=fs.readFileSync(themePath,'utf8');
 for(const value of ['--md-primary: #2F4858','--md-primary-container: #96E6A1','--md-secondary: #2B878F','--md-tertiary: #3AA79E','--md-brand-gradient: linear-gradient(90deg, #96E6A1 0%, #61C8A3 20%, #3AA79E 40%, #2B878F 60%, #2E6677 80%, #2F4858 100%)','--md-background: #FBFDF8','--md-surface-container: #F0F5ED','--md-radius-full: 9999px','prefers-reduced-motion: reduce']) assert(css.includes(value),value);
 assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(css));
});
test('Catalogue return link: replace path without duplicate links; catalogue has no self-link',()=>{
 const html='<html><head></head><body><p>教材</p></body></html>';
 const themed=applySharedUi(html,'../../dist/index.html');
 assert(themed.includes('href="../../dist/index.html"'));
 assert.equal(themed.match(/id="study-catalog-nav"/g).length,1);
 assert.equal(applySharedUi(themed).match(/id="study-catalog-nav"/g).length,1);
 assert(!applySharedUi(themed,null).includes('id="study-catalog-nav"'));
 assert.throws(()=>applySharedUi(html,'javascript:bad'));
});

test('Single HTML: eleven embedded pages keep the shared theme',()=>{
 const html=fs.readFileSync('dist/學習平台_單檔整合版.html','utf8');
 const names=JSON.parse(html.match(/<script id="embedded-page-list" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const pages=[...html.matchAll(/<script id="embedded-page-\d+" type="application\/json">([\s\S]*?)<\/script>/g)].map(([,page])=>JSON.parse(page));
 assert.equal(names.length,11);assert.equal(pages.length,names.length);
 const css=fs.readFileSync(themePath,'utf8').trim();
 for(const page of pages) assert.equal(page.match(/<style id="study-ui-theme">([\s\S]*?)<\/style>/)[1].trim(),css);
});
