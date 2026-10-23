import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStudyPack } from '../validator/index.js';
import {applySharedUi} from './ui-theme.js';
import {findExternalResources} from '../utils/offline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模板檔案路徑
const TEMPLATE_PATH = path.resolve(__dirname, '../../renderer/template.html');
const STYLES_PATH = path.resolve(__dirname, '../../renderer/styles.css');
const APP_JS_PATH = path.resolve(__dirname, '../../renderer/app.js');

const MAX_RECOMMENDED_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function escapeHtmlTitle(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 編譯 Study Pack 資料為完全獨立、零外部依賴的單一 HTML 檔案字串
 * @param {object} studyPack 符合 Schema 的學習包物件
 * @param {object} [options]
 * @param {boolean} [options.skipValidation=false] 是否略過前置驗證 (預設 false)
 * @returns {{ html: string, sizeBytes: number, chaptersCount: number, questionsCount: number, warnings: Array<string> }}
 */
export function compileStudyPackToHtml(studyPack, options = {}) {
  const warnings = [];

  // 1. 執行驗證
  if (!options.skipValidation) {
    const report = validateStudyPack(studyPack);
    if (!report.isValid) {
      const errorMsgs = report.issues
        .filter(i => i.level === 'ERROR')
        .map(i => `[${i.code}] ${i.message}`)
        .join('; ');
      throw new Error(`無法編譯 Study Pack，資料驗證未通過: ${errorMsgs}`);
    }
    // 收集現存警告
    for (const w of report.issues.filter(i => i.level === 'WARNING')) {
      warnings.push(`(${w.code}) ${w.message}`);
    }
  }

  // 2. 讀取模板、樣式與腳本
  const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const stylesCss = fs.readFileSync(STYLES_PATH, 'utf-8')+'\n'+fs.readFileSync(path.resolve(__dirname,'../../renderer/teaching.css'),'utf8');
  const typography = fs.readFileSync(path.resolve(__dirname,'../../../設計預覽/text-format.mjs'),'utf8').split('export function conciseText')[0].replace('export function readableText','function readableText');
  const appJs = '(function(){'+typography+';window.StudyTypography={readableText};})();\n'+ ['../../renderer/vendor/marked.umd.js', '../../renderer/content.js', '../../renderer/app.js']
    .map(file => fs.readFileSync(path.resolve(__dirname, file), 'utf-8')).join('\n');

  // 3. 安全序列化 Study Pack JSON 資料
  // 避免教材文字改變 HTML script 解析狀態，JSON 還原後仍保留原文。
  const { questions = [], ...packData } = studyPack;
  const serializedData = JSON.stringify({
    ...packData,
    questions: questions.map(({ explanation, ...question }) => question)
  }).replace(/</g, '\\u003c');

  // 4. 合併替換
  let finalHtml = templateHtml
    .replace('<title>Study Pack</title>', () => `<title>${escapeHtmlTitle(studyPack.title || 'Study Pack')}</title>`)
    .replace('/* __INLINE_CSS__ */', () => stylesCss)
    .replace('/* __INLINE_JS__ */', () => appJs)
    .replace('/* __STUDY_PACK_DATA__ */', () => serializedData);

  finalHtml = applySharedUi(finalHtml);
  // 5. 離線完整性驗證：確認無外部資源載入
  const externalResources = findExternalResources(finalHtml);
  if (externalResources.length) {
    throw new Error(`編譯結果違反零外部依賴規範，偵測到外部引用: ${externalResources.join(', ')}`);
  }

  const sizeBytes = Buffer.byteLength(finalHtml, 'utf-8');

  // 大於 20MB 發出警告
  if (sizeBytes > MAX_RECOMMENDED_SIZE_BYTES) {
    warnings.push(`最終 HTML 檔案大小為 ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB，超過建議的 20 MB 門檻`);
  }

  return {
    html: finalHtml,
    sizeBytes,
    chaptersCount: Array.isArray(studyPack.chapters) ? studyPack.chapters.length : 0,
    questionsCount: Array.isArray(studyPack.questions) ? studyPack.questions.length : 0,
    warnings
  };
}

/**
 * 編譯並直接寫入指定檔案路徑
 * @param {object} studyPack
 * @param {string} outputPath
 * @param {object} [options]
 * @returns {{ outputPath: string, sizeBytes: number, chaptersCount: number, questionsCount: number, warnings: Array<string> }}
 */
export function compileAndWriteToFile(studyPack, outputPath, options = {}) {
  const result = compileStudyPackToHtml(studyPack, options);
  const resolvedOut = path.resolve(outputPath);
  const dir = path.dirname(resolvedOut);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolvedOut, result.html, 'utf-8');
  return {
    outputPath: resolvedOut,
    ...result
  };
}
