import { sanitizeHtml, slugify } from '../utils/sanitize.js';

/**
 * 解析 Frontmatter (支援簡單的 --- key: value --- 格式)
 * @param {string} mdContent
 * @returns {{ data: Record<string, string>, content: string }}
 */
export function parseFrontmatter(mdContent) {
  const match = mdContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: mdContent };
  }

  const rawMeta = match[1];
  const content = match[2];
  const data = {};

  for (const line of rawMeta.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      data[key] = val;
    }
  }

  return { data, content };
}

/**
 * 解析 Markdown 語法為章節與小節結構
 * 規格：
 * # Chapter Title -> Chapter
 * ## Section Title -> Section
 * ### 重點 / Key Points -> keyPoints 清單
 * ### 備註 / Notes -> notes 清單
 * 其他段落 -> content
 * 
 * @param {string} rawMarkdown
 * @param {object} [options]
 * @returns {{ chapters: Array<object>, metadata: object }}
 */
export function parseMarkdownToChapters(rawMarkdown, options = {}) {
  const { data: frontmatter, content } = parseFrontmatter(rawMarkdown);
  const lines = content.split(/\r?\n/);

  const chapters = [];
  let currentChapter = null;
  let currentSection = null;
  let activeSublist = null; // 'keyPoints' | 'notes' | null
  let chapterIndex = 0;
  let sectionIndex = 0;

  function ensureChapter(title = '第一章') {
    if (!currentChapter) {
      chapterIndex++;
      const id = options.defaultChapterId || `chapter-${String(chapterIndex).padStart(2, '0')}`;
      currentChapter = {
        id,
        title,
        summary: '',
        sections: []
      };
      chapters.push(currentChapter);
    }
    return currentChapter;
  }

  function ensureSection(title = '概述') {
    ensureChapter();
    if (!currentSection) {
      sectionIndex++;
      const id = `${currentChapter.id}-sec-${String(sectionIndex).padStart(2, '0')}`;
      currentSection = {
        id,
        title,
        content: '',
        keyPoints: [],
        notes: []
      };
      currentChapter.sections.push(currentSection);
    }
    return currentSection;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // H1 -> Chapter
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      chapterIndex++;
      sectionIndex = 0;
      activeSublist = null;
      const rawTitle = h1Match[1].trim();
      const id = frontmatter.id || frontmatter.chapterId || slugify(rawTitle, `chapter-${String(chapterIndex).padStart(2, '0')}`);
      currentChapter = {
        id,
        title: rawTitle,
        summary: '',
        sections: []
      };
      chapters.push(currentChapter);
      currentSection = null;
      continue;
    }

    // H2 -> Section
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      ensureChapter();
      sectionIndex++;
      activeSublist = null;
      const rawTitle = h2Match[1].trim();
      const id = `${currentChapter.id}-${slugify(rawTitle, `sec-${String(sectionIndex).padStart(2, '0')}`)}`;
      currentSection = {
        id,
        title: rawTitle,
        content: '',
        keyPoints: [],
        notes: []
      };
      currentChapter.sections.push(currentSection);
      continue;
    }

    // H3 -> 特殊區塊 (重點 / 備註) 或 小標題
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      ensureSection();
      const heading = h3Match[1].trim().toLowerCase();
      if (heading.includes('重點') || heading.includes('key point') || heading.includes('核心')) {
        activeSublist = 'keyPoints';
      } else if (heading.includes('備註') || heading.includes('note') || heading.includes('補充')) {
        activeSublist = 'notes';
      } else {
        activeSublist = null;
        currentSection.content += (currentSection.content ? '\n\n' : '') + `### ${h3Match[1].trim()}`;
      }
      continue;
    }

    // 清單項目 - 或 *
    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      ensureSection();
      const itemText = listMatch[1].trim();
      if (activeSublist === 'keyPoints') {
        currentSection.keyPoints.push(itemText);
      } else if (activeSublist === 'notes') {
        currentSection.notes.push(itemText);
      } else {
        // 一般清單項目加入 content
        currentSection.content += (currentSection.content ? '\n' : '') + `- ${itemText}`;
      }
      continue;
    }

    // 若非清單項目且有文字，若之前在收集子清單，中斷收集
    if (trimmed && activeSublist && !line.startsWith(' ') && !line.startsWith('\t')) {
      activeSublist = null;
    }

    // 一般內容段落
    if (trimmed) {
      ensureSection();
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    } else if (currentSection && currentSection.content && !currentSection.content.endsWith('\n\n')) {
      currentSection.content += '\n';
    }
  }

  // 清理 content 結尾多餘空白與進行安全性消毒
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      sec.content = sanitizeHtml(sec.content.trim());
      sec.keyPoints = sec.keyPoints.map(p => sanitizeHtml(p.trim())).filter(Boolean);
      sec.notes = sec.notes.map(n => sanitizeHtml(n.trim())).filter(Boolean);
    }
    if (ch.sections.length > 0 && !ch.summary) {
      // 若未指定章節摘要，預設取第一小節的第一行內容或重點
      const firstSec = ch.sections[0];
      ch.summary = firstSec.keyPoints[0] || firstSec.content.slice(0, 100).replace(/\n/g, ' ') || '';
    }
  }

  return {
    metadata: frontmatter,
    chapters
  };
}
