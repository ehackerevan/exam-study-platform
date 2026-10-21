import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('Concept relations use grouped lists without repeated source columns',()=>{
 const source=fs.readFileSync(new URL('../src/renderer/content.js',import.meta.url),'utf8');
 const context={window:{}};
 vm.runInNewContext(source.replace('window.StudyContent = {render};','window.StudyContent = {render,diagram};'),context);
 const diagram=context.window.StudyContent.diagram;
 for(const edge of ['A[來源] --> B[結果]','A[來源] -->|條件成立| B[結果]']){
  const html=diagram('graph TD\n'+edge);
  assert(!html.includes('<table'));assert(html.includes('<li>'));
  assert(!html.includes('接續'));assert(html.includes('來源'));assert(html.includes('結果'));
  if(edge.includes('條件成立'))assert(html.includes('條件成立'));
 }
 const grouped=diagram('graph TD\nA[共同情境] --> B[處理一]\nA --> C[處理二]');
 assert.equal((grouped.match(/共同情境/g)||[]).length,1);
 assert.equal((grouped.match(/<li>/g)||[]).length,2);
});
