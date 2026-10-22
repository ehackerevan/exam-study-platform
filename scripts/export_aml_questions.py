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

aml_qs = [q for q in all_data if q.get("category") == "防制洗錢"]
print(f"萃取防制洗錢題目數: {len(aml_qs)} 題 (含單選與複選)")

def classify_chapter(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["處置", "多層化", "整合", "前置犯罪", "特定犯罪", "自洗錢"]):
        return "aml01"
    elif any(k in t for k in ["cdd", "實質受益人", "25%", "pep", "重要政治", "身分", "edd"]):
        return "aml02"
    elif any(k in t for k in ["ctr", "str", "50萬", "通貨", "可疑", "調查局", "洩密", "5年"]):
        return "aml03"
    elif any(k in t for k in ["資恐", "恐怖", "制裁", "tfs", "凍結", "安理會"]):
        return "aml04"
    else:
        return "aml05"

pack_questions = []
seen_ids = set()
seen_texts = set()

for idx, q in enumerate(aml_qs):
    period = q.get('period', '107')
    full_stem = f"【場次 {period} 第 {q['number']} 題】" + q["text"]

    if full_stem in seen_texts:
        continue
    seen_texts.add(full_stem)

    base_id = f"aml-{period}-{q['number']}"
    qid = base_id
    if qid in seen_ids:
        qid = f"{base_id}-{idx}"
    seen_ids.add(qid)

    ch_id = classify_chapter(full_stem)
    is_multi = q.get('type') == 'multiple-choice' or (',' in str(q.get('answer', '')))

    if is_multi:
        ans_parts = [int(p.strip()) - 1 for p in str(q['answer']).split(',') if p.strip().isdigit()]
        ans_parts = sorted(list(set(ans_parts)))
        letters = ['A', 'B', 'C', 'D']
        opt_labels = [f"({i+1})" for i in ans_parts]
        pack_questions.append({
            "id": qid,
            "chapterId": ch_id,
            "type": "multiple-choice",
            "question": full_stem,
            "options": q["options"],
            "answer": ans_parts,
            "explanation": f"原始答案表所列複選答案為第 {'、'.join(opt_labels)} 項。"
        })
    else:
        ans_int = int(q["answer"]) - 1
        pack_questions.append({
            "id": qid,
            "chapterId": ch_id,
            "type": "single-choice",
            "question": full_stem,
            "options": q["options"],
            "answer": ans_int,
            "explanation": f"原始答案表所列為第 ({q['answer']}) 項：{q['options'][ans_int] if ans_int < len(q['options']) else ''}。"
        })

out_dir = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\教材\防制洗錢與打擊資恐重點教材")

with open(out_dir / "questions.json", "w", encoding="utf-8") as f:
    json.dump({"questions": pack_questions}, f, ensure_ascii=False, indent=2)

pack_meta = {
    "id": "aml-cft-exam-pack",
    "title": "防制洗錢與打擊資恐：重點教材跟歷屆考題",
    "description": f"涵蓋洗錢防制、客戶審查、大額通貨與疑似洗錢交易申報、資恐防制及金融制裁等主題。收錄歷屆試題供練習，答案與適用規定依原考期及官方來源核對。",
    "language": "zh-TW",
    "contentVersion": "2026.10.1"
}
with open(out_dir / "pack.json", "w", encoding="utf-8") as f:
    json.dump(pack_meta, f, ensure_ascii=False, indent=2)

print(f"成功導出防制洗錢 questions.json ({len(pack_questions)} 題，含複選題) 與 pack.json！")
