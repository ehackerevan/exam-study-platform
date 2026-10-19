#!/usr/bin/env node
import { runCli } from '../src/cli/index.js';

runCli().then(code => {
  if (code !== 0) {
    process.exit(code);
  }
}).catch(err => {
  console.error('執行過程發生未預期錯誤:', err);
  process.exit(1);
});
