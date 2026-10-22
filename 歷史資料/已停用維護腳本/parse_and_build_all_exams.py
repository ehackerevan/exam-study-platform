# 歷史工具：禁止載入或執行，以免覆寫已核對的 canonical 題庫。
raise SystemExit("歷史腳本已停用；請使用 npm run build:ui，以教材/ 的 canonical 題庫建置。")

# -*- coding: utf-8 -*-
"""
全量解析與建置考古題完整題庫大全 (HTML)
涵蓋四大考試類別：
1. 金融科技力 (8~21 屆)
2. 消費金融 (25~49 屆)
3. 永續發展 (113~115 年)
4. 防制洗錢人員 (107~115 年)
"""

import os
import re
import sys
import json
from pathlib import Path
import pymupdf

sys.stdout.reconfigure(encoding='utf-8')

BASE_EXAM_DIR = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\考古題")
OUTPUT_HTML_PATH = BASE_EXAM_DIR / "歷屆考古題_完整題庫大全.html"

# ==========================================
# 1. 答案萃取器
# ==========================================
def extract_answers_from_pdf(pdf_path: Path) -> dict:
    """從解答 PDF 萃取答案映射 {1: '3', 2: '2', ...} 或 {'科目': {1: '3'}}"""
    if not pdf_path.exists():
        return {}

    doc = pymupdf.open(pdf_path)
    full_text = "\n".join([page.get_text() for page in doc])

    results = {}

    # 檢查是否區分科目 (例如消費金融同時含法規與實務)
    has_law = "法規" in full_text
    has_prac = "實務" in full_text

    if has_law and has_prac:
        # 分割兩個科目
        law_pos = full_text.find("法規")
        prac_pos = full_text.find("實務")
        if law_pos != -1 and prac_pos != -1:
            if law_pos < prac_pos:
                law_text = full_text[law_pos:prac_pos]
                prac_text = full_text[prac_pos:]
            else:
                prac_text = full_text[prac_pos:law_pos]
                law_text = full_text[law_pos:]

            return {
                "法規": _parse_answer_text(law_text),
                "實務": _parse_answer_text(prac_text)
            }

    return _parse_answer_text(full_text)

def _parse_answer_text(text: str) -> dict:
    ans_map = {}

    # 格式 A: 1.【3】 或 1.【B】 或 1.【一】
    p1 = re.compile(r'(\d+)\s*[\.．、]\s*[【\[\(（]?\s*([1-4A-D一二三四#*無全]+|\d)\s*[】\]\)）]?')
    for m in p1.finditer(text):
        q_num = int(m.group(1))
        ans_raw = m.group(2).strip()
        ans_norm = _normalize_ans_char(ans_raw)
        if 1 <= q_num <= 100:
            ans_map[q_num] = ans_norm

    # 格式 B: 垂直交錯 (1 \n A \n 2 \n B) 常見於證基會/保發
    if len(ans_map) < 5:
        tokens = [t.strip() for t in text.split() if t.strip()]
        i = 0
        while i < len(tokens) - 1:
            t1 = tokens[i]
            t2 = tokens[i+1]
            if t1.isdigit() and (t2 in ['1','2','3','4','A','B','C','D','a','b','c','d'] or len(t2) <= 7):
                q = int(t1)
                if 1 <= q <= 100 and q not in ans_map:
                    ans_map[q] = _normalize_ans_char(t2)
                    i += 2
                    continue
            i += 1

    return ans_map

def _normalize_ans_char(raw: str) -> str:
    raw = raw.upper().strip()
    mapping = {'一': '1', '二': '2', '三': '3', '四': '4', 'A': '1', 'B': '2', 'C': '3', 'D': '4'}
    if raw in mapping:
        return mapping[raw]
    return raw

# ==========================================
# 2. 題目萃取器
# ==========================================
def extract_questions_from_pdf(pdf_path: Path) -> list:
    """從試題 PDF 萃取題目清單 [{number: 1, text: '', options: []}]"""
    if not pdf_path.exists():
        return []

    doc = pymupdf.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"

    # 清除頁首頁尾干擾文字
    clean_lines = []
    for line in full_text.splitlines():
        l = line.strip()
        if not l:
            continue
        if any(h in l for h in ['請填應試號碼', '入場通知書編號', '翻面繼續作答', '背面尚有試題', '第 1 頁，共', '第 2 頁，共', '第 3 頁，共', '第 4 頁，共', '第 5 頁，共']):
            continue
        clean_lines.append(l)

    text = "\n".join(clean_lines)

    # 依題號切割
    # 題號通常為：1. 或 1、 或 1 (換行)
    q_splits = re.split(r'\n(?=\d{1,2}\s*[\.．、\s])', text)

    questions = []
    for chunk in q_splits:
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.match(r'^(\d{1,2})\s*[\.．、\s]+(.*)$', chunk, re.DOTALL)
        if not m:
            continue

        q_num = int(m.group(1))
        content = m.group(2).strip()

        # 切割選項 (1)~(4) 或 (A)~(D) 或 ①~④
        # 尋找選項開始位置
        opt_pattern = re.compile(r'(?:\(([1-4A-Da-d])\)|([1-4A-Da-d])[\.．、]|([①②③④]))\s*')
        matches = list(opt_pattern.finditer(content))

        if len(matches) >= 2:
            stem = content[:matches[0].start()].strip()
            # 清除題幹開頭多餘文字
            stem = re.sub(r'^[^\w\u4e00-\u9fa5]+', '', stem)

            options = []
            for idx in range(len(matches)):
                start = matches[idx].end()
                end = matches[idx + 1].start() if idx + 1 < len(matches) else len(content)
                opt_str = content[start:end].strip()
                # 移除換行轉空格
                opt_str = " ".join(opt_str.split())
                options.append(opt_str)

            questions.append({
                "number": q_num,
                "text": " ".join(stem.split()),
                "options": options
            })

    return questions

# ==========================================
# 3. 各大分類批次處理器
# ==========================================

def process_fintech():
    """解析金融科技力 (8~21 屆)"""
    print("\n[1/4] 開始解析：金融科技力知識檢定 (8~21 屆)...")
    dir_path = BASE_EXAM_DIR / "金融科技力(8-21)"
    all_qs = []

    for term_dir in sorted(dir_path.iterdir(), key=lambda p: int(p.name) if p.name.isdigit() else 999):
        if not term_dir.is_dir(): continue
        term = term_dir.name
        q_file = None
        a_file = None
        for f in term_dir.glob("*.pdf"):
            if f.stem.endswith("-1"): q_file = f
            elif f.stem.endswith("-2"): a_file = f

        if q_file and a_file:
            ans_map = extract_answers_from_pdf(a_file)
            qs = extract_questions_from_pdf(q_file)
            for q in qs:
                ans = ans_map.get(q["number"], "")
                all_qs.append({
                    "category": "金融科技力",
                    "period": term,
                    "subject": "金融科技力",
                    "number": q["number"],
                    "text": q["text"],
                    "options": q["options"],
                    "answer": ans,
                    "note": ""
                })
            print(f"  - 第 {term} 屆: 解析 {len(qs)} 題 (答案命中: {sum(1 for q in qs if q['number'] in ans_map)}/{len(qs)})")

    return all_qs

def process_consumer_finance():
    """解析消費金融 (25~49 屆)"""
    print("\n[2/4] 開始解析：消費金融內部控制與內部稽核 (25~49 屆)...")
    dir_path = BASE_EXAM_DIR / "消費金融"
    all_qs = []

    for term_dir in sorted(dir_path.iterdir(), key=lambda p: int(p.name) if p.name.isdigit() else 999):
        if not term_dir.is_dir(): continue
        term = term_dir.name

        # 區分 25~34 屆 與 35~49 屆
        law_q = None
        prac_q = None
        ans_pdf = None

        for f in term_dir.glob("*.pdf"):
            if "法規" in f.name: law_q = f
            elif "實務" in f.name: prac_q = f
            elif f.name == f"{term}.pdf": ans_pdf = f
            elif f.stem.endswith("-1"): law_q = f
            elif f.stem.endswith("-2"): prac_q = f
            elif f.stem.endswith("-3"): ans_pdf = f

        if ans_pdf:
            ans_data = extract_answers_from_pdf(ans_pdf)
            law_ans = ans_data.get("法規", ans_data) if isinstance(ans_data, dict) and "法規" in ans_data else ans_data
            prac_ans = ans_data.get("實務", ans_data) if isinstance(ans_data, dict) and "實務" in ans_data else ans_data

            if law_q:
                l_qs = extract_questions_from_pdf(law_q)
                for q in l_qs:
                    all_qs.append({
                        "category": "消費金融",
                        "period": term,
                        "subject": "法規",
                        "number": q["number"],
                        "text": q["text"],
                        "options": q["options"],
                        "answer": law_ans.get(q["number"], ""),
                        "note": ""
                    })

            if prac_q:
                p_qs = extract_questions_from_pdf(prac_q)
                for q in p_qs:
                    all_qs.append({
                        "category": "消費金融",
                        "period": term,
                        "subject": "實務",
                        "number": q["number"],
                        "text": q["text"],
                        "options": q["options"],
                        "answer": prac_ans.get(q["number"], ""),
                        "note": ""
                    })

            total_in_term = (len(l_qs) if law_q else 0) + (len(p_qs) if prac_q else 0)
            print(f"  - 第 {term} 屆: 共解析 {total_in_term} 題 (法規 {len(l_qs) if law_q else 0} 題, 實務 {len(p_qs) if prac_q else 0} 題)")

    return all_qs

def process_esg():
    """解析永續發展 (113~115 年)"""
    print("\n[3/4] 開始解析：永續發展基礎能力測驗 (113~115 年)...")
    dir_path = BASE_EXAM_DIR / "永續發展11301-11504"
    all_qs = []

    for pdf_file in sorted(dir_path.rglob("*.pdf")):
        # 只挑選試題檔
        name = pdf_file.name
        if "答案" in name or name.endswith("a.pdf") or name.endswith("-2.pdf"):
            continue

        # 尋找對應的答案檔
        ans_file = None
        candidates = []
        if "試題" in name:
            candidates.append(pdf_file.with_name(name.replace("試題", "答案")))
        candidates.extend([
            pdf_file.with_name(pdf_file.stem + "a.pdf"),
            pdf_file.with_name(pdf_file.stem + "A.pdf"),
            pdf_file.with_name(pdf_file.stem[:-1] + "2.pdf") if pdf_file.stem.endswith("-1") else None,
            pdf_file.with_name(pdf_file.stem + "-2.pdf")
        ])
        for c in candidates:
            if c and c.exists() and c != pdf_file:
                ans_file = c
                break

        if not ans_file:
            # 尋找同資料夾內的答案檔
            for other in pdf_file.parent.glob("*.pdf"):
                if other != pdf_file and ("答案" in other.name or other.stem.endswith("a") or other.stem.endswith("A") or other.stem.endswith("-2") or other.name == f"{period_label}a.pdf"):
                    ans_file = other
                    break

        # 判定期數標籤
        rel_parts = pdf_file.relative_to(dir_path).parts
        period_label = f"{rel_parts[0]}-{rel_parts[1]}" if len(rel_parts) >= 2 else pdf_file.stem
        if "11301" in name: period_label = "113-1"
        elif "11302" in name: period_label = "113-2"
        elif "11303" in name: period_label = "113-3"

        qs = extract_questions_from_pdf(pdf_file)
        ans_map = extract_answers_from_pdf(ans_file) if ans_file else {}

        for q in qs:
            all_qs.append({
                "category": "永續發展",
                "period": period_label,
                "subject": "永續發展",
                "number": q["number"],
                "text": q["text"],
                "options": q["options"],
                "answer": ans_map.get(q["number"], ""),
                "note": ""
            })

        print(f"  - 場次 {period_label} ({pdf_file.stem}): 解析 {len(qs)} 題 (解答: {ans_file.name if ans_file else '未匹配'})")

    return all_qs

def process_aml():
    """解析防制洗錢與打擊資恐人員 (107~115 年)"""
    print("\n[4/4] 開始解析：防制洗錢與打擊資恐人員測驗 (107~115 年)...")
    dir_path = BASE_EXAM_DIR / "防制洗錢人員10701-11503"
    all_qs = []

    for pdf_file in sorted(dir_path.rglob("*.pdf")):
        name = pdf_file.name
        # 排除非試題
        if "筆記" in name: continue
        if name.endswith("A.pdf") or name.endswith("a.pdf") or name.endswith("-2.pdf") or "答案" in name:
            continue

        # 尋找解答檔
        ans_file = None
        candidates = []
        if "Q.pdf" in name:
            candidates.append(pdf_file.with_name(name.replace("Q.pdf", "A.pdf")))
        if "試題" in name:
            candidates.append(pdf_file.with_name(name.replace("試題", "答案")))
        candidates.extend([
            pdf_file.with_name(pdf_file.stem + "a.pdf"),
            pdf_file.with_name(pdf_file.stem + "A.pdf"),
            pdf_file.with_name(pdf_file.stem[:-1] + "2.pdf") if pdf_file.stem.endswith("-1") else None,
            pdf_file.with_name(pdf_file.stem + "-2.pdf")
        ])
        for c in candidates:
            if c and c.exists() and c != pdf_file:
                ans_file = c
                break

        if not ans_file:
            for other in pdf_file.parent.glob("*.pdf"):
                if other != pdf_file and ("答案" in other.name or other.stem.endswith("A") or other.stem.endswith("a") or other.stem.endswith("-2")):
                    ans_file = other
                    break

        rel_parts = pdf_file.relative_to(dir_path).parts
        year = rel_parts[0] if len(rel_parts) >= 1 else "107"
        period_label = f"{year}年第{rel_parts[1]}次" if len(rel_parts) >= 2 and rel_parts[1].isdigit() else f"{year}年"

        qs = extract_questions_from_pdf(pdf_file)
        ans_map = extract_answers_from_pdf(ans_file) if ans_file else {}

        for q in qs:
            all_qs.append({
                "category": "防制洗錢",
                "period": period_label,
                "subject": "法令及實務",
                "number": q["number"],
                "text": q["text"],
                "options": q["options"],
                "answer": ans_map.get(q["number"], ""),
                "note": ""
            })

        print(f"  - 場次 {period_label} ({pdf_file.stem[:15]}): 解析 {len(qs)} 題 (解答: {ans_file.name if ans_file else '未匹配'})")

    return all_qs

# ==========================================
# 4. 生成單一離線 HTML
# ==========================================
def build_master_html(questions_list: list):
    print(f"\n==========================================")
    print(f"總題庫匯整完成！全庫題目總數：{len(questions_list)} 題")
    print(f"開始生成單一離線 HTML 題庫大全...")

    # 序列化 JSON
    json_data = json.dumps(questions_list, ensure_ascii=False).replace("</script", "<\\/script")

    html = f"""<!DOCTYPE html>
<html lang="zh-Hant" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>歷屆考題｜四科題庫</title>
  <style>
    :root {{
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --primary-light: #eff6ff;
      --primary-border: #bfdbfe;
      --success: #16a34a;
      --success-light: #f0fdf4;
      --success-border: #86efac;
      --warning: #d97706;
      --danger: #dc2626;
      --danger-light: #fef2f2;
      --danger-border: #fecaca;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-sub: #475569;
      --border: #e2e8f0;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", "PingFang TC", sans-serif;
    }}
    [data-theme="dark"] {{
      --bg: #0b1120;
      --card-bg: #1e293b;
      --text-main: #f1f5f9;
      --text-sub: #94a3b8;
      --border: #334155;
      --primary-light: #1e3a8a33;
      --primary-border: #1e3a8a;
      --success-light: #064e3b33;
      --success-border: #065f46;
      --danger-light: #450a0a;
      --danger-border: #991b1b;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: var(--font); background: var(--bg); color: var(--text-main); line-height: 1.6; padding-bottom: 80px; transition: background 0.2s, color 0.2s;
    }}
    .top-header {{
      position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.96); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }}
    [data-theme="dark"] .top-header {{ background: rgba(30,41,59,0.96); }}
    .header-inner {{
      max-width: 1200px; margin: 0 auto; padding: 12px 16px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;
    }}
    .brand-title {{
      font-size: 1.25rem; font-weight: 800; color: var(--primary); display: flex; align-items: center; gap: 8px;
    }}
    .brand-badge {{
      font-size: 0.75rem; background: var(--primary-light); border: 1px solid var(--primary-border); color: var(--primary); padding: 2px 8px; border-radius: 9999px; font-weight: 700;
    }}
    .header-actions {{ display: flex; gap: 8px; align-items: center; }}

    /* 篩選工具列 */
    .filter-bar {{ background: var(--card-bg); border-bottom: 1px solid var(--border); padding: 12px 16px; }}
    .filter-inner {{
      max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
    }}
    .filter-group {{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }}
    .filter-label {{ font-size: 0.85rem; font-weight: 700; color: var(--text-sub); }}
    select, input[type="text"] {{
      background: var(--bg); border: 1.5px solid var(--border); color: var(--text-main); padding: 6px 12px; border-radius: 8px; font-size: 0.9rem; font-family: inherit; outline: none;
    }}
    select:focus, input[type="text"]:focus {{ border-color: var(--primary); }}
    .btn {{
      background: var(--card-bg); border: 1px solid var(--border); color: var(--text-main); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 4px;
    }}
    .btn:hover {{ border-color: var(--primary); color: var(--primary); }}
    .btn-active {{ background: var(--primary); color: #fff !important; border-color: var(--primary); }}

    /* 主要容器 */
    .container {{ max-width: 1200px; margin: 20px auto; padding: 0 16px; }}
    .stats-card {{
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }}
    .stat-badge {{ display: inline-flex; align-items: center; gap: 6px; font-size: 0.95rem; color: var(--text-sub); }}
    .stat-count {{ font-weight: 800; color: var(--primary); font-size: 1.35rem; }}

    /* 題號快速直達 */
    .quick-nav-box {{
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;
    }}
    .quick-nav-title {{ font-size: 0.9rem; font-weight: 700; color: var(--text-sub); cursor: pointer; user-select: none; }}
    .quick-nav-grid {{
      display: flex; flex-wrap: wrap; gap: 6px; max-height: 140px; overflow-y: auto; padding: 6px 0; margin-top: 8px;
    }}
    .nav-chip {{
      display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 32px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: var(--text-sub); text-decoration: none; transition: all 0.15s;
    }}
    .nav-chip:hover {{ background: var(--primary-light); color: var(--primary); border-color: var(--primary); }}

    /* 題目卡片 */
    .q-card {{
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: transform 0.15s;
    }}
    .q-card:hover {{ border-color: var(--primary-border); }}
    .q-card-header {{
      display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;
    }}
    .q-tags {{ display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }}
    .tag-cat {{
      background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary-border); font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;
    }}
    .tag-period {{ background: var(--bg); color: var(--text-sub); border: 1px solid var(--border); font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 6px; }}
    .tag-num {{ font-size: 0.85rem; font-weight: 800; color: var(--text-main); }}
    .tag-ans {{
      font-size: 0.8rem; font-weight: 700; color: var(--success); background: var(--success-light); border: 1px solid var(--success-border); padding: 2px 8px; border-radius: 6px;
    }}
    .btn-reveal {{
      background: transparent; border: 1px solid var(--border); font-size: 0.8rem; padding: 4px 10px; border-radius: 6px; cursor: pointer; color: var(--text-sub);
    }}
    .btn-reveal:hover {{ background: var(--bg); color: var(--primary); }}
    .q-text {{
      font-size: 1.05rem; font-weight: 600; line-height: 1.6; margin-bottom: 14px; word-break: break-word;
    }}
    .options-list {{ display: flex; flex-direction: column; gap: 8px; }}
    .opt-chip {{
      display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.15s; user-select: none;
    }}
    .opt-chip:hover {{ border-color: var(--primary); background: var(--primary-light); }}
    .opt-num {{ font-weight: 700; font-size: 0.85rem; flex-shrink: 0; min-width: 28px; }}
    .opt-label {{ flex: 1; font-size: 0.95rem; line-height: 1.5; }}
    .opt-check {{ font-size: 0.75rem; font-weight: 700; color: var(--success); display: none; }}

    /* 點擊作答回饋 */
    .opt-selected-correct {{
      background: var(--success-light) !important; border-color: var(--success-border) !important; color: var(--success); font-weight: 700;
    }}
    .opt-selected-wrong {{
      background: var(--danger-light) !important; border-color: var(--danger-border) !important; color: var(--danger); font-weight: 700;
    }}
    .is-official-correct {{
      border-color: var(--success) !important;
    }}

    .back-to-top {{
      position: fixed; bottom: 24px; right: 24px; width: 44px; height: 44px; border-radius: 50%; background: var(--primary); color: #fff; border: none; font-size: 1.25rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; z-index: 99; transition: transform 0.2s;
    }}
    .back-to-top:hover {{ transform: scale(1.08); }}

    @media (max-width: 640px) {{
      .q-card {{ padding: 14px 12px; }}
      .opt-chip {{ padding: 8px 10px; font-size: 0.9rem; }}
    }}
  </style>
</head>
<body>
  <header class="top-header">
    <div class="header-inner">
      <div class="brand-title">
        歷屆考題｜四科題庫
        <span class="brand-badge">四大證照合一</span>
      </div>
      <div class="header-actions">
        <button class="btn" onclick="toggleTheme()">🌓 模式切換</button>
      </div>
    </div>
  </header>

  <!-- 篩選列 -->
  <div class="filter-bar">
    <div class="filter-inner">
      <!-- 類別篩選 -->
      <div class="filter-group">
        <label class="filter-label">考試類別：</label>
        <select id="categorySelect" onchange="onCategoryChange()">
          <option value="all">全部考科總覽</option>
          <option value="金融科技力">金融科技力 (8~21屆)</option>
          <option value="消費金融">消費金融 (25~49屆)</option>
          <option value="永續發展">永續發展基礎能力 (113~115年)</option>
          <option value="防制洗錢">防制洗錢人員 (107~115年)</option>
        </select>
      </div>

      <!-- 期數/屆數篩選 -->
      <div class="filter-group">
        <label class="filter-label">屆數/場次：</label>
        <select id="periodSelect" onchange="applyFilters()">
          <option value="all">全部場次</option>
        </select>
      </div>

      <!-- 關鍵字搜尋 -->
      <div class="filter-group">
        <input type="text" id="searchInput" placeholder="🔍 搜尋題幹關鍵字、概念..." oninput="debounceSearch()" style="min-width:200px;" />
        <button class="btn" onclick="clearSearch()">清除</button>
      </div>
    </div>
  </div>

  <main class="container">
    <div class="stats-card">
      <div class="stat-badge">
        <span>目前顯示：</span>
        <span class="stat-count" id="displayCount">0</span>
        <span>題 / 全庫總題數：<strong id="totalCount">{len(questions_list)}</strong> 題</span>
      </div>
      <div style="font-size:0.85rem;color:var(--text-sub);">
        <span>💡 題目右上方標註官方標準答案，點擊選項即可即時對答案練習</span>
      </div>
    </div>

    <!-- 題號快速導覽 -->
    <details class="quick-nav-box" id="quickNavBox" open>
      <summary class="quick-nav-title">📑 題號快速直達索引（點擊跳轉）</summary>
      <div class="quick-nav-grid" id="quickNavGrid"></div>
    </details>

    <!-- 題目清單 -->
    <div id="questionsContainer"></div>
  </main>

  <button class="back-to-top" onclick="window.scrollTo({{top:0, behavior:'smooth'}})" title="回到頂端">↑</button>

  <script>
    const RAW_QUESTIONS = {json_data};
    let currentCategory = 'all';
    let currentPeriod = 'all';
    let searchQuery = '';
    let searchTimeout = null;

    function init() {{
      updatePeriodDropdown();
      applyFilters();
    }}

    function toggleTheme() {{
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
    }}

    function onCategoryChange() {{
      currentCategory = document.getElementById('categorySelect').value;
      updatePeriodDropdown();
      applyFilters();
    }}

    function updatePeriodDropdown() {{
      const periodSelect = document.getElementById('periodSelect');
      periodSelect.innerHTML = '<option value="all">全部場次/屆數</option>';

      let pool = RAW_QUESTIONS;
      if (currentCategory !== 'all') {{
        pool = pool.filter(q => q.category === currentCategory);
      }}

      const periods = [...new Set(pool.map(q => String(q.period)))];
      // 排序
      periods.sort((a, b) => {{
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return nb - na;
        return String(b).localeCompare(String(a));
      }});

      periods.forEach(p => {{
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = `第 ${{p}} 屆 / 場次`;
        periodSelect.appendChild(opt);
      }});
      currentPeriod = 'all';
    }}

    function debounceSearch() {{
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {{
        searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
        applyFilters();
      }}, 250);
    }}

    function clearSearch() {{
      document.getElementById('searchInput').value = '';
      searchQuery = '';
      applyFilters();
    }}

    function applyFilters() {{
      currentPeriod = document.getElementById('periodSelect').value;
      let filtered = RAW_QUESTIONS;

      if (currentCategory !== 'all') {{
        filtered = filtered.filter(q => q.category === currentCategory);
      }}
      if (currentPeriod !== 'all') {{
        filtered = filtered.filter(q => String(q.period) === currentPeriod);
      }}
      if (searchQuery) {{
        filtered = filtered.filter(q => {{
          return q.text.toLowerCase().includes(searchQuery) ||
            q.options.some(o => o.toLowerCase().includes(searchQuery));
        }});
      }}

      renderQuestions(filtered);
    }}

    function renderQuestions(list) {{
      const container = document.getElementById('questionsContainer');
      const navGrid = document.getElementById('quickNavGrid');
      document.getElementById('displayCount').textContent = list.length;

      if (list.length === 0) {{
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-sub);">無符合條件的題目</div>';
        navGrid.innerHTML = '';
        return;
      }}

      // 渲染題號索引 (前 200 題)
      let navHtml = '';
      const limit = Math.min(list.length, 200);
      for (let i = 0; i < limit; i++) {{
        const q = list[i];
        const cardId = `q-${{q.category}}-${{q.period}}-${{q.number}}-${{i}}`;
        navHtml += `<a href="#${{cardId}}" class="nav-chip" title="${{q.category}} 第${{q.number}}題">${{q.number}}</a>`;
      }}
      if (list.length > limit) {{
        navHtml += `<span style="font-size:0.8rem;color:var(--text-sub);align-self:center;">...共有 ${{list.length}} 題</span>`;
      }}
      navGrid.innerHTML = navHtml;

      // 渲染題目卡片 (分頁/限制 300 題防止 DOM 過重)
      const renderLimit = Math.min(list.length, 300);
      let cardsHtml = '';
      for (let i = 0; i < renderLimit; i++) {{
        const q = list[i];
        const cardId = `q-${{q.category}}-${{q.period}}-${{q.number}}-${{i}}`;
        const ansRaw = String(q.answer).trim();

        let optionsHtml = '';
        (q.options || []).forEach((opt, idx) => {{
          const optNum = String(idx + 1);
          const isCorrect = optNum === ansRaw || ansRaw.includes(optNum);
          optionsHtml += `
            <div class="opt-chip ${{isCorrect ? 'is-official-correct' : ''}}" onclick="checkOpt(this, ${{isCorrect}})">
              <span class="opt-num">(${{optNum}})</span>
              <span class="opt-label">${{escapeHtml(opt)}}</span>
              <span class="opt-check">✓ 標準答案</span>
            </div>
          `;
        }});

        cardsHtml += `
          <article class="q-card" id="${{cardId}}">
            <div class="q-card-header">
              <div class="q-tags">
                <span class="tag-cat">${{escapeHtml(q.category)}}</span>
                <span class="tag-period">第 ${{q.period}} 屆/場</span>
                ${{q.subject ? `<span class="tag-period">${{escapeHtml(q.subject)}}</span>` : ''}}
                <span class="tag-num">第 ${{q.number}} 題</span>
                <span class="tag-ans">【正確答案：(${{ansRaw || '公佈疑義'}})】</span>
              </div>
              <div>
                <button type="button" class="btn-reveal" onclick="revealAns(this)">揭曉答案</button>
              </div>
            </div>
            <div class="q-text">${{escapeHtml(q.text)}}</div>
            <div class="options-list">
              ${{optionsHtml}}
            </div>
          </article>
        `;
      }}

      if (list.length > renderLimit) {{
        cardsHtml += `<div style="text-align:center;padding:2rem;color:var(--text-sub);">已顯示前 300 題，請縮小篩選範圍以獲得最佳檢視效能。</div>`;
      }}

      container.innerHTML = cardsHtml;
    }}

    function checkOpt(el, isCorrect) {{
      if (isCorrect) {{
        el.classList.add('opt-selected-correct');
      }} else {{
        el.classList.add('opt-selected-wrong');
      }}
    }}

    function revealAns(btn) {{
      const card = btn.closest('.q-card');
      card.querySelectorAll('.opt-chip.is-official-correct').forEach(opt => {{
        opt.style.background = 'var(--success-light)';
        opt.style.borderColor = 'var(--success-border)';
        const check = opt.querySelector('.opt-check');
        if (check) check.style.display = 'inline-block';
      }});
      btn.style.display = 'none';
    }}

    function escapeHtml(str) {{
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }}

    window.onload = init;
  </script>
</body>
</html>
"""

    with open(OUTPUT_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    size_mb = os.path.getsize(OUTPUT_HTML_PATH) / (1024 * 1024)
    print(f"✓ 成功寫出單一自包含 HTML 檔案！")
    print(f"  路徑: {OUTPUT_HTML_PATH}")
    print(f"  檔案大小: {size_mb:.2f} MB")

def main():
    print("==========================================")
    print("啟動全量歷屆考古題題目與解答整合管線")
    print("==========================================")

    fintech_qs = process_fintech()
    cf_qs = process_consumer_finance()
    esg_qs = process_esg()
    aml_qs = process_aml()

    all_questions = fintech_qs + cf_qs + esg_qs + aml_qs
    build_master_html(all_questions)

if __name__ == "__main__":
    main()
