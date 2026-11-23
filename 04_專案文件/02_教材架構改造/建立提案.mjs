import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../../src/renderer/vendor/marked.umd.js';
const dir='專案文件/教材架構改造',read=f=>fs.readFileSync(dir+'/'+f,'utf8'),write=(f,s)=>fs.writeFileSync(dir+'/'+f,s);
const inventory=JSON.parse(read('現況盤點.json')),points=JSON.parse(read('知識點候選對照.json')).points,paths=JSON.parse(read('學習路徑.json'));
const ids=new Set(paths.units.map(u=>u.id));assert.equal(ids.size,paths.units.length);
const finished=new Set();function visit(id,trail=[]){assert(ids.has(id),id);assert(!trail.includes(id),'前置循環 '+trail.join('→')+id);if(finished.has(id))return;for(const r of paths.units.find(u=>u.id===id).requires)visit(r,[...trail,id]);finished.add(id)}paths.units.forEach(u=>visit(u.id));
for(const c of inventory.courses)for(const ch of c.chapters)assert(paths.units.some(u=>u.pack===c.id&&u.oldChapters.includes(ch.id)),c.id+'/'+ch.id);
const official=[
 ['一（一）','永續介紹',['esg00','esg01']],['一（二）','永續發展目標',['esg01']],['一（三）','國內永續發展政策',['esg01','esg02','esg03']],['一（四）','國際永續發展政策',['esg01','esg02']],
 ['二（一）','國際永續資訊公開規範',['esg02','esg04']],['二（二）','國內永續資訊公開規範',['esg01','esg02','esg04']],['二（三）','第三方驗證',['esg02','esg06']],
 ['三（一）','整體ESG風險概述',['esg01','esg06']],['三（二）','環境風險',['esg01','esg02','esg04']],['三（三）','社會風險',['esg06']],['三（四）','治理風險',['esg01','esg06']],
 ['四（一）','永續評比、評鑑與指數',['esg03','esg06']],['四（二）','永續投資',['esg03']],['四（三）','永續融資',['esg03']],['四（四）','永續授信',['esg03','esg06']],['四（五）','永續保險',['esg06']],['四（六）','永續金融漂綠問題',['esg04']]
].map(([item,title,chapters])=>({item,title,chapters,status:'候選內容定位，未通過逐點內容充分性審查'}));
assert.equal(official.length,17);
write('官方範圍候選對照.json',JSON.stringify({source:'https://www.tabf.org.tw/LicenseDocDownload.aspx?Path=ct/164381_20251215.pdf',effective:'114-07-01起適用（已查來源封面標示，不保證沒有後續修訂）',items:official},null,2));
write('舊閱讀錨點快照.json',JSON.stringify(inventory.courses.flatMap(c=>c.chapters.map(ch=>({packId:c.id,chapterId:ch.id,sourceSectionIds:ch.sections.map(s=>s.id),displayedSectionIds:ch.readingSections.map(s=>s.id),status:'兩側均須保留或有明確alias；本地dist不視同新建置'}))),null,2));
let map='# 全科知識地圖與新舊對照\n\n這是來源完整盤點與候選教學依賴圖，不是已核准的官方逐點大綱。來源層的210段與候選學習節點不同粒度，不能用其數量宣稱完整學會。\n\n[架構提案](提案.html) · [單元原型](單元原型.html)\n\n';
for(const c of inventory.courses){
 map+=`## ${c.name}\n\n### 建議學習順序與前置\n\n| 候選單元 | 先備 | 性質 | 舊章 |\n| --- | --- | --- | --- |\n`;
 for(const u of paths.units.filter(u=>u.pack===c.id))map+=`| ${u.title}（${u.id}） | ${u.requires.map(id=>paths.units.find(x=>x.id===id).title).join('、')||'起點'} | ${u.kind} | ${u.oldChapters.join('、')} |\n`;
 map+='\n### 逐章對照\n\n| 舊章ID與名稱 | 候選單元 | 原題數 |\n| --- | --- | --- |\n';
 for(const ch of c.chapters)map+=`| ${ch.id} ${ch.title} | ${paths.units.filter(u=>u.pack===c.id&&u.oldChapters.includes(ch.id)).map(u=>u.title).join('；')} | ${ch.questionCount} |\n`;
 map+='\n### 全部來源段落與規則候選\n\n數字欄只是一段原文的機械擷取，須連同主體、版本及例外再審查；不可當作已核准必背數字。\n\n';
 for(const p of points.filter(p=>p.packId===c.id)){
  map+=`<details><summary>${p.chapterId}｜${p.title}｜${p.id}</summary>\n\n來源：${p.sourceLocator}\n\n原小節ID：${p.legacySectionId}\n\n`;
  if(p.detailSubheadings.length)map+='細項：\n\n'+p.detailSubheadings.map(x=>'- '+x).join('\n')+'\n\n';
  if(p.numericRuleCandidates.length)map+='原文數字／規則候選：\n\n'+p.numericRuleCandidates.map(x=>'> '+x.replace(/\|/g,'／')).join('\n\n')+'\n\n';
  map+='狀態：待逐點語意審核；同名詞不自動合併，題目不得只憑詞彙命中建立正式關聯。\n\n</details>\n\n';
 }
}
map+='## 永續官方17細目候選定位\n\n| 官方細目 | 舊章 | 狀態 |\n| --- | --- | --- |\n'+official.map(x=>`| ${x.item} ${x.title} | ${x.chapters.join('、')} | 可定位，內容充分性待審 |`).join('\n')+'\n\n## 題庫型及缺口\n\n金融常識兩版保持隔離；投資型及衍生性各只有一個exam章入口，尚無可核定的完整概念教材。人身／外幣／產險尚未形成現行完整包。照片第三章缺頁不是可自動補完的知識，仍需另取得來源。\n';
write('新舊知識地圖.md',map);
const esc=s=>s.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function html(title,md){return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>body{max-width:1100px;margin:auto;padding:24px;font:17px/1.85 system-ui;color:#243b32;background:#fafbf8}*{box-sizing:border-box}h1{font-size:1.8rem}h2{margin-top:2.5rem;font-size:1.4rem}h3{font-size:1.15rem}a{color:#216155}a:focus-visible,summary:focus-visible{outline:3px solid #216155}p,li,summary{overflow-wrap:anywhere}.scroll{overflow:auto;margin:16px 0}table{border-collapse:collapse;min-width:600px;width:100%}th,td{border:1px solid #bfcfc5;padding:12px;text-align:left;vertical-align:top}th{background:#edf3eb}summary{padding:12px 0;cursor:pointer}details{border-bottom:1px solid #bfcfc5}code{font-size:.9em}blockquote{margin:12px 0;padding-left:16px;border-left:3px solid #bfcfc5}@media(max-width:600px){body{padding:16px;font-size:16px}h1{font-size:1.5rem}}@media print{.scroll{overflow:visible}table{min-width:0}body{font-size:10pt;padding:0}}</style></head><body>'+globalThis.marked.parse(md).replace(/<table>/g,'<div class="scroll" tabindex="0" role="region" aria-label="對照表"><table>').replace(/<\/table>/g,'</table></div>')+'</body></html>'}
write('新舊知識地圖.html',html('全科知識地圖與新舊對照',map));
write('提案.html',html('教材架構診斷與提案',read('診斷與架構提案.md')));
console.log(JSON.stringify({sourceParagraphs:points.length,chapters:inventory.courses.reduce((a,c)=>a+c.chapters.length,0),learningNodes:paths.units.length,officialEsgItems:official.length,dependencyCycle:false},null,2));
