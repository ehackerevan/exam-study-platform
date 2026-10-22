# -*- coding: utf-8 -*-
"""
強健考古題解析與答案比對引擎 (Robust Exam & Answer Parser)
支援研訓院、證基會、保發中心、犯罪防制中心等所有歷屆考古題與解答 PDF。
"""

import re
from pathlib import Path
import pymupdf

def normalize_ans_char(raw: str) -> str:
    """正規化答案字元為大寫英數字"""
    if not raw:
        return ""
    raw = str(raw).strip().upper()
    mapping = {'一': '1', '二': '2', '三': '3', '四': '4', 'A': '1', 'B': '2', 'C': '3', 'D': '4'}
    if raw in mapping:
        return mapping[raw]
    return raw

def extract_answers_from_pdf_robust(pdf_path: Path) -> dict:
    """
    從解答 PDF 萃取答案映射。
    可能回傳單一科目 dict: {1: '3', 2: '2', ...}
    或多科目 dict: {'法規': {1: '3'}, '實務': {1: '4'}}
    """
    if not pdf_path or not pdf_path.exists():
        return {}

    doc = pymupdf.open(pdf_path)

    # 策略 1: 表格萃取 (Table Extraction) - 研訓院、部分證基會標準表格
    # 檢查是否有完整表格
    table_answers = _extract_via_tables(doc)
    if table_answers:
        return table_answers

    # 策略 2: 橫向「題號 ... 標準答案 ...」格式 (證基會/保發常見)
    full_text = "\n".join([page.get_text() for page in doc])
    row_answers = _extract_via_row_labels(full_text)
    if row_answers and len(row_answers) >= 10:
        return row_answers

    # 策略 3: 純文字題號重置與區塊分割 (消費金融 25~36 屆或無表頭純文字)
    split_answers = _extract_via_text_splits(full_text)
    if split_answers:
        return split_answers

    # 策略 4: 標準多欄垂直 token 配對
    token_answers = _extract_via_tokens(full_text)
    return token_answers

def _extract_via_tables(doc) -> dict:
    """從 PDF 表格抽取答案"""
    all_tables_data = []
    for page in doc:
        for tab in page.find_tables():
            df = tab.extract()
            if df and len(df) >= 2:
                all_tables_data.append(df)

    if not all_tables_data:
        return {}

    # 檢查第一張表是否區分法規與實務 (消金 37~49 屆)
    for df in all_tables_data:
        header = [str(col).strip() if col else "" for col in df[0]]
        law_col = -1
        prac_col = -1
        q_col = -1

        for idx, col_name in enumerate(header):
            if "題號" in col_name or "節次" in col_name:
                q_col = idx
            if "法規" in col_name:
                law_col = idx
            if "實務" in col_name:
                prac_col = idx

        if law_col != -1 and prac_col != -1:
            law_dict = {}
            prac_dict = {}
            for row in df[1:]:
                if not row or len(row) <= max(law_col, prac_col):
                    continue
                q_raw = str(row[q_col if q_col != -1 else 0]).strip()
                if q_raw.isdigit():
                    q_num = int(q_raw)
                    law_ans = str(row[law_col]).strip() if row[law_col] else ""
                    prac_ans = str(row[prac_col]).strip() if row[prac_col] else ""
                    if law_ans:
                        law_dict[q_num] = normalize_ans_char(law_ans)
                    if prac_ans:
                        prac_dict[q_num] = normalize_ans_char(prac_ans)
            if len(law_dict) >= 10:
                return {"法規": law_dict, "實務": prac_dict}

    # 單一科目表格處理 (例如金融科技力 9~21 屆, 永續 602466 等)
    single_dict = {}
    for df in all_tables_data:
        for row in df:
            if not row or len(row) < 2:
                continue
            r0 = str(row[0]).strip() if row[0] else ""
            r1 = str(row[1]).strip() if row[1] else ""
            if r0.isdigit():
                q_num = int(r0)
                if 1 <= q_num <= 100 and r1:
                    single_dict[q_num] = normalize_ans_char(r1)

    if len(single_dict) >= 15:
        return single_dict

    return {}

def _extract_via_row_labels(text: str) -> dict:
    """解析『題號 1 2 3 ... 標準答案 1 2 2 ...』格式"""
    if "題號" not in text or "標準答案" not in text:
        return {}

    ans_map = {}
    # 切割題號與標準答案段落
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    full_joined = " ".join(lines)

    # 尋找所有 "題號 ... 標準答案 ..." 塊
    # Pattern: 題號\s+((?:\d+\s+)+)標準答案\s+((?:[^\s]+\s+)+)
    pattern = re.compile(r'題號\s+([\d\s]+?)\s*標準答案\s+([^\n\r]+?)(?=題號|$)', re.DOTALL)
    for m in pattern.finditer(full_joined):
        q_tokens = [t for t in m.group(1).split() if t.isdigit()]
        a_tokens = m.group(2).split()
        for q_str, a_str in zip(q_tokens, a_tokens):
            q_num = int(q_str)
            ans_map[q_num] = normalize_ans_char(a_str)

    return ans_map

def _extract_via_text_splits(text: str) -> dict:
    """處理純文字解答，包括 1. 3 2. 4 格式與可能的多科目切換"""
    # 搜尋所有 題號.答案 模式
    # 例如: 1. 3 或 1.【3】 或 1.3
    p = re.compile(r'(?:^|\s)(\d{1,2})\s*[\.．、]\s*[【\[\(（]?\s*([1-4A-D一二三四#*無全a-d]+|[A-Za-z0-9,，、/]+)\s*[】\]\)）]?(?=\s|$)')
    matches = list(p.finditer(text))
    if len(matches) < 10:
        return {}

    # 檢查是否在中間題號重置 (例如 1~50 後又出現 1~80)
    sections = []
    curr_section = {}
    last_q = 0

    for m in matches:
        q = int(m.group(1))
        ans = normalize_ans_char(m.group(2))
        if q <= last_q and len(curr_section) >= 20:
            # 發生題號重置，建立新章節
            sections.append(curr_section)
            curr_section = {}
        curr_section[q] = ans
        last_q = q

    if curr_section:
        sections.append(curr_section)

    if len(sections) == 2:
        return {"法規": sections[0], "實務": sections[1]}
    elif len(sections) == 1:
        return sections[0]
    elif len(sections) > 2:
        # 挑題數最多的兩個
        sections.sort(key=lambda s: len(s), reverse=True)
        return {"法規": sections[0], "實務": sections[1]}

    return {}

def _extract_via_tokens(text: str) -> dict:
    """針對保發/證基會垂直交錯的多欄 tokens"""
    tokens = [t.strip() for t in text.split() if t.strip()]
    ans_map = {}
    i = 0
    while i < len(tokens) - 1:
        t1 = tokens[i]
        t2 = tokens[i+1]
        if t1.isdigit():
            q = int(t1)
            # t2 可能是單一字母/數字，或帶有逗號的多選標記
            if 1 <= q <= 100:
                if re.match(r'^[1-4A-Da-d一二三四#*無全]$', t2) or len(t2) <= 8:
                    ans_map[q] = normalize_ans_char(t2)
                    i += 2
                    continue
        i += 1
    return ans_map
