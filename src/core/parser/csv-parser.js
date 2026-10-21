import { sanitizeHtml } from '../utils/sanitize.js';

/**
 * 健壯的 RFC 4180 CSV 解析器，支援逗號、雙引號、換行
 * @param {string} csvText
 * @returns {Array<Array<string>>}
 */
export function parseCsvRows(csvText) {
  csvText = csvText.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // 跳過下一個轉義引號
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (inQuotes) throw new Error('CSV 引號未閉合，請確認來源檔案完整。');
  currentRow.push(currentVal.trim());
  if (currentRow.some(c => c.length > 0)) rows.push(currentRow);

  return rows;
}

/**
 * 將答案標識符（例如 'A', '1', 'True', 'A,B'）轉為 0-based 數字或數字陣列
 * @param {string} rawAnswer
 * @param {string} type
 * @param {Array<string>} options
 * @returns {number|Array<number>}
 */
export function normalizeAnswer(rawAnswer, type = 'single-choice', options = []) {
  if (rawAnswer === null || rawAnswer === undefined) return undefined;
  const str = String(rawAnswer).trim().toUpperCase();
  if (!str) return undefined;
  if (type === 'true-false') {
    if (['O', 'T', 'TRUE', 'YES', '是', '對', '1'].includes(str)) return 0;
    if (['X', 'F', 'FALSE', 'NO', '否', '錯', '2', '0'].includes(str)) return 1;
  }
  const index = token => /^[A-Z]$/.test(token) ? token.charCodeAt(0) - 65
    : /^\d+$/.test(token) ? Math.max(0, Number(token) - 1) : undefined;
  if (type === 'multiple-choice') {
    let tokens = str.split(/[,，、\s;/]+/).filter(Boolean);
    if (tokens.length === 1 && /^[A-Z]{2,}$/.test(tokens[0])) tokens = tokens[0].split('');
    const indexes = tokens.map(index);
    return indexes.some(i => i === undefined) ? undefined : [...new Set(indexes)].sort((a, b) => a - b);
  }
  const value = index(str);
  if (value !== undefined) return value;
  const match = options.findIndex(o => typeof o === 'string' && o.trim().toUpperCase() === str);
  return match === -1 ? undefined : match;
}

/**
 * 解析題庫 CSV 為 Question 物件清單
 * @param {string} csvContent
 * @param {object} [defaultChapterMapping] 例如 { "第一章": "chapter-01" }
 * @returns {Array<object>}
 */
export function parseQuestionsCsv(csvContent, defaultChapterMapping = {}) {
  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const headerMap = {};
  headers.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  // 尋找欄位索引
  function getCol(aliases) {
    for (const a of aliases) {
      if (headerMap[a] !== undefined) return headerMap[a];
    }
    return -1;
  }

  const idCol = getCol(['id', 'qid', '題號', '題目代號']);
  const chapCol = getCol(['chapter', 'chapterid', 'chapter_id', '章節', '章節代碼']);
  const secCol = getCol(['section', 'sectionid', 'section_id', '小節', '單元']);
  const typeCol = getCol(['type', 'qtype', '題型']);
  const qCol = getCol(['question', 'title', 'stem', '題目', '題幹']);
  const ansCol = getCol(['answer', 'ans', '正確答案', '答案']);
  const expCol = getCol(['explanation', 'explain', 'analysis', '解析', '詳解']);

  // 動態尋找選項欄位
  const optionCols = [];
  const optLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (const letter of optLetters) {
    const col = getCol([`option_${letter}`, `option${letter}`, `opt_${letter}`, `opt${letter}`, `選項${letter}`, `選項_${letter}`, letter]);
    if (col !== -1) {
      optionCols.push({ key: letter, col });
    }
  }
  // 檢查 option_1, option_2...
  if (optionCols.length === 0) {
    for (let i = 1; i <= 6; i++) {
      const col = getCol([`option_${i}`, `option${i}`, `選項${i}`, `${i}`]);
      if (col !== -1) {
        optionCols.push({ key: String(i), col });
      }
    }
  }

  const questions = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || !row.some(c => c.trim().length > 0)) continue;

    const id = idCol !== -1 && row[idCol] ? row[idCol].trim() : `q${String(r).padStart(3, '0')}`;
    const rawChapter = chapCol !== -1 && row[chapCol] ? row[chapCol].trim() : 'chapter-01';
    const chapterId = defaultChapterMapping[rawChapter] || rawChapter;
    const rawSection = secCol !== -1 && row[secCol] ? row[secCol].trim() : '';
    const rawType = typeCol !== -1 && row[typeCol] ? row[typeCol].trim().toLowerCase() : 'single-choice';
    const questionText = qCol !== -1 && row[qCol] ? row[qCol].trim() : '';
    const rawAnswer = ansCol !== -1 ? row[ansCol] : undefined;
    const explanation = expCol !== -1 && row[expCol] ? row[expCol].trim() : '';

    // 處理題型
    let type = ['single', 'single-choice', '單選', '單選題'].includes(rawType) ? 'single-choice' : rawType;
    if (rawType.includes('true') || rawType.includes('false') || rawType.includes('是') || rawType.includes('非')) {
      type = 'true-false';
    } else if (rawType.includes('multi') || rawType.includes('複選') || rawType.includes('多選')) {
      type = 'multiple-choice';
    }

    // 擷取選項
    let options = [];
    if (optionCols.length > 0) {
      for (const { col } of optionCols) {
        options.push(sanitizeHtml((row[col] || '').trim()));
      }
    }

    // 只移除尾端空欄；保留中間空欄，避免移動答案索引。
    while (options.length && !options.at(-1)) options.pop();

    // 是非題若無選項，自動補上標準選項
    if (type === 'true-false' && options.length === 0) {
      options = ['正確 (O)', '錯誤 (X)'];
    }

    const answer = normalizeAnswer(rawAnswer, type, options);

    questions.push({
      id,
      chapterId,
      sectionId: rawSection,
      type,
      question: sanitizeHtml(questionText),
      options,
      answer,
      explanation: sanitizeHtml(explanation)
    });
  }

  return questions;
}
