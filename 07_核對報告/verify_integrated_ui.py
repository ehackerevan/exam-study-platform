from __future__ import annotations

import base64
import copy
import json
import hashlib
import re
import struct
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPILER_DIST = ROOT.parent / "Study Pack Compiler" / "dist"
PACKS = [
    ROOT / "02_金融科技力" / "02_離線教材題庫包" / "金融科技力重點教材.html",
    ROOT / "03_消費金融內控稽核" / "02_離線教材題庫包" / "消費金融內部控制與稽核重點教材.html",
    ROOT / "04_永續發展基礎能力" / "02_離線教材題庫包" / "永續發展基礎能力重點教材.html",
    ROOT / "05_防制洗錢與打擊資恐" / "02_離線教材題庫包" / "防制洗錢與打擊資恐重點教材.html",
]
TRUST_SHELL = ROOT / "01_信託業務人員" / "06_答案核對版" / "信託業務人員教材與題庫_核對版.html"
REQUIRED_CSS_VARS = {
    "--bg-surface", "--border-subtle", "--radius-lg", "--text-muted",
    "--bg-surface-alt", "--radius-md", "--primary", "--text-main",
    "--border-strong",
}


class ReturnLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_return_link = False
        self.hrefs: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "a" and "integrated-catalog-return" in classes:
            self.in_return_link = True
            if attrs.get("href"):
                self.hrefs.append(attrs["href"])

    def handle_endtag(self, tag):
        if tag == "a" and self.in_return_link:
            self.in_return_link = False


def pack_data(source: str):
    marker = "window.__STUDY_PACK__ = "
    start = source.index(marker) + len(marker)
    return json.JSONDecoder().raw_decode(source[start:])[0]


MERMAID_BLOCK = re.compile(r"```mermaid\s*\r?\n.*?\r?\n```", re.I | re.S)
DIAGRAM_FIGURE = re.compile(r'<figure class="textbook-diagram".*?</figure>', re.S)
PNG_DATA_URI = re.compile(r'<img\b[^>]*src="data:image/png;base64,([A-Za-z0-9+/=]+)"', re.S)
SOURCE_SUBJECTS = {
    "金融科技力重點教材.html": "02_金融科技力",
    "消費金融內部控制與稽核重點教材.html": "03_消費金融內控稽核",
    "永續發展基礎能力重點教材.html": "04_永續發展基礎能力",
    "防制洗錢與打擊資恐重點教材.html": "05_防制洗錢與打擊資恐",
    "防制洗錢與打擊資恐人員重點教材_既有輸出.html": "05_防制洗錢與打擊資恐",
}


def _without_curriculum_content(pack: dict) -> dict:
    result = copy.deepcopy(pack)
    for field in ("description", "title", "chapters"):
        result.pop(field, None)
    return result


def verify_rendered_diagrams(pack: dict, original: dict, name: str) -> int:
    if pack.get("questions") != original.get("questions"):
        raise AssertionError(f"Question payload changed: {name}")
    if _without_curriculum_content(pack) != _without_curriculum_content(original):
        raise AssertionError(f"Non-content package data changed: {name}")

    diagram_count = 0
    for chapter in pack.get("chapters", []):
        for section in chapter.get("sections", []):
            actual = section.get("content", "")
            figures = DIAGRAM_FIGURE.findall(actual)
            if "```mermaid" in actual.lower() or "\\n" in actual:
                raise AssertionError(f"Mermaid diagrams not fully rendered: {name}/{section.get('id')}")
            for figure in figures:
                images = PNG_DATA_URI.findall(figure)
                if len(images) != 1:
                    raise AssertionError(f"Expected one embedded PNG: {name}/{section.get('id')}")
                try:
                    png = base64.b64decode(images[0], validate=True)
                except ValueError as exc:
                    raise AssertionError(f"Invalid embedded PNG: {name}/{section.get('id')}") from exc
                if png[:8] != b"\x89PNG\r\n\x1a\n" or len(png) < 1000:
                    raise AssertionError(f"Invalid or empty image: {name}/{section.get('id')}")
                width, height = struct.unpack(">II", png[16:24])
                if width < 200 or height < 100:
                    raise AssertionError(f"Unexpected image dimensions {width}x{height}: {name}/{section.get('id')}")
            diagram_count += len(figures)
    source_subject = SOURCE_SUBJECTS.get(name)
    if source_subject is None:
        raise AssertionError(f"No current Markdown source mapping for {name}")
    source_root = ROOT / source_subject
    source_dirs = [path for path in source_root.iterdir() if path.is_dir() and "教材" in path.name]
    source_count = sum(len(MERMAID_BLOCK.findall(path.read_text(encoding="utf-8-sig"))) for folder in source_dirs for path in folder.rglob("*.md"))
    if diagram_count != source_count:
        raise AssertionError(f"Rendered diagram count {diagram_count} does not match current Markdown count {source_count}: {name}")
    return diagram_count


def bank_script(source: str) -> str:
    start_marker = "// Shared question browser for subject packs."
    end_marker = "  function init() {"
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


NODE_BANK_HARNESS = r'''const vm = require('node:vm');
const assert = require('node:assert/strict');
let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => payload += chunk);
process.stdin.on('end', () => {
  const {bankJs, pack} = JSON.parse(payload);
  class Element {
    constructor() { this.value = ''; this.textContent = ''; this.innerHTML = ''; this.disabled = false; this.hidden = false; this.dataset = {}; this.listeners = {}; this.focused = false; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    fire(type, event = {}) { if (this.listeners[type]) return this.listeners[type](event); }
    focus() { this.focused = true; }
  }
  const ids = ['bank-period-filter','bank-part-filter','bank-topic-filter','bank-search','bank-quiz-count','bank-part-field','bank-clear-filters','bank-start-filtered','bank-start-wrong','bank-open-quiz-setup','bank-result-count','bank-page-label','bank-previous-page','bank-next-page','bank-question-list'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  elements['bank-quiz-count'].value = '20';
  const startCalls = [];
  const switchedViews = [];
  const context = {
    pack,
    document: {getElementById: id => elements[id]},
    escapeHtml: value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),
    startQuiz: (...args) => startCalls.push(args),
    switchView: view => switchedViews.push(view),
  };
  vm.runInNewContext(`${bankJs}\nsetupQuestionBank();`, context);
  const currentMatches = () => vm.runInContext('questionBankMatches', context);
  const meta = q => {
    const header = (q.question.match(/^[【\[](.+?)[】\]]/) || [null, ''])[1];
    const period = (header.match(/第\s*\d+\s*屆/) || [null])[0] || ((header.match(/場次\s*(.+?)(?=\s*第\s*\d+\s*題|$)/) || [null, ''])[1] || '').trim() || '未標示';
    return {period, part:(header.match(/法規|實務/) || [null])[0] || ''};
  };
  const initialCount = Number((elements['bank-result-count'].textContent.match(/符合 (\d+) 題/) || [null, 0])[1]);
  assert.equal(initialCount, pack.questions.length, 'initial question count');
  const periods = [...new Set(pack.questions.map(q => meta(q).period))];
  const chosenPeriod = periods.sort((a,b) => pack.questions.filter(q => meta(q).period === b).length - pack.questions.filter(q => meta(q).period === a).length)[0];
  elements['bank-period-filter'].value = chosenPeriod;
  elements['bank-period-filter'].fire('change');
  let expected = pack.questions.filter(q => meta(q).period === chosenPeriod);
  assert.deepEqual(Array.from(currentMatches(), q => q.id), expected.map(q => q.id), 'period filter');
  const periodCount = expected.length;
  const availableParts = [...new Set(pack.questions.map(q => meta(q).part).filter(Boolean))];
  let chosenPart = '';
  if (availableParts.length > 1) {
    chosenPart = availableParts.sort((a,b) => pack.questions.filter(q => meta(q).period === chosenPeriod && meta(q).part === b).length - pack.questions.filter(q => meta(q).period === chosenPeriod && meta(q).part === a).length)[0];
    elements['bank-part-filter'].value = chosenPart;
    elements['bank-part-filter'].fire('change');
    expected = pack.questions.filter(q => meta(q).period === chosenPeriod && meta(q).part === chosenPart);
    assert.deepEqual(Array.from(currentMatches(), q => q.id), expected.map(q => q.id), 'exam part filter');
  }
  if (periodCount > 10) {
    const before = elements['bank-page-label'].textContent;
    elements['bank-next-page'].fire('click');
    assert.notEqual(elements['bank-page-label'].textContent, before, 'pagination next');
    elements['bank-previous-page'].fire('click');
    assert.equal(elements['bank-page-label'].textContent, before, 'pagination previous');
  }
  const q0 = expected[0];
  elements['bank-topic-filter'].value = q0.chapterId;
  elements['bank-topic-filter'].fire('change');
  expected = expected.filter(q => q.chapterId === q0.chapterId);
  assert.deepEqual(Array.from(currentMatches(), q => q.id), expected.map(q => q.id), 'chapter filter');
  elements['bank-search'].value = q0.question;
  elements['bank-search'].fire('input');
  expected = expected.filter(q => `${q.question} ${q.options.join(' ')} ${q.explanation || ''}`.toLocaleLowerCase().includes(q0.question.toLocaleLowerCase()));
  assert.deepEqual(Array.from(currentMatches(), q => q.id), expected.map(q => q.id), 'keyword filter');
  assert.ok(expected.length > 0, 'keyword should match at least one question');
  assert.match(elements['bank-question-list'].innerHTML, /揭曉答案與解析/, 'answer disclosure');
  assert.match(elements['bank-question-list'].innerHTML, /正確答案：/, 'answer content');
  assert.match(elements['bank-question-list'].innerHTML, /Google 搜尋此題/, 'per-question Google search link');
  assert.match(elements['bank-question-list'].innerHTML, /rel="noopener noreferrer"/, 'Google link safe target');
  assert.match(elements['bank-question-list'].innerHTML, /<div class="question-bank-stem-row">[\s\S]*Google 搜尋此題[\s\S]*<\/div>\s*<ul class="question-bank-options">/, 'Google link beside question stem');
  const target = expected[0];
  elements['bank-question-list'].fire('click', {target:{closest:selector => selector === '[data-bank-practice]' ? {dataset:{bankPractice:target.id}} : null}});
  assert.equal(startCalls.at(-1)[0], 'custom', 'single-question practice mode');
  assert.deepEqual(Array.from(startCalls.at(-1)[3], q => q.id), [target.id], 'single-question practice pool');
  assert.equal(switchedViews.at(-1), 'quiz', 'single-question opens quiz');
  elements['bank-search'].value = '';
  elements['bank-topic-filter'].value = '';
  elements['bank-search'].fire('input');
  elements['bank-period-filter'].fire('change');
  expected = pack.questions.filter(q => meta(q).period === chosenPeriod && (!chosenPart || meta(q).part === chosenPart));
  elements['bank-quiz-count'].value = '10';
  elements['bank-start-filtered'].fire('click');
  assert.equal(startCalls.at(-1)[0], 'custom', 'filtered quiz mode');
  assert.equal(startCalls.at(-1)[2], 10, 'filtered quiz count');
  assert.deepEqual(Array.from(startCalls.at(-1)[3], q => q.id), expected.map(q => q.id), 'filtered quiz pool');
  elements['bank-open-quiz-setup'].fire('click');
  assert.equal(switchedViews.at(-1), 'quiz', 'quiz setup route');
  elements['bank-start-wrong'].fire('click');
  assert.equal(startCalls.at(-1)[0], 'wrong', 'wrong-question mode');
  elements['bank-clear-filters'].fire('click');
  assert.equal(elements['bank-period-filter'].value, '', 'clear period');
  assert.equal(elements['bank-topic-filter'].value, '', 'clear chapter');
  assert.equal(elements['bank-search'].value, '', 'clear search');
  assert.equal(elements['bank-search'].focused, true, 'return focus to search');
  let multiChoiceChecked = false;
  for (const q of pack.questions.filter(q => q.type === 'multiple-choice')) {
    elements['bank-search'].value = q.question;
    elements['bank-search'].fire('input');
    if (currentMatches().some(item => item.id === q.id)) {
      const answer = Array.isArray(q.answer) ? q.answer : [q.answer];
      const letters = ['A','B','C','D','E','F'];
      const answerText = answer.map(index => letters[index] || String(index + 1)).join('、');
      assert.ok(elements['bank-question-list'].innerHTML.includes(`正確答案：</strong>${answerText}`), 'multiple-choice answer labels');
      multiChoiceChecked = true;
      break;
    }
  }
  if (pack.questions.some(q => q.type === 'multiple-choice')) assert.ok(multiChoiceChecked, 'multiple-choice answer detail');
  console.log(JSON.stringify({initialCount,period:chosenPeriod,periodCount,examPartFilter:chosenPart ? 'passed' : 'not-applicable',chapterSearchAndPractice:'passed',filteredQuiz:'passed',quizSetup:'passed',googleQuestionSearch:'passed',wrongPractice:'passed',clearFilters:'passed',multipleChoiceAnswer:multiChoiceChecked ? 'passed' : 'not-applicable'}));
});'''


NODE_SUBJECT_NAV_HARNESS = r'''const vm = require('node:vm');
const assert = require('node:assert/strict');
let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => payload += chunk);
process.stdin.on('end', () => {
  const {navigationJs} = JSON.parse(payload);
  class Element {
    constructor(id, dataset = {}) { this.id = id; this.dataset = dataset; this.hidden = false; this.textContent = ''; this.attrs = {}; this.classes = new Set(); this.classList = {toggle:(name,force)=>force ? this.classes.add(name) : this.classes.delete(name),contains:name=>this.classes.has(name)}; }
    setAttribute(name,value){this.attrs[name]=value;}
    focus(){}
  }
  const viewIds = ['dashboard','reader','search','quick-review','quiz','bank','settings'];
  const byId = Object.fromEntries(viewIds.map(name => [`view-${name}`,new Element(`view-${name}`)]));
  byId['study-subnav'] = new Element('study-subnav');
  byId['settings-toggle'] = new Element('settings-toggle');
  byId['search-input'] = new Element('search-input');
  const mainTabs = [new Element('study-tab',{pane:'study'}),new Element('questions-tab',{pane:'questions'})];
  const studyTabs = ['dashboard','reader','search','quick-review'].map(view => new Element(view,{view}));
  const document = {getElementById:id=>byId[id],querySelectorAll:selector=>selector==='.subject-tab-btn'?mainTabs:(selector==='.view-nav-btn'?studyTabs:[])};
  const context = {document,renderDashboard(){},renderReader(){},renderQuickReview(){},renderQuestionBank(){}};
  vm.runInNewContext(`let currentView = 'dashboard';\n${navigationJs}\nswitchView('dashboard');`,context);
  assert.equal(mainTabs[0].attrs['aria-selected'],'true','study tab selected');
  assert.equal(byId['study-subnav'].hidden,false,'study subnav visible');
  vm.runInContext("switchView('reader')",context);
  assert.equal(studyTabs.find(btn=>btn.dataset.view==='reader').classList.contains('active'),true,'reader subnav active');
  vm.runInContext("switchView('bank')",context);
  assert.equal(mainTabs[1].attrs['aria-selected'],'true','question tab selected');
  assert.equal(byId['study-subnav'].hidden,true,'study subnav hidden in question area');
  vm.runInContext("switchView('quiz')",context);
  assert.equal(mainTabs[1].attrs['aria-selected'],'true','question tab remains selected in quiz');
  vm.runInContext("switchView('settings')",context);
  assert.equal(byId['settings-toggle'].textContent,'↩ 返回','settings return action');
  assert.equal(byId['settings-toggle'].attrs['aria-pressed'],'true','settings state');
  vm.runInContext('switchView(settingsReturnView)',context);
  assert.equal(vm.runInContext('currentView',context),'quiz','return to prior view');
  assert.equal(byId['settings-toggle'].textContent,'⚙️ 設定','settings action reset');
  console.log(JSON.stringify({twoPrimaryTabs:'passed',studySubnav:'passed',questionArea:'passed',settingsReturn:'passed'}));
});'''


NODE_TRUST_HARNESS = r'''const vm = require('node:vm');
const assert = require('node:assert/strict');
const {TextDecoder} = require('node:util');
let payload = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => payload += chunk);
process.stdin.on('end', () => {
  const {script} = JSON.parse(payload);
  class Element {
    constructor(id, pane = '') { this.id = id; this.dataset = {pane}; this.hidden = false; this.srcdoc = ''; this.style = {}; this.attrs = {}; this.listeners = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    setAttribute(name, value) { this.attrs[name] = value; }
    fire(type, event = {}) { if (this.listeners[type]) return this.listeners[type](event); }
  }
  const study = new Element('studyFrame');
  const questions = new Element('questionsFrame');
  const error = new Element('loadError');
  const tabs = [new Element('studyTab','study'),new Element('questionsTab','questions')];
  const frames = [study,questions];
  const listeners = {};
  const location = {hash:''};
  const history = {replaceState(_state,_title,hash){location.hash = hash;}};
  const document = {
    getElementById(id){ return ({studyFrame:study,questionsFrame:questions,loadError:error})[id]; },
    querySelectorAll(selector){ return selector === '.tab' ? tabs : (selector === '.page-frame' ? frames : []); },
  };
  const context = {document,window:{addEventListener:(name,fn)=>listeners[name]=fn},location,history,TextDecoder,atob:value=>Buffer.from(value,'base64').toString('binary'),console:{error(){}}};
  vm.runInNewContext(script, context);
  assert.ok(study.srcdoc.toLowerCase().includes('<title>'), 'study embedded page loaded');
  assert.equal(study.hidden,false,'study frame visible at start');
  assert.equal(questions.hidden,true,'question frame hidden at start');
  tabs[1].fire('click');
  assert.ok(questions.srcdoc.toLowerCase().includes('<title>'),'question bank embedded page loaded');
  assert.notEqual(questions.srcdoc,study.srcdoc,'distinct embedded pages loaded');
  assert.equal(study.hidden,true,'study frame hidden after switch');
  assert.equal(questions.hidden,false,'question frame visible after switch');
  assert.equal(tabs[1].attrs['aria-selected'],'true','question tab selected');
  assert.equal(location.hash,'#questions','tab route stored in hash');
  listeners.message({data:{type:'trust-study-switch',pane:'study'}});
  assert.equal(study.hidden,false,'in-page return message switches to study');
  assert.equal(questions.hidden,true,'question frame hidden after in-page return');
  console.log(JSON.stringify({studyFrame:'loaded and visible',questionFrame:'loaded and switchable',hashNavigation:'passed',inPageReturn:'passed'}));
});'''


def main() -> None:
    html_files = sorted(ROOT.rglob("*.html"))
    non_catalog_pages = [path for path in html_files if path != ROOT / "index.html"]
    missing_nav: list[str] = []
    unresolved_links: list[str] = []
    for path in non_catalog_pages:
        source = path.read_text(encoding="utf-8-sig")
        if 'id="integrated-catalog-style"' not in source or "integrated-catalog-nav" not in source:
            missing_nav.append(path.relative_to(ROOT).as_posix())
            continue
        parser = ReturnLinkParser()
        parser.feed(source)
        if not parser.hrefs:
            unresolved_links.append(f"{path.relative_to(ROOT).as_posix()}: missing return link")
            continue
        if len(parser.hrefs) != 1:
            unresolved_links.append(f"{path.relative_to(ROOT).as_posix()}: expected 1 return link, found {len(parser.hrefs)}")
            continue
        target = (path.parent / parser.hrefs[0]).resolve()
        if target != (ROOT / "index.html").resolve() or not target.is_file():
            unresolved_links.append(f"{path.relative_to(ROOT).as_posix()}: {parser.hrefs[0]}")
    if missing_nav or unresolved_links:
        raise AssertionError({"missing_nav": missing_nav, "unresolved_links": unresolved_links})

    report_path = ROOT / "07_核對報告" / "ui_harmonization_report.json"
    report = json.loads(report_path.read_text(encoding="utf-8-sig"))
    recorded_hashes = report.get("html_sha256", {})
    if len(recorded_hashes) != len(non_catalog_pages):
        raise AssertionError(f"HTML hash manifest has {len(recorded_hashes)} entries for {len(non_catalog_pages)} pages")
    for relative, expected_hash in recorded_hashes.items():
        path = ROOT / relative
        actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            raise AssertionError(f"HTML hash does not match UI report: {relative}")

    pack_results = {}
    with tempfile.TemporaryDirectory(prefix="study-pack-js-check-") as temp_dir:
        temp_root = Path(temp_dir)
        trust_source = TRUST_SHELL.read_text(encoding="utf-8-sig")
        if not re.search(r"body\s*\{[^}]*grid-template-rows\s*:\s*auto\s+auto\s+minmax\(0,\s*1fr\)", trust_source, re.S):
            raise AssertionError("Trust shell must allocate rows for catalog, app bar, and page content")
        trust_scripts = re.findall(r"<script\b(?![^>]*\bsrc\b)[^>]*>(.*?)</script>", trust_source, flags=re.S | re.I)
        for script_index, script in enumerate(trust_scripts):
            script_path = temp_root / f"trust-{script_index}.js"
            script_path.write_text(script, encoding="utf-8")
            check = subprocess.run(["node", "--check", str(script_path)], capture_output=True, text=True)
            if check.returncode:
                raise AssertionError(f"trust inline script {script_index}: {check.stderr}")
        trust_interaction = subprocess.run(
            ["node", "-e", NODE_TRUST_HARNESS],
            input=json.dumps({"script": trust_scripts[0]}, ensure_ascii=False),
            capture_output=True, text=True, encoding="utf-8",
        )
        if trust_interaction.returncode:
            raise AssertionError(f"trust screen harness failed: {trust_interaction.stderr or trust_interaction.stdout}")
        embedded_questions = re.search(r"questions:\s*'([^']+)'", trust_source)
        embedded_question_html = base64.b64decode(embedded_questions.group(1)).decode("utf-8") if embedded_questions else ""
        if 'https://www.google.com/search?q=${encodeURIComponent(q.t)}' not in embedded_question_html or 'rel="noopener noreferrer"' not in embedded_question_html:
            raise AssertionError("Trust question screen must contain its per-question Google search link")
        aggregate_source = (ROOT / "06_四科彙整題庫" / "歷屆考古題_完整題庫大全.html").read_text(encoding="utf-8-sig")
        if 'https://www.google.com/search?q=${encodeURIComponent(q.text)}' not in aggregate_source or 'rel="noopener noreferrer"' not in aggregate_source:
            raise AssertionError("Aggregate question cards must contain a safe Google search link")
        catalog_source = (ROOT / "index.html").read_text(encoding="utf-8-sig")
        if '<details class="supporting-links">' not in catalog_source:
            raise AssertionError("Catalog supporting links must be collapsible")
        for index, path in enumerate(PACKS):
            source = path.read_text(encoding="utf-8-sig")
            main_nav = re.search(r'<nav class="nav-tabs" aria-label="主要內容">(.*?)</nav>', source, flags=re.S)
            if not main_nav or len(re.findall(r'data-pane="(?:study|questions)"', main_nav.group(1))) != 2:
                raise AssertionError(f"{path.name} must have two Trust-style primary tabs")
            if source.count('class="view-nav-btn') != 4 or 'id="study-subnav"' not in source:
                raise AssertionError(f"{path.name} must keep four secondary study actions")
            if 'https://www.google.com/search?q=${encodeURIComponent(q.question)}' not in source or 'rel="noopener noreferrer"' not in source or 'class="question-bank-stem-row"' not in source:
                raise AssertionError(f"{path.name} missing safe question-adjacent Google search link")
            if '<details class="question-bank-filter-disclosure" open>' not in source:
                raise AssertionError(f"{path.name} question filters must be collapsible")
            data = pack_data(source)
            original_path = COMPILER_DIST / path.name
            original = pack_data(original_path.read_text(encoding="utf-8-sig"))
            rendered_diagrams = verify_rendered_diagrams(data, original, path.name)
            defined_vars = set(re.findall(r"(--[\w-]+)\s*:", source))
            missing_vars = sorted(REQUIRED_CSS_VARS - defined_vars)
            if missing_vars:
                raise AssertionError(f"{path.name} missing CSS vars: {missing_vars}")
            inline_scripts = re.findall(r"<script\b(?![^>]*\bsrc\b)[^>]*>(.*?)</script>", source, flags=re.S | re.I)
            for script_index, script in enumerate(inline_scripts):
                script_path = temp_root / f"{index}-{script_index}.js"
                script_path.write_text(script, encoding="utf-8")
                check = subprocess.run(["node", "--check", str(script_path)], capture_output=True, text=True)
                if check.returncode:
                    raise AssertionError(f"{path.name} inline script {script_index}: {check.stderr}")
            bank_js = bank_script(source)
            payload = json.dumps({"bankJs": bank_js, "pack": data}, ensure_ascii=False)
            interaction = subprocess.run(["node", "-e", NODE_BANK_HARNESS], input=payload, capture_output=True, text=True, encoding="utf-8")
            if interaction.returncode:
                raise AssertionError(f"{path.name} interaction harness failed: {interaction.stderr or interaction.stdout}")
            nav_start = source.index("  // DOM 參考快取")
            nav_end = source.index("  // ===== 1. Dashboard 渲染 =====", nav_start)
            navigation_js = source[nav_start:nav_end]
            navigation = subprocess.run(
                ["node", "-e", NODE_SUBJECT_NAV_HARNESS],
                input=json.dumps({"navigationJs": navigation_js}, ensure_ascii=False),
                capture_output=True, text=True, encoding="utf-8",
            )
            if navigation.returncode:
                raise AssertionError(f"{path.name} navigation harness failed: {navigation.stderr or navigation.stdout}")
            pack_results[path.name] = {
                "questions": len(data["questions"]),
                "inline_script_blocks": len(inline_scripts),
                "question_payload_matches_compiler_output": True,
                "rendered_mermaid_diagrams_from_current_markdown": rendered_diagrams,
                "embedded_images_valid": True,
                "css_variables_defined": True,
                "trust_style_navigation": json.loads(navigation.stdout.strip()),
                "question_bank_interactions": json.loads(interaction.stdout.strip()),
            }

    legacy_path = ROOT / "05_防制洗錢與打擊資恐" / "03_其他離線版本" / "防制洗錢與打擊資恐人員重點教材_既有輸出.html"
    legacy_original_path = COMPILER_DIST / "防制洗錢與打擊資恐人員重點教材.html"
    legacy_diagrams = verify_rendered_diagrams(
        pack_data(legacy_path.read_text(encoding="utf-8-sig")),
        pack_data(legacy_original_path.read_text(encoding="utf-8-sig")),
        legacy_path.name,
    )

    result = {
        "html_pages_total": len(html_files),
        "catalog_page": "index.html",
        "pages_with_catalog_return_navigation": len(non_catalog_pages),
        "catalog_return_links_resolved": True,
        "html_sha256_manifest_matches": True,
        "study_pack_inline_scripts_syntax": "passed",
        "trust_shell": {
            "grid_rows_allocate_catalog_app_bar_and_content": True,
            "inline_scripts_syntax": "passed",
            "per_question_google_search": True,
            "embedded_study_and_question_screens": json.loads(trust_interaction.stdout.strip()),
        },
        "google_question_search": "present in Trust, all four subject packs, and the four-subject aggregate",
        "catalog_secondary_links_collapsible": True,
        "packs": pack_results,
        "additional_offline_packs": {legacy_path.name: {"rendered_mermaid_diagrams_from_current_markdown": legacy_diagrams, "question_payload_matches_compiler_output": True, "embedded_images_valid": True}},
        "browser_visual_validation": "not run: local file URL was blocked by browser security policy; no workaround attempted",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
