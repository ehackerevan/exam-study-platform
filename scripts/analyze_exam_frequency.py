#!/usr/bin/env python3
"""Frequency profile for the four non-trust subject question banks.

Run from the Study Pack Compiler project root:
    python scripts/analyze_exam_frequency.py
The generated JSON is a descriptive, keyword-based index, not a forecast.
"""
from __future__ import annotations

import json
import sys
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path.cwd()
if not (ROOT / "教材").is_dir():
    raise SystemExit("請從 Study Pack Compiler 專案根目錄執行此程式。")

COURSES = {
    "金融科技力重點教材": {
        "label": "金融科技力",
        "folder": "教材/金融科技力重點教材",
        "core_chapters": {
            "c01": "金融科技發展與數位轉型",
            "c02": "雲端運算、大數據與AI應用",
            "c03": "區塊鏈、分散式帳本與虛擬資產",
            "c04": "純網銀、開放銀行與API",
            "c05": "支付、數位身分與金融資安",
            "c06": "RegTech、SupTech與監理沙盒",
        },
        "concepts": [
            ("雲端運算", ["雲端", "IaaS", "PaaS", "SaaS", "私有雲", "公有雲", "混合雲", "虛擬化"]),
            ("大數據與人工智慧", ["大數據", "Big Data", "5V", "Robo-Advisor", "機器學習", "深度學習", "人工智慧", "AI"]),
            ("區塊鏈、分散式帳本與虛擬資產", ["區塊鏈", "分散式帳本", "DLT", "比特幣", "虛擬資產", "加密貨幣", "共識機制", "智能合約", "STO", "挖礦"]),
            ("純網銀、開放銀行與API", ["純網路銀行", "純網銀", "開放銀行", "Open Banking", "Open API", "API", "TSP"]),
            ("行動支付、電子支付與第三方支付", ["行動支付", "第三方支付", "電子支付", "電子票證", "電支", "QR Code"]),
            ("數位身分與生物辨識", ["數位身分", "身分驗證", "身份驗證", "生物辨識", "指紋辨識", "FIDO", "多因子驗證", "雙因素"]),
            ("金融資安與零信任", ["零信任", "Zero Trust", "金融資安", "資通安全", "資安", "網路安全", "社交工程"]),
            ("RegTech、SupTech與監理沙盒", ["RegTech", "SupTech", "監理科技", "監理沙盒", "金融監理", "創新實驗", "試辦"]),
            ("金融科技發展與數位轉型", ["數位轉型", "金融科技發展路徑", "鯰魚效應", "ABCD", "FinTech"]),
        ],
        "laws": [
            ("金融科技發展與創新實驗條例", ["金融科技發展與創新實驗條例", "金融科技創新實驗條例", "創新實驗條例"]),
            ("銀行法", ["銀行法"]),
            ("電子支付機構管理條例", ["電子支付機構管理條例"]),
            ("電子票證發行管理條例", ["電子票證發行管理條例"]),
            ("個人資料保護法", ["個人資料保護法", "個資法"]),
            ("金融消費者保護法", ["金融消費者保護法"]),
            ("資通安全管理法", ["資通安全管理法"]),
            ("證券交易法", ["證券交易法"]),
            ("金融服務業辦理數位身分驗證指引", ["金融服務業辦理數位身分驗證指引"]),
            ("金融業運用人工智慧指引", ["金融業運用人工智慧指引"]),
            ("金融機構使用物聯網設備安全控管規範", ["金融機構使用物聯網設備安全控管規範"]),
            ("金融機構運用新興科技作業規範", ["金融機構運用新興科技作業規範"]),
        ],
    },
    "消費金融內部控制與稽核重點教材": {
        "label": "消費金融內部控制與稽核",
        "folder": "教材/消費金融內部控制與稽核重點教材",
        "core_chapters": {
            "cf01": "內部控制與內部稽核",
            "cf02": "授信、徵信與擔保品",
            "cf03": "信用卡與循環信用",
            "cf04": "逾期放款、催收與呆帳",
        },
        "concepts": [
            ("內部控制與內部稽核", ["內部控制", "內部稽核", "稽核", "COSO", "三道防線", "遵守法令", "法遵", "公司治理", "總稽核", "自評"]),
            ("授信、徵信與擔保品", ["授信", "徵信", "信用調查", "5P", "DBR", "債務比", "擔保品", "抵押", "放款", "無擔保", "信用資料", "聯徵", "JCIC"]),
            ("信用卡與循環信用", ["信用卡", "循環信用", "最低應繳", "掛失", "盜刷", "發卡", "收單", "預借現金"]),
            ("逾期放款、催收與呆帳", ["逾期放款", "催收", "呆帳", "轉銷", "備抵", "資產品質", "逾放"]),
            ("消費者保護與個資", ["金融消費者", "消費者保護", "個人資料", "個資", "申訴", "評議", "消費者權益"]),
            ("銀行作業、委外與風險管理", ["委外", "作業風險", "安全維護", "詐騙", "通報", "匯款", "外匯", "金融機構安全", "客戶身分", "營業秘密"]),
            ("防制洗錢與交易監控", ["洗錢防制", "洗錢", "可疑交易", "大額通貨", "防制詐騙", "異常交易"]),
        ],
        "laws": [
            ("金融控股公司及銀行業內部控制及稽核制度實施辦法", ["金融控股公司及銀行業內部控制及稽核制度實施辦法"]),
            ("信用卡業務機構管理辦法", ["信用卡業務機構管理辦法"]),
            ("銀行法", ["銀行法"]),
            ("金融控股公司法", ["金融控股公司法"]),
            ("金融消費者保護法", ["金融消費者保護法"]),
            ("消費者保護法", ["消費者保護法"]),
            ("個人資料保護法", ["個人資料保護法", "個資法"]),
            ("銀行資產評估損失準備提列及逾期放款催收款呆帳處理辦法", ["銀行資產評估損失準備提列及逾期放款催收款呆帳處理辦法"]),
            ("中華民國銀行公會會員徵信準則", ["中華民國銀行公會會員徵信準則", "會員徵信準則"]),
            ("中華民國銀行公會會員授信準則", ["中華民國銀行公會會員授信準則", "會員授信準則"]),
            ("金融同業間遭歹徒詐騙案件通報要點", ["金融同業間遭歹徒詐騙案件通報要點"]),
            ("金融機構作業委託他人處理內部作業制度及程序辦法", ["金融機構作業委託他人處理內部作業制度及程序辦法"]),
        ],
    },
    "永續發展基礎能力重點教材": {
        "label": "永續發展基礎能力",
        "folder": "教材/永續發展基礎能力重點教材",
        "core_chapters": {
            "esg01": "ESG與永續治理",
            "esg02": "溫室氣體盤查與碳定價（章節未細分）",
            "esg03": "永續金融、債券與責任投資",
            "esg04": "永續資訊揭露準則與反漂綠",
        },
        "concepts": [
            ("氣候公約與轉型政策", ["氣候變遷綱要公約", "巴黎協定", "京都議定書", "UNFCCC", "COP", "氣候變遷因應法"]),
            ("溫室氣體盤查、查驗與確信", ["溫室氣體", "GHG", "範疇一", "範疇二", "範疇三", "ISO 14064", "盤查", "查驗", "確信", "排放量"]),
            ("碳定價、碳費與碳交易", ["碳費", "碳稅", "碳定價", "碳權", "碳交易", "碳市場", "CBAM", "碳邊境"]),
            ("永續金融、債券與責任投資", ["永續金融", "綠色金融", "責任投資", "永續債券", "綠色債券", "社會債券", "轉型債券", "PRI", "PRB", "PSI", "赤道原則", "EP4"]),
            ("永續資訊揭露準則與反漂綠", ["IFRS", "ISSB", "GRI", "SASB", "TCFD", "ESRS", "SFDR", "永續報告書", "永續資訊揭露", "反漂綠", "漂綠"]),
            ("ESG與永續治理", ["ESG", "永續治理", "淨零", "2050", "永續經濟活動", "上市櫃公司永續發展路徑圖", "永續發展實務守則"]),
        ],
        "laws": [
            ("氣候變遷因應法（含舊稱溫室氣體減量及管理法）", ["氣候變遷因應法", "溫室氣體減量及管理法"]),
            ("溫室氣體排放量盤查登錄及查驗管理辦法", ["溫室氣體排放量盤查登錄及查驗管理辦法"]),
            ("上市櫃公司永續發展實務守則", ["上市櫃公司永續發展實務守則", "上市上櫃公司永續發展實務守則"]),
            ("上市公司編製與申報永續報告書作業辦法", ["上市公司編製與申報永續報告書作業辦法", "永續報告書作業辦法"]),
            ("公開發行公司年報應行記載事項準則", ["公開發行公司年報應行記載事項準則"]),
            ("永續發展債券作業要點", ["永續發展債券作業要點"]),
            ("永續金融揭露規範（SFDR）", ["永續金融揭露規範", "SFDR"]),
            ("公開發行公司建立內部控制制度處理準則", ["公開發行公司建立內部控制制度處理準則"]),
            ("再生能源發展條例", ["再生能源發展條例"]),
            ("歐洲氣候法", ["歐洲氣候法", "European Climate Law"]),
            ("巴黎協定", ["巴黎協定"]),
            ("聯合國氣候變化綱要公約", ["聯合國氣候變化綱要公約", "氣候變遷綱要公約", "UNFCCC"]),
        ],
    },
    "防制洗錢與打擊資恐重點教材": {
        "label": "防制洗錢與打擊資恐",
        "folder": "教材/防制洗錢與打擊資恐重點教材",
        "core_chapters": {
            "aml01": "洗錢犯罪與法定要件",
            "aml02": "客戶審查、實質受益人與PEP",
            "aml03": "大額通貨與可疑交易申報",
            "aml04": "資恐防制與金融制裁",
        },
        "concepts": [
            ("客戶審查、實質受益人與PEP", ["CDD", "KYC", "客戶審查", "客戶身分", "實質受益人", "受益所有人", "PEP", "重要政治性職務", "EDD", "加強審查"]),
            ("大額通貨與可疑交易申報", ["CTR", "STR", "大額通貨", "通貨交易", "可疑交易", "疑似洗錢交易", "申報", "調查局", "禁止通報", "免申報"]),
            ("資恐防制與金融制裁", ["資恐防制法", "資恐", "打擊資恐", "恐怖主義", "目標性金融制裁", "TFS", "制裁名單", "凍結", "恐怖活動"]),
            ("風險基礎方法、內控與FATF", ["FATF", "風險基礎", "風險評估", "防制計畫", "內部控制", "內部稽核", "教育訓練", "國際合作"]),
            ("保存期限、申報時限與罰則", ["保存年限", "保存期限", "交易紀錄", "申報期限", "保存幾年", "幾日內", "罰鍰", "罰金", "有期徒刑"]),
            ("洗錢犯罪與法定要件", ["洗錢罪", "洗錢行為", "前置犯罪", "特定犯罪", "洗錢三階段", "沒收", "犯罪所得", "人頭帳戶"]),
        ],
        "laws": [
            ("洗錢防制法", ["洗錢防制法"]),
            ("資恐防制法", ["資恐防制法"]),
            ("金融機構防制洗錢辦法", ["金融機構防制洗錢辦法"]),
            ("金融機構對達一定金額以上通貨交易及疑似洗錢交易申報辦法", ["金融機構對達一定金額以上通貨交易及疑似洗錢交易申報辦法", "通貨交易及疑似洗錢交易申報辦法"]),
            ("銀行業及指定金融機構防制洗錢及打擊資恐內控與稽核實施辦法", ["銀行業及其他經金融監督管理委員會指定之金融機構防制洗錢及打擊資恐內部控制與稽核制度實施辦法", "內部控制與稽核制度實施辦法"]),
            ("銀行評估洗錢及資恐風險及訂定相關防制計畫指引", ["銀行評估洗錢及資恐風險及訂定相關防制計畫指引"]),
            ("金融機構辦理國內匯款作業確認客戶身分原則", ["金融機構辦理國內匯款作業確認客戶身分原則"]),
            ("洗錢防制物品出入境申報及通報辦法", ["洗錢防制物品出入境申報及通報辦法"]),
            ("存款帳戶及其疑似不法或顯屬異常交易管理辦法", ["存款帳戶及其疑似不法或顯屬異常交易管理辦法"]),
            ("銀行法", ["銀行法"]),
        ],
    },
    "信託業務人員重點教材": {
        "label": "信託業務人員",
        "folder": "教材/信託業務人員重點教材",
        "record_type": "trust",
        "concept_mode": "question_topic",
        "laws": [
            ("信託法", ["信託法"]),
            ("信託業法", ["信託業法"]),
            ("金融資產證券化條例", ["金融資產證券化條例"]),
            ("不動產證券化條例", ["不動產證券化條例"]),
            ("信託資金集合管理運用管理辦法", ["信託資金集合管理運用管理辦法"]),
            ("境外基金管理辦法", ["境外基金管理辦法"]),
            ("信託業設立標準", ["信託業設立標準"]),
            ("證券投資信託及顧問法", ["證券投資信託及顧問法", "投信投顧法"]),
            ("證券投資信託事業證券投資顧問事業證券商兼營信託業務管理辦法", ["證券投資信託事業證券投資顧問事業證券商兼營信託業務管理辦法"]),
            ("有價證券借貸辦法", ["有價證券借貸辦法"]),
            ("信託業應負之義務及相關行為規範", ["信託業應負之義務及相關行為規範"]),
            ("信託業負責人應具備資格條件暨經營與管理人員應具備信託專門學識或經驗準則", ["信託業負責人應具備資格條件暨經營與管理人員應具備信託專門學識或經驗準則"]),
            ("信託業營運範圍受益權轉讓限制風險揭露及行銷訂約管理辦法", ["信託業營運範圍受益權轉讓限制風險揭露及行銷訂約管理辦法"]),
            ("境外結構型商品管理規則", ["境外結構型商品管理規則"]),
            ("民法", ["民法"]),
            ("所得稅法", ["所得稅法"]),
            ("遺產及贈與稅法", ["遺產及贈與稅法"]),
            ("銀行法", ["銀行法"]),
            ("證券交易法", ["證券交易法"]),
            ("公司法", ["公司法"]),
            ("保險法", ["保險法"]),
            ("金融消費者保護法", ["金融消費者保護法"]),
        ],
    },
    "金融市場常識與職業道德題庫（證基會113年版）": {
        "label": "金融市場常識與職業道德（證基會113年版）",
        "folder": "教材/金融市場常識與職業道德題庫",
        "record_type": "sfi",
        "concept_mode": "official_chapter",
        "official_chapters": {
            "financial-market": "金融市場常識",
            "professional-ethics": "職業道德",
        },
        "laws": [
            ("證券交易法", ["證券交易法"]),
            ("期貨交易法", ["期貨交易法"]),
            ("信託法", ["信託法"]),
            ("信託業法", ["信託業法"]),
            ("洗錢防制法", ["洗錢防制法"]),
            ("個人資料保護法", ["個人資料保護法", "個資法"]),
            ("消費者保護法", ["消費者保護法"]),
            ("金融消費者保護法", ["金融消費者保護法"]),
            ("銀行法", ["銀行法"]),
            ("保險法", ["保險法"]),
            ("證券投資信託及顧問法", ["證券投資信託及顧問法", "投信投顧法"]),
            ("證券投資人及期貨交易人保護法", ["證券投資人及期貨交易人保護法"]),
            ("金融控股公司法", ["金融控股公司法"]),
            ("公平交易法", ["公平交易法"]),
            ("公司法", ["公司法"]),
        ],
        "official_references": [
            ("金融監督管理委員會", ["金融監督管理委員會", "金管會"]),
            ("中央銀行", ["中央銀行"]),
            ("臺灣證券交易所", ["臺灣證券交易所", "證券交易所"]),
            ("證券櫃檯買賣中心", ["證券櫃檯買賣中心", "櫃檯買賣中心"]),
            ("臺灣集中保管結算所", ["臺灣集中保管結算所", "集保結算所"]),
            ("證券投資人及期貨交易人保護中心", ["證券投資人及期貨交易人保護中心", "投保中心"]),
            ("證券暨期貨市場發展基金會", ["證券暨期貨市場發展基金會", "證基會"]),
            ("金融消費評議中心", ["金融消費評議中心"]),
        ],
        "law_exclusions": {
            "消費者保護法": ["金融消費者保護法"],
        },
    },
}

EXAM_PATTERNS = [
    re.compile(r"【第\s*(\d+)\s*屆\s*([^】]*?)\s*第\s*(\d+)\s*題】"),
    re.compile(r"【場次\s*(\d{3})-(\d+)\s*第\s*(\d+)\s*題】"),
    re.compile(r"【場次\s*(\d{3})年?第(\d+)次\s*第\s*(\d+)\s*題】"),
]

def source_exam(question: str, subject: str) -> dict | None:
    for index, pattern in enumerate(EXAM_PATTERNS):
        match = pattern.search(question or "")
        if not match:
            continue
        if index == 0:
            return {"term": f"第 {match.group(1)} 屆", "subject": match.group(2).strip() or subject, "number": int(match.group(3))}
        if index == 1:
            return {"term": f"{match.group(1)}-{match.group(2)}", "subject": subject, "number": int(match.group(3))}
        return {"term": f"{match.group(1)}年第{match.group(2)}次", "subject": subject, "number": int(match.group(3))}
    return None

def normalize(text: str) -> str:
    return re.sub(r"\s+", "", (text or "")).casefold()

def record_source_exam(record: dict, config: dict) -> dict | None:
    explicit = record.get("sourceExam")
    if isinstance(explicit, dict):
        try:
            return {
                "term": str(explicit["term"]),
                "subject": str(explicit.get("subject") or config["label"]),
                "number": int(explicit["number"]),
            }
        except (KeyError, TypeError, ValueError):
            return None
    if config.get("record_type") == "trust":
        try:
            return {
                "term": f"第 {int(record['term'])} 屆",
                "subject": str(record["subject"]),
                "number": int(record["number"]),
            }
        except (KeyError, TypeError, ValueError):
            return None
    return source_exam(record.get("question", ""), config["label"])


def question_text(record: dict) -> str:
    return str(record.get("question", record.get("stem", "")))


def ranking_rows(hits: dict[str, list[str]], sessions: dict[str, set[str]], total: int, label_key: str) -> list[dict]:
    return [
        {
            "rank": rank,
            label_key: label,
            "question_count": len(question_ids),
            "share_of_all_records_percent": round(100 * len(question_ids) / total, 2) if total else 0,
            "exam_session_count": len(sessions[label]),
            "question_ids": question_ids,
            "sample_question_ids": question_ids[:5],
        }
        for rank, (label, question_ids) in enumerate(sorted(hits.items(), key=lambda item: (-len(item[1]), item[0])), 1)
    ]


def record_stats(records: list[dict], config: dict) -> dict:
    topic_hits = defaultdict(list)
    law_hits = defaultdict(list)
    official_reference_hits = defaultdict(list)
    topic_sessions = defaultdict(set)
    law_sessions = defaultdict(set)
    official_reference_sessions = defaultdict(set)
    ids = []
    source_slots = defaultdict(list)
    short_stems = []
    malformed_answers = []
    unparsed = []
    normalized_stems = defaultdict(set)
    unmatched = []
    matched_ids = set()

    for q in records:
        qid = str(q.get("id", ""))
        ids.append(qid)
        stem = question_text(q)
        exam = record_source_exam(q, config)
        if exam:
            slot = (exam["term"], exam["subject"], exam["number"])
            source_slots[slot].append(qid)
        else:
            unparsed.append(qid)
        stem = re.sub(r"【[^】]*】", "", stem)
        normalized_stems[normalize(stem)].add(exam["term"] if exam else "未解析")
        if len(normalize(stem)) <= 10:
            short_stems.append(qid)

        answer = q.get("answer")
        answer_indexes = answer if isinstance(answer, list) else [answer]
        options = q.get("options") or []
        valid_indexes = [i for i in answer_indexes if isinstance(i, int) and 0 <= i < len(options)]
        if len(valid_indexes) != len(answer_indexes):
            malformed_answers.append(qid)

        searchable = normalize(" ".join([stem, *[str(o) for o in options]]))
        concept_mode = config.get("concept_mode", "keywords")
        labels = set()
        if concept_mode == "question_topic":
            topic = str(q.get("topic", "")).strip()
            if topic:
                labels.add(topic)
        elif concept_mode == "official_chapter":
            chapter_label = config["official_chapters"].get(q.get("chapterId"))
            if chapter_label:
                labels.add(chapter_label)
        else:
            for label, aliases in config["concepts"]:
                if any(normalize(alias) in searchable for alias in aliases):
                    labels.add(label)
            if not labels and q.get("chapterId") in config.get("core_chapters", {}):
                labels.add(config["core_chapters"][q["chapterId"]])
        if labels:
            matched_ids.add(qid)
            for label in labels:
                topic_hits[label].append(qid)
                if exam:
                    topic_sessions[label].add(exam["term"])
        else:
            unmatched.append(qid)

        correct_text = normalize(" ".join([stem, *[str(options[i]) for i in valid_indexes]]))
        for label, aliases in config["laws"]:
            matched = any(normalize(alias) in correct_text for alias in aliases)
            excluded = any(normalize(alias) in correct_text for alias in config.get("law_exclusions", {}).get(label, []))
            if matched and not excluded:
                law_hits[label].append(qid)
                if exam:
                    law_sessions[label].add(exam["term"])
        for label, aliases in config.get("official_references", []):
            if any(normalize(alias) in correct_text for alias in aliases):
                official_reference_hits[label].append(qid)
                if exam:
                    official_reference_sessions[label].add(exam["term"])

    total = len(records)
    topic_rows = ranking_rows(topic_hits, topic_sessions, total, "concept")
    law_rows = ranking_rows(law_hits, law_sessions, total, "law_or_rule")
    official_reference_rows = ranking_rows(official_reference_hits, official_reference_sessions, total, "reference")
    collisions = [
        {"term": slot[0], "subject": slot[1], "number": slot[2], "question_ids": qids}
        for slot, qids in source_slots.items() if len(qids) > 1
    ]
    repeated_stems = [terms for terms in normalized_stems.values() if len(terms) > 1]
    return {
        "question_record_count": total,
        "unique_question_id_count": len(set(ids)),
        "duplicate_question_id_count": total - len(set(ids)),
        "parsed_exam_metadata_count": total - len(unparsed),
        "unparsed_exam_metadata_count": len(unparsed),
        "exam_session_count": len({exam["term"] for q in records if (exam := record_source_exam(q, config))}),
        "invalid_answer_index_count": len(malformed_answers),
        "short_stem_at_most_10_characters_count": len(short_stems),
        "short_stem_sample_ids": short_stems[:10],
        "same_exam_subject_number_collision_group_count": len(collisions),
        "records_in_collision_groups": sum(len(row["question_ids"]) for row in collisions),
        "extra_records_in_collision_groups": sum(len(row["question_ids"]) - 1 for row in collisions),
        "collision_samples": collisions[:10],
        "repeated_stem_across_exam_terms_group_count": len(repeated_stems),
        "topic_classified_unique_question_count": len(matched_ids),
        "topic_classification_coverage_percent": round(100 * len(matched_ids) / total, 2) if total else 0,
        "unclassified_question_count": len(unmatched),
        "unclassified_sample_ids": unmatched[:10],
        "unclassified_question_ids": unmatched,
        "unclassified_knowledge_point": "其他／未分類",
        "classification_method": {
            "keywords": "題幹與所有選項比對此程式列出的觀念詞；無關鍵詞命中時才使用已配置的一般教材章節備援分類。",
            "question_topic": "逐題沿用信託完整題庫既有 topic 欄位，不再另造分類。",
            "official_chapter": "逐題依證基會113年題庫既有 chapterId 對應官方兩大分類，不細分官方分類。",
        }[config.get("concept_mode", "keywords")],
        "concept_ranking": topic_rows,
        "law_ranking": law_rows,
        "official_reference_ranking": official_reference_rows,
        "law_matching_method": "以題幹及正確選項比對本程式列出的法規名稱與別名；計數為命中題數，不代表法規重要度、答案正確性或現行有效性。",
    }

def main() -> None:
    courses = {}
    for course_name, config in COURSES.items():
        if config.get("record_type") == "trust":
            questions_path = ROOT / config["folder"] / "full_exam_bank.json"
            bank = json.loads(questions_path.read_text(encoding="utf-8"))
            records = list({str(q.get("id", "")): q for rows in bank.values() for q in rows}.values())
        else:
            questions_path = ROOT / config["folder"] / "questions.json"
            source_data = json.loads(questions_path.read_text(encoding="utf-8"))
            records = source_data if isinstance(source_data, list) else source_data.get("questions")
        if not isinstance(records, list):
            raise ValueError(f"{questions_path} 缺少 questions 陣列")
        result = record_stats(records, config)
        result["source_file"] = config["folder"] + "/" + questions_path.name
        result["label"] = config["label"]
        assert all(
            rows[i]["question_count"] >= rows[i + 1]["question_count"]
            for key in ("concept_ranking", "law_ranking")
            for rows in [result[key]]
            for i in range(len(rows) - 1)
        ), f"排行必須依題數降冪：{config['label']}"
        courses[course_name] = result

    output = {
        "schema_version": 2,
        "generated_on": date.today().isoformat(),
        "scope": "六科清理後 canonical 題庫的每筆題目紀錄；信託來源為 full_exam_bank.json，其餘來源為 questions.json；重複題幹跨考期仍按各筆紀錄計數",
        "method": {
            "counting_grain": "每個 canonical source question ID；同一題幹若在不同考期重現，按每筆歷屆紀錄計數",
            "concepts": "四科以題幹及選項關鍵詞分類，沒有命中時才用已配置的教材章節備援分類；信託逐題沿用來源 topic 欄；證基會113年題庫僅依官方 financial-market/professional-ethics 兩個 chapterId 分類，不自創細分類。完整 question_ids 為知識點選單及章末題目的共同依據。",
            "laws": "以題幹及正確選項比對程式列出的法規名稱與別名；只代表詞彙命中題數，不代表官方命題比例、法規重要性、答案正確性或法規現行狀態。",
            "official_references": "只對證基會題庫統計題幹及正確選項中的指定官方機關／機構名稱與別名；不是完整引註或來源效力審核。",
            "percentages": "題數除以該科 canonical 題目紀錄數；概念可能為多標籤，比例不可相加視為 100%。",
            "limitations": "關鍵詞／既有 topic 統計是可追溯的索引，不等於人工逐題語意、答案或法規審校；詞彙別名可能造成漏判或誤命中。未分類題數、樣本 ID 與考期題次衝突均保留，不推定為重複或刪除。",
        },
        "courses": courses,
    }
    destination = ROOT / "tasks" / "exam_frequency_20261020.json"
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = build_report(output)
    (ROOT / "tasks" / "knowledge_point_coverage_20261021.md").write_text(report, encoding="utf-8")
    for result in courses.values():
        print(
            f'{result["label"]}: {result["question_record_count"]} 題, '
            f'概念分類覆蓋 {result["topic_classification_coverage_percent"]}%, '
            f'考期題次衝突 {result["same_exam_subject_number_collision_group_count"]} 組'
        )
        print("  觀念：" + "；".join(f'{row["concept"]} {row["question_count"]}' for row in result["concept_ranking"][:5]))
        print("  法規：" + "；".join(f'{row["law_or_rule"]} {row["question_count"]}' for row in result["law_ranking"][:5]))
    print(f"Saved {destination} and tasks/knowledge_point_coverage_20261021.md")


def build_report(output: dict) -> str:
    lines = [
        "# 六科知識點與法規／官方資料覆蓋分析",
        "",
        f"統計更新日：{output['generated_on']}。資料版本：schema {output['schema_version']}。",
        "",
        "## 範圍與方法",
        "",
        "逐筆使用清理後 canonical 題庫：信託使用 `教材/信託業務人員重點教材/full_exam_bank.json`，其他五科使用各自的 `questions.json`。每個知識點與法規／機關排名都保留完整 `question_ids` 以供追溯；排名題數按題庫紀錄計，重複題幹在不同考期仍分別計數。",
        "",
        "四科（金融科技、消費金融、ESG、AML）延用分析器內人工整理的關鍵詞分類；信託沿用完整題庫既有 `topic` 欄；SFI 113 年版只沿用官方題庫的「金融市場常識」與「職業道德」兩類，不另造更細的出題分類。官方題庫下載頁公告題數為504題及616題；113/9/23修訂表已套用於職業道德第279題。",
        "",
        "法規統計以題幹加正確選項，比對分析器明列的法規名稱與別名；SFI 的官方機關／機構統計使用同樣範圍。這些是詞彙命中數，不能解讀為官方命題比例、法規重要度、答案正確性或現行效力。關鍵詞可能漏判或誤命中；本報告不等於逐題語意及法律審查。",
        "",
        "考期題次衝突組表示多筆題目被解析到同一考期、科目與題號，僅供來源回查；不等於重複題，也沒有因此刪題。",
        "",
        "## 六科覆蓋總覽",
        "",
        "| 科目 | 題數 | 已分類 | 覆蓋率 | 未分類 | 知識點數 | 法規命中題次 | 考期題次衝突組 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for course_name, data in output["courses"].items():
        law_total = sum(row["question_count"] for row in data["law_ranking"])
        lines.append(
            f"| {data['label']} | {data['question_record_count']} | {data['topic_classified_unique_question_count']} | "
            f"{data['topic_classification_coverage_percent']:.2f}% | {data['unclassified_question_count']} | "
            f"{len(data['concept_ranking'])} | {law_total} | {data['same_exam_subject_number_collision_group_count']} |"
        )
    lines.extend(["", "## 逐科點位、法規與官方資料命中", ""])
    for course_name, data in output["courses"].items():
        lines.extend([
            f"### {data['label']}",
            "",
            f"來源：`{data['source_file']}`。題數 {data['question_record_count']}；知識點分類覆蓋 {data['topic_classified_unique_question_count']}/{data['question_record_count']}（{data['topic_classification_coverage_percent']:.2f}%）；未分類 {data['unclassified_question_count']}。",
            f"分類方法：{data['classification_method']}",
            "",
            "| 知識點 | 題數 | 題庫占比 | 樣本題目 ID |",
            "| --- | ---: | ---: | --- |",
        ])
        for row in data["concept_ranking"]:
            samples = "、".join(row["sample_question_ids"])
            lines.append(f"| {row['concept']} | {row['question_count']} | {row['share_of_all_records_percent']:.2f}% | `{samples}` |")
        lines.extend([
            "",
            "**法規／規範名稱命中**（題幹與正確選項詞彙比對；項目可重疊）：",
            "",
        ])
        if data["law_ranking"]:
            lines.extend(["| 法規／規範 | 命中題數 | 題庫占比 | 樣本題目 ID |", "| --- | ---: | ---: | --- |"])
            for row in data["law_ranking"]:
                samples = "、".join(row["sample_question_ids"])
                lines.append(f"| {row['law_or_rule']} | {row['question_count']} | {row['share_of_all_records_percent']:.2f}% | `{samples}` |")
        else:
            lines.append("題庫沒有命中分析器設定的法規名稱／別名。")
        if data["official_reference_ranking"]:
            lines.extend(["", "**SFI 官方機關／機構名稱命中**（不代表正式引註）：", "", "| 機關／機構 | 命中題數 | 樣本題目 ID |", "| --- | ---: | --- |"])
            for row in data["official_reference_ranking"]:
                samples = "、".join(row["sample_question_ids"])
                lines.append(f"| {row['reference']} | {row['question_count']} | `{samples}` |")
        if data["unclassified_question_count"]:
            lines.extend(["", "未分類樣本 ID：`" + "`、`".join(data["unclassified_sample_ids"]) + "`。完整未分類 ID 見統計 JSON。"])
        lines.append("")
    lines.extend([
        "## 與目前教材包知識點的串接",
        "",
        "`concept_ranking[].question_ids` 是精確逐題映射，也是教材包的知識點選單與章末練習挑題依據；未分類題目使用 JSON 中的 `unclassified_knowledge_point` 標籤，不隱藏覆蓋缺口。信託排名使用題庫既有 topic；SFI 選單只提供官方兩大類。統計 JSON 也供教材的高頻觀念、法規排行文字使用。",
        "",
        "原始排名、完整題目 ID、考期樣本與分類限制見 `tasks/exam_frequency_20261020.json`。",
        "",
    ])
    return "\n".join(lines)

if __name__ == "__main__":
    main()
