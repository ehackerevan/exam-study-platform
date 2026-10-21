import {readUtf8File} from '../core/utils/utf8.js';
import fs from 'node:fs';
import path from 'node:path';
import { buildNormalizedStudyPack } from '../core/parser/index.js';
import { validateStudyPack } from '../core/validator/index.js';
import { compileAndWriteToFile } from '../core/compiler/index.js';

/**
 * 掃描目錄載入所有支援的來源檔案
 * @param {string} sourceDir
 */
export function loadSourcesFromDirectory(sourceDir) {
  const dir = path.resolve(sourceDir);
  if (!fs.existsSync(dir)) {
    throw new Error(`找不到指定的來源目錄: ${dir}`);
  }

  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    // 若傳入的是單一檔案 (例如 study-pack.json)
    if (dir.toLowerCase().endsWith('.json')) {
      const jsonContent = readUtf8File(dir);
      return { jsons: [jsonContent] };
    }
    throw new Error(`路徑必須為目錄或 .json 檔案: ${dir}`);
  }

  const markdowns = [];
  const csvQuestions = [];
  const txtQuestions = [];
  const jsons = [];
  let meta = {};

  // 遞迴讀取目錄
  function walk(currentDir) {
    const files = fs.readdirSync(currentDir).sort();
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      if (fs.lstatSync(fullPath).isSymbolicLink()) continue;
      const s = fs.statSync(fullPath);
      if (s.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(file).toLowerCase();
        const base = path.basename(file).toLowerCase();

        if (base === 'pack.json' || base === 'study-pack.json' || base === 'metadata.json') {
          try {
            const raw = readUtf8File(fullPath);
            const parsed = JSON.parse(raw);
            meta = { ...meta, ...parsed };
            jsons.push(raw);
          } catch (e) {
            throw new Error(`無法讀取中繼資料 ${fullPath}: ${e.message}`);
          }
        } else if (ext === '.json') {
          jsons.push(readUtf8File(fullPath));
        } else if (ext === '.md' || ext === '.markdown') {
          markdowns.push(readUtf8File(fullPath));
        } else if (ext === '.csv') {
          csvQuestions.push(readUtf8File(fullPath));
        } else if (ext === '.txt') {
          txtQuestions.push(readUtf8File(fullPath));
        }
      }
    }
  }

  walk(dir);

  return { meta, markdowns, csvQuestions, txtQuestions, jsons };
}

/**
 * CLI 命令處理器
 * @param {Array<string>} args
 */
export async function runCli(args = process.argv.slice(2)) {
  const command = args[0];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return 0;
  }

  if (command === '--version' || command === '-v') {
    console.log('study-pack version 1.0.0');
    return 0;
  }

  if (command === 'validate') {
    const sourcePath = args[1] || '.';
    return handleValidate(sourcePath);
  }

  if (command === 'build') {
    const sourcePath = args[1] || '.';
    let outputPath = path.join(process.cwd(), 'dist/study.html');
    const oIdx = args.findIndex(a => a === '-o' || a === '--output');
    if (oIdx !== -1 && args[oIdx + 1]) {
      outputPath = args[oIdx + 1];
    } else if (args[2] && !args[2].startsWith('-')) {
      outputPath = args[2];
    }
    return handleBuild(sourcePath, outputPath);
  }

  console.error(`未知指令: ${command}`);
  printHelp();
  return 1;
}

function handleValidate(sourcePath) {
  try {
    const sources = loadSourcesFromDirectory(sourcePath);
    const pack = buildNormalizedStudyPack(sources);
    const report = validateStudyPack(pack);

    console.log(report.toString());
    return report.isValid ? 0 : 1;
  } catch (err) {
    console.error(`驗證錯誤: ${err.message}`);
    return 1;
  }
}

function handleBuild(sourcePath, outputPath) {
  try {
    const sources = loadSourcesFromDirectory(sourcePath);
    const pack = buildNormalizedStudyPack(sources);
    const report = validateStudyPack(pack);

    if (!report.isValid) {
      console.error(report.toString());
      console.error('\n[編譯失敗] 存在嚴重錯誤 (ERROR)，已禁止編譯。');
      return 1;
    }

    if (report.warningCount > 0) {
      console.warn(`[編譯提示] 發現 ${report.warningCount} 個品質警告 (WARNING)`);
    }

    const result = compileAndWriteToFile(pack, outputPath);
    const sizeMb = (result.sizeBytes / (1024 * 1024)).toFixed(2);
    const sizeKb = (result.sizeBytes / 1024).toFixed(1);
    const sizeDisplay = result.sizeBytes > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

    console.log(`\n========================================`);
    console.log(`✓ 編譯成功！Single HTML 已輸出至:`);
    console.log(`  ${result.outputPath}`);
    console.log(`檔案大小: ${sizeDisplay} (${result.sizeBytes} bytes)`);
    console.log(`章節數量: ${result.chaptersCount} Chapters`);
    console.log(`題目數量: ${result.questionsCount} Questions`);
    console.log(`========================================\n`);

    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.warn(`! ${w}`));
    }

    return 0;
  } catch (err) {
    console.error(`[編譯異常]: ${err.message}`);
    return 1;
  }
}

function printHelp() {
  console.log(`
Study Pack Compiler - 學習網站產生器 CLI

用法 (Usage):
  study-pack build <來源目錄或檔案> [輸出路徑]   編譯並產出單一離線 HTML 學習網站
  study-pack validate <來源目錄或檔案>           驗證來源資料合約與內容品質

範例 (Examples):
  study-pack build ./examples/general-exam ./dist/general-exam.html
  study-pack validate ./examples/language-learning
  study-pack build ./my-pack.json

選項 (Options):
  -h, --help      顯示本說明訊息
  -v, --version   顯示版本號
`);
}
