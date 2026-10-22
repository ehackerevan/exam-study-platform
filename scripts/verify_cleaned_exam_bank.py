# -*- coding: utf-8 -*-
"""
自動化驗證產出的歷屆考古題_完整題庫大全.html (支援單選與複選合規驗證)
"""

import sys
import json
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

html_path = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\dist\歷屆考古題_完整題庫大全.html")
if not html_path.exists():
    print("Error: HTML file does not exist!")
    sys.exit(1)

content = html_path.read_text(encoding='utf-8')

# 提取 RAW_QUESTIONS
m = re.search(r'const\s+RAW_QUESTIONS\s*=\s*(\[.*?\]);', content, re.DOTALL)
if not m:
    print("Error: RAW_QUESTIONS not found in HTML!")
    sys.exit(1)

data = json.loads(m.group(1))
print(f"✓ 成功載入 HTML 內嵌資料，總題數: {len(data)} 題")

invalid_answers = []
invalid_options = []
invalid_stems = []
bonus_or_disputed = []
single_count = 0
multi_count = 0

for idx, item in enumerate(data):
    ans = str(item.get("answer", "")).strip()
    opts = item.get("options", [])
    stem = str(item.get("text", "")).strip()
    q_type = item.get("type", "single-choice")
    cat = item.get("category", "")

    # 檢查送分/爭議標記
    if any(k in ans for k in ['*', '#', '送', '給分', '皆', '或', '一律', '作廢']):
        bonus_or_disputed.append((idx, cat, item.get("period"), ans))

    if q_type == "multiple-choice":
        multi_count += 1
        # 複選答案必須為逗號分隔或純數字組合 (1~4)
        parts = [p.strip() for p in ans.split(',') if p.strip()]
        if not parts or any(p not in ['1', '2', '3', '4'] for p in parts):
            invalid_answers.append((idx, cat, item.get("period"), ans))
        for p in parts:
            if int(p) > len(opts):
                invalid_options.append((idx, f"multi ans {p} > opts {len(opts)}"))
    else:
        single_count += 1
        # 單選答案必須是 1, 2, 3, 4
        if ans not in ['1', '2', '3', '4']:
            invalid_answers.append((idx, cat, item.get("period"), ans))
        elif int(ans) > len(opts):
            invalid_options.append((idx, f"ans {ans} > opts {len(opts)}"))

    # 四個非空選項才是完整的選擇題資料。
    if len(opts) != 4 or any(not str(option).strip() for option in opts):
        invalid_options.append((idx, f"選項不完整: {opts}"))

    if not stem:
        invalid_stems.append(idx)

print(f"• 合格單選題數量: {single_count} 題")
print(f"• 合格複選題數量: {multi_count} 題")
print(f"• 非法答案數量: {len(invalid_answers)}")
print(f"• 送分/爭議殘留題目數量: {len(bonus_or_disputed)}")
print(f"• 選項異常或越界數量: {len(invalid_options)}")
print(f"• 空題幹數量: {len(invalid_stems)}")

if len(invalid_answers) == 0 and len(bonus_or_disputed) == 0 and len(invalid_options) == 0 and len(invalid_stems) == 0:
    print(f"\n【驗證通過】所有 {len(data)} 題完全合規！(包含 {single_count} 題單選與 {multi_count} 題複選，無任何送分或單選爭議題殘留！)")
else:
    print("\n【驗證失敗】仍有異常題目存在！")
    sys.exit(1)
