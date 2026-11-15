import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../設計預覽/build-preview.mjs',import.meta.url),'utf8');
const implementation=source.slice(source.indexOf('function formatMermaidGraph('),source.indexOf('\nfunction original('));
const format=graph=>vm.runInNewContext(implementation+'\nformatMermaidGraph('+JSON.stringify(graph)+')');
test('Mermaid 教材保留實際沙盒流程的三條條件邊',()=>{
 const source=fs.readFileSync(new URL('../教材/金融科技力重點教材/06_監理科技(RegTech)與金融監理沙盒法規.md',import.meta.url),'utf8');
 const result=format(source.match(/```mermaid\s*\n([\s\S]*?)```/)[1]);
 assert.match(result,/提出申請.*主管機關審查.*60 日.*進入實驗期/);
 assert.match(result,/進入實驗期.*延長 1 次.*6 個月.*延長實驗期/);
 assert.match(result,/延長實驗期.*法律修正.*3 年.*法規鬆綁落地/);
 assert.equal(result.trim().split('\n').length,3);
});
test('Mermaid 同時保留無條件邊、串連邊及未連節點',()=>{
 const result=format('graph LR\nA[起點] -->|條件| B[中段] --> C[終點]\nD[獨立節點]');
 assert.match(result,/起點 → \*\*【條件】\*\* → 中段/);
 assert.match(result,/中段 → 終點/);assert.match(result,/- 獨立節點/);
});
