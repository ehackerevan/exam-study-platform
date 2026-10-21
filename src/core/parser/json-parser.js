import { createDefaultStudyPack } from '../schema/index.js';
import { sanitizeHtml } from '../utils/sanitize.js';

/**
 * 解析 JSON 輸入並正規化為標準 Study Pack
 * @param {string|object} input
 * @returns {object}
 */
export function parseStudyPackJson(input) {
  let parsed = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input.replace(/^\uFEFF/, ''));
    } catch (err) {
      throw new Error(`JSON 解析失敗: ${err.message}`);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON 內容必須為物件');
  }

  // 若輸入直接是題目陣列
  if (Array.isArray(parsed)) {
    const pack = createDefaultStudyPack({ title: '匯入題庫' });
    pack.questions = sanitizeQuestions(parsed);
    // 自動產生預設章節
    const chapterIds = [...new Set(pack.questions.map(q => q.chapterId || 'chapter-01'))];
    pack.chapters = chapterIds.map(cid => ({
      id: cid,
      title: `章節 ${cid}`,
      summary: '',
      sections: [{ id: `${cid}-sec-01`, title: '預設小節', content: '', keyPoints: [], notes: [] }]
    }));
    return pack;
  }

  for (const field of ['chapters', 'questions']) {
    if (parsed[field] !== undefined && !Array.isArray(parsed[field])) throw new Error(`${field} 必須為陣列`);
  }

  const base = createDefaultStudyPack(parsed);

  // 消毒章節
  if (Array.isArray(base.chapters)) {
    base.chapters = base.chapters.map(ch => ({
      ...ch,
      id: String(ch.id || 'chapter-01'),
      title: String(ch.title || '未命名章節'),
      summary: String(ch.summary || ''),
      sections: Array.isArray(ch.sections)
        ? ch.sections.map(s => ({
            id: String(s.id || 'sec-01'),
            title: String(s.title || '未命名小節'),
            content: sanitizeHtml(String(s.content || '')),
            keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.map(p => sanitizeHtml(String(p))) : [],
            notes: Array.isArray(s.notes) ? s.notes.map(n => sanitizeHtml(String(n))) : []
          }))
        : []
    }));
  }

  // 消毒題目
  if (Array.isArray(base.questions)) {
    base.questions = sanitizeQuestions(base.questions);
  }

  return base;
}

function sanitizeQuestions(questions) {
  return questions.map((q, idx) => ({
    ...q,
    id: String(q.id || `q${String(idx + 1).padStart(3, '0')}`),
    chapterId: String(q.chapterId || 'chapter-01'),
    sectionId: String(q.sectionId || ''),
    type: q.type === undefined ? 'single-choice' : q.type,
    question: sanitizeHtml(String(q.question || '')),
    options: Array.isArray(q.options) ? q.options.map(o => typeof o === 'string' ? sanitizeHtml(o) : o) : [],
    answer: q.answer,
    explanation: sanitizeHtml(String(q.explanation || '')),
    ...(q.sourceExam && typeof q.sourceExam === 'object' && !Array.isArray(q.sourceExam) ? {
      sourceExam: {
        term: sanitizeHtml(String(q.sourceExam.term || '')),
        subject: sanitizeHtml(String(q.sourceExam.subject || '')),
        number: q.sourceExam.number
      }
    } : {})
  }));
}
