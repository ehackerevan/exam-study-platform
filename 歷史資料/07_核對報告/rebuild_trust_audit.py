from __future__ import annotations
import base64, csv, hashlib, json, re
from collections import Counter
from pathlib import Path

ROOT = Path(r'C:\Users\ehack\OneDrive\文件\Agent\證照考試整合資料')
TRUST = ROOT / '01_信託業務人員'
DATA = TRUST / '04_題庫與解答資料'
REPORT = ROOT / '07_核對報告'
SOURCE_WRAPPER = TRUST / '03_既有教材與題庫頁' / '信託教材與題庫_單檔版.html'
OUTPUT_DIR = TRUST / '06_答案核對版'
OUTPUT = OUTPUT_DIR / '信託業務人員教材與題庫_核對版.html'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def official_state(value):
    text = str(value).strip()
    if any(word in text for word in ('送分', '給分', '全體計分')):
        return 'sendoff', None
    digits = re.findall(r'[1-4]', text)
    if len(digits) != 1 or not re.fullmatch(r'[^1-4]*[1-4][^1-4]*', text):
        return 'ambiguous_or_invalid', None
    return 'single', digits[0]


def key_for(q):
    return (int(q['period']), str(q['subject']), int(q['number']))


def content_for(q, answer=None):
    subject_code = 1 if q['subject'] == '信託法規' else 2
    return {
        'p': int(q['period']), 's': subject_code, 'n': int(q['number']),
        't': q['text'], 'o': q['options'],
        'a': str(answer if answer is not None else q.get('answerText', '')),
        'tp': q.get('topic', ''), 'note': q.get('annotation', '')
    }


qbank = read_json(DATA / 'sync_data' / '歷屆題庫.json')
cohort47 = read_json(DATA / 'temp_47_all_questions.json')
official_raw = read_json(DATA / 'official_answers_all.json')
official = {}
for period, subjects in official_raw.items():
    for subject, answers in subjects.items():
        for number, value in answers.items():
            official[(int(period), subject, int(number))] = str(value).strip()

candidates = qbank + cohort47
assert len(candidates) == 2852
assert len({key_for(q) for q in candidates}) == len(candidates), 'duplicate question keys'
reasons = Counter()
kept = []
answer_mismatches = []
for q in candidates:
    key = key_for(q)
    raw_official = official.get(key)
    if raw_official is None:
        reasons['official_answer_missing'] += 1
        continue
    state, official_answer = official_state(raw_official)
    if state == 'sendoff':
        reasons['official_sendoff'] += 1
        continue
    if state != 'single':
        reasons['official_ambiguous_or_invalid_answer'] += 1
        continue
    if q.get('gradable') is not True:
        reasons['not_gradable'] += 1
        continue
    if q.get('incomplete') is not False or not q.get('text') or len(q.get('options', [])) < 2:
        reasons['incomplete_or_invalid_question'] += 1
        continue
    answers = q.get('answers', [])
    if len(answers) != 1 or not isinstance(answers[0], int) or not 0 <= answers[0] < 4:
        reasons['bank_answer_invalid_or_multiple'] += 1
        continue
    bank_answer = str(answers[0] + 1)
    if bank_answer != official_answer:
        answer_mismatches.append({'key': key, 'bank': bank_answer, 'official': official_answer})
        reasons['answer_mismatch'] += 1
        continue
    if q.get('answerText'):
        text_state, text_answer = official_state(q['answerText'])
        if text_state != 'single' or text_answer != bank_answer:
            reasons['answer_text_mismatch_or_ambiguous'] += 1
            continue
    kept.append((q, official_answer))

assert not answer_mismatches, answer_mismatches
assert sum(reasons.values()) + len(kept) == len(candidates)
kept.sort(key=lambda item: (int(item[0]['period']), 1 if item[0]['subject'] == '信託法規' else 2, int(item[0]['number'])))
expected_raw = [content_for(q, answer) for q, answer in kept]
assert len(expected_raw) == len(kept)
corrected = [r for r in expected_raw if (r['p'], r['s'], r['n']) == (53, 2, 53)]
assert len(corrected) == 1 and corrected[0]['a'] == '2'

# Confirm the original trust question page still represents the 2,722 canonical rows.
wrapper = SOURCE_WRAPPER.read_text(encoding='utf-8')
page_match = re.search(r"questions:\s*'([^']+)'", wrapper, re.S)
assert page_match, 'could not locate embedded questions page'
source_page = base64.b64decode(page_match.group(1)).decode('utf-8')
raw_match = re.search(r'const RAW_QUESTIONS\s*=\s*(\[.*?\]);', source_page, re.S)
assert raw_match, 'could not locate source question array'
source_rows = json.loads(raw_match.group(1))
source_keys = {(int(r['p']), int(r['s']), int(r['n'])) for r in source_rows}
canonical_rows = [q for q in qbank if int(q['period']) != 47]
canonical_keys = {(int(q['period']), 1 if q['subject'] == '信託法規' else 2, int(q['number'])) for q in canonical_rows}
assert source_keys == canonical_keys and len(source_rows) == len(canonical_rows) == 2722

# Reuse the existing question UI, replacing only its embedded data array.
new_array = json.dumps(expected_raw, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
new_page, substitutions = re.subn(r'(const RAW_QUESTIONS\s*=\s*)\[.*?\](;)', lambda m: m.group(1) + new_array + m.group(2), source_page, count=1, flags=re.S)
assert substitutions == 1
new_embedded = base64.b64encode(new_page.encode('utf-8')).decode('ascii')
new_wrapper, substitutions = re.subn(r"(questions:\s*')[^']+(')", lambda m: m.group(1) + new_embedded + m.group(2), wrapper, count=1, flags=re.S)
assert substitutions == 1
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(new_wrapper, encoding='utf-8')

# Decode the delivered file and assert its embedded questions equal the audited rows.
written_wrapper = OUTPUT.read_text(encoding='utf-8')
written_b64 = re.search(r"questions:\s*'([^']+)'", written_wrapper, re.S).group(1)
written_page = base64.b64decode(written_b64).decode('utf-8')
written_array = re.search(r'const RAW_QUESTIONS\s*=\s*(\[.*?\]);', written_page, re.S).group(1)
written_rows = json.loads(written_array)
assert written_rows == expected_raw
assert len(written_rows) == 2852

old_audit_path = REPORT / 'trust_audit_details.json'
old_audit = read_json(old_audit_path)
missing = []
source_keys_all = {key_for(q) for q in candidates}
for key, answer in official.items():
    if key not in source_keys_all:
        state, _ = official_state(answer)
        missing.append({'key': list(key), 'official': answer, 'classification': state})
missing.sort(key=lambda row: (row['key'][0], row['key'][1], row['key'][2]))
assert len(official) == 2860 and len(missing) == 8
assert sum(1 for row in missing if row['classification'] == 'ambiguous_or_invalid') == 2
assert sum(1 for row in missing if row['classification'] == 'sendoff') == 1
old_audit['curated_question_bank'] = {
    'rule': 'Only include questions with one clear official answer, a gradable complete question, and a matching bank answer; exclude ambiguous official answers and sendoff questions.',
    'candidate_records': len(candidates),
    'included_records': len(kept),
    'excluded_records': sum(reasons.values()),
    'excluded_by_reason': dict(reasons),
    'official_answer_keys': len(official),
    'source_missing_official_question_keys': missing,
    'answer_mismatches': answer_mismatches,
    'included_by_subject': dict(Counter(q['subject'] for q, _ in kept)),
    'included_by_period_47': sum(1 for q, _ in kept if int(q['period']) == 47),
    'quality_note_summary': dict(Counter(q.get('qualityNote', '') for q in candidates)),
    'delivered_file': str(OUTPUT.relative_to(ROOT)),
    'delivered_file_sha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    'embedded_output_recheck': {'records': len(written_rows), 'matches_audited_payload': written_rows == expected_raw}
}
old_audit_path.write_text(json.dumps(old_audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

with (REPORT / 'trust_audit_details.csv').open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['source', 'issue', 'key', 'official_answer', 'bank_answer', 'question_count'])
    writer.writeheader()
    for item in missing:
        issue = {'ambiguous_or_invalid': 'official_ambiguous_answer_not_in_bank', 'sendoff': 'official_sendoff_not_in_bank', 'single': 'official_question_not_in_bank'}.get(item['classification'], 'official_answer_unusable_not_in_bank')
        writer.writerow({'source': 'official answer map vs JSON plus cohort47', 'issue': issue, 'key': json.dumps(item['key'], ensure_ascii=False), 'official_answer': item['official'], 'bank_answer': '', 'question_count': 1})

summary = {
    'trust_candidates': len(candidates), 'trust_included': len(kept),
    'trust_excluded': sum(reasons.values()), 'trust_missing_official_questions': len(missing),
    'trust_ambiguous_official_questions_missing': 2, 'trust_sendoff_questions_missing': 1,
    'trust_answer_mismatches': len(answer_mismatches), 'trust_period47_included': sum(1 for q, _ in kept if int(q['period']) == 47),
    'trust_subject_counts': dict(Counter(q['subject'] for q, _ in kept)),
    'filtered_html': str(OUTPUT), 'filtered_html_sha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
