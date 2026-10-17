from __future__ import annotations
import hashlib, json, os, re
from collections import Counter
from pathlib import Path

ROOT = Path(r'C:\Users\ehack\OneDrive\文件\Agent\證照考試整合資料')
REPORT = ROOT / '07_核對報告'
PACKS = [
    ROOT / '02_金融科技力' / '02_離線教材題庫包' / '金融科技力重點教材.html',
    ROOT / '03_消費金融內控稽核' / '02_離線教材題庫包' / '消費金融內部控制與稽核重點教材.html',
    ROOT / '04_永續發展基礎能力' / '02_離線教材題庫包' / '永續發展基礎能力重點教材.html',
    ROOT / '05_防制洗錢與打擊資恐' / '02_離線教材題庫包' / '防制洗錢與打擊資恐重點教材.html',
]

PORTAL_CSS = r'''<style id="integrated-catalog-style">
.integrated-catalog-nav{box-sizing:border-box;display:flex;align-items:center;gap:.75rem;min-height:3.25rem;padding:.5rem clamp(1rem,3vw,2rem);background:#f8fafc;color:#172b43;border-bottom:1px solid #d9e2ec;font:500 .92rem/1.4 system-ui,-apple-system,"Segoe UI","Noto Sans TC","Microsoft JhengHei",sans-serif}
.integrated-catalog-brand{display:flex;align-items:center;gap:.6rem;color:#173c61!important;font-weight:750;text-decoration:none!important;white-space:nowrap}
.integrated-catalog-mark{display:inline-grid;place-items:center;width:1.8rem;height:1.8rem;border-radius:.35rem;background:#175ca8;color:#fff;font-weight:800}
.integrated-catalog-subject{color:#566679;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.integrated-catalog-return{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-height:2.25rem;padding:.35rem .75rem;border:1px solid #a9bfd3;border-radius:.4rem;background:#fff;color:#174f82!important;font-weight:700;text-decoration:none!important;white-space:nowrap}
.integrated-catalog-return:hover{background:#eaf2fb;border-color:#175ca8}
.integrated-catalog-nav a:focus-visible,.question-bank-browser :focus-visible{outline:3px solid #f0a524;outline-offset:2px}
@media(max-width:520px){.integrated-catalog-nav{gap:.5rem;padding-inline:.75rem;font-size:.82rem}.integrated-catalog-subject{display:none}.integrated-catalog-return{padding-inline:.55rem}}
</style>'''

BANK_CSS = r'''<style id="question-bank-style">
.question-bank-browser{max-width:1100px;margin:0 auto;padding:clamp(1rem,3vw,1.75rem);background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg)}
.question-bank-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:1rem}
.question-bank-heading h2{margin:0;font-size:1.35rem;font-weight:800}
.question-bank-heading p{margin:.25rem 0 0;color:var(--text-muted);font-size:.92rem}
.question-bank-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;align-items:end;padding:1rem;background:var(--bg-surface-alt);border-radius:var(--radius-md)}
.question-bank-field{display:grid;gap:.35rem;min-width:0}
.question-bank-field label{font-weight:700;font-size:.88rem}
.question-bank-field input,.question-bank-field select{width:100%;min-height:2.7rem}
.question-bank-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.85rem}
.question-bank-status{margin:1rem 0 .5rem;color:var(--text-muted);font-size:.92rem}
.question-bank-list{display:grid;gap:.75rem}
.question-bank-card{min-width:0;padding:1rem;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:var(--bg-surface)}
.question-bank-meta{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.65rem;color:var(--text-muted);font-size:.82rem}
.question-bank-tag{padding:.15rem .5rem;border-radius:999px;background:var(--bg-surface-alt)}
.question-bank-stem{margin:0 0 .65rem;font-weight:700;line-height:1.65;overflow-wrap:anywhere}
.question-bank-options{display:grid;gap:.35rem;margin:0 0 .75rem;padding:0;list-style:none}
.question-bank-options li{display:grid;grid-template-columns:1.5rem 1fr;gap:.5rem;line-height:1.55}
.question-bank-options li strong{color:var(--primary)}
.question-bank-card details{border-top:1px solid var(--border-subtle);padding-top:.65rem;color:var(--text-main)}
.question-bank-card summary{cursor:pointer;color:var(--primary);font-weight:700}
.question-bank-answer{margin:.65rem 0 .35rem}
.question-bank-explanation{margin:.35rem 0;color:var(--text-muted);white-space:pre-line}
.question-bank-practice{margin-top:.7rem}
.question-bank-pagination{display:flex;align-items:center;justify-content:center;gap:.75rem;margin-top:1rem}
.question-bank-empty{padding:2rem 1rem;text-align:center;color:var(--text-muted);border:1px dashed var(--border-strong);border-radius:var(--radius-md)}
@media(max-width:520px){.question-bank-browser{padding:.9rem}.question-bank-actions>*{flex:1 1 100%}.question-bank-pagination{justify-content:space-between}}
</style>'''

BANK_MARKUP = r'''    <section id="view-bank" class="view-panel">
      <div class="question-bank-browser">
        <div class="question-bank-heading">
          <div><h2>歷屆題庫</h2><p>依考期、考科與章節篩選；可查看詳解，或從題目直接作答並記錄進度。</p></div>
        </div>
        <div class="question-bank-filters" aria-label="題庫篩選條件">
          <div class="question-bank-field"><label for="bank-period-filter">考期／場次</label><select id="bank-period-filter" class="select-dropdown"><option value="">全部考期</option></select></div>
          <div class="question-bank-field" id="bank-part-field"><label for="bank-part-filter">考科／組別</label><select id="bank-part-filter" class="select-dropdown"><option value="">全部考科</option></select></div>
          <div class="question-bank-field"><label for="bank-topic-filter">章節／知識點</label><select id="bank-topic-filter" class="select-dropdown"><option value="">全部章節</option></select></div>
          <div class="question-bank-field"><label for="bank-search">關鍵字</label><input id="bank-search" class="search-input" type="search" placeholder="搜尋題目、選項或解析" autocomplete="off"></div>
        </div>
        <div class="question-bank-actions">
          <label class="question-bank-field" for="bank-quiz-count"><span>篩選後練習題數</span><select id="bank-quiz-count" class="select-dropdown"><option value="10">10 題</option><option value="20" selected>20 題</option><option value="50">50 題</option><option value="all">全部符合題目</option></select></label>
          <button type="button" class="btn btn-secondary" id="bank-clear-filters">清除篩選</button>
          <button type="button" class="btn btn-primary" id="bank-start-filtered">隨機練習篩選結果</button>
          <button type="button" class="btn btn-danger" id="bank-start-wrong">練習錯題</button>
        </div>
        <p id="bank-result-count" class="question-bank-status" role="status" aria-live="polite"></p>
        <div id="bank-question-list" class="question-bank-list"></div>
        <nav class="question-bank-pagination" aria-label="題庫頁次">
          <button type="button" class="btn btn-secondary" id="bank-previous-page">上一頁</button>
          <span id="bank-page-label" aria-live="polite"></span>
          <button type="button" class="btn btn-secondary" id="bank-next-page">下一頁</button>
        </nav>
      </div>
    </section>'''

BANK_JS = r'''  // Shared question browser for subject packs.
  const questionBankPageSize = 10;
  const questionBankMeta = new Map();
  let questionBankMatches = [];
  let questionBankPage = 0;

  function getQuestionBankMeta(q) {
    const header = (q.question.match(/^[【\[](.+?)[】\]]/) || [null, ''])[1];
    const period = (header.match(/第\s*\d+\s*屆/) || [null])[0]
      || ((header.match(/場次\s*(.+?)(?=\s*第\s*\d+\s*題|$)/) || [null, ''])[1]).trim()
      || '未標示';
    const part = (header.match(/法規|實務/) || [null])[0] || '';
    const chapter = (pack.chapters.find(c => c.id === q.chapterId) || {}).title || '未分類';
    return { period, part, chapter };
  }

  function fillBankFilter(select, values, allLabel) {
    select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` + values.map(value =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
    ).join('');
  }

  function renderQuestionBank() {
    const period = document.getElementById('bank-period-filter').value;
    const part = document.getElementById('bank-part-filter').value;
    const chapter = document.getElementById('bank-topic-filter').value;
    const query = document.getElementById('bank-search').value.trim().toLocaleLowerCase();
    questionBankMatches = pack.questions.filter(q => {
      const meta = questionBankMeta.get(q.id);
      if (period && meta.period !== period) return false;
      if (part && meta.part !== part) return false;
      if (chapter && q.chapterId !== chapter) return false;
      if (query && !`${q.question} ${q.options.join(' ')} ${q.explanation || ''} ${meta.chapter}`.toLocaleLowerCase().includes(query)) return false;
      return true;
    });
    const pageCount = Math.max(1, Math.ceil(questionBankMatches.length / questionBankPageSize));
    questionBankPage = Math.min(questionBankPage, pageCount - 1);
    const first = questionBankPage * questionBankPageSize;
    const shown = questionBankMatches.slice(first, first + questionBankPageSize);
    document.getElementById('bank-result-count').textContent = questionBankMatches.length
      ? `符合 ${questionBankMatches.length} 題，顯示 ${first + 1}–${first + shown.length} 題`
      : '符合 0 題；請清除部分篩選條件。';
    document.getElementById('bank-page-label').textContent = `${questionBankPage + 1} / ${pageCount}`;
    document.getElementById('bank-previous-page').disabled = questionBankPage === 0;
    document.getElementById('bank-next-page').disabled = questionBankPage >= pageCount - 1;
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    document.getElementById('bank-question-list').innerHTML = shown.length ? shown.map(q => {
      const meta = questionBankMeta.get(q.id);
      const answer = Array.isArray(q.answer) ? q.answer : [q.answer];
      const answerText = answer.map(index => letters[index] || String(index + 1)).join('、');
      const typeText = q.type === 'multiple-choice' ? '複選' : (q.type === 'true-false' ? '是非' : '單選');
      const optionHtml = q.options.map((option, index) => `<li><strong>${letters[index] || index + 1}</strong><span>${escapeHtml(option)}</span></li>`).join('');
      return `<article class="question-bank-card">
        <div class="question-bank-meta"><span class="question-bank-tag">${escapeHtml(meta.period)}</span>${meta.part ? `<span class="question-bank-tag">${escapeHtml(meta.part)}</span>` : ''}<span class="question-bank-tag">${escapeHtml(meta.chapter)}</span><span class="question-bank-tag">${typeText}</span></div>
        <p class="question-bank-stem">${escapeHtml(q.question)}</p>
        <ul class="question-bank-options">${optionHtml}</ul>
        <details><summary>揭曉答案與解析</summary><p class="question-bank-answer"><strong>正確答案：</strong>${escapeHtml(answerText)}</p><p class="question-bank-explanation">${escapeHtml(q.explanation || '此題未附解析。')}</p></details>
        <button type="button" class="btn btn-primary question-bank-practice" data-bank-practice="${escapeHtml(q.id)}">開始作答並記錄結果</button>
      </article>`;
    }).join('') : '<div class="question-bank-empty" role="status">沒有符合條件的題目，請調整篩選或搜尋詞。</div>';
  }

  function setupQuestionBank() {
    pack.questions.forEach(q => questionBankMeta.set(q.id, getQuestionBankMeta(q)));
    const periods = [...new Set([...questionBankMeta.values()].map(meta => meta.period))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const parts = [...new Set([...questionBankMeta.values()].map(meta => meta.part).filter(Boolean))].sort();
    const chapters = pack.chapters.map(c => ({ id: c.id, title: c.title }));
    fillBankFilter(document.getElementById('bank-period-filter'), periods, '全部考期');
    fillBankFilter(document.getElementById('bank-part-filter'), parts, '全部考科／組別');
    document.getElementById('bank-part-field').hidden = parts.length < 2;
    const topicSelect = document.getElementById('bank-topic-filter');
    topicSelect.innerHTML = '<option value="">全部章節／知識點</option>' + chapters.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`).join('');
    ['bank-period-filter', 'bank-part-filter', 'bank-topic-filter'].forEach(id => document.getElementById(id).addEventListener('change', () => { questionBankPage = 0; renderQuestionBank(); }));
    document.getElementById('bank-search').addEventListener('input', () => { questionBankPage = 0; renderQuestionBank(); });
    document.getElementById('bank-clear-filters').addEventListener('click', () => {
      document.getElementById('bank-period-filter').value = '';
      document.getElementById('bank-part-filter').value = '';
      document.getElementById('bank-topic-filter').value = '';
      document.getElementById('bank-search').value = '';
      questionBankPage = 0;
      renderQuestionBank();
      document.getElementById('bank-search').focus();
    });
    document.getElementById('bank-start-filtered').addEventListener('click', () => {
      const value = document.getElementById('bank-quiz-count').value;
      switchView('quiz');
      startQuiz('custom', '', value === 'all' ? 'all' : Number(value), questionBankMatches);
    });
    document.getElementById('bank-start-wrong').addEventListener('click', () => {
      switchView('quiz');
      startQuiz('wrong', '', 'all');
    });
    document.getElementById('bank-previous-page').addEventListener('click', () => { questionBankPage--; renderQuestionBank(); });
    document.getElementById('bank-next-page').addEventListener('click', () => { questionBankPage++; renderQuestionBank(); });
    document.getElementById('bank-question-list').addEventListener('click', event => {
      const button = event.target.closest('[data-bank-practice]');
      if (!button) return;
      const q = pack.questions.find(item => item.id === button.dataset.bankPractice);
      if (!q) return;
      switchView('quiz');
      startQuiz('custom', '', 'all', [q]);
    });
    renderQuestionBank();
  }
'''


def decode(path: Path):
    raw = path.read_bytes()
    bom = raw.startswith(b'\xef\xbb\xbf')
    return raw.decode('utf-8-sig'), bom, ('\r\n' if b'\r\n' in raw else '\n')


def encode(text: str, bom: bool) -> bytes:
    return (b'\xef\xbb\xbf' if bom else b'') + text.encode('utf-8')


def pack_data(text: str):
    marker = 'window.__STUDY_PACK__ = '
    start = text.index(marker) + len(marker)
    return json.JSONDecoder().raw_decode(text[start:])[0]


def add_question_bank(path: Path, text: str, newline: str):
    if 'id="view-bank"' in text:
        return text, False
    original = pack_data(text)
    before_questions = original['questions']
    targets = [
        (r'(?m)^(\s*<button class="tab-btn" data-view="quiz" type="button">.*?</button>)$', r'\1' + newline + '      <button class="tab-btn" data-view="bank" type="button">📚 題庫</button>'),
        ("    quiz: document.getElementById('view-quiz'),", "    quiz: document.getElementById('view-quiz')," + newline + "    bank: document.getElementById('view-bank'),"),
        ("    if (viewName === 'search') document.getElementById('search-input')?.focus();", "    if (viewName === 'search') document.getElementById('search-input')?.focus();" + newline + "    if (viewName === 'bank') renderQuestionBank();"),
    ]
    for old, new in targets:
        if old.startswith('(?m)'):
            text, count = re.subn(old, new, text, count=1)
        else:
            count = text.count(old)
            if count == 1:
                text = text.replace(old, new, 1)
        if count != 1:
            raise RuntimeError(f'{path.name}: expected one insertion point: {old!r}')
    settings_marker = '    <section id="view-settings" class="view-panel">'
    if settings_marker not in text:
        raise RuntimeError(f'{path.name}: settings section not found')
    text = text.replace(settings_marker, BANK_MARKUP.replace('\n', newline) + newline + settings_marker, 1)
    text, count = re.subn(
        r'function startQuiz\(mode, chapterId = \'\', count = 20\) \{',
        "function startQuiz(mode, chapterId = '', count = 20, sourcePool = null) {", text, count=1)
    if count != 1:
        raise RuntimeError(f'{path.name}: quiz start function not found')
    replacements = [
        ('    let pool = [];\n    if (mode === \'chapter\') {', "    let pool = Array.isArray(sourcePool) ? [...sourcePool] : [];\n    if (!Array.isArray(sourcePool) && mode === 'chapter') {"),
        ("    } else if (mode === 'wrong') {", "    } else if (!Array.isArray(sourcePool) && mode === 'wrong') {"),
        ("    } else {\n      // random\n      pool = [...pack.questions];\n    }", "    } else if (!Array.isArray(sourcePool)) {\n      // random\n      pool = [...pack.questions];\n    }"),
        ("    setupSearch();", "    setupQuestionBank();\n    setupSearch();"),
    ]
    for old, new in replacements:
        if text.count(old) != 1:
            raise RuntimeError(f'{path.name}: expected one quiz patch point: {old!r}')
        text = text.replace(old, new, 1)
    init_marker = '  function init() {'
    if init_marker not in text:
        raise RuntimeError(f'{path.name}: initialization marker not found')
    text = text.replace(init_marker, BANK_JS.replace('\n', newline) + newline + init_marker, 1)
    head_end = re.search(r'</head\s*>', text, re.I)
    if not head_end:
        raise RuntimeError(f'{path.name}: head close not found')
    text = text[:head_end.start()] + BANK_CSS.replace('\n', newline) + newline + text[head_end.start():]
    after = pack_data(text)
    if after['questions'] != before_questions:
        raise RuntimeError(f'{path.name}: question payload changed while adding UI')
    return text, True


def add_portal(path: Path, text: str, newline: str):
    if path.resolve() == (ROOT / 'index.html').resolve() or 'id="integrated-catalog-nav"' in text:
        return text, False
    relative = Path(os.path.relpath(ROOT / 'index.html', start=path.parent)).as_posix()
    top = path.relative_to(ROOT).parts[0]
    labels = {
        '01_信託業務人員': '信託業務人員', '02_金融科技力': '金融科技力',
        '03_消費金融內控稽核': '消費金融內控稽核', '04_永續發展基礎能力': '永續發展基礎能力',
        '05_防制洗錢與打擊資恐': '防制洗錢與打擊資恐', '06_四科彙整題庫': '四科彙整題庫',
        '00_四科官方題目與解答PDF': '四科官方題目與解答 PDF', '00_既有核對報告': '核對報告',
    }
    subject = labels.get(top, '教材與題庫')
    nav = f'''<nav id="integrated-catalog-nav" class="integrated-catalog-nav" aria-label="五科整合目錄">
  <a class="integrated-catalog-brand" href="{relative}"><span class="integrated-catalog-mark" aria-hidden="true">學</span><span>五科教材與題庫</span></a>
  <span class="integrated-catalog-subject">{subject}</span>
  <a class="integrated-catalog-return" href="{relative}">← 返回五科目錄</a>
</nav>'''.replace('\n', newline)
    body = re.search(r'<body\b[^>]*>', text, re.I)
    head = re.search(r'</head\s*>', text, re.I)
    if not body or not head:
        raise RuntimeError(f'{path.relative_to(ROOT)}: missing body/head; cannot add catalog navigation')
    text = text[:head.start()] + PORTAL_CSS.replace('\n', newline) + newline + text[head.start():]
    body = re.search(r'<body\b[^>]*>', text, re.I)
    text = text[:body.end()] + newline + nav + newline + text[body.end():]
    return text, True


plans = []
for path in PACKS:
    text, bom, newline = decode(path)
    quick_review_key = "quickReview: document.getElementById('view-quick-review'),"
    if text.count(quick_review_key) == 1:
        text = text.replace(quick_review_key, "'quick-review': document.getElementById('view-quick-review'),", 1)
    updated, changed = add_question_bank(path, text, newline)
    plans.append((path, updated, bom, changed))

for path in sorted(ROOT.rglob('*.html')):
    if path.resolve() == (ROOT / 'index.html').resolve():
        continue
    if any(path.resolve() == entry[0].resolve() for entry in plans):
        continue
    text, bom, newline = decode(path)
    updated, changed = add_portal(path, text, newline)
    if path.name == '信託歷屆題庫.html':
        old_home = '<a class="btn" href="index.html">返回教材</a>'
        new_home = '<a class="btn" href="../../index.html">返回五科目錄</a>'
        if old_home in updated:
            updated = updated.replace(old_home, new_home, 1)
            changed = True
    plans.append((path, updated, bom, changed))

# Add the catalog return to Study Pack pages after their new question-browser views.
for index, (path, text, bom, bank_changed) in enumerate(plans):
    if path in PACKS:
        updated, portal_changed = add_portal(path, text, '\r\n' if '\r\n' in text else '\n')
        plans[index] = (path, updated, bom, bank_changed or portal_changed)

# Validate the complete patch before writing any page.
for path, text, bom, _ in plans:
    if 'id="integrated-catalog-nav"' not in text:
        raise RuntimeError(f'{path.relative_to(ROOT)} missing catalog navigation')
    target = re.search(r'<a class="integrated-catalog-return" href="([^"]+)"', text)
    if not target or not (path.parent / target.group(1)).resolve().exists():
        raise RuntimeError(f'{path.relative_to(ROOT)} catalog link does not resolve')
    if path in PACKS:
        if 'id="view-bank"' not in text or 'data-view="bank"' not in text or 'function setupQuestionBank()' not in text:
            raise RuntimeError(f'{path.relative_to(ROOT)} missing question browser features')
        if pack_data(text)['questions'] is None:
            raise RuntimeError(f'{path.relative_to(ROOT)} missing question data')

for path, text, bom, _ in plans:
    path.write_bytes(encode(text, bom))

report = {
    'date': '2026-10-16',
    'html_files_with_catalog_navigation': len(plans),
    'subject_packs_with_question_browser': len(PACKS),
    'features': ['period/session filters', 'exam part filter when present', 'chapter/knowledge-point filter', 'keyword search', 'answer and explanation reveal', 'random quiz from filtered results', 'one-question attempt with progress tracking', 'existing wrong-question quiz'],
    'pack_question_counts': {path.name: len(pack_data(path.read_text(encoding='utf-8-sig'))['questions']) for path in PACKS},
    'catalog_links_resolved': True,
    'html_sha256': {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path, *_ in plans},
}
(REPORT / 'ui_harmonization_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='html_sha256'}, ensure_ascii=True, indent=2))
