import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const retired = ['add_frontmatter_fintech.py', 'audit_and_clean_exam_bank.py',
  'export_aml_questions.py', 'export_cf_questions.py', 'export_esg_questions.py',
  'export_fintech_questions.py', 'parse_and_build_all_exams.py', 'robust_exam_parser.py',
  'verify_cleaned_exam_bank.py'];

test('Retired maintenance tools refuse execution from another directory before reading or writing data', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'study-retired-'));
  const banks = ['防制洗錢與打擊資恐重點教材', '永續發展基礎能力重點教材'].map(name => path.join(root, '教材', name, 'questions.json'));
  const before = banks.map(file => fs.readFileSync(file));
  try {
    for (const file of retired) {
      assert(!fs.existsSync(path.join(root, 'scripts', file)), `${file} is not an active tool`);
      const result = spawnSync('python', [path.join(root, '歷史資料', '已停用維護腳本', file)], {cwd, encoding:'utf8', env:{...process.env, PYTHONIOENCODING:'utf-8'}});
      assert.ifError(result.error);
      assert.notEqual(result.status, 0, file);
      assert.match(result.stderr, /歷史腳本已停用/, file);
    }
    assert.deepEqual(fs.readdirSync(cwd), []);
    banks.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), before[index]));
  } finally {
    fs.rmdirSync(cwd);
  }
});

test('Frequency analyzer resolves its own project root when loaded from a notebook directory', () => {
  const result = spawnSync('python', ['-c', 'import runpy, sys; print(runpy.run_path(sys.argv[1])["ROOT"])', path.join(root, 'scripts', 'analyze_exam_frequency.py')], {cwd:path.join(root, 'tasks'), encoding:'utf8', env:{...process.env, PYTHONIOENCODING:'utf-8'}});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(path.resolve(result.stdout.trim()), root);
});
