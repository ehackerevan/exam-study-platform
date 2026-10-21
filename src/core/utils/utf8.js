import fs from 'node:fs';

export function readUtf8File(file) {
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(fs.readFileSync(file));
  } catch (error) {
    throw new Error(`無法以 UTF-8 讀取 ${file}: ${error.message}`, {cause: error});
  }
}
