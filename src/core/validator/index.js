/**
 * Study Pack Validator 驗證器
 * 依據規範區分 ERROR, WARNING, INFO
 */

export class ValidationReport {
  constructor() {
    /** @type {Array<{ level: 'ERROR'|'WARNING'|'INFO', code: string, message: string, target?: string }>} */
    this.issues = [];
    this.stats = {
      chaptersCount: 0,
      sectionsCount: 0,
      questionsCount: 0,
      keyPointsCount: 0
    };
  }

  addError(code, message, target = '') {
    this.issues.push({ level: 'ERROR', code, message, target });
  }

  addWarning(code, message, target = '') {
    this.issues.push({ level: 'WARNING', code, message, target });
  }

  addInfo(code, message, target = '') {
    this.issues.push({ level: 'INFO', code, message, target });
  }

  get isValid() {
    return !this.issues.some(i => i.level === 'ERROR');
  }

  get errorCount() {
    return this.issues.filter(i => i.level === 'ERROR').length;
  }

  get warningCount() {
    return this.issues.filter(i => i.level === 'WARNING').length;
  }

  get infoCount() {
    return this.issues.filter(i => i.level === 'INFO').length;
  }

  toString() {
    const lines = [];
    lines.push(`=== Study Pack 驗證報告 ===`);
    lines.push(`章節數 (Chapters): ${this.stats.chaptersCount}`);
    lines.push(`小節數 (Sections): ${this.stats.sectionsCount}`);
    lines.push(`重點數 (Key Points): ${this.stats.keyPointsCount}`);
    lines.push(`題目數 (Questions): ${this.stats.questionsCount}`);
    lines.push(`狀態: ${this.isValid ? '✓ 驗證通過 (VALID)' : '✕ 驗證失敗 (INVALID)'}`);
    lines.push(`錯誤 (Errors): ${this.errorCount} | 警告 (Warnings): ${this.warningCount} | 提示 (Infos): ${this.infoCount}`);

    if (this.issues.length > 0) {
      lines.push('\n[詳細清單]:');
      for (const issue of this.issues) {
        const targetStr = issue.target ? ` [${issue.target}]` : '';
        lines.push(`  [${issue.level}]${targetStr} (${issue.code}) ${issue.message}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * 驗證 Study Pack 資料完整性與品質
 * @param {object} pack
 * @returns {ValidationReport}
 */
export function validateStudyPack(pack) {
  const report = new ValidationReport();

  if (!pack || typeof pack !== 'object') {
    report.addError('PACK_NULL', 'Study Pack 資料為空或非物件');
    return report;
  }

  const checkText = (text, target) => {
    if (typeof text !== 'string' || /[\uFFFD\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
      report.addError('INVALID_TEXT', '文字必須為字串，且不可含編碼替代字元或非法控制字元', target);
    }
  };
  if (!Array.isArray(pack.questions)) report.addError('INVALID_QUESTIONS', 'questions 必須為陣列');
  if (typeof pack.title === 'string') checkText(pack.title, 'title');

  // 1. Pack 基本資訊檢查
  if (!pack.id || typeof pack.id !== 'string' || !pack.id.trim()) {
    report.addError('MISSING_PACK_ID', '缺少學習包識別代碼 (id)');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(pack.id)) {
    report.addWarning('INVALID_PACK_ID_FORMAT', `學習包 ID '${pack.id}' 建議僅使用英數字、下底線與連字號`);
  }

  if (!pack.title || typeof pack.title !== 'string' || !pack.title.trim()) {
    report.addError('MISSING_PACK_TITLE', '缺少學習包標題 (title)');
  }

  if (!Array.isArray(pack.chapters) || pack.chapters.length === 0) {
    report.addError('NO_CHAPTERS', '學習包必須包含至少一個章節 (chapters)');
  }

  report.stats.chaptersCount = Array.isArray(pack.chapters) ? pack.chapters.length : 0;
  report.stats.questionsCount = Array.isArray(pack.questions) ? pack.questions.length : 0;

  const chapterIdSet = new Set();
  const chapterTitles = new Set();
  const chapterQuestionCounter = new Map();

  // 2. 章節 Chapter 檢查
  if (Array.isArray(pack.chapters)) {
    pack.chapters.forEach((ch, chIdx) => {
      if (!ch || typeof ch !== 'object') { report.addError('INVALID_CHAPTER', '章節必須為物件', `Chapter #${chIdx + 1}`); return; }
      const chLabel = ch.id ? `Chapter ${ch.id}` : `Chapter #${chIdx + 1}`;

      if (!ch.id || typeof ch.id !== 'string') {
        report.addError('MISSING_CHAPTER_ID', `第 ${chIdx + 1} 章缺少 ID`, chLabel);
      } else if (chapterIdSet.has(ch.id)) {
        report.addError('DUPLICATE_CHAPTER_ID', `章節 ID '${ch.id}' 重複定義`, chLabel);
      } else {
        chapterIdSet.add(ch.id);
        chapterQuestionCounter.set(ch.id, 0);
      }

      if (!ch.title || typeof ch.title !== 'string' || !ch.title.trim()) {
        report.addError('MISSING_CHAPTER_TITLE', `章節 '${ch.id || chIdx}' 缺少標題`, chLabel);
      } else {
        if (chapterTitles.has(ch.title.trim())) {
          report.addWarning('DUPLICATE_CHAPTER_TITLE', `發現重複的章節名稱 '${ch.title}'`, chLabel);
        }
        chapterTitles.add(ch.title.trim());
      }

      if (typeof ch.title === 'string') checkText(ch.title, chLabel);
      if (ch.summary !== undefined) checkText(ch.summary, chLabel);
      let totalKeyPointsInChapter = 0;
      let totalContentLength = 0;

      if (!Array.isArray(ch.sections)) {
        report.addError('INVALID_CHAPTER_SECTIONS', `章節 '${ch.title}' 的小節 (sections) 必須為陣列`, chLabel);
      } else if (ch.sections.length === 0) {
        report.addWarning('EMPTY_CHAPTER_SECTIONS', `章節 '${ch.title}' 沒有任何小節 (sections)`, chLabel);
      } else {
        const sectionIdSet = new Set();
        report.stats.sectionsCount += ch.sections.length;

        ch.sections.forEach((sec, secIdx) => {
          if (!sec || typeof sec !== 'object') { report.addError('INVALID_SECTION', '小節必須為物件', chLabel); return; }
          const secLabel = `${chLabel} > Section ${sec.id || '#' + (secIdx + 1)}`;
          if (!sec.id) {
            report.addError('MISSING_SECTION_ID', `小節缺少 ID`, secLabel);
          } else if (sectionIdSet.has(sec.id)) {
            report.addError('DUPLICATE_SECTION_ID', `章節內小節 ID '${sec.id}' 重複`, secLabel);
          } else {
            sectionIdSet.add(sec.id);
          }

          if (typeof sec.title !== 'string' || !sec.title.trim()) {
            report.addError('MISSING_SECTION_TITLE', `小節缺少標題`, secLabel);
          }

          for (const field of ['title', 'content']) if (sec[field] !== undefined) checkText(sec[field], `${secLabel} ${field}`);
          for (const field of ['keyPoints', 'notes']) {
            if (sec[field] !== undefined && !Array.isArray(sec[field])) report.addError('INVALID_TEXT_LIST', `${field} 必須為文字陣列`, secLabel);
            else for (const text of sec[field] || []) checkText(text, secLabel);
          }
          if (Array.isArray(sec.keyPoints)) {
            totalKeyPointsInChapter += sec.keyPoints.length;
            report.stats.keyPointsCount += sec.keyPoints.length;
          }

          if (sec.content && typeof sec.content === 'string') {
            totalContentLength += sec.content.trim().length;
          }
        });
      }

      if (totalKeyPointsInChapter === 0) {
        report.addWarning('NO_KEY_POINTS_IN_CHAPTER', `章節 '${ch.title}' 沒有任何教材重點 (keyPoints)`, chLabel);
      }

      if (totalContentLength === 0 && totalKeyPointsInChapter === 0) {
        report.addWarning('EMPTY_CHAPTER_CONTENT', `章節 '${ch.title}' 內容完全空白`, chLabel);
      }
    });
  }

  // 3. 題目 Question 檢查
  const questionIdSet = new Set();
  const normalizedQuestionsMap = new Map(); // 用於檢測完全相同題目

  if (Array.isArray(pack.questions)) {
    pack.questions.forEach((q, qIdx) => {
      if (!q || typeof q !== 'object') { report.addError('INVALID_QUESTION', '題目必須為物件', `Question #${qIdx + 1}`); return; }
      const qLabel = q.id ? `Question ${q.id}` : `Question #${qIdx + 1}`;

      // ID 唯一性
      if (!q.id || typeof q.id !== 'string') {
        report.addError('MISSING_QUESTION_ID', `第 ${qIdx + 1} 題缺少 ID`, qLabel);
      } else if (questionIdSet.has(q.id)) {
        report.addError('DUPLICATE_QUESTION_ID', `題目 ID '${q.id}' 重複`, qLabel);
      } else {
        questionIdSet.add(q.id);
      }

      // 所屬章節是否存在
      if (!q.chapterId) {
        report.addError('MISSING_QUESTION_CHAPTER', `題目未指定所屬章節代號 (chapterId)`, qLabel);
      } else if (!chapterIdSet.has(q.chapterId)) {
        report.addError('INVALID_QUESTION_CHAPTER', `題目所屬章節 '${q.chapterId}' 不存在於章節清單中`, qLabel);
      } else {
        const count = chapterQuestionCounter.get(q.chapterId) || 0;
        chapterQuestionCounter.set(q.chapterId, count + 1);
      }

      const questionChapter = (Array.isArray(pack.chapters) ? pack.chapters : []).find(chapter => chapter?.id === q.chapterId);
      if (q.sectionId && (!Array.isArray(questionChapter?.sections) || !questionChapter.sections.some(section => section?.id === q.sectionId))) {
        report.addError('INVALID_QUESTION_SECTION', '題目小節不存在於所屬章節', qLabel);
      }

      // 題型支援
      const validTypes = ['single-choice', 'true-false', 'multiple-choice'];
      if (!q.type || !validTypes.includes(q.type)) {
        report.addError('INVALID_QUESTION_TYPE', `不支援的題型 '${q.type}'，必須為 single-choice, true-false 或 multiple-choice`, qLabel);
      }

      // 題幹內文
      if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
        report.addError('EMPTY_QUESTION_TEXT', `題目內容不可為空`, qLabel);
      }

      if (typeof q.question === 'string') checkText(q.question, qLabel);

      // 選項檢查
      if (!Array.isArray(q.options) || q.options.length < 2) {
        report.addError('INSUFFICIENT_OPTIONS', `題目選項必須至少提供 2 個，目前有 ${q.options ? q.options.length : 0} 個`, qLabel);
      }

      if (Array.isArray(q.options)) for (const option of q.options) {
        checkText(option, qLabel);
        if (typeof option === 'string' && !option.trim()) report.addError('EMPTY_OPTION', '題目選項不可空白', qLabel);
      }
      if (q.type === 'true-false' && q.options?.length !== 2) report.addError('INVALID_TRUE_FALSE_OPTIONS', '是非題必須有兩個選項', qLabel);

      // 答案檢查
      if (q.type === 'multiple-choice') {
        if (!Array.isArray(q.answer) || q.answer.length === 0) {
          report.addError('INVALID_MULTIPLE_CHOICE_ANSWER', `多選題答案必須為非空數字陣列`, qLabel);
        } else {
          if (new Set(q.answer).size !== q.answer.length) report.addError('DUPLICATE_ANSWER', '多選答案不可重複', qLabel);
          for (const ansIdx of q.answer) {
            if (!Number.isSafeInteger(ansIdx) || ansIdx < 0 || !Array.isArray(q.options) || ansIdx >= q.options.length) {
              report.addError('ANSWER_OUT_OF_BOUNDS', `多選題答案索引 ${ansIdx} 超出選項範圍 (0 至 ${(q.options?.length || 0) - 1})`, qLabel);
            }
          }
        }
      } else {
        // 單選或是非
        if (!Number.isSafeInteger(q.answer) || q.answer < 0 || !Array.isArray(q.options) || q.answer >= q.options.length) {
          report.addError('ANSWER_OUT_OF_BOUNDS', `答案索引 ${q.answer} 超出選項範圍 (共有 ${q.options ? q.options.length : 0} 個選項)`, qLabel);
        }
      }

      if (q.sourceExam !== undefined &&
        (!q.sourceExam || typeof q.sourceExam.term !== 'string' || !q.sourceExam.term.trim() ||
          typeof q.sourceExam.subject !== 'string' || !q.sourceExam.subject.trim() ||
          !Number.isSafeInteger(q.sourceExam.number) || q.sourceExam.number < 1)) {
        report.addError('INVALID_SOURCE_EXAM', '考試來源需包含考期、科目與正整數題號', qLabel);
      }

      if (q.knowledgePoints !== undefined &&
        (!Array.isArray(q.knowledgePoints) || !q.knowledgePoints.length ||
          q.knowledgePoints.some(label => typeof label !== 'string' || !label.trim()) ||
          new Set(q.knowledgePoints).size !== q.knowledgePoints.length)) {
        report.addError('INVALID_KNOWLEDGE_POINTS', '知識點需為不重複的非空文字陣列', qLabel);
      }

      if ((q.featuredGroup !== undefined || q.featuredRank !== undefined) &&
        (typeof q.featuredGroup !== 'string' || !q.featuredGroup.trim() || !Number.isSafeInteger(q.featuredRank) || q.featuredRank < 1)) {
        report.addError('INVALID_FEATURED_QUESTION', '精選題需包含題組代碼與正整數排序', qLabel);
      }

      // 重複題目檢查 (normalized exact match)
      if (typeof q.question === 'string' && q.question) {
        const normStem = q.question.replace(/\s+/g, '').toLowerCase();
        if (normalizedQuestionsMap.has(normStem)) {
          report.addWarning('DUPLICATE_QUESTION_TEXT', `發現題幹內容與 ${normalizedQuestionsMap.get(normStem)} 高度重複`, qLabel);
        } else {
          normalizedQuestionsMap.set(normStem, q.id || `#${qIdx + 1}`);
        }
      }
    });
  }

  for (const chapter of Array.isArray(pack.chapters) ? pack.chapters : []) {
    if (!chapter || chapter.practiceQuestionIds === undefined) continue;
    const ids = chapter.practiceQuestionIds;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !questionIdSet.has(id))) {
      report.addError('INVALID_PRACTICE_QUESTIONS', '章末練習需使用不重複且存在的題目 ID', chapter.id);
    }
  }

  // 檢查是否有章節完全沒有題目
  for (const [cid, qCount] of chapterQuestionCounter.entries()) {
    if (qCount === 0) {
      report.addWarning('NO_QUESTIONS_IN_CHAPTER', `章節 '${cid}' 沒有配置任何題目`, `Chapter ${cid}`);
    }
  }

  return report;
}
