import { sanitizeHtml } from '../utils/sanitize.js';
import { normalizeAnswer } from './csv-parser.js';

/**
 * 解析純文字格式題目 (常見考題文本)
 * 支援格式：
 * 1. 題目描述
 * (A) 選項一
 * (B) 選項二
 * (C) 選項三
 * (D) 選項四
 * 答案：A
 * 解析：這是詳解
 * 
 * @param {string} txtContent
 * @param {string} [defaultChapterId]
 * @returns {Array<object>}
 */
export function parseQuestionsTxt(txtContent, defaultChapterId = 'chapter-01') {
  const blocks = txtContent.split(/\r?\n\s*\r?\n/);
  const questions = [];
  let count = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let questionText = '';
    const options = [];
    let rawAnswer;
    let explanation = '';
    let foundStem = false;

    for (const line of lines) {
      // 答案行
      const ansMatch = line.match(/^(?:答案|ans|answer)[:：\s]+([A-Za-z0-9,]+)/i);
      if (ansMatch) {
        rawAnswer = ansMatch[1].trim();
        continue;
      }

      // 解析行
      const expMatch = line.match(/^(?:解析|詳解|說明|explanation)[:：\s]+(.*)$/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }

      // 選項行：(A) 或 A. 或 A、 或 (1)-(6)
      const optMatch = line.match(/^(?:\(([A-Ga-g1-6])\)|([A-Ga-g])[.、\s])\s*(.+)$/);
      if (optMatch) {
        options.push(sanitizeHtml(optMatch[3].trim()));
        continue;
      }

      // 題幹
      if (!foundStem) {
        const cleanStem = line.replace(/^[0-9]+[.、\s]+/, '');
        questionText = cleanStem;
        foundStem = true;
      } else {
        // 若在題幹後且還沒進入選項，視為多行題幹
        if (options.length === 0) {
          questionText += '\n' + line;
        } else {
          // 選項後的多餘行若不是答案/解析，則追加至詳解
          explanation += (explanation ? '\n' : '') + line;
        }
      }
    }

    if (questionText && options.length >= 2) {
      count++;
      const id = `q${String(count).padStart(3, '0')}`;
      const type = 'single-choice';
      const answer = normalizeAnswer(rawAnswer, type, options);

      questions.push({
        id,
        chapterId: defaultChapterId,
        sectionId: '',
        type,
        question: sanitizeHtml(questionText),
        options,
        answer,
        explanation: sanitizeHtml(explanation)
      });
    }
  }

  return questions;
}
