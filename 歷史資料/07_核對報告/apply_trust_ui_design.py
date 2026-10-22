from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKS = [
    ROOT / "02_金融科技力" / "02_離線教材題庫包" / "金融科技力重點教材.html",
    ROOT / "03_消費金融內控稽核" / "02_離線教材題庫包" / "消費金融內部控制與稽核重點教材.html",
    ROOT / "04_永續發展基礎能力" / "02_離線教材題庫包" / "永續發展基礎能力重點教材.html",
    ROOT / "05_防制洗錢與打擊資恐" / "02_離線教材題庫包" / "防制洗錢與打擊資恐重點教材.html",
]
AGGREGATE = ROOT / "06_四科彙整題庫" / "歷屆考古題_完整題庫大全.html"
CATALOG = ROOT / "index.html"
REPORT = ROOT / "07_核對報告" / "ui_harmonization_report.json"

TRUST_STYLE = r'''<style id="trust-ui-shell-style">
.app-header{background:#0f2742;color:#f8fafc;border-bottom:0;box-shadow:0 2px 10px rgba(15,39,66,.25)}
.brand-badge{background:#175ca8;color:#fff;border-radius:10px}
.brand-title{color:#f8fafc}
.brand-meta{color:#cbd5e1}
.nav-tabs{background:transparent;border-radius:0;padding:0;gap:8px;max-width:none;overflow:visible}
.subject-tab-btn{min-height:44px;padding:8px 16px;border:1px solid rgba(255,255,255,.28);border-radius:10px;background:transparent;color:#f8fafc;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap}
.subject-tab-btn:hover{color:#fff;background:rgba(255,255,255,.08)}
.subject-tab-btn.active{color:#422006;background:#f59e0b;border-color:#f59e0b;box-shadow:none}
.subject-tab-btn:focus-visible,.header-settings:focus-visible,.view-nav-btn:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}
.header-settings{min-height:44px;padding:.45rem .7rem;border-color:rgba(255,255,255,.28);border-radius:10px;color:#f8fafc;background:transparent;font-weight:700;white-space:nowrap}
.header-settings:hover{color:#fff;background:rgba(255,255,255,.08)}
.header-settings[aria-pressed="true"]{color:#422006;background:#f59e0b;border-color:#f59e0b}
.app-container{display:flex;flex-direction:column;align-items:stretch;min-height:0}
.study-subnav{display:flex;align-items:center;gap:.45rem;width:100%;max-width:1100px;margin:0 auto;padding:.8rem clamp(1rem,3vw,1.75rem) .55rem;border-bottom:1px solid var(--border-subtle)}
.study-subnav[hidden]{display:none!important}
.view-nav-btn{min-height:40px;padding:.4rem .8rem;border:1px solid transparent;border-radius:var(--radius-md);background:transparent;color:var(--text-muted);font:inherit;font-weight:650;white-space:nowrap;cursor:pointer}
.view-nav-btn:hover{background:var(--bg-surface-alt);color:var(--text-main)}
.view-nav-btn.active{border-color:var(--border-subtle);background:var(--bg-surface);color:var(--primary);box-shadow:var(--shadow-sm)}
.view-panel.active{flex:1;width:100%}
.question-bank-filter-disclosure{margin:.5rem 0 .75rem;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:var(--bg-surface)}
.question-bank-filter-disclosure>summary{padding:.7rem .9rem;color:var(--text-main);font-weight:750;cursor:pointer;list-style-position:inside}
.question-bank-filter-disclosure[open]>summary{border-bottom:1px solid var(--border-subtle)}
.question-bank-filter-disclosure .question-bank-filters{border-radius:0 0 var(--radius-md) var(--radius-md)}
.question-bank-card-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;margin-top:.7rem}
.question-bank-card-actions .question-bank-practice{margin-top:0}
.question-bank-stem-row{display:flex;align-items:flex-start;gap:.75rem;margin:0 0 .65rem}
.question-bank-stem-row .question-bank-stem{flex:1;margin:0}
.question-bank-stem-row .question-bank-google-link{flex:0 0 auto;min-height:2.25rem;padding:.35rem .55rem}
.question-bank-google-link{display:inline-flex;align-items:center;justify-content:center;min-height:2.5rem;padding:.4rem .7rem;border:1px solid var(--border-strong);border-radius:var(--radius-md);color:var(--primary);background:var(--bg-surface);font-size:.88rem;font-weight:700;text-decoration:none}
.question-bank-google-link:hover{background:var(--bg-surface-alt);text-decoration:underline}
@media(max-width:768px){.app-header{max-width:100%;height:auto;min-height:var(--header-height);flex-wrap:wrap;gap:.55rem;padding:.55rem .8rem}.nav-tabs{max-width:none;overflow:visible}.study-subnav{overflow-x:auto;padding-inline:.8rem}.view-nav-btn{flex:0 0 auto}}
@media(max-width:600px){.app-header{height:auto;min-height:0;padding:.55rem .7rem}.brand-section{flex:1 1 calc(100% - 6rem);min-width:0}.brand-meta{display:none}.nav-tabs{order:3;flex:1 1 100%;width:100%;display:grid;grid-template-columns:1fr 1fr}.subject-tab-btn{width:100%;justify-content:center}.header-settings{order:2}.study-subnav{padding:.5rem .7rem;gap:.25rem}.view-nav-btn{padding:.35rem .55rem;font-size:.85rem}.question-bank-card-actions>*{flex:1 1 auto}.question-bank-stem-row{flex-direction:column}}
</style>'''

NEW_MAIN_TABS = '''    <nav class="nav-tabs" aria-label="主要內容">
      <button class="tab-btn subject-tab-btn active" data-pane="study" type="button" aria-selected="true">📘 教材</button>
      <button class="tab-btn subject-tab-btn" data-pane="questions" type="button" aria-selected="false">📝 歷屆題庫</button>
    </nav>
    <button type="button" class="btn-icon header-settings" id="settings-toggle" aria-label="開啟設定" aria-pressed="false" title="設定">⚙️ 設定</button>'''

STUDY_SUBNAV = '''
    <nav class="study-subnav" id="study-subnav" aria-label="教材功能">
      <button class="view-nav-btn active" data-view="dashboard" type="button">總覽</button>
      <button class="view-nav-btn" data-view="reader" type="button">教材閱讀</button>
      <button class="view-nav-btn" data-view="search" type="button">教材搜尋</button>
      <button class="view-nav-btn" data-view="quick-review" type="button">速查</button>
    </nav>'''

OLD_MAIN_TABS = '''    <nav class="nav-tabs" aria-label="主功能分頁">
      <button class="tab-btn active" data-view="dashboard" type="button">📊 總覽</button>
      <button class="tab-btn" data-view="reader" type="button">📘 教材</button>
      <button class="tab-btn" data-view="search" type="button">🔍 搜尋</button>
      <button class="tab-btn" data-view="quick-review" type="button">💡 速查</button>
      <button class="tab-btn" data-view="quiz" type="button">📝 測驗</button>
      <button class="tab-btn" data-view="bank" type="button">📚 題庫</button>
      <button class="tab-btn" data-view="settings" type="button">⚙️ 設定</button>
    </nav>'''

NEW_SWITCH_VIEW = '''  // 切換視圖並同步 Trust 樣式的兩個主要分頁。
  function mainPaneForView(viewName) {
    if (studyViewNames.has(viewName)) return 'study';
    if (questionViewNames.has(viewName)) return 'questions';
    return studyViewNames.has(settingsReturnView) ? 'study' : 'questions';
  }

  function switchView(viewName) {
    if (!views[viewName]) return;
    if (viewName === 'settings' && currentView !== 'settings') settingsReturnView = currentView;
    if (studyViewNames.has(viewName)) lastStudyView = viewName;
    currentView = viewName;
    Object.keys(views).forEach(key => {
      if (views[key]) views[key].classList.toggle('active', key === viewName);
    });
    navTabBtns.forEach(btn => {
      const active = btn.dataset.view === viewName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });
    const pane = mainPaneForView(viewName);
    subjectTabBtns.forEach(btn => {
      const active = btn.dataset.pane === pane;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    studySubnav.hidden = !studyViewNames.has(viewName);
    settingsToggleBtn.textContent = viewName === 'settings' ? '↩ 返回' : '⚙️ 設定';
    settingsToggleBtn.setAttribute('aria-label', viewName === 'settings' ? '返回上一頁' : '開啟設定');
    settingsToggleBtn.setAttribute('aria-pressed', String(viewName === 'settings'));

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'reader') renderReader();
    if (viewName === 'quick-review') renderQuickReview();
    if (viewName === 'search') document.getElementById('search-input')?.focus();
    if (viewName === 'bank') renderQuestionBank();
  }

'''

TRUST_SEARCH_STYLE = '''<style id="question-google-search-style">
.question-google-link{display:inline-flex;align-items:center;min-height:40px;padding:7px 10px;border:1px solid var(--primary);border-radius:8px;color:var(--primary);font-size:.85rem;font-weight:700;text-decoration:none;white-space:nowrap}
.question-google-link:hover{background:var(--primary-light);text-decoration:underline}
</style>'''


def decode(path: Path) -> tuple[str, bool, str]:
    raw = path.read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    return raw.decode("utf-8-sig"), bom, "\r\n" if b"\r\n" in raw else "\n"


def encode(text: str, bom: bool, newline: str) -> bytes:
    normalized = text.replace("\r\n", "\n").replace("\n", newline)
    return (b"\xef\xbb\xbf" if bom else b"") + normalized.encode("utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} insertion point, found {count}")
    return text.replace(old, new, 1)


GOOGLE_QUESTION_LINK = '<a class="question-bank-google-link" href="https://www.google.com/search?q=${encodeURIComponent(q.question)}" target="_blank" rel="noopener noreferrer" aria-label="使用 Google 搜尋此題">🔎 Google 搜尋此題 ↗</a>'
QUESTION_PRACTICE_BUTTON = '<button type="button" class="btn btn-primary question-bank-practice" data-bank-practice="${escapeHtml(q.id)}">開始作答並記錄結果</button>'


def move_google_search_to_question(path: Path, source: str) -> str:
    if 'class="question-bank-stem-row"' in source:
        return source
    old_stem = '        <p class="question-bank-stem">${escapeHtml(q.question)}</p>'
    new_stem = f'        <div class="question-bank-stem-row"><p class="question-bank-stem">${{escapeHtml(q.question)}}</p>{GOOGLE_QUESTION_LINK}</div>'
    source = replace_once(source, old_stem, new_stem, f"{path.name} question-adjacent Google link")
    old_actions = f'        <div class="question-bank-card-actions">{QUESTION_PRACTICE_BUTTON}{GOOGLE_QUESTION_LINK}</div>'
    new_actions = f'        <div class="question-bank-card-actions">{QUESTION_PRACTICE_BUTTON}</div>'
    source = replace_once(source, old_actions, new_actions, f"{path.name} remove duplicate Google action")
    if '.question-bank-stem-row{' not in source:
        source = replace_once(source, '.question-bank-card-actions .question-bank-practice{margin-top:0}', '.question-bank-card-actions .question-bank-practice{margin-top:0}\n.question-bank-stem-row{display:flex;align-items:flex-start;gap:.75rem;margin:0 0 .65rem}\n.question-bank-stem-row .question-bank-stem{flex:1;margin:0}\n.question-bank-stem-row .question-bank-google-link{flex:0 0 auto;min-height:2.25rem;padding:.35rem .55rem}', f"{path.name} question-adjacent link layout")
    return source


def transform_pack(path: Path, source: str) -> str:
    if 'id="trust-ui-shell-style"' in source:
        return move_google_search_to_question(path, source)
    source = replace_once(source, OLD_MAIN_TABS, NEW_MAIN_TABS, f"{path.name} main tab bar")
    source = replace_once(source, '<span class="brand-meta" id="app-brand-version">v1.0.0</span>', '<span class="brand-meta" id="app-brand-version">教材、題庫與離線學習進度</span>', f"{path.name} header subtitle")
    source = replace_once(source, '  <main class="app-container">', '  <main class="app-container">' + STUDY_SUBNAV, f"{path.name} study subnav")
    source = replace_once(source, "const navTabBtns = document.querySelectorAll('.tab-btn');", "const subjectTabBtns = document.querySelectorAll('.subject-tab-btn');\n  const navTabBtns = document.querySelectorAll('.view-nav-btn');\n  const studySubnav = document.getElementById('study-subnav');\n  const settingsToggleBtn = document.getElementById('settings-toggle');\n  const studyViewNames = new Set(['dashboard', 'reader', 'search', 'quick-review']);\n  const questionViewNames = new Set(['bank', 'quiz']);\n  let lastStudyView = 'dashboard';\n  let settingsReturnView = 'dashboard';", f"{path.name} navigation references")
    source = replace_once(source, "  let currentView = 'dashboard'; // 'dashboard' | 'reader' | 'search' | 'quick-review' | 'quiz' | 'settings'", "  let currentView = 'dashboard'; // 'dashboard' | 'reader' | 'search' | 'quick-review' | 'quiz' | 'bank' | 'settings'", f"{path.name} current view state")
    source = replace_once(source, "    document.getElementById('app-brand-version').textContent = `v${pack.contentVersion || '1.0'}`;\n", "", f"{path.name} version label")
    source = replace_once(source, "    // 導航 Tab 事件\n    navTabBtns.forEach(btn => {\n      btn.onclick = () => switchView(btn.dataset.view);\n    });", "    // 主要區域與教材次導覽。\n    subjectTabBtns.forEach(btn => {\n      btn.onclick = () => switchView(btn.dataset.pane === 'study' ? lastStudyView : 'bank');\n    });\n    navTabBtns.forEach(btn => {\n      btn.onclick = () => switchView(btn.dataset.view);\n    });\n    settingsToggleBtn.onclick = () => switchView(currentView === 'settings' ? settingsReturnView : 'settings');", f"{path.name} navigation handlers")
    switch_pattern = r"  // 切換視圖\n  function switchView\(viewName\) \{.*?\n  \}\n\n  // ===== 1\. Dashboard 渲染 ====="
    source, count = re.subn(switch_pattern, NEW_SWITCH_VIEW + "  // ===== 1. Dashboard 渲染 =====", source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path.name}: could not replace view switch function")

    source = replace_once(source, '        <div class="question-bank-filters" aria-label="題庫篩選條件">', '        <details class="question-bank-filter-disclosure" open>\n          <summary>篩選條件</summary>\n          <div class="question-bank-filters" aria-label="題庫篩選條件">', f"{path.name} filter disclosure start")
    source = replace_once(source, '        </div>\n        <div class="question-bank-actions">', '          </div>\n        </details>\n        <div class="question-bank-actions">', f"{path.name} filter disclosure end")
    source = replace_once(source, '          <button type="button" class="btn btn-danger" id="bank-start-wrong">練習錯題</button>', '          <button type="button" class="btn btn-danger" id="bank-start-wrong">練習錯題</button>\n          <button type="button" class="btn btn-secondary" id="bank-open-quiz-setup">測驗設定</button>', f"{path.name} quiz setup link")
    source = replace_once(source, '        <button type="button" class="btn btn-primary question-bank-practice" data-bank-practice="${escapeHtml(q.id)}">開始作答並記錄結果</button>', '        <div class="question-bank-card-actions"><button type="button" class="btn btn-primary question-bank-practice" data-bank-practice="${escapeHtml(q.id)}">開始作答並記錄結果</button><a class="question-bank-google-link" href="https://www.google.com/search?q=${encodeURIComponent(q.question)}" target="_blank" rel="noopener noreferrer" aria-label="使用 Google 搜尋此題">🔎 Google 搜尋此題 ↗</a></div>', f"{path.name} Google question search link")
    source = replace_once(source, "    document.getElementById('bank-start-wrong').addEventListener('click', () => {\n      switchView('quiz');\n      startQuiz('wrong', '', 'all');\n    });", "    document.getElementById('bank-start-wrong').addEventListener('click', () => {\n      switchView('quiz');\n      startQuiz('wrong', '', 'all');\n    });\n    document.getElementById('bank-open-quiz-setup').addEventListener('click', () => switchView('quiz'));", f"{path.name} quiz setup handler")
    source = replace_once(source, "</head>", TRUST_STYLE + "\n</head>", f"{path.name} trust-style header")
    return move_google_search_to_question(path, source)


def transform_aggregate(source: str) -> str:
    if "question-google-search-style" not in source:
        source = replace_once(source, "</head>", TRUST_SEARCH_STYLE + "\n</head>", "aggregate Google link styles")
    old = '<div class="q-text">${escapeHtml(q.text)}</div>'
    new = '<div class="q-text">${escapeHtml(q.text)}</div>\n            <a class="question-google-link" href="https://www.google.com/search?q=${encodeURIComponent(q.text)}" target="_blank" rel="noopener noreferrer" aria-label="使用 Google 搜尋此題">🔎 Google 搜尋此題 ↗</a>'
    if old in source:
        source = replace_once(source, old, new, "aggregate question search action")
    elif new not in source:
        raise RuntimeError("Aggregate question card template not found")
    return source


def transform_catalog(source: str) -> str:
    if 'class="supporting-links"' in source:
        return source
    old = '<section class="links" aria-label="其他整合資料"><a href="06_四科彙整題庫/歷屆考古題_完整題庫大全.html">開啟四科彙整題庫</a><a href="README_分類索引.md">查看分類索引</a><a href="07_核對報告/題目答案核對摘要.md">查看題目與答案核對報告</a></section>'
    new = '<details class="supporting-links"><summary>來源、索引與核對資料</summary><section class="links" aria-label="其他整合資料"><a href="06_四科彙整題庫/歷屆考古題_完整題庫大全.html">開啟四科彙整題庫</a><a href="README_分類索引.md">查看分類索引</a><a href="07_核對報告/題目答案核對摘要.md">查看題目與答案核對報告</a></section></details>'
    source = replace_once(source, old, new, "catalog supporting-links section")
    source = replace_once(source, "</style>", ".supporting-links{margin-top:1rem;border-top:1px solid var(--line);padding-top:.8rem}.supporting-links summary{cursor:pointer;color:var(--muted);font-weight:700}.supporting-links[open] summary{margin-bottom:.5rem}\n</style>", "catalog supporting-links styles")
    return source


def main() -> None:
    pending: list[tuple[Path, str, bool, str]] = []
    for path in PACKS:
        source, bom, newline = decode(path)
        pending.append((path, transform_pack(path, source), bom, newline))
    for path in (AGGREGATE, CATALOG):
        source, bom, newline = decode(path)
        updated = transform_aggregate(source) if path == AGGREGATE else transform_catalog(source)
        pending.append((path, updated, bom, newline))

    # Validate the full batch before writing any output.
    for path, source, _, _ in pending:
        if path in PACKS:
            for marker in ('data-pane="study"', 'data-pane="questions"', 'id="study-subnav"', 'Google 搜尋此題', 'question-bank-stem-row', 'question-bank-filter-disclosure', 'id="bank-open-quiz-setup"'):
                if marker not in source:
                    raise RuntimeError(f"{path.name}: missing expected UI element {marker}")
            if source.count('class="view-nav-btn') != 4:
                raise RuntimeError(f"{path.name}: expected four study navigation actions")
    for path, source, bom, newline in pending:
        path.write_bytes(encode(source, bom, newline))

    report = json.loads(REPORT.read_text(encoding="utf-8-sig"))
    for path in (*PACKS, AGGREGATE):
        relative = path.relative_to(ROOT).as_posix().replace('/', '\\')
        report.setdefault("html_sha256", {})[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    report["trust_template_update"] = {
        "subject_pack_primary_tabs": ["教材", "歷屆題庫"],
        "preserved_study_routes": ["總覽", "教材閱讀", "教材搜尋", "速查"],
        "settings_access": "header utility button with return-to-previous-view behavior",
        "question_actions": ["single-question attempt", "Google search for each question", "filtered random practice", "wrong-question practice", "quiz setup"],
        "question_filters_collapsible": True,
        "catalog_secondary_links_collapsible": True,
        "aggregate_question_google_search": True,
    }
    report.setdefault("verification", {})["question_cards_google_search"] = "placed beside every question stem in all four subject packs and the four-subject aggregate; Trust already had per-question Google search"
    report["verification"]["question_search_target_safety"] = "noopener noreferrer on all five subject banks and the four-subject aggregate"
    report["verification"]["subject_pack_navigation"] = "Trust-style two primary tabs with preserved secondary study navigation"
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"updated_packs": [path.name for path in PACKS], "updated_aggregate": AGGREGATE.name, "updated_catalog": CATALOG.name}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
