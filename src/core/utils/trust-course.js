import {readUtf8File} from './utf8.js';
import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdownToChapters } from '../parser/markdown-parser.js';

export function loadTrustCourse(sourceDir) {
  const course = JSON.parse(readUtf8File(path.join(sourceDir, 'course_data.json')));
  const bank = JSON.parse(readUtf8File(path.join(sourceDir, 'full_exam_bank.json')));
  const curated = JSON.parse(readUtf8File(path.join(sourceDir, 'curated_top10_bank.json')));
  const chapters = course.chapters.flatMap((source) => {
    const markdown = source.markdown.replace(/!\[([^\]]*)\]\((images\/[^)]+\.svg)\)/g, (_, alt, relative) => {
      const imagePath = path.resolve(sourceDir, relative);
      if (!imagePath.startsWith(path.resolve(sourceDir) + path.sep)) throw new Error(`信託圖解路徑超出教材目錄: ${relative}`);
      const svg = fs.readFileSync(imagePath);
      return `![${alt}](data:image/svg+xml;base64,${svg.toString('base64')})`;
    });
    const parsed = parseMarkdownToChapters(markdown, { defaultChapterId: source.id }).chapters;
    if (!parsed.length) throw new Error(`信託教材章節沒有可解析內容: ${source.id}`);
    return parsed.map((chapter) => ({ ...chapter, id: source.id, title: source.title }));
  });

  const featured = new Map();
  for (const [group, questions] of Object.entries(curated)) {
    questions.forEach((question, index) => featured.set(`${question.term}|${question.subject}|${question.number}`, { featuredGroup: group, featuredRank: index + 1 }));
  }

  const questions = [...new Map(Object.values(bank).flat().map((question) => [question.id, question])).values()]
    .sort((a, b) => a.chapter.localeCompare(b.chapter, 'en', { numeric: true }) || a.term - b.term || a.subject.localeCompare(b.subject, 'zh-TW') || a.number - b.number)
    .map((question) => {
      if (question.answer !== question.answers?.[0]) throw new Error(`信託題庫答案欄位不一致: ${question.id}`);
      return {
        id: question.id,
        chapterId: question.chapter,
        type: 'single-choice',
        question: question.stem,
        options: question.options,
        answer: question.answer,
        sourceExam: { term: `第 ${question.term} 屆`, subject: question.subject, number: question.number },
        ...(featured.get(`${question.term}|${question.subject}|${question.number}`) || {})
      };
    });

  return {
    version: 1,
    schemaVersion: 1,
    contentVersion: '2026.10.19',
    id: 'trust-exam',
    title: '信託業務人員：重點教材跟歷屆考題',
    description: `收錄 ${questions.length} 題歷屆練習題。`,
    language: 'zh-TW',
    chapters,
    questions
  };
}
