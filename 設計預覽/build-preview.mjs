import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {courses} from './lessons.mjs';
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
renderer.html = ({text}) => '<div class="source-excerpt">' + escape(text.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|summary|details|h[1-6])>/gi,'\n').replace(/<[^>]+>/g,'')).replace(/\n/g,'<br>') + '</div>';
renderer.link = ({href, text}) => /^https?:\/\//i.test(href) ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(text)}</a>` : escape(text);
renderer.image = ({href, text}) => /^data:image\/svg\+xml;base64,[a-z0-9+/=]+$/i.test(href) ? `<img src="${href}" alt="${escape(text)}" loading="lazy" decoding="async">` : `<p class="diagram-source">原圖：${escape(text)}</p>`;
function original(raw) {
  const source = String(raw || '').replace(/```mermaid\s*\n([\s\S]*?)```/g, (_, graph) => {
    const labels = [...graph.matchAll(/(?:\["([^"]+)"\]|\[([^\]]+)\]|\{"([^"]+)"\})/g)].map(match => match.slice(1).find(Boolean).replace(/<br\s*\/?>/gi,'；'));
    return '\n\n原教材圖中文字（供對照，不表示必經順序）：\n\n' + [...new Set(labels)].map(label => '- ' + label).join('\n') + '\n\n';
  });
  return globalThis.marked.parse(source, {renderer,gfm:true,breaks:true})
    .replace(/<(\/?)h([1-6])>/g, (_, close, level) => `<${close}h${Math.min(6,Number(level)+3)}>`)
    .replace(/<table>/g,'<div class="table-scroll" tabindex="0" aria-label="原文比較表，可左右捲動"><table>').replace(/<\/table>/g,'</table></div>');
}

const totals = {subjects:courses.length,chapters:0,questions:0};
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
<div class="breadcrumb"><span>${escape(course.name)}</span><span aria-hidden="true">/</span><span>${escape(shortTitle(chapter))}</span></div>
<p class="lesson-kicker">${course.key==='ethics'?'題庫導讀':'CHAPTER '+String(index).padStart(2,'0')} · 先看懂，再深入</p>
<h2 id="${id}-title" tabindex="-1">${escape(lesson.headline)}</h2><p class="intro">${escape(lesson.intro)}</p>
<div class="lesson-meta"><span class="meta-dot" aria-hidden="true"></span><span>一張圖理解重點</span><span aria-hidden="true">·</span><span>一個問題檢查理解</span><span aria-hidden="true">·</span><span>保留原文與十題練習</span></div>
<section class="concept-map" aria-labelledby="${id}-map-title"><div class="map-heading"><h3 id="${id}-map-title">${icon('map')}先看這張圖</h3><span class="map-kind">${type}</span></div>
<ol class="map ${lesson.kind==='compare'?'compare':''}" style="--nodes:${lesson.steps.length}">${lesson.steps.map((step,i)=>`<li><button type="button" class="map-node" aria-pressed="false" aria-controls="${id}-step-${i}"><span class="step-index">${String(i+1).padStart(2,'0')}</span><strong>${escape(step[1])}</strong><small>${escape(step[0])}</small></button></li>`).join('')}</ol>
<div class="map-track" aria-hidden="true">${lesson.steps.map(()=>'<span></span>').join('')}</div>
<div class="step-details" aria-live="polite">${lesson.steps.map((step,i)=>`<div class="step-detail" id="${id}-step-${i}"><span>${String(i+1).padStart(2,'0')}</span><p><strong>${escape(step[0])}：</strong>${escape(step[2])}</p></div>`).join('')}</div>
<div class="map-footer"><p class="step-hint">不用背圖形，試著說出每一段在做什麼。</p><button class="next-step" type="button" data-step="1">下一步 →</button></div></section>
<aside class="important">${icon('info')}<p><strong>一起記住：</strong>${escape(lesson.limit)}</p></aside>
<section class="analogy" aria-label="生活比喻"><h3 class="section-tag">換成生活裡的事</h3><p>${escape(lesson.analogy)}</p></section>
<section class="understanding"><h3>如果換個情況呢？</h3><p class="question-line">${escape(lesson.check[0])}</p><details class="check-answer"><summary>看看怎麼想</summary><p>${escape(lesson.check[1])}</p></details></section>
<details class="source-block"><summary>${icon('book','summary-icon')}展開原教材對照<span class="summary-meta">${sections.length} 個段落</span><span class="chevron" aria-hidden="true">›</span></summary><p class="source-note">來源：<code>${escape(originalFile)}</code><br>以下保留現有教材條件與細節；圖形語法轉為文字標籤。導讀與頻率資料來自現行建置結果，並非本次重新核定法規。</p>${sections.map(section=>`<section class="source-section"><h4>${escape(section.title)}</h4>${original(section.content)}${section.keyPoints?.length?'<ul>'+section.keyPoints.map(point=>'<li>'+escape(point)+'</li>').join('')+'</ul>':''}${section.notes?.length?'<p>'+section.notes.map(escape).join('<br>')+'</p>':''}</section>`).join('')}</details>
<details class="practice-block"><summary>${icon('check','summary-icon')}章末練習<span class="practice-total">10 題</span><span class="summary-meta">依來源答案核對</span><span class="chevron" aria-hidden="true">›</span></summary><p class="practice-note">${chapter.practiceQuestionIds?.length?'沿用現行教材的章末十題。':'此分類使用來源題庫前十題作設計預覽。'}預覽練習不記入正式進度；題目與答案未因改版改寫。</p>${questions.map((question,qindex)=>{
      const answer=Array.isArray(question.answer)?question.answer:[question.answer];
      const qkey=id+'-q'+qindex;
      return `<form class="practice-form" data-question-id="${escape(question.id)}" data-answer="${escape(JSON.stringify(answer))}"><div class="question-source"><span>QUESTION ${String(qindex+1).padStart(2,'0')} / 10</span><span>${escape([question.sourceExam?.term,question.sourceExam?.subject,question.sourceExam?.number?'第 '+question.sourceExam.number+' 題':''].filter(Boolean).join(' · '))}</span></div><fieldset><legend><small>${question.type==='multiple-choice'?'複選題，可選多項':'單選題'}</small>${escape(question.question)}</legend>${question.options.map((option,i)=>`<label class="option"><input type="${question.type==='multiple-choice'?'checkbox':'radio'}" name="${qkey}" value="${i}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${escape(option)}</span></label>`).join('')}</fieldset><button class="check-question" type="submit">核對答案</button><p class="quiz-feedback" role="status" hidden></p></form>`;
    }).join('')}</details>
<footer class="lesson-bottom"><p class="recap"><strong>一句話帶走：</strong>${escape(lesson.intro)}</p><nav class="lesson-navigation" aria-label="章節前後導覽"><a href="#${course.key}-${prev.id}"><span>${index===0?'本科起點':'上一章'}</span>← ${escape(index===0?'全景導讀':course.chapters[index-1].headline)}</a><a href="#${course.key}-${next.id}"><span>${index===course.chapters.length-1?'回到本科導讀':'接著看'}</span>${escape(next.headline)} →</a></nav></footer>
</article>`);
  });
}

const css = fs.readFileSync(path.join(dir,'preview.css'),'utf8');
const js = fs.readFileSync(path.join(dir,'preview.js'),'utf8').replace(/<\/script/gi,'<\\/script');
const html = `<!doctype html><html lang="zh-Hant" class="without-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="六科37章教材白話圖解：先看角色與關係，展開原文，再以十題練習核對理解。獨立設計預覽。"><title>各科教材・白話圖解｜設計預覽</title><link rel="icon" href="data:,"><style>${css}</style></head><body>
<a class="skip-link" href="#main-content">跳到教材內容</a><header class="site-header"><div class="brand">${icon('map','brand-mark')}<div><h1>各科教材・白話圖解</h1><small>LEARNING NOTES / 2026</small></div></div><span class="preview-tag">設計預覽</span></header>
<noscript><p class="noscript">目前未啟用 JavaScript，所有章節仍可依序閱讀，原文與理解答案可展開；選答核對需要啟用 JavaScript。</p></noscript>
<div class="workspace"><aside class="sidebar" aria-label="選科與章節目錄"><div class="subject-field"><label class="field-label" for="subject-select">選擇科目</label><select id="subject-select">${courses.map(course=>`<option value="${course.key}">${escape(course.name)}</option>`).join('')}</select></div><details class="chapter-picker" open><summary>章節目錄</summary>${navigation.join('')}</details><div class="sidebar-note"><strong>先看關係，再讀細節。</strong>圖解幫你建立理解；關鍵條件與例外，回到原文確認。<div class="swatches" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div></div></aside><main id="main-content" tabindex="-1">${lessons.join('\n')}</main></div>
<footer class="site-footer"><span>依現有教材製作 · ${totals.subjects} 科 / ${totals.chapters} 章 / ${totals.questions} 道章末練習</span><span>獨立預覽 · 不變更正式學習進度</span></footer><script>${js}</script></body></html>`;
assert.deepEqual(findExternalResources(html),[],'Preview has no external resources');
const output = path.join(dir,'各科教材_ELI5_獨立預覽.html');
fs.writeFileSync(output,html);
console.log(JSON.stringify({output,...totals,sizeMB:Number((Buffer.byteLength(html)/1024/1024).toFixed(2))},null,2));
