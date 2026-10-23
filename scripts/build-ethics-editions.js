import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadSourcesFromDirectory} from '../src/cli/index.js';
import {buildNormalizedStudyPack} from '../src/core/parser/index.js';
import {validateStudyPack} from '../src/core/validator/index.js';
import {compileStudyPackToHtml} from '../src/core/compiler/index.js';
const file113='dist/金融市場常識與職業道德題庫.html',file116='dist/金融市場常識與職業道德題庫_116年版.html';
const old=JSON.parse(fs.readFileSync(file113,'utf8').match(/window\.__STUDY_PACK__\s*=\s*({.*});/)[1]);
const modern=buildNormalizedStudyPack(loadSourcesFromDirectory('歷史資料/金融市場常識與職業道德題庫_證基會116年版'));
const source=JSON.parse(fs.readFileSync('歷史資料/金融市場常識與職業道德題庫_證基會116年版/questions.json','utf8'));
assert.equal(modern.questions.length,1174);assert.notEqual(old.id,modern.id);
const identity=q=>JSON.stringify([q.chapterId,q.question,q.options,q.answer]);
const known=new Map(old.questions.map(q=>[identity(q),q.knowledgePoints]));
const original=new Map(source.questions.map(q=>[q.id,q]));
for(const question of modern.questions){
 const raw=original.get(question.id);assert(raw);
 for(const field of ['question','options','answer','sourceExam'])assert.deepEqual(question[field],raw[field],`${question.id} ${field}`);
 question.knowledgePoints=known.get(identity(question))||['其他／未分類'];
 delete question.explanation;
}
for(const chapter of modern.chapters){
 const previous=old.chapters.find(ch=>ch.id===chapter.id);assert(previous);
 chapter.teachingSummary=previous.teachingSummary;
 chapter.teachingSections=structuredClone(previous.teachingSections).map(section=>({...section,content:section.content.replace(/<details class="chapter-sources">[\s\S]*?<\/details>/g,'')}));
 chapter.teachingSections.push(...chapter.sections);
 chapter.practiceQuestionIds=modern.questions.filter(q=>q.chapterId===chapter.id).slice(0,10).map(q=>q.id);
}
const editions=[{id:old.id,label:'113 年版 · 1,120 題',file:file113.slice(5),period:'適用至 2026-12-31'},{id:modern.id,label:'116 年版 · 1,174 題',file:file116.slice(5),period:'2027-01-01 起適用'}];
for(const [pack,file] of [[old,file113],[modern,file116]]){
 pack.editions=editions;
 const result=validateStudyPack(pack);assert(result.isValid,result.toString());
 fs.writeFileSync(file,compileStudyPackToHtml(pack).html);
}
console.log('Built SFI edition choice: 113 (1120) / 116 (1174), separate progress IDs; 116 source fields unchanged');
