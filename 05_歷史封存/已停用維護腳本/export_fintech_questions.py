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

ft_qs = [q for q in all_data if q.get("category") == "金融科技力"]
print(f"萃取金融科技力題目數: {len(ft_qs)} 題")

def classify_chapter(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["區塊鏈", "以太", "比特幣", "共識", "分散式帳本", "公鑰", "私鑰", "雜湊", "hash", "默克爾", "pow", "pos", "dpos", "sto", "智慧合約", "智能合約"]):
        return "c03"
    elif any(k in t for k in ["純網銀", "開放銀行", "open banking", "api", "tsp", "樂天", "連線", "將來商業", "第三方服務"]):
        return "c04"
    elif any(k in t for k in ["雲端", "iaas", "paas", "saas", "大數據", "5v", "人工智慧", "ai", "機器學習", "深度學習", "理財機器人", "robo", "再平衡", "半結構化", "非結構化", "結構化"]):
        return "c02"
    elif any(k in t for k in ["支付", "第三方支付", "電子支付", "儲值", "身分認證", "fido", "生物辨識", "零信任", "資安", "f-isac", "f-cert", "密碼", "otp", "指紋", "人臉"]):
        return "c05"
    elif any(k in t for k in ["沙盒", "創新實驗", "regtech", "suptech", "監理科技", "法遵科技", "審查天數"]):
        return "c06"
    elif any(k in t for k in ["轉型", "鯰魚", "fintech 1.0", "fintech 2.0", "fintech 3.0", "長尾", "普惠"]):
        return "c01"
    else:
        return "c07"

pack_questions = []
for q in ft_qs:
    ans_int = int(q["answer"]) - 1  # 0-based
    full_stem = f"【第 {q['period']} 屆第 {q['number']} 題】" + q["text"]
    ch_id = classify_chapter(full_stem)

    pack_questions.append({
        "id": f"ft-{q['period']}-{q['number']}",
        "chapterId": ch_id,
        "type": "single-choice",
        "question": full_stem,
        "options": q["options"],
        "answer": ans_int,
        "explanation": f"原始題庫答案表所列為第 ({q['answer']}) 項：{q['options'][ans_int] if ans_int < len(q['options']) else ''}。"
    })

out_dir = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\教材\金融科技力重點教材")

# 以物件包裝 questions，避免觸發純陣列的自動空白章節注入
with open(out_dir / "questions.json", "w", encoding="utf-8") as f:
    json.dump({"questions": pack_questions}, f, ensure_ascii=False, indent=2)

pack_meta = {
    "id": "fintech-exam-pack",
    "title": "金融科技力：重點教材跟歷屆考題",
    "description": "涵蓋金融科技發展、雲端大數據AI、區塊鏈虛擬資產、純網銀開放銀行、支付資安與監理沙盒法規等主題。收錄歷屆試題供練習，答案與適用規定依原考期及官方來源核對。",
    "language": "zh-TW",
    "contentVersion": "2026.10.1"
}
with open(out_dir / "pack.json", "w", encoding="utf-8") as f:
    json.dump(pack_meta, f, ensure_ascii=False, indent=2)

print(f"成功導出封裝為物件之 questions.json ({len(pack_questions)} 題) 與 pack.json！")
