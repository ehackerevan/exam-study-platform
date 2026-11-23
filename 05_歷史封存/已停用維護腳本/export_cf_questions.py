# 歷史工具：禁止載入或執行，以免覆寫已核對的 canonical 題庫。
raise SystemExit("歷史腳本已停用；請使用 npm run build:ui，以教材/ 的 canonical 題庫建置。")

# -*- coding: utf-8 -*-
import sys
import json
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

html_path = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\考古題\歷屆考古題_完整題庫大全.html")
content = html_path.read_text(encoding='utf-8')
m = re.search(r'const\s+RAW_QUESTIONS\s*=\s*(\[.*?\]);', content, re.DOTALL)
all_data = json.loads(m.group(1))

cf_qs = [q for q in all_data if q.get("category") == "消費金融"]
print(f"萃取消費金融題目數: {len(cf_qs)} 題")

def classify_chapter(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["稽核", "內控", "內部控制", "coso", "自行查核", "三道防線", "總稽核"]):
        return "cf01"
    elif any(k in t for k in ["授信", "徵信", "擔保", "抵押", "鑑價", "dbr", "5p", "月收入", "借款人"]):
        return "cf02"
    elif any(k in t for k in ["信用卡", "循環信用", "最低應繳", "附卡", "學生卡", "盜刷", "掛失", "評議"]):
        return "cf03"
    elif any(k in t for k in ["催收", "逾期", "呆帳", "轉銷", "個資", "個人資料", "受託機構"]):
        return "cf04"
    else:
        return "cf05"

pack_questions = []
seen_ids = set()
seen_texts = set()

for idx, q in enumerate(cf_qs):
    ans_int = int(q["answer"]) - 1
    subj = q.get('subject', '消金')
    full_stem = f"【第 {q['period']} 屆 {subj} 第 {q['number']} 題】" + q["text"]

    # 簡單題幹去重
    if full_stem in seen_texts:
        continue
    seen_texts.add(full_stem)

    base_id = f"cf-{q['period']}-{subj}-{q['number']}"
    qid = base_id
    if qid in seen_ids:
        qid = f"{base_id}-{idx}"
    seen_ids.add(qid)

    ch_id = classify_chapter(full_stem)

    pack_questions.append({
        "id": qid,
        "chapterId": ch_id,
        "type": "single-choice",
        "question": full_stem,
        "options": q["options"],
        "answer": ans_int,
        "explanation": f"原始題庫答案表所列為第 ({q['answer']}) 項：{q['options'][ans_int] if ans_int < len(q['options']) else ''}。"
    })

out_dir = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\教材\消費金融內部控制與稽核重點教材")

with open(out_dir / "questions.json", "w", encoding="utf-8") as f:
    json.dump({"questions": pack_questions}, f, ensure_ascii=False, indent=2)

pack_meta = {
    "id": "consumer-finance-exam-pack",
    "title": "消費金融內部控制與稽核：重點教材跟歷屆考題",
    "description": "涵蓋銀行內控、個人授信、信用卡、逾期催收與個資保護等主題。收錄歷屆試題供練習，答案與適用規定依原考期及官方來源核對。",
    "language": "zh-TW",
    "contentVersion": "2026.10.1"
}
with open(out_dir / "pack.json", "w", encoding="utf-8") as f:
    json.dump(pack_meta, f, ensure_ascii=False, indent=2)

print(f"成功導出消費金融去重後 questions.json ({len(pack_questions)} 題) 與 pack.json！")
