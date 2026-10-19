import fs from 'node:fs';
import path from 'node:path';
import { loadSourcesFromDirectory } from '../src/cli/index.js';
import { buildNormalizedStudyPack } from '../src/core/parser/index.js';
import { validateStudyPack } from '../src/core/validator/index.js';
import { compileAndWriteToFile } from '../src/core/compiler/index.js';
import {applySharedUi} from '../src/core/compiler/ui-theme.js';
import { parseSourceExam } from '../src/core/utils/source-exam.js';
import { loadTrustCourse } from '../src/core/utils/trust-course.js';

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
  // Prefer actual teaching chapters over placeholders generated while importing question arrays.
  pack.chapters = pack.chapters.filter((chapter, index, all) =>
    !all.some((other, otherIndex) => otherIndex !== index && other.id === chapter.id && other.sections.some(s => s.content)) || chapter.sections.some(s => s.content));
  pack.description = pack.description.replace(/100%\s*正確/g, '依來源整理的');
  pack.contentVersion = '2026.10.18';
  pack.description = `收錄 ${pack.questions.length} 題。先讀概念，再練本章與複習待加強題；進度可匯出備份。`;
  for (const question of pack.questions) {
    question.sourceExam ||= parseSourceExam(question, c.name.replace(/重點教材$/, ''));
    delete question.explanation;
  }
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
    intro.sections.unshift({id:`${intro.id}-learning-guide`, title:'如何使用這份教材', content:'先讀各章概念，再用「本章練習」檢查理解；答錯時返回相關教材。每章完成後，確認自己能用自己的話說明重點，再標記已讀。\n\n歷屆答案保留考試當時的判定，可能與後續規定不同。涉及日期、門檻或法規適用，請以該考期與官方現行資料分別核對。\n\n本次整理日期：2026-10-18；不是逐題法規審校日期。', keyPoints:['讀概念 → 練本章 → 看理由 → 回教材 → 重練待加強題'], notes:[]});
    intro.sections.push({id:`${intro.id}-question-count`, title:'題目總數', content:`本教材目前共收錄 ${pack.questions.length} 題。`, keyPoints:[], notes:[]});
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
  const sizeKb = (res.sizeBytes / 1024).toFixed(1);
  const multiCount = pack.questions.filter(q => q.type === 'multiple-choice').length;
  console.log(`[OK] ${c.name} -> ${c.out} (${sizeKb} KB, ${res.chaptersCount} 章節, ${res.questionsCount} 題目，其中複選題 ${multiCount} 題)`);
}

console.log('\n=== 五科 Study Pack 全部編譯完成！ ===');
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const cards = view => courses.map(c => '<a class="subject-link" href="'+escape(path.basename(c.out))+'?view='+view+'"><span class="subject-name">'+escape(c.name.replace(/重點教材$/,''))+'</span><span class="subject-meta">'+(view==='reader' ? c.chapterCount+' 章教材 · 概念與重點整理' : c.questionCount.toLocaleString('zh-TW')+' 題 · 章節、隨機與錯題練習')+'</span></a>').join('');
const total = courses.reduce((sum,c)=>sum+c.questionCount,0);
const catalogue = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>學科目錄｜教材與題庫</title></head><body><main class="catalog-main"><header class="catalog-header"><div><h1>學科目錄</h1><p>'+courses.length+' 個學科 · '+total.toLocaleString('zh-TW')+' 題練習 · 離線使用</p></div><nav class="catalog-nav" aria-label="目錄分區"><a href="#materials">教材閱讀</a><a href="#question-banks">題庫練習</a></nav></header><div class="catalog-sections"><section class="catalog-section" id="materials" aria-labelledby="materials-title"><h2 id="materials-title">教材閱讀</h2><p>從概念與重點開始，讀完後可直接練習本章。</p><div class="subject-grid">'+cards('reader')+'</div></section><section class="catalog-section" id="question-banks" aria-labelledby="banks-title"><h2 id="banks-title">題庫練習</h2><p>選擇學科，進行章節練習、隨機抽題或複習錯題。</p><div class="subject-grid">'+cards('quiz')+'</div><p><a href="歷屆考古題_完整題庫大全.html">依考期與題型瀏覽歷屆題庫 →</a></p></section></div><footer class="catalog-footer"><p><small>進度保存在目前瀏覽器，請定期匯出備份。歷屆答案與現行規定須分別核對。</small></p></footer></main></body></html>';
fs.writeFileSync('dist/index.html', applySharedUi(catalogue, null));
