import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = JSON.parse(fs.readFileSync(new URL('../教材/教學單元/永續盤查.json',import.meta.url),'utf8'));

export function attachLearningUnits(pack) {
  if(pack.id!==source.packId)return;
  const introduction=pack.chapters.find(ch=>ch.id==='esg01');
  const renamed=introduction.sections.find(sec=>sec.title.includes('永續概念與國際氣候治理'));
  assert(renamed,'永續概念原小節不存在');
  introduction.sectionAliases={'esg01-一國際氣候公約演進里程碑':renamed.id};
  const chapter=pack.chapters.find(ch=>ch.id===source.chapterId);
  const section=chapter?.sections.find(sec=>sec.id===source.sectionId);
  assert(section,'教學單元找不到原小節');
  const split=section.content.indexOf('### (二)');
  assert(split>0,'盤查原文的ISO延伸界線不存在');
  const parts={core:section.content.slice(0,split),extension:section.content.slice(split)};
  chapter.learningUnits=[{id:source.id,title:source.title,sectionId:source.sectionId,officialScope:source.officialScope,blocks:source.blocks.map(block=>({id:block.id,title:block.title,depth:block.depth,content:block.sourcePart?parts[block.sourcePart]:block.content}))}];
  for(const id of source.questionIds){const question=pack.questions.find(q=>q.id===id);assert(question,'教學單元題目不存在：'+id);question.knowledgeIds=[source.id];if(source.questionExplanations?.[id])question.explanation=source.questionExplanations[id];}
  if(chapter.practiceQuestionIds)chapter.practiceQuestionIds=[...new Set([...source.questionIds,...chapter.practiceQuestionIds])].slice(0,10);
}
