import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNormalizedStudyPack,parseStudyPackJson} from '../src/core/parser/index.js';
import {loadSourcesFromDirectory} from '../src/cli/index.js';
import {attachLearningUnits} from '../scripts/learning-units.js';
import {validateStudyPack} from '../src/core/validator/index.js';

test('盤查教學由原文帶入全部分類與延伸，保持題目身分及舊小節',()=>{
 const pack=buildNormalizedStudyPack(loadSourcesFromDirectory('教材/永續發展基礎能力重點教材'));
 const before=pack.questions.map(q=>[q.id,q.chapterId,q.question,q.options,q.answer]);
 attachLearningUnits(pack);
 assert.deepEqual(pack.questions.map(q=>[q.id,q.chapterId,q.question,q.options,q.answer]),before);
 const ch=pack.chapters.find(c=>c.id==='esg02'),unit=ch.learningUnits[0],sec=ch.sections.find(s=>s.id===unit.sectionId);
 assert.equal(unit.blocks.find(b=>b.id==='scope-rules').content+unit.blocks.find(b=>b.id==='source-extension').content,sec.content);
 assert(validateStudyPack(pack).isValid);
 const imported=parseStudyPackJson(JSON.stringify(pack));assert.deepEqual(imported.chapters.find(c=>c.id==='esg02').learningUnits,ch.learningUnits);
 assert(imported.questions.find(q=>q.id==='esg-115-3-47').knowledgeIds.includes(unit.id));
 pack.questions[0].knowledgeIds=['not-found'];assert(validateStudyPack(pack).issues.some(i=>i.code==='INVALID_KNOWLEDGE_LINK'));
});

test('教學單元拒絕重複ID、錯誤深度及不存在的來源；輸入內容仍清理',()=>{
 const pack=buildNormalizedStudyPack(loadSourcesFromDirectory('教材/永續發展基礎能力重點教材'));attachLearningUnits(pack);
 const unit=pack.chapters.find(c=>c.id==='esg02').learningUnits[0];unit.blocks[0].content+='<script>alert(1)</script>';
 assert(!parseStudyPackJson(pack).chapters.find(c=>c.id==='esg02').learningUnits[0].blocks[0].content.includes('<script>'));
 unit.blocks.push({...unit.blocks[0]});assert(validateStudyPack(pack).issues.some(i=>i.code==='INVALID_LEARNING_BLOCK'));unit.blocks.pop();
 unit.blocks[0].depth='unknown';assert(validateStudyPack(pack).issues.some(i=>i.code==='INVALID_LEARNING_BLOCK'));
 unit.sectionId='missing';assert(validateStudyPack(pack).issues.some(i=>i.code==='INVALID_LEARNING_UNIT'));
});
