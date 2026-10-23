import fs from 'node:fs';
import assert from 'node:assert/strict';
import {courses} from '../設計預覽/lessons.mjs';
import {compileStudyPackToHtml} from '../src/core/compiler/index.js';

// build:ui 先產生來源 pack 及預覽，再把同一份教學內容編入正式閱讀模式。
const preview=fs.readFileSync('設計預覽/各科教材_ELI5_獨立預覽.html','utf8');
const text=html=>html.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
let chapters=0,topics=0;
for(const course of courses){
 const file='dist/'+course.source+'.html';
 const previous=fs.readFileSync(file,'utf8');
 const pack=JSON.parse(previous.match(/window\.__STUDY_PACK__\s*=\s*({.*});/)[1]);
 const questionSnapshot=JSON.stringify(pack.questions);
 for(const chapter of pack.chapters){
  const id=course.key+'-'+chapter.id;
  const start=preview.indexOf(`<article class="lesson" id="${id}" `);
  assert(start>=0,id);
  const article=preview.slice(start,preview.indexOf('</article>',start));
  const readingStart=article.indexOf('<div class="chapter-reading">')+'<div class="chapter-reading">'.length;
  const readingEnd=article.indexOf('</div></section>\n<section class="chapter-review">',readingStart);
  assert(readingStart>0&&readingEnd>readingStart,id+' reading boundaries');
  const pieces=[...article.slice(readingStart,readingEnd).matchAll(/<section class="source-section knowledge-topic" data-source-id="([^"]+)">([\s\S]*?)<\/section>/g)];
  assert(pieces.length,id+' topics');
  const sections=pieces.map(([,sectionId,html])=>{
   const heading=html.match(/^<h4>([\s\S]*?)<\/h4>/);assert(heading,id+' heading');
   return {id:sectionId,title:text(heading[1]),content:'<div class="knowledge-topic">'+html.slice(heading[0].length)+'</div>',keyPoints:[],notes:[]};
  });
  const graphStart=article.indexOf('<details class="chapter-overview"');
  const graphEnd=article.indexOf('</section></details>',graphStart)+'</section></details>'.length;
  assert(graphStart>=0&&graphEnd>graphStart,id+' overview');
  sections.unshift({id:chapter.id+'-overview',title:'章節總覽',content:article.slice(graphStart,graphEnd),keyPoints:[],notes:[]});
  const reviewStart=article.indexOf('<section class="chapter-review">');
  const reviewEnd=article.indexOf('<details class="practice-block">',reviewStart);
  assert(reviewStart>=0&&reviewEnd>reviewStart,id+' review');
  sections.push({id:chapter.id+'-review',title:'回顧與理解檢查',content:article.slice(reviewStart,reviewEnd),keyPoints:[],notes:[]});
  chapter.teachingSections=sections;
  chapter.teachingSummary=text(article.match(/<p class="intro">([\s\S]*?)<\/p>/)[1]);
  if(!chapter.practiceQuestionIds?.length)chapter.practiceQuestionIds=pack.questions.filter(q=>q.chapterId===chapter.id).slice(0,10).map(q=>q.id);
  assert.equal(chapter.practiceQuestionIds.length,10,id+' ten practice questions');
  chapters++;topics+=pieces.length;
 }
 assert.equal(JSON.stringify(pack.questions),questionSnapshot,course.key+' source questions unchanged');
 fs.writeFileSync(file,compileStudyPackToHtml(pack).html);
}
assert.equal(chapters,37);assert.equal(topics,162);
console.log(`Integrated teaching: ${chapters} chapters, ${topics} topics; source questions unchanged`);
