import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {loadSourcesFromDirectory} from '../../src/cli/index.js';
import {buildNormalizedStudyPack} from '../../src/core/parser/index.js';
import {loadTrustCourse} from '../../src/core/utils/trust-course.js';
const root=process.cwd(),out=path.join(root,'專案文件/教材架構改造');
const read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');
const json=p=>JSON.parse(read(p));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const digest=x=>crypto.createHash('sha1').update(x).digest('hex').slice(0,12);
const strip=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(path.join(dir,f.name)):[path.join(dir,f.name)])}
const dirs=fs.readdirSync('教材',{withFileTypes:true}).filter(d=>d.isDirectory());
const frequencies=json('tasks/exam_frequency_20261020.json');
const courses=[];const points=[];
for(const d of dirs){
 const dir=path.join('教材',d.name);const trust=d.name.startsWith('信託');
 if(!trust&&!fs.existsSync(path.join(dir,'pack.json')))continue;
 const pack=trust?loadTrustCourse(dir):buildNormalizedStudyPack(loadSourcesFromDirectory(dir));
 const distPath=path.join('dist',d.name+'.html');
 const dist=fs.existsSync(distPath)?JSON.parse(read(distPath).match(/window\.__STUDY_PACK__\s*=\s*({.*});/)[1]):null;
 const canonicalQs=pack.questions;const byId=new Map(canonicalQs.map(q=>[q.id,q]));
 const sourceFiles=files(dir).filter(f=>/\.(md|json)$/i.test(f));
 const chapters=pack.chapters.map(ch=>{
  const displayed=dist?.chapters.find(c=>c.id===ch.id);const sourceSections=ch.sections.filter(s=>!s.id.endsWith('source-note'));
  const readingSections=displayed?.teachingSections||displayed?.sections||[];
  for(const sec of sourceSections){
   points.push({id:`kp-${digest(pack.id+'/'+ch.id+'/'+sec.id)}`,packId:pack.id,chapterId:ch.id,legacySectionId:sec.id,title:sec.title,status:'候選段落；尚未逐點語意審核',sourceLocator:trust?`${dir}/course_data.json#${ch.id}/${sec.id}`:sourceFiles.find(f=>f.endsWith('.md')&&read(f).match(new RegExp('^id: '+ch.id+'\\s*$','m')))?.replaceAll('\\','/')||dir,detailSubheadings:[...sec.content.matchAll(/^#{3,6}\s+(.+)$/gm)].map(m=>m[1]),numericRuleCandidates:sec.content.split('\n').filter(l=>l.length<500&&/\d/.test(l)&&/年|月|日|%|％|元|倍|條|期限/.test(l)&&!l.includes('data:')&&!l.includes('<svg')),prerequisiteIds:[],officialMappings:[],candidateQuestionIds:canonicalQs.filter(q=>q.sectionId===sec.id&&q.chapterId===ch.id).map(q=>q.id)});
  }
  const practice=(displayed?.practiceQuestionIds||[]).map(id=>dist.questions.find(q=>q.id===id)).filter(Boolean);
  return {id:ch.id,title:ch.title,sections:sourceSections.map(s=>({id:s.id,title:s.title,characters:strip(s.content).length})),readingSections:readingSections.map(s=>({id:s.id,title:s.title,characters:strip(s.content).length})),questionCount:canonicalQs.filter(q=>q.chapterId===ch.id).length,practiceCount:practice.length,practiceFromOtherChapter:practice.filter(q=>q.chapterId!==ch.id).map(q=>({id:q.id,chapterId:q.chapterId})),sourceChars:sourceSections.reduce((a,s)=>a+strip(s.content).length,0),readingChars:readingSections.reduce((a,s)=>a+strip(s.content).length,0)};
 });
 const labels=Object.entries(frequencies.courses).find(([k])=>k===d.name||k.startsWith(d.name+'（'))?.[1];
 const keyCounts={};for(const q of canonicalQs)for(const k of Object.keys(q))keyCounts[k]=(keyCounts[k]||0)+1;
 const token=/\b(?:GRI|TCFD|IFRS|SASB|ISSB|TNFD|GHG|CDD|KYC|PEP|CTR|STR|API|AI|REITs|REATs)\b|碳定價|確信|信託財產|實質受益人/g;
 const repeatedConcepts={};for(const ch of pack.chapters)for(const s of ch.sections)for(const t of new Set((s.title+' '+s.content).match(token)||[])){(repeatedConcepts[t]??=[]).push({chapterId:ch.id,sectionId:s.id})}
 const paragraphs=new Map();for(const ch of pack.chapters)for(const sec of ch.sections)for(const para of strip(sec.content).split(/(?<=[。；])\s*/).filter(p=>p.length>=45)){const normalized=para.replace(/[^\p{L}\p{N}]/gu,'');const a=paragraphs.get(normalized)||[];a.push({chapterId:ch.id,sectionId:sec.id,excerpt:para.slice(0,100)});paragraphs.set(normalized,a)}
 courses.push({name:d.name,id:pack.id,sourceFiles:sourceFiles.map(p=>p.replaceAll('\\','/')),chapters,questionCount:canonicalQs.length,questionFieldCounts:keyCounts,questionSectionLinkCount:canonicalQs.filter(q=>q.sectionId).length,explanationCount:canonicalQs.filter(q=>q.explanation).length,distContentVersion:dist?.contentVersion,distQuestionCount:dist?.questions.length,distSourceQuestionMismatch:dist?canonicalQs.filter(q=>{const old=dist.questions.find(o=>o.id===q.id);return !old||old.question!==q.question||JSON.stringify(old.options)!==JSON.stringify(q.options)||JSON.stringify(old.answer)!==JSON.stringify(q.answer)}).map(q=>q.id):[],distValidSectionLinks:dist?.questions.filter(q=>dist.chapters.find(c=>c.id===q.chapterId)?.teachingSections?.some(s=>s.id===q.sectionId)).length||0,unclassified:labels?.unclassified_question_count,frequencyCount:labels?.question_record_count,frequencyCoverage:labels?.topic_classification_coverage_percent,ranking:labels?.concept_ranking?.map(r=>({name:r.concept,count:r.question_count,ids:r.question_ids,examCount:r.exam_session_count})),repeatedConcepts:Object.fromEntries(Object.entries(repeatedConcepts).filter(([,a])=>new Set(a.map(x=>x.chapterId)).size>1)),exactRepeatedSentences:[...paragraphs.values()].filter(a=>new Set(a.map(x=>x.chapterId)).size>1)});
}
const extras=['dist/金融市場常識與職業道德題庫_116年版.html','dist/投資型保險題庫.html','dist/衍生性金融商品題庫.html'].map(p=>{const pack=JSON.parse(read(p).match(/window\.__STUDY_PACK__\s*=\s*({.*});/)[1]);return {path:p,id:pack.id,questionCount:pack.questions.length,chapters:pack.chapters.map(c=>({id:c.id,title:c.title,sections:c.sections.length})),classified:pack.questions.filter(q=>q.knowledgePoints?.some(p=>p!=='其他／未分類')).length}});
const snapshots=files('教材').concat(files('src'),files('scripts'),files('設計預覽'),files('dist'),files('sync'),files('analytics'),['package.json','學習平台_單檔整合版.html','開始學習.html','index.html']).filter(p=>fs.existsSync(p));
const baseline=Object.fromEntries(snapshots.map(p=>[p.replaceAll('\\','/'),hash(p)]));
if(!fs.existsSync(path.join(out,'正式檔案基線.json')))fs.writeFileSync(path.join(out,'正式檔案基線.json'),JSON.stringify(baseline,null,2));
fs.writeFileSync(path.join(out,'現況盤點.json'),JSON.stringify({date:'2026-11-03',scope:'六科來源全章節結構與全部題目欄位；現有dist為本機輸出，不視同已重新建置',frequencyGenerated:frequencies.generated_on,courses,extras},null,2));
fs.writeFileSync(path.join(out,'知識點候選對照.json'),JSON.stringify({status:'設計候選，尚未接入正式建置；不得當作已語意驗證的完整官方知識點',identity:'初次由pack／chapter／legacySection身分雜湊指派；核准後固定，不隨標題、排序或正文重算',points},null,2));
assert.equal(new Set(points.map(p=>p.id)).size,points.length);
console.log(JSON.stringify({courses:courses.map(c=>({name:c.name,id:c.id,chapters:c.chapters.length,sections:c.chapters.reduce((a,c)=>a+c.sections.length,0),questions:c.questionCount,sectionLinks:c.questionSectionLinkCount,explanations:c.explanationCount,unclassified:c.unclassified,frequency:c.frequencyCount,top:c.ranking?.slice(0,3).map(r=>[r.name,r.count]),mismatch:c.distSourceQuestionMismatch.length,practiceCrossChapter:c.chapters.filter(ch=>ch.practiceFromOtherChapter.length).map(ch=>[ch.id,ch.practiceFromOtherChapter.length])})),extras,points:points.length,baselineFiles:Object.keys(baseline).length},null,2));
