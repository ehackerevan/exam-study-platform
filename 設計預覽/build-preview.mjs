import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {courses} from './lessons.mjs';
import {cddTopics} from './cdd-topics.mjs';
import {sectionTopics,reviewTopics,guideTopics,ethicsTopics} from './section-topics.mjs';
import {readableText,conciseText,emphasizeHtml} from './text-format.mjs';
import {findExternalResources} from '../src/core/utils/offline.js';
import '../src/renderer/vendor/marked.umd.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(dir);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, className = '') => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
  map:'<circle cx="4" cy="12" r="2.5"/><circle cx="20" cy="5" r="2.5"/><circle cx="20" cy="19" r="2.5"/><path d="M6.5 12h5V5h6M11.5 12v7h6"/>',
  book:'<path d="M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Z"/><path d="M12 5v15"/>',
  check:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M7 13l3 3 7-7"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/>'
}[name]}</svg>`;

const renderer = new globalThis.marked.Renderer();
const renderTableCell = renderer.tablecell;
renderer.tablecell = function(token) {
  const lines = token.text.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>|[*_`]/g,'').split('\n');
  const compact = lines.every(line => [...line.trim()].length <= 18);
  return renderTableCell.call(this,token).replace(/^<(th|td)/,compact?'<$1 class="table-compact"':'<$1');
};
renderer.html = ({text}) => '<div class="source-excerpt">' + escape(text.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|summary|details|h[1-6])>/gi,'\n').replace(/<[^>]+>/g,'')).replace(/\n/g,'<br>') + '</div>';
renderer.link = ({href, text}) => /^https?:\/\//i.test(href) ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(text)}</a>` : escape(text);
renderer.image = ({href, text}) => {
  if (!/^data:image\/svg\+xml;base64,[a-z0-9+/=]+$/i.test(href)) return `<p>${escape(readableText(text))}</p>`;
  const svg = Buffer.from(href.split(',')[1],'base64').toString('utf8').replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g,(_,start,label,end)=>start+emphasizeHtml(conciseText(label)).replace(/<strong class="legal-value">/g,'<tspan fill="#fcd34d" font-weight="800">').replace(/<\/strong>/g,'</tspan>')+end);
  return `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" alt="${escape(readableText(text))}" loading="lazy" decoding="async">`;
};
function original(raw) {
  const source = conciseText(raw).replace(/```mermaid\s*\n([\s\S]*?)```/g, (_, graph) => {
    const labels = [...graph.matchAll(/(?:\["([^"]+)"\]|\[([^\]]+)\]|\{"([^"]+)"\})/g)].map(match => match.slice(1).find(Boolean).replace(/<br\s*\/?>/gi,'；'));
    return '\n\n' + [...new Set(labels)].filter(label=>label.trim()!=='CDD 強制發動時機').map(label => '- ' + label.replace(/^\s*\d+[.、]\s*/, '').replace(/；{2,}/g,'；')).join('\n') + '\n\n';
  });
  return emphasizeHtml(globalThis.marked.parse(source, {renderer,gfm:true,breaks:true})
    .replace(/<(\/?)h([1-6])>/g, (_, close, level) => `<${close}h${Math.min(6,Number(level)+3)}>`)
    .replace(/<table>([\s\S]*?)<\/table>/g,(_,cells)=>`<table class="${(cells.match(/<th[ >]/g)||[]).length>2?'table-wide':'table-narrow'}">${cells}</table>`).replace(/<table class="([^"]+)">/g,'<div class="table-scroll" tabindex="0" aria-label="比較表，可左右捲動"><table class="$1">').replace(/<\/table>/g,'</table></div>'));
}

const totals = {subjects:courses.length,chapters:0,questions:0,topics:0};
const coverage = [];
const teach = value => escape(conciseText(value));
function topicFrom(row, title) {
 assert(row, 'Missing teaching notes: '+title);
 assert.equal(row.length,4,title);
 return {title:conciseText(title),core:row[0],nodes:row[1].split('|').map(part=>part.split('：')),example:row[2],trap:row[3]};
}
function renderTopic(topic,section,body) {
 const reference = section.title==='法規原文對照庫';
 const summary = /歷屆常見易錯觀念|常見法規數字整理|常見英文縮寫|題目判讀重點/.test(section.title || '');
 const supplemental = !reference && !summary;
 const plain=value=>String(value).replace(/<[^>]*>|\s|[，。；：、]/g,'');
 const core=plain(body).includes(plain(teach(topic.core)))?'':`<p class="topic-core">${teach(topic.core)}</p>`;
 const tag=topic.flow?'ol':'ul';
 const structure=`<${tag} class="${topic.flow?'topic-diagram topic-flow':'topic-list'}" aria-label="${escape(conciseText(topic.title))}概念整理">${topic.nodes.map(node=>`<li><strong>${teach(node[0])}</strong><span>${teach(node[1])}</span></li>`).join('')}</${tag}>`;
 const diagram=supplemental&&!topic.overview&&!body.includes('<table')?(body&&!topic.flow?`<details class="topic-structure"><summary>概念整理</summary>${structure}</details>`:structure):'';
 const points=(section.keyPoints||[]).filter(point=>!plain(body).includes(plain(teach(point))));
 const notes=(section.notes||[]).filter(note=>!plain(body).includes(plain(teach(note))));
 const hasExample=/實例說明|案例[：:]|例[：:]/.test(body.replace(/<[^>]*>/g,''));
 const example=supplemental&&!topic.overview&&!hasExample&&topic.example?`<div class="topic-example"><p><strong>例：</strong>${teach(topic.example)}</p></div>`:'';
 const trap=supplemental&&!topic.overview&&topic.trap?`<p class="topic-trap"><strong>易混淆：</strong>${teach(topic.trap)}</p>`:'';
 const explanation=supplemental?`<div class="topic-explain">${core}</div>`:'';
 const application=diagram||example||trap?`<div class="topic-application">${diagram}${example}${trap}</div>`:'';
 const rules=body||points.length||notes.length?`<div class="topic-rules"><div class="rule-content">${body}</div>${points.length?'<ul>'+points.map(point=>'<li>'+emphasizeHtml(teach(point))+'</li>').join('')+'</ul>':''}${notes.length?'<p>'+notes.map(note=>emphasizeHtml(teach(note))).join('<br>')+'</p>':''}</div>`:'';
 totals.topics++;
 return `<section class="source-section knowledge-topic" data-source-id="${escape(section.id)}"><h4>${teach(reference?'法規條文':topic.title)}</h4>${reference?'<details class="law-reference"><summary>展開本章法規條文</summary>':''}<div class="${explanation&&rules?'topic-reading':'topic-single'}">${explanation}${rules}${application}</div>${reference?'</details>':''}</section>`;
}
const guideTitles={trust:['角色分工','財產與管理目的','財產、義務與救濟'],fintech:['服務需求與工具','資料、運算與連接','支付與身分驗證'],consumer:['授信流程與控制','業務、風管與稽核','消費者權益'],esg:['環境、社會與治理','排放邊界與換算','金融工具與揭露'],aml:['犯罪、審查與申報','身分、控制者與風險','申報與資料保存'],ethics:['資金供需','機構與市場','金融工具與風險'],'professional-ethics':['適合度與揭露','利益衝突','保密與誠信']};
const navigation = [];
const lessons = [];
for (const course of courses) {
  const raw = fs.readFileSync(path.join(root,'dist',course.source+'.html'),'utf8');
  const match = raw.match(/window\.__STUDY_PACK__\s*=\s*({.*});/);
  assert(match, `Missing compiled source: ${course.source}`);
  const pack = JSON.parse(match[1]);
  assert.equal(course.chapters.length,pack.chapters.length,course.name+' chapter coverage');
  const questionById = new Map(pack.questions.map(question => [question.id,question]));
  const sourceDir = path.join(root,'教材',course.source);
  const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.md'));
  const shortTitle = chapter => chapter.title.replace(/^第\s*\d+\s*章[：:]\s*/,'').replace(/：重點教材跟歷屆考題$/,'');
  navigation.push(`<nav class="course-navigation" data-course="${course.key}" aria-label="${escape(course.name)}章節"><ol class="chapter-list">${course.chapters.map((chapter,index) => {
    const item = pack.chapters.find(item => item.id === chapter.id);
    assert(item,course.key+'/'+chapter.id);
    return `<li><a href="#${course.key}-${chapter.id}"><span class="chapter-number">${String(index).padStart(2,'0')}</span><span>${escape(index===0 && course.key!=='ethics'?'全景導讀':shortTitle(item))}</span></a></li>`;
  }).join('')}</ol></nav>`);

  course.chapters.forEach((lesson,index) => {
    const chapter = pack.chapters.find(chapter => chapter.id === lesson.id);
    const id = course.key+'-'+lesson.id;
    const sections = chapter.sections.filter(section => String(section.content || '').replace(/[-#*_>\s]/g,'') || section.keyPoints?.length || section.notes?.length);
    const entry = {chapter:id,removed:[],topics:[]};
    let topicIndex=0;
    const guide = (index===0 && course.key!=='ethics') || course.key==='ethics';
    const learningSections = guide ? (course.key==='ethics'&&chapter.id==='professional-ethics'?ethicsTopics:guideTopics[course.key]).map((row,i)=>({section:{id:id+'-topic-'+i},topic:topicFrom(row,guideTitles[chapter.id==='professional-ethics'?chapter.id:course.key][i]),body:course.key==='esg'&&i===0?original(sections.find(section=>section.title.includes('每天 2 小時'))?.content||''):''})) : sections.flatMap((section,i)=>{
      if(id==='aml-aml02') {
        const topic=cddTopics[i];assert(topic,section.title);
        if(topic.overview){entry.removed.push({id:section.id,reason:'重複章首摘要，保留於章首與章節總覽'});return [];}
        return [{section,topic,body:topic.overview?'':original(section.content)}];
      }
      if(/本章學習導航與核心地圖|本章使用說明/.test(section.title)) {entry.removed.push({id:section.id,reason:'重複章首導讀'});return [];}
      let topic;
      if(/歷屆常見易錯觀念/.test(section.title)) topic={title:'常見誤判與條件辨識',core:lesson.limit,nodes:lesson.steps.map(step=>[step[0],step[1]]),example:lesson.check[0]+' '+lesson.check[1],trap:'先找題目改動的對象、條件與用詞，再回看各項規定。'};
      else if(section.title==='法規原文對照庫') topic={title:'條文與適用要件',core:'將本章觀念放回條文，依序辨認規範對象、行為與例外。',nodes:[['對象',lesson.steps[0][0]],['事項',lesson.steps[1][0]],['條件',lesson.steps[2][0]]],example:lesson.check[0]+' '+lesson.check[1],trap:lesson.limit};
      else if(/常見法規數字整理|常見英文縮寫|題目判讀重點/.test(section.title)) topic=topicFrom(reviewTopics[section.title.includes('縮寫')?1:section.title.includes('判讀')?2:0],section.title.replace('歷屆題目','').replace('常見法規數字整理','數字、期間與適用情境'));
      else topic=topicFrom(sectionTopics[course.key+'/'+chapter.id]?.[topicIndex++],section.title);
      return [{section,topic,body:original(section.content)}];
    });
    if(guide) entry.removed=sections.map(section=>({id:section.id,reason:'導讀整合為學科核心知識；來源連結移至章末'}));
    if(sectionTopics[course.key+'/'+chapter.id]) assert.equal(topicIndex,sectionTopics[course.key+'/'+chapter.id].length,id+' teaching coverage');
    entry.topics=learningSections.map(({section,topic})=>({id:section.id,title:topic.title}));coverage.push(entry);
    const references=[...new Set(sections.flatMap(section=>[...String(section.content||'').matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].map(match=>renderer.link({href:match[2],text:match[1]}))))];
    assert(lesson.steps.length>=3 && lesson.steps.length<=5,id+' step count');
    const practiceIds = chapter.practiceQuestionIds?.length ? chapter.practiceQuestionIds : pack.questions.filter(q=>q.chapterId===chapter.id).slice(0,10).map(q=>q.id);
    const questions = practiceIds.map(id => questionById.get(id));
    assert.equal(questions.length,10,id+' preserves ten practice questions');
    questions.forEach(question => assert(question,id+' question exists'));
    totals.chapters++;totals.questions+=questions.length;
    const originalFile = course.key==='trust' ? (index===0?'scripts/build-coursepacks.js（導讀）':`教材/${course.source}/course_data.json · ${chapter.id}`)
      : course.key==='ethics' ? `教材/${course.source}/questions.json · ${chapter.id}`
      : `教材/${course.source}/${files.find(file=>fs.readFileSync(path.join(sourceDir,file),'utf8').match(/^id:\s*(\S+)/m)?.[1]===chapter.id)||files.find(file=>file.startsWith(String(index).padStart(2,'0')+'_'))||'pack.json'}`;
    const type = lesson.kind==='compare' ? '比較圖 · 箭頭表示對照' : lesson.kind==='roles' ? '角色圖 · 看責任與關係' : '理解流程 · 點選節點看說明';
    const prev = course.chapters[Math.max(0,index-1)];
    const next = course.chapters[index+1] || course.chapters[0];
    lessons.push(`<article class="lesson" id="${id}" data-course="${course.key}" data-short-title="${escape(shortTitle(chapter))}" aria-labelledby="${id}-title">
<div class="breadcrumb"><span>${escape(course.name)}</span></div>
<p class="lesson-kicker">${course.key==='ethics'?'題庫導讀':'CHAPTER '+String(index).padStart(2,'0')}</p>
<h2 id="${id}-title" tabindex="-1">${escape(lesson.headline)}</h2><p class="intro">${teach(lesson.intro)}</p>

<details class="chapter-overview"><summary>章節總覽</summary><section class="concept-map" aria-labelledby="${id}-map-title"><div class="map-heading"><h3 id="${id}-map-title">${icon('map')}角色與關係</h3><span class="map-kind">${type}</span></div>
<ol class="map ${lesson.kind==='compare'||lesson.kind==='roles'?'map-parallel':'map-flow'}" style="--nodes:${lesson.steps.length}">${lesson.steps.map((step,i)=>`<li><button type="button" class="map-node" aria-pressed="false" aria-controls="${id}-step-${i}"><span class="step-index">${String(i+1).padStart(2,'0')}</span><strong>${escape(step[1])}</strong><small>${escape(step[0])}</small></button></li>`).join('')}</ol>
<div class="map-track" aria-hidden="true">${lesson.steps.map(()=>'<span></span>').join('')}</div>
<div class="step-details" aria-live="polite">${lesson.steps.map((step,i)=>`<div class="step-detail" id="${id}-step-${i}"><span>${String(i+1).padStart(2,'0')}</span><p><strong>${escape(step[0])}：</strong>${teach(step[2])}</p></div>`).join('')}</div>
<div class="map-footer"><button class="next-step" type="button" data-step="1">下一步 →</button></div></section></details>

<section class="source-block" aria-labelledby="${id}-source-title"><h3 id="${id}-source-title">${icon('book','summary-icon')}本章知識點</h3><div class="chapter-reading">${learningSections.map(({section,topic,body})=>renderTopic(topic,section,body)).join('')}</div></section>
<section class="chapter-review"><h3>判斷界線</h3><p>${teach(lesson.limit)}</p></section>
<section class="understanding"><h3>換個情況，怎麼判斷？</h3><p class="question-line">${teach(lesson.check[0])}</p><details class="check-answer"><summary>看看怎麼想</summary><p>${teach(lesson.check[1])}</p></details></section>
<details class="chapter-sources"><summary>參考資料與版本</summary><p>${escape(course.name)}教材${course.key==='ethics'?'；題目依證基會 113 年版及官方勘誤整理。':'。'}</p>${references.length?'<ul>'+references.map(link=>'<li>'+link+'</li>').join('')+'</ul>':''}</details>
<details class="practice-block"><summary>${icon('check','summary-icon')}章末練習<span class="practice-total">10 題</span><span class="chevron" aria-hidden="true">›</span></summary><p class="practice-note">核對答案後，回看不熟悉的知識點。</p>${questions.map((question,qindex)=>{
      const answer=Array.isArray(question.answer)?question.answer:[question.answer];
      const qkey=id+'-q'+qindex;
      return `<form class="practice-form" data-question-id="${escape(question.id)}" data-answer="${escape(JSON.stringify(answer))}"><div class="question-source"><span>QUESTION ${String(qindex+1).padStart(2,'0')} / 10</span><span>${escape([question.sourceExam?.term,question.sourceExam?.subject,question.sourceExam?.number?'第 '+question.sourceExam.number+' 題':''].filter(Boolean).join(' · '))}</span></div><fieldset><legend><small>${question.type==='multiple-choice'?'複選題，可選多項':'單選題'}</small>${escape(readableText(question.question))}</legend>${question.options.map((option,i)=>`<label class="option"><input type="${question.type==='multiple-choice'?'checkbox':'radio'}" name="${qkey}" value="${i}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${escape(readableText(option))}</span></label>`).join('')}</fieldset><button class="check-question" type="submit">核對答案</button><p class="quiz-feedback" role="status" hidden></p></form>`;
    }).join('')}</details>
<footer class="lesson-bottom"><nav class="lesson-navigation" aria-label="章節前後導覽"><a href="#${course.key}-${prev.id}"><span>${index===0?'本科起點':'上一章'}</span>← ${escape(index===0?'全景導讀':course.chapters[index-1].headline)}</a><a href="#${course.key}-${next.id}"><span>${index===course.chapters.length-1?'回到本科導讀':'接著看'}</span>${escape(next.headline)} →</a></nav></footer>
</article>`);
  });
}

const css = fs.readFileSync(path.join(dir,'preview.css'),'utf8');
const js = fs.readFileSync(path.join(dir,'preview.js'),'utf8').replace(/<\/script/gi,'<\\/script');
const html = `<!doctype html><html lang="zh-Hant" class="without-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="六科38章教材白話圖解：先看角色與關係，依知識點讀懂規定與情境，再以十題練習核對理解。獨立設計預覽。"><title>各科教材・白話圖解｜設計預覽</title><link rel="icon" href="data:,"><style>${css}</style></head><body>
<a class="skip-link" href="#main-content">跳到教材內容</a><header class="site-header"><div class="brand">${icon('map','brand-mark')}<div><h1>各科教材・白話圖解</h1><small>LEARNING NOTES / 2026</small></div></div><span class="preview-tag">設計預覽</span></header>
<noscript><p class="noscript">目前未啟用 JavaScript，所有章節仍可依序閱讀，教材直接顯示，理解答案可展開；選答核對需要啟用 JavaScript。</p></noscript>
<div class="workspace"><aside class="sidebar" aria-label="選科與章節目錄"><div class="subject-field"><label class="field-label" for="subject-select">選擇科目</label><select id="subject-select">${courses.map(course=>`<option value="${course.key}">${escape(course.name)}</option>`).join('')}</select></div><details class="chapter-picker" open><summary>章節目錄</summary>${navigation.join('')}</details></aside><main id="main-content" tabindex="-1">${lessons.join('\n')}</main></div>
<footer class="site-footer"><span> ${totals.subjects} 科 / ${totals.chapters} 章 / ${totals.questions} 道章末練習</span></footer><script>${js}</script></body></html>`;
assert.deepEqual(findExternalResources(html),[],'Preview has no external resources');
const output = path.join(dir,'各科教材_ELI5_獨立預覽.html');
fs.writeFileSync(output,html);
fs.mkdirSync(path.join(root,'.qa-artifacts/eli5-v4'),{recursive:true});
fs.writeFileSync(path.join(root,'.qa-artifacts/eli5-v4/coverage.json'),JSON.stringify(coverage,null,2));
console.log(JSON.stringify({output,...totals,sizeMB:Number((Buffer.byteLength(html)/1024/1024).toFixed(2))},null,2));
