import fs from 'node:fs';
import path from 'node:path';
import { loadSourcesFromDirectory } from '../src/cli/index.js';
import { buildNormalizedStudyPack } from '../src/core/parser/index.js';
import { validateStudyPack } from '../src/core/validator/index.js';
import { compileAndWriteToFile } from '../src/core/compiler/index.js';
import {applySharedUi} from '../src/core/compiler/ui-theme.js';
import { parseSourceExam } from '../src/core/utils/source-exam.js';
import { loadTrustCourse } from '../src/core/utils/trust-course.js';

const frequency = JSON.parse(fs.readFileSync('tasks/exam_frequency_20261020.json', 'utf8')).courses;
const quarantined = new Set(JSON.parse(fs.readFileSync('tasks/question-quarantine.json', 'utf8')).map(row => row.id));
const trustBank = JSON.parse(fs.readFileSync('教材/信託業務人員重點教材/full_exam_bank.json', 'utf8'));
const trustQuestions = [...new Map(Object.values(trustBank).flat().map(question => [question.id, question])).values()];
const countTrustItems = selector => {
  const counts = new Map();
  for (const question of trustQuestions) {
    const item = selector(question);
    if (item) counts.set(item, (counts.get(item) || 0) + 1);
  }
  return [...counts].map(([item, question_count]) => ({ item, question_count })).sort((a, b) => b.question_count - a.question_count || a.item.localeCompare(b.item, 'zh-TW'));
};
const trustConceptRanking = countTrustItems(question => question.topic);
const trustLawNames = [
  '信託業法施行細則', '信託業設立標準', '信託資金集合管理運用管理辦法', '金融資產證券化條例',
  '不動產證券化條例', '證券投資信託及顧問法', '遺產及贈與稅法', '信託業法', '信託法',
  '所得稅法', '土地稅法', '證券交易法', '銀行法', '民法', '公司法'
];
const trustLawRanking = trustLawNames.map(item => ({
  item,
  question_count: trustQuestions.filter(question => [question.stem, ...question.options].join(' ').includes(item)).length
})).filter(row => row.question_count > 0).sort((a, b) => b.question_count - a.question_count || a.item.localeCompare(b.item, 'zh-TW'));
if (trustConceptRanking.reduce((sum, row) => sum + row.question_count, 0) !== trustQuestions.length || !trustLawRanking.length) {
  throw new Error('信託高頻統計資料不完整，請先核對題庫的主題標籤與法規名稱。');
}
frequency['信託業務人員重點教材'] = {
  concept_ranking: trustConceptRanking.slice(0, 10).map(({ item: concept, question_count }) => ({ concept, question_count })),
  law_ranking: trustLawRanking.slice(0, 10).map(({ item: law_or_rule, question_count }) => ({ law_or_rule, question_count }))
};
const chart = (title, rows, labelKey) => {
  const max = rows[0]?.question_count || 1;
  return `### ${title}\n\n| 排名 | 項目 | 題數長條 | 題數 |\n| ---: | --- | --- | ---: |\n${rows.map((row, index) => `| ${index + 1} | ${row[labelKey].replace(/\|/g, '\\|')} | ${'█'.repeat(Math.max(1, Math.round(row.question_count / max * 24)))} | ${row.question_count} |`).join('\n')}`;
};
const frequencySection = course => {
  const data = frequency[course];
  if (!data) throw new Error(`缺少歷屆頻率資料：${course}`);
  const method = course === '信託業務人員重點教材'
    ? '統計方式：概念依題庫的 topic 主題標籤計數；法規依題幹與選項中出現的法規名稱計數，題目依 ID 去重。一題可能涉及多項法規。'
    : '統計方式：由題幹與選項的關鍵詞初步分類，法規依題幹及正確選項比對；一題可能對應多個觀念；統計依原始收錄資料計算，包含待核對題目。';
  return `以下長條依本教材現有題庫的命中題數排序，僅供安排複習順序，不代表官方命題比例；一題可能命中多個觀念。\n\n${chart('高頻觀念', data.concept_ranking, 'concept')}\n\n${chart('高頻法規與規範', data.law_ranking, 'law_or_rule')}\n\n${method}`;
};
const practiceQuestionIds = (pack, course) => {
  const questionText = question => `${question.question} ${question.options.join(' ')}`.toLocaleLowerCase('zh-TW');
  const topicById = new Map(trustQuestions.map(question => [question.id, question.topic]));
  const concepts = course.trust
    ? [...new Set(trustQuestions.map(question => question.topic).filter(Boolean))].map(topic => ({
        label: topic,
        ids: new Set(),
        terms: [topic],
        rank: 0
      }))
    : frequency[course.name].concept_ranking.map((concept, rank) => ({
        label: concept.concept,
        ids: new Set(concept.sample_question_ids || []),
        terms: concept.concept.replace(/（[^）]*）/g, '').split(/[、，,與及暨；;]/).map(term => term.trim().toLocaleLowerCase('zh-TW')).filter(term => term.length >= 2),
        rank
      }));
  const countQuestions = (chapterQuestions, concept) => chapterQuestions.filter(question =>
    concept.ids.has(question.id) || (course.trust
      ? topicById.get(question.id) === concept.label
      : concept.terms.some(term => questionText(question).includes(term)))
  );
  const allQuestions = pack.questions;

  return Object.fromEntries(pack.chapters.map(chapter => {
    const chapterQuestions = allQuestions.filter(question => question.chapterId === chapter.id);
    const ranked = concepts.map(concept => ({ concept, questions: countQuestions(chapterQuestions, concept) }))
      .filter(row => row.questions.length)
      .sort((a, b) => b.questions.length - a.questions.length || a.concept.rank - b.concept.rank);
    // Intro chapters span the whole subject and may have no questions assigned directly.
    const source = ranked.length ? ranked : chapterQuestions.length ? [{ questions: chapterQuestions }] : concepts.map(concept => ({ concept, questions: countQuestions(allQuestions, concept) }))
      .filter(row => row.questions.length)
      .sort((a, b) => b.questions.length - a.questions.length || a.concept.rank - b.concept.rank);
    const selected = [];
    const seen = new Set();
    const remaining = source.map(row => [...row.questions]);
    while (selected.length < 10 && remaining.some(questions => questions.length)) {
      for (const questions of remaining) {
        const question = questions.shift();
        if (question && !seen.has(question.id)) selected.push(question.id), seen.add(question.id);
        if (selected.length === 10) break;
      }
    }
    chapter.practiceConcepts = source.filter(row => row.concept && row.questions.some(question => seen.has(question.id))).map(row => row.concept.label);
    return [chapter.id, selected];
  }));
};

const courses = [
  { name: '信託業務人員重點教材', dir: '教材/信託業務人員重點教材', out: 'dist/信託業務人員重點教材.html', trust: true },
  { name: '金融科技力重點教材', dir: '教材/金融科技力重點教材', out: 'dist/金融科技力重點教材.html' },
  { name: '消費金融內部控制與稽核重點教材', dir: '教材/消費金融內部控制與稽核重點教材', out: 'dist/消費金融內部控制與稽核重點教材.html' },
  { name: '永續發展基礎能力重點教材', dir: '教材/永續發展基礎能力重點教材', out: 'dist/永續發展基礎能力重點教材.html' },
  { name: '防制洗錢與打擊資恐重點教材', dir: '教材/防制洗錢與打擊資恐重點教材', out: 'dist/防制洗錢與打擊資恐重點教材.html' }
];
console.log('=== 開始編譯五科 Study Pack HTML ===\n');

for (const c of courses) {
  const dirPath = path.resolve(process.cwd(), c.dir);
  const outPath = path.resolve(process.cwd(), c.out);

  const sources = c.trust ? null : loadSourcesFromDirectory(dirPath);
  const pack = c.trust ? loadTrustCourse(dirPath) : buildNormalizedStudyPack(sources);
  const excludedCount = pack.questions.filter(question => quarantined.has(question.id)).length;
  pack.questions = pack.questions.filter(question => !quarantined.has(question.id));
  pack.excludedQuestionCount = excludedCount;
  // Prefer actual teaching chapters over placeholders generated while importing question arrays.
  pack.chapters = pack.chapters.filter((chapter, index, all) =>
    !all.some((other, otherIndex) => otherIndex !== index && other.id === chapter.id && other.sections.some(s => s.content)) || chapter.sections.some(s => s.content));
  pack.description = pack.description.replace(/100%\s*正確/g, '依來源整理的');
  if (!c.trust) pack.readerLayout = 'chunked';
  pack.contentVersion = c.trust ? '2026.10.18' : '2026.10.20';
  pack.description = `收錄 ${pack.questions.length} 題。先讀概念，再練本章與複習待加強題；進度可匯出備份。`;
  for (const question of pack.questions) {
    question.sourceExam ||= parseSourceExam(question, c.name.replace(/重點教材$/, ''));
    delete question.explanation;
  }
  for (const chapter of pack.chapters) {
    chapter.summary = chapter.summary.replace(/100%\s*正確/g, '依來源整理的');
    chapter.summary = chapter.summary.replace(/\*\*/g, '');
    chapter.title = chapter.title.replace(/\*\*/g, '');
    chapter.sections = chapter.sections.filter(section =>
      !/本教材.*(?:特色|設計)/.test(section.title) &&
      !/章節索引|本章重點/.test(section.title) &&
      !(section.title === '概述' && (!section.content || section.content.trim() === '---'))
    );
    for (const section of chapter.sections) {
      if (/00$/.test(chapter.id) && /出題權重|核心地圖|核心架構/.test(section.title)) {
        section.title = '學習範圍與報考提醒';
        section.content = '本教材依收錄題庫整理各章概念。考試題型、配分、及格標準與報考資格，請以報考當期官方簡章為準。練習題型依原收錄資料呈現，不用歷史題型推定本期規則。';
      }
      section.content = section.content
        .replace(/依據[^\n]*(?:大數據|權重|比重)[^\n]*[：:]/g, '以下為學習主題導覽。')
        .replace(/```mermaid\s*\npie[\s\S]*?```/g, '')
        .replace(/\*\*單一離線學習包\*\*[^\n]*/g, '')
        .replace(/100%\s*正確/g, '依來源整理的');
  const decorativeEmoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
      section.title = section.title.replace(decorativeEmoji, '').replace(/\s{2,}/g, ' ').trim();
      section.content = section.content.replace(decorativeEmoji, '');
      section.keyPoints = section.keyPoints.map(text => text.replace(decorativeEmoji, ''));
      section.notes = section.notes.map(text => text.replace(decorativeEmoji, ''));
      section.title = section.title.replace(/\*\*/g, '');
      section.content = section.content.replace(/\*\*/g, '');
      section.keyPoints = section.keyPoints.map(text => text.replace(/\*\*/g, ''));
      section.notes = section.notes.map(text => text.replace(/\*\*/g, ''));
    }
  }
  const intro = pack.chapters[0];
  if (intro) {
    const overview = intro.sections.find(section => section.title === '概述');
    const learningContext = intro.sections.find(section => section.title === '本章概念');
    if (overview?.content && learningContext) learningContext.content = `${overview.content}\n\n${learningContext.content}`;
    intro.sections = intro.sections.filter(section => section.title !== '概述' && section.title !== '章節');
    intro.sections.unshift({id:`${intro.id}-learning-guide`, title:'如何使用這份教材', content:'先讀各章概念，再用「本章練習」檢查理解；答錯時返回相關教材。每章完成後，確認自己能用自己的話說明重點，再標記已讀。\n\n歷屆答案保留考試當時的判定，可能與後續規定不同。涉及日期、門檻或法規適用，請以該考期與官方現行資料分別核對。\n\n本次整理日期：2026-10-20；不是逐題法規審校日期。', keyPoints:[], notes:[]});
    intro.sections.splice(1, 0, {id:`${intro.id}-exam-frequency`, title:'歷屆高頻觀念與法規排行', content:frequencySection(c.name), keyPoints:[], notes:[]});
    intro.sections.push({id:`${intro.id}-question-count`, title:'題目總數', content:`本教材目前可練習 ${pack.questions.length} 題。${excludedCount ? `另有 ${excludedCount} 題因選項疑義暫停出題。` : ``}`, keyPoints:[], notes:[]});
    const expectedIntro = ['如何使用這份教材', '歷屆高頻觀念與法規排行', '本章概念', '學科範圍與報考提醒', '題目總數'];
    if (JSON.stringify(intro.sections.map(section => section.title)) !== JSON.stringify(expectedIntro)) {
      throw new Error(`${c.name} 導讀架構與其他學科不一致：${intro.sections.map(section => section.title).join(' / ')}`);
    }
  }
  if (!c.trust) for (const chapter of pack.chapters) {
    const context = chapter.sections.find(section => section.title === '本章概念');
    const summary = context?.content.split('### 概念說明')[1]?.split('\n').find(line => line.startsWith('- '));
    if (summary) chapter.summary = summary.slice(2);
  }
  const practiceByChapter = practiceQuestionIds(pack, c);
  const questionById = new Map(pack.questions.map(question => [question.id, question]));
  for (const chapter of pack.chapters) {
    chapter.practiceQuestionIds = practiceByChapter[chapter.id] || [];
    const hasChapterQuestions = pack.questions.some(question => question.chapterId === chapter.id);
    if (chapter.practiceQuestionIds.length > 10 || chapter.practiceQuestionIds.some(id => {
      const question = questionById.get(id);
      return !question || (hasChapterQuestions && question.chapterId !== chapter.id);
    })) {
      throw new Error(`${c.name} ${chapter.title} 的章末練習題不符合章節或題數限制`);
    }
  }

  // 驗證
  const report = validateStudyPack(pack);
  if (!report.isValid) {
    console.error(`[ERROR] 驗證失敗 ${c.name}:`, report.toString());
    process.exit(1);
  }

  const res = compileAndWriteToFile(pack, outPath);
  c.questionCount = pack.questions.length;
  c.chapterCount = pack.chapters.length;
  c.progress = { id: pack.id, chapters: pack.chapters.map(chapter => chapter.id), questions: pack.questions.map(question => question.id) };
  const category = c.trust ? '信託業務人員' : c.name.startsWith('消費') ? '消費金融' : c.name.startsWith('永續') ? '永續發展' : c.name.startsWith('防制') ? '防制洗錢' : '金融科技力';
  c.bankQuestions = pack.questions.map(question => ({
    category, period:question.sourceExam?.term?.replace(/^第\s*|\s*屆$/g, '') || '',
    subject:question.sourceExam?.subject || '', number:question.sourceExam?.number || '',
    text:question.question.replace(/^【[^】]+】\s*/, ''),
    options:c.trust ? question.options.map(option => option.replace(/^\s*[（(][1-4][）)]\s*/, '')) : question.options,
    studyHref:`${path.basename(c.out)}?view=quiz`,
    answer:(Array.isArray(question.answer) ? question.answer : [question.answer]).map(index => index + 1).join(','), type:question.type
  }));
  const sizeKb = (res.sizeBytes / 1024).toFixed(1);
  const multiCount = pack.questions.filter(q => q.type === 'multiple-choice').length;
  console.log(`[OK] ${c.name} -> ${c.out} (${sizeKb} KB, ${res.chaptersCount} 章節, ${res.questionsCount} 題目，其中複選題 ${multiCount} 題)`);
}

console.log('\n=== 五科 Study Pack 全部編譯完成！ ===');
const masterPath = '06_四科彙整題庫/歷屆考古題_完整題庫大全.html';
const masterQuestions = courses.flatMap(course => course.bankQuestions);
let masterHtml = fs.readFileSync(masterPath, 'utf8');
masterHtml = masterHtml.replace(/const RAW_QUESTIONS\s*=\s*\[[^\n]*\];/, () => `const RAW_QUESTIONS = ${JSON.stringify(masterQuestions).replace(/</g, '\\u003c')};`)
  .replace(/(id="totalCount">)\d+/, `$1${masterQuestions.length}`)
  .replaceAll('四科題庫', '五科題庫').replaceAll('四大證照合一', '五科歷屆考題');
if (!masterHtml.includes('<option value="信託業務人員">')) masterHtml = masterHtml.replace('<option value="all">全部考科總覽</option>', '<option value="all">全部考科總覽</option><option value="信託業務人員">信託業務人員 (41~62屆)</option>');
fs.writeFileSync(masterPath, masterHtml);
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const cards = view => courses.map(c => '<a class="subject-link" data-pack="'+escape(c.progress.id)+'" data-progress-view="'+view+'" href="'+escape(path.basename(c.out))+'?view='+view+'"><span class="subject-name">'+escape(c.name.replace(/重點教材$/,''))+'</span><span class="subject-meta">'+(view==='reader' ? c.chapterCount+' 章教材 · 概念與重點整理' : c.questionCount.toLocaleString('zh-TW')+' 題 · 章節、隨機與錯題練習')+'</span><span class="subject-progress"><span class="subject-progress-label">讀取進度中…</span><progress max="100" value="0" aria-label="'+escape(c.name.replace(/重點教材$/,''))+(view==='reader' ? '閱讀進度' : '題庫作答進度')+'">0%</progress></span></a>').join('');
const total = courses.reduce((sum,c)=>sum+c.questionCount,0);
const catalogue = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>學科目錄｜重點教材跟歷屆考題</title></head><body><main class="catalog-main">
<nav class="landing-nav" aria-label="主要導覽"><a class="landing-brand" href="index.html">學習小步走<span>重點教材跟歷屆考題</span></a><div class="catalog-nav"><a href="#materials">探索學科</a><a href="#question-banks">開始練題</a></div></nav><header class="catalog-intro"><h1>學科目錄</h1><p>${courses.length} 個學科 · ${total.toLocaleString('zh-TW')} 題歷屆練習</p></header>
<div class="catalog-sections"><section class="catalog-section" id="materials" aria-labelledby="materials-title"><h2 id="materials-title">重點教材</h2><div class="subject-grid">${cards('reader')}</div></section>
<section class="catalog-section" id="question-banks" aria-labelledby="banks-title"><h2 id="banks-title">歷屆考題</h2><p>依章節練習、隨機抽題，或專心複習答錯的題目。</p><div class="subject-grid">${cards('quiz')}</div><p class="bank-link"><a href="歷屆考古題_完整題庫大全.html">依考期與題型瀏覽完整歷屆題庫 →</a></p></section>
</div><footer class="catalog-footer"><p>進度保存在目前瀏覽器，請定期匯出備份。歷屆答案與現行規定須分別核對。</p></footer></main><script>window.__CATALOG_PROGRESS__ = ${JSON.stringify(courses.map(course => course.progress)).replace(/</g, '\\u003c')};</script><script>${fs.readFileSync(new URL('../src/renderer/catalog-progress.js', import.meta.url), 'utf8')}</script></body></html>`;
fs.writeFileSync('dist/index.html', applySharedUi(catalogue, null));
