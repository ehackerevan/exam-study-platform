import { parseMarkdownToChapters } from './markdown-parser.js';
import { parseQuestionsCsv } from './csv-parser.js';
import { parseStudyPackJson } from './json-parser.js';
import { parseQuestionsTxt } from './txt-parser.js';
import { createDefaultStudyPack } from '../schema/index.js';

export {
  parseMarkdownToChapters,
  parseQuestionsCsv,
  parseStudyPackJson,
  parseQuestionsTxt
};

/**
 * 組合多個來源檔案成為單一標準 Normalized Study Pack
 * @param {object} sources
 * @param {object} [sources.meta] 學習包基礎中繼資料
 * @param {Array<string>} [sources.markdowns] Markdown 字串陣列
 * @param {Array<string>} [sources.csvQuestions] CSV 題目字串陣列
 * @param {Array<string>} [sources.txtQuestions] TXT 題目字串陣列
 * @param {Array<string|object>} [sources.jsons] JSON 內容
 * @returns {object} Normalized Study Pack
 */
export function buildNormalizedStudyPack(sources = {}) {
  const pack = createDefaultStudyPack(sources.meta || {});

  // 若有 JSON 來源，優先讀取
  if (sources.jsons && sources.jsons.length > 0) {
    for (const jsonItem of sources.jsons) {
      const parsed = parseStudyPackJson(jsonItem);
      if (parsed.id && (!pack.id || pack.id.startsWith('study-pack-'))) pack.id = parsed.id;
      if (parsed.title && pack.title === '未命名學習教材') pack.title = parsed.title;
      if (parsed.description) pack.description = parsed.description;
      if (parsed.language) pack.language = parsed.language;
      if (parsed.contentVersion) pack.contentVersion = parsed.contentVersion;
      if (parsed.chapters) pack.chapters.push(...parsed.chapters);
      if (parsed.questions) pack.questions.push(...parsed.questions);
    }
  }

  // 處理 Markdown 章節
  if (sources.markdowns && sources.markdowns.length > 0) {
    for (const md of sources.markdowns) {
      const { metadata, chapters } = parseMarkdownToChapters(md);
      if (metadata.title && pack.title === '未命名學習教材') pack.title = metadata.title;
      if (metadata.id && (!pack.id || pack.id.startsWith('study-pack-'))) pack.id = metadata.id;
      if (metadata.description) pack.description = metadata.description;
      if (metadata.language) pack.language = metadata.language;
      if (metadata.contentVersion) pack.contentVersion = metadata.contentVersion;
      pack.chapters.push(...chapters);
    }
  }

  // Question-array imports add empty chapters; keep the teaching source when its ID matches.
  const hasContent = chapter => chapter.sections.some(section => section.content || section.keyPoints?.length || section.notes?.length);
  const populatedIds = new Set(pack.chapters.filter(hasContent).map(chapter => chapter.id));
  pack.chapters = pack.chapters.filter(chapter => !populatedIds.has(chapter.id) || hasContent(chapter));

  // 建立章節名稱與 ID 的對應表，協助 CSV/TXT 正確配對
  const chapterMapping = {};
  for (const ch of pack.chapters) {
    chapterMapping[ch.id] = ch.id;
    chapterMapping[ch.title] = ch.id;
  }

  // 處理 CSV 題庫
  if (sources.csvQuestions && sources.csvQuestions.length > 0) {
    for (const csv of sources.csvQuestions) {
      const qs = parseQuestionsCsv(csv, chapterMapping);
      pack.questions.push(...qs);
    }
  }

  // 處理 TXT 題庫
  if (sources.txtQuestions && sources.txtQuestions.length > 0) {
    const defaultChapterId = pack.chapters[0] ? pack.chapters[0].id : 'chapter-01';
    for (const txt of sources.txtQuestions) {
      const qs = parseQuestionsTxt(txt, defaultChapterId);
      pack.questions.push(...qs);
    }
  }

  const chaptersById = new Map(pack.chapters.map(chapter => [chapter.id, chapter]));
  for (const question of pack.questions) {
    const sections = chaptersById.get(question.chapterId)?.sections || [];
    if (question.sectionId && !sections.some(section => section.id === question.sectionId)) {
      const matches = sections.filter(section => section.title === question.sectionId);
      if (matches.length === 1) question.sectionId = matches[0].id;
    }
  }

  // 若題目所屬的章節尚未在 pack.chapters 中，自動補齊章節節點
  const existingChapterIds = new Set(pack.chapters.map(c => c.id));
  const missingChapterIds = new Set();
  for (const q of pack.questions) {
    if (q.chapterId && !existingChapterIds.has(q.chapterId)) {
      missingChapterIds.add(q.chapterId);
    }
  }
  for (const cid of missingChapterIds) {
    pack.chapters.push({
      id: cid,
      title: `章節 ${cid}`,
      summary: '',
      sections: [{ id: `${cid}-sec-01`, title: '預設小節', content: '', keyPoints: [], notes: [] }]
    });
  }

  return pack;
}
