import fs from 'node:fs';
import path from 'node:path';
import { loadSourcesFromDirectory } from '../src/cli/index.js';
import { buildNormalizedStudyPack } from '../src/core/parser/index.js';
import { validateStudyPack } from '../src/core/validator/index.js';
import { compileStudyPackToHtml } from '../src/core/compiler/index.js';
import {applySharedUi} from '../src/core/compiler/ui-theme.js';
import { parseSourceExam } from '../src/core/utils/source-exam.js';
import { loadTrustCourse } from '../src/core/utils/trust-course.js';

const statistics = JSON.parse(fs.readFileSync('tasks/exam_frequency_20261020.json', 'utf8'));
const frequency = statistics.courses;
const ranking = (title, rows, labelKey) => {
  const shown = rows.slice(0, 10);
  const escapeMarkdown = text => text.replace(/[\\`*_{}\[\]<>()#+.!|&~\-]/g, '\\$&');
  const list = `### ${title}\n\n${shown.map((row, index) => `${index + 1}. ${escapeMarkdown(row[labelKey])}：**${row.question_count.toLocaleString('zh-TW')} 題**`).join('\n') || '目前沒有命中資料。'}`;
  return rows.length > shown.length ? `${list}\n\n共 ${rows.length} 項，教材頁列出前 ${shown.length} 項；一題可能命中多項，題數不可直接相加。` : list;
};
const frequencySection = course => {
  const data = frequency[course];
  if (!data) throw new Error(`缺少歷屆頻率資料：${course}`);
  return `以下排名依本教材現有題庫命中題數排序，每項直接列出題數，只供安排複習順序，不代表官方命題比例；一題可能命中多個觀念。知識點分類沿用題庫來源與統計資料所列的方法；法規／規範按題幹及正確選項的名稱詞彙命中。這不是逐題語意或法律審校。\n\n${ranking('高頻觀念', data.concept_ranking, 'concept')}\n\n${ranking('高頻法規與規範', data.law_ranking, 'law_or_rule')}\n\n可到「測驗」依知識點練習；尚未分類的題目列在「其他／未分類」。`;
};

const courses = [
  { name: '信託業務人員重點教材', dir: '教材/信託業務人員重點教材', out: 'dist/信託業務人員重點教材.html', trust: true },
  { name: '金融科技力重點教材', dir: '教材/金融科技力重點教材', out: 'dist/金融科技力重點教材.html' },
  { name: '消費金融內部控制與稽核重點教材', dir: '教材/消費金融內部控制與稽核重點教材', out: 'dist/消費金融內部控制與稽核重點教材.html' },
  { name: '永續發展基礎能力重點教材', dir: '教材/永續發展基礎能力重點教材', out: 'dist/永續發展基礎能力重點教材.html' },
  { name: '防制洗錢與打擊資恐重點教材', dir: '教材/防制洗錢與打擊資恐重點教材', out: 'dist/防制洗錢與打擊資恐重點教材.html' },
  { name: '金融市場常識與職業道德題庫（證基會113年版）', dir: '教材/金融市場常識與職業道德題庫', out: 'dist/金融市場常識與職業道德題庫.html', quizOnly: true }
];
const chapterPracticeIds = (pack, course) => {
  const concepts = (frequency[course.name]?.concept_ranking || []).map((concept, rank) => ({
    label:concept.concept,
    ids:new Set(concept.question_ids || concept.sample_question_ids || []),
    rank
  }));
  const matchingQuestions = (questions, concept) => questions.filter(question => concept.ids.has(question.id));

  return Object.fromEntries(pack.chapters.map(chapter => {
    const chapterQuestions = pack.questions.filter(question => question.chapterId === chapter.id);
    const ranked = concepts.map(concept => ({concept, questions:matchingQuestions(chapterQuestions, concept)}))
      .filter(row => row.questions.length)
      .sort((a, b) => b.questions.length - a.questions.length || a.concept.rank - b.concept.rank);
    const source = ranked.length ? ranked : chapterQuestions.length ? [{questions:chapterQuestions}] : concepts.map(concept => ({
      concept, questions:matchingQuestions(pack.questions, concept)
    })).filter(row => row.questions.length).sort((a, b) => b.questions.length - a.questions.length || a.concept.rank - b.concept.rank);
    const selected = [], seen = new Set(), remaining = source.map(row => [...row.questions]);
    while (selected.length < 10 && remaining.some(questions => questions.length)) {
      for (const questions of remaining) {
        const question = questions.shift();
        if (question && !seen.has(question.id)) selected.push(question.id), seen.add(question.id);
        if (selected.length === 10) break;
      }
    }
    const relatedQuestions = ranked.flatMap(row => matchingQuestions(pack.questions, row.concept));
    for (const question of [...relatedQuestions, ...chapterQuestions, ...pack.questions]) {
      if (selected.length === 10) break;
      if (!seen.has(question.id)) selected.push(question.id), seen.add(question.id);
    }
    chapter.practiceConcepts = source.filter(row => row.concept && row.questions.some(question => seen.has(question.id))).map(row => row.concept.label);
    return [chapter.id, selected];
  }));
};
const attachKnowledgePoints = (pack, course) => {
  const labelsById = new Map(pack.questions.map(question => [question.id, new Set()]));
  const data = frequency[course.name];
  if (!data) throw new Error(`缺少題庫知識點統計：${course.name}`);
  const add = (questions, label) => {
    if (!label) return;
    for (const question of questions) labelsById.get(question.id)?.add(label);
  };
  const questionById = new Map(pack.questions.map(question => [question.id, question]));
  for (const concept of data.concept_ranking || []) {
    for (const id of concept.question_ids || concept.sample_question_ids || []) {
      if (!questionById.has(id)) throw new Error(`${course.name} 知識點題目 ID 不存在：${id}`);
      add([questionById.get(id)], concept.concept);
    }
  }
  const unclassifiedIds = new Set(data.unclassified_question_ids || []);
  for (const question of pack.questions) {
    const labels = labelsById.get(question.id);
    if (!labels.size && unclassifiedIds.has(question.id)) labels.add(data.unclassified_knowledge_point);
    if (!labels.size) throw new Error(`${course.name} 題目缺少統計知識點對應：${question.id}`);
    question.knowledgePoints = [...labels];
  }
};
console.log(`=== 開始編譯 ${courses.length} 個 Study Pack HTML ===\n`);

const outputs = [];
for (const c of courses) {
  const dirPath = path.resolve(process.cwd(), c.dir);
  const outPath = path.resolve(process.cwd(), c.out);

  const sources = c.trust ? null : loadSourcesFromDirectory(dirPath);
  const pack = c.trust ? loadTrustCourse(dirPath) : buildNormalizedStudyPack(sources);
  pack.description = pack.description.replace(/100%\s*正確/g, '依來源整理的');
  pack.contentVersion = statistics.generated_on.replaceAll('-', '.');
  pack.description = c.quizOnly ? pack.description : `收錄 ${pack.questions.length} 題。先讀概念，再練本章與複習待加強題；進度可匯出備份。`;
  for (const question of pack.questions) {
    question.sourceExam ||= parseSourceExam(question, c.name.replace(/重點教材$/, ''));
    delete question.explanation;
  }
  attachKnowledgePoints(pack, c);
  if (pack.questions.some(question => !question.knowledgePoints.length || question.knowledgePoints.some(label => typeof label !== 'string' || !label.trim()))) {
    throw new Error(`${c.name} 題目知識點分類不完整`);
  }
  if (!c.quizOnly) {
    const selectedByChapter = chapterPracticeIds(pack, c), questionById = new Map(pack.questions.map(question => [question.id, question]));
    for (const chapter of pack.chapters) {
      chapter.practiceQuestionIds = selectedByChapter[chapter.id] || [];
      if (chapter.practiceQuestionIds.length !== 10 || chapter.practiceQuestionIds.some(id => !questionById.has(id))) {
        throw new Error(`${c.name} ${chapter.title} 的章末練習題數或題目 ID 不正確`);
      }
    }
  } else for (const chapter of pack.chapters) chapter.practiceQuestionIds = [];
  for (const chapter of pack.chapters) {
    chapter.summary = chapter.summary.replace(/100%\s*正確/g, '依來源整理的');
    chapter.summary = chapter.summary.replace(/\*\*/g, '');
    chapter.title = chapter.title.replace(/\*\*/g, '');
    chapter.sections = chapter.sections.filter(section => !/本教材.*(?:特色|設計)/.test(section.title) && !/章節索引/.test(section.title));
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
    if (!c.quizOnly) {
      intro.sections.unshift({id:`${intro.id}-learning-guide`, title:'如何使用這份教材', content:'先讀各章概念，再用「本章練習」檢查理解；答錯時返回相關教材。每章完成後，確認自己能用自己的話說明重點，再標記已讀。\n\n歷屆答案保留考試當時的判定，可能與後續規定不同。涉及日期、門檻或法規適用，請以該考期與官方現行資料分別核對。\n\n本次整理日期：2026-10-20；不是逐題法規審校日期。', keyPoints:['讀概念 → 練本章 → 對照答案 → 回教材 → 重練錯題'], notes:[]});
      intro.sections.splice(1, 0, {id:`${intro.id}-exam-frequency`, title:'歷屆高頻觀念與法規排行', content:frequencySection(c.name), keyPoints:[], notes:[]});
      intro.sections.push({id:`${intro.id}-question-count`, title:'題目總數', content:`本教材目前共收錄 ${pack.questions.length} 題。`, keyPoints:[], notes:[]});
    }
  }

  // 驗證
  const report = validateStudyPack(pack);
  if (!report.isValid) {
    console.error(`[ERROR] 驗證失敗 ${c.name}:`, report.toString());
    process.exit(1);
  }

  const res = compileStudyPackToHtml(pack);
  outputs.push({path: outPath, html: res.html});
  c.questionCount = pack.questions.length;
  c.chapterCount = pack.chapters.length;
  const sizeKb = (res.sizeBytes / 1024).toFixed(1);
  const multiCount = pack.questions.filter(q => q.type === 'multiple-choice').length;
  console.log(`[OK] ${c.name} -> ${c.out} (${sizeKb} KB, ${res.chaptersCount} 章節, ${res.questionsCount} 題目，其中複選題 ${multiCount} 題)`);
}

console.log(`\n=== ${courses.length} 個 Study Pack 全部編譯完成！ ===`);
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const total = courses.filter(c=>!c.quizOnly).reduce((sum,c)=>sum+c.questionCount,0);
const cards = courses.map(c => `<article class="subject-card" style="padding:1.25rem;background:var(--bg-surface-alt);border-radius:16px;"><h2 class="subject-name">${escape(c.name.replace(/重點教材$/,''))}</h2><p class="subject-meta">${c.questionCount.toLocaleString('zh-TW')} 題${c.quizOnly ? ' · 113年版｜2026-12-31止適用' : ' · '+c.chapterCount+' 章教材'}</p><div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem;">${c.quizOnly ? '' : `<a class="subject-link" data-action="reader" style="padding:.75rem;" href="${escape(path.basename(c.out))}?view=reader">繼續學習</a>`}<a class="subject-link" data-action="quiz" style="padding:.75rem;" href="${escape(path.basename(c.out))}?view=quiz">開始練題</a></div></article>`).join('');
const catalogue = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>學科目錄｜重點教材跟歷屆考題</title></head><body><main class="catalog-main"><header class="catalog-header"><div><h1>學科目錄</h1><p>5 科教材 · ${total.toLocaleString('zh-TW')} 題練習 · 1 個獨立題庫 · 離線使用</p></div></header><section class="catalog-section"><p>選科後繼續閱讀，或直接開始十題練習。</p><div class="subject-grid">${cards}</div></section><footer class="catalog-footer"><p>進度保存在目前瀏覽器，請定期在科目「設定」匯出備份。歷屆答案與現行規定須分別核對。</p></footer></main></body></html>`;
outputs.push({path: 'dist/index.html', html: applySharedUi(catalogue, null)});
fs.mkdirSync('dist', {recursive: true});
for (const output of outputs) fs.writeFileSync(output.path, output.html, 'utf8');
