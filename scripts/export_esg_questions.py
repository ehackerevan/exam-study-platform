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

esg_qs = [q for q in all_data if q.get("category") == "永續發展"]
print(f"萃取永續發展題目數: {len(esg_qs)} 題")

def classify_chapter(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["巴黎", "京都", "淨零", "氣候變遷因應法", "環境部", "1.5", "sdgs", "國發會"]):
        return "esg01"
    elif any(k in t for k in ["範疇", "scope", "溫室氣體", "盤查", "碳定價", "碳稅", "碳費", "cbam", "六氟化硫", "二氧化碳"]):
        return "esg02"
    elif any(k in t for k in ["綠色債券", "社會責任債券", "可持續", "slb", "赤道原則", "pri", "prb", "psi", "專案融資"]):
        return "esg03"
    elif any(k in t for k in ["tcfd", "issb", "ifrs", "gri", "sasb", "漂綠", "greenwashing", "永續報告書"]):
        return "esg04"
    else:
        return "esg05"

pack_questions = []
seen_ids = set()
seen_texts = set()

for idx, q in enumerate(esg_qs):
    ans_int = int(q["answer"]) - 1
    period = q.get('period', '113')
    full_stem = f"【場次 {period} 第 {q['number']} 題】" + q["text"]

    if full_stem in seen_texts:
        continue
    seen_texts.add(full_stem)

    base_id = f"esg-{period}-{q['number']}"
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

out_dir = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\教材\永續發展基礎能力重點教材")

with open(out_dir / "questions.json", "w", encoding="utf-8") as f:
    json.dump({"questions": pack_questions}, f, ensure_ascii=False, indent=2)

pack_meta = {
    "id": "esg-sustainability-pack",
    "title": "永續發展基礎能力：重點教材跟歷屆考題",
    "description": f"涵蓋巴黎協定、溫室氣體盤查、碳定價、綠色金融、永續揭露準則與反漂綠等主題。收錄歷屆試題供練習，答案與適用規定依原考期及官方來源核對。",
    "language": "zh-TW",
    "contentVersion": "2026.10.1"
}
with open(out_dir / "pack.json", "w", encoding="utf-8") as f:
    json.dump(pack_meta, f, ensure_ascii=False, indent=2)

print(f"成功導出永續發展 questions.json ({len(pack_questions)} 題) 與 pack.json！")
