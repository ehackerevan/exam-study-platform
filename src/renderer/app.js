/**
 * Study Pack Client-side Application Core
 * 完全離線執行，零外部依賴
 */
(function() {
  'use strict';

  // 取得內嵌資料
  const pack = window.__STUDY_PACK__;
  if (!pack || !pack.id) {
    console.error('Study Pack 資料缺失');
    return;
  }

  // 常數與門檻設定
  const questionIds = new Set(pack.questions.map(question => question.id));
  const readingSections = chapter => chapter.teachingSections || chapter.sections;
  const sectionText = new WeakMap();
  const searchableContent = section => {
    if(!sectionText.has(section)){const template=document.createElement('template');template.innerHTML=window.StudyContent.render(section.content || '');sectionText.set(section,template.content.textContent || '');}
    return sectionText.get(section);
  };
  const hasTeachingChapter = id => readingSections(pack.chapters.find(chapter => chapter.id === id)||{sections:[]}).some(section => !section.id.endsWith('-source-note') && (section.content || section.keyPoints?.length || section.notes?.length));
  const STORAGE_KEY = `study-pack.${pack.id}.progress`;
  const THRESHOLDS = {
    WEAK: 60,     // < 60% 需要加強
    MODERATE: 80  // 60-80% 尚未穩定, > 80% 穩定
  };

  // 預設進度狀態
  let progress = {
    format: 'study-pack-progress-v1',
    packId: pack.id,
    schemaVersion: pack.schemaVersion || 1,
    contentVersion: pack.contentVersion || '1.0.0',
    completedChapters: [],
    hiddenQuestionIds: [],
    favoriteQuestionIds: [],
    questionStats: Object.create(null), // { [id]: { attempts, wrongCount, correctCount, lastResult, lastAnsweredAt } }
    quizHistory: [],
    lastPosition: { chapterId: '', sectionId: '' },
    settings: { theme: 'system' }
  };

  let storageWritable = true;
  function showStorageWarning(message) {
    document.getElementById('storage-warning-banner').style.display = 'flex';
    document.getElementById('storage-warning-message').textContent = message;
  }
  function normalizeProgress(data) {
    if (!data || data.format !== 'study-pack-progress-v1' || data.packId !== pack.id ||
      !Array.isArray(data.completedChapters) || !data.completedChapters.every(id => typeof id === 'string') ||
      !data.questionStats || typeof data.questionStats !== 'object' || Array.isArray(data.questionStats) ||
      !data.lastPosition || typeof data.lastPosition.chapterId !== 'string' ||
      (data.lastPosition.sectionId !== undefined && typeof data.lastPosition.sectionId !== 'string') ||
      (data.quizHistory !== undefined && (!Array.isArray(data.quizHistory) || data.quizHistory.length > 20 || data.quizHistory.some(item =>
        !item || !['chapter','random','wrong','exam','featured','knowledge-point'].includes(item.mode) ||
        !Number.isSafeInteger(item.questionCount) || item.questionCount < 1 ||
        !Number.isSafeInteger(item.correctCount) || item.correctCount < 0 ||
        !Number.isSafeInteger(item.wrongCount) || item.wrongCount < 0 ||
        item.correctCount + item.wrongCount !== item.questionCount ||
        !Number.isSafeInteger(item.accuracy) || item.accuracy < 0 || item.accuracy > 100 ||
        typeof item.completedAt !== 'string' || !Number.isFinite(Date.parse(item.completedAt)) ||
        (item.term !== undefined && typeof item.term !== 'string') ||
        (item.subject !== undefined && typeof item.subject !== 'string') ||
        (item.knowledgePoint !== undefined && (typeof item.knowledgePoint !== 'string' || !item.knowledgePoint.trim())) ||
        (item.featuredGroup !== undefined && typeof item.featuredGroup !== 'string'))))) throw Error('進度結構不正確');
    for(const field of ['hiddenQuestionIds','favoriteQuestionIds'])if(data[field]!==undefined&&(!Array.isArray(data[field])||!data[field].every(id=>typeof id==='string')))throw Error('題目標記格式不正確');
    for (const record of Object.values(data.questionStats)) {
      if (!record || !['attempts','wrongCount','correctCount'].every(key => Number.isSafeInteger(record[key]) && record[key] >= 0) ||
        record.attempts !== record.wrongCount + record.correctCount || typeof record.lastResult !== 'boolean') throw Error('作答紀錄不正確');
    }
    return {...progress, ...data, hiddenQuestionIds:[...new Set((data.hiddenQuestionIds||[]).filter(id=>questionIds.has(id)))], favoriteQuestionIds:[...new Set((data.favoriteQuestionIds||[]).filter(id=>questionIds.has(id)))], questionStats:Object.assign(Object.create(null),data.questionStats), completedChapters:[...new Set(data.completedChapters.filter(id => pack.chapters.some(ch => ch.id === id)))],
      settings:{theme:['system','light','dark'].includes(data.settings?.theme) ? data.settings.theme : 'system'},
      lastPosition:{chapterId:data.lastPosition.chapterId,sectionId:data.lastPosition.sectionId || ''},
      quizHistory:(data.quizHistory || []).slice(0,20)};
  }
  // 載入 localStorage
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        progress = normalizeProgress(parsed);
      }
    } catch (err) {
      storageWritable = false;
      showStorageWarning('無法讀取原有紀錄，本次僅暫存於頁面，不會覆寫原資料。請匯出備份。');
    }
  }

  function saveProgress() {
    if (!storageWritable) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return true;
    } catch (err) {
      storageWritable = false;
      showStorageWarning('目前無法保存進度，本次作答只暫存於頁面，關閉或重新整理會消失。請匯出備份。');
      return false;
    }
  }

  const isQuestionHidden = question => progress.hiddenQuestionIds.includes(question.id);
  function setQuestionMark(field,id,enabled){
    if(!questionIds.has(id))return;
    progress[field]=enabled?[...new Set([...progress[field],id])]:progress[field].filter(value=>value!==id);
    saveProgress();
    for(const button of document.querySelectorAll('.question-favorite')){
      const selected=progress.favoriteQuestionIds.includes(button.dataset.questionId);
      button.textContent=selected?'★ 已精選':'☆ 加入精選';button.setAttribute('aria-pressed',String(selected));
    }
    renderQuestionManager();
  }
  function createQuestionActions(question,onHide){
    const bar=document.createElement('div');bar.className='question-actions';
    const favorite=document.createElement('button');favorite.type='button';favorite.className='btn btn-secondary question-favorite';favorite.dataset.questionId=question.id;
    const selected=progress.favoriteQuestionIds.includes(question.id);favorite.textContent=selected?'★ 已精選':'☆ 加入精選';favorite.setAttribute('aria-pressed',String(selected));
    favorite.onclick=()=>setQuestionMark('favoriteQuestionIds',question.id,!progress.favoriteQuestionIds.includes(question.id));
    const hide=document.createElement('button');hide.type='button';hide.className='btn btn-secondary question-hide';hide.textContent='隱藏題目';
    hide.onclick=()=>{
      setQuestionMark('hiddenQuestionIds',question.id,true);
      let notice=document.getElementById('question-mark-notice');
      if(!notice){notice=document.createElement('div');notice.id='question-mark-notice';notice.setAttribute('role','status');document.body.append(notice);}
      notice.replaceChildren(document.createTextNode('已隱藏，之後不再出題。 '));
      const undo=document.createElement('button');undo.type='button';undo.className='btn btn-secondary';undo.textContent='復原';
      undo.onclick=()=>{setQuestionMark('hiddenQuestionIds',question.id,false);notice.textContent='已恢復，可再次出題。';};notice.append(undo);
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='btn btn-secondary';dismiss.textContent='關閉';dismiss.onclick=()=>notice.remove();notice.append(dismiss);
      onHide();undo.focus();
    };
    bar.append(favorite,hide);return bar;
  }
  function renderQuestionManager(){
    const panel=document.getElementById('personal-question-panel');if(!panel)return;
    const available=progress.favoriteQuestionIds.filter(id=>!progress.hiddenQuestionIds.includes(id)).length;
    panel.querySelector('#btn-personal-favorites').textContent=`練習我的精選（${available}）`;
    panel.querySelector('#btn-personal-favorites').disabled=available===0;
    panel.querySelector('#hidden-question-heading').textContent=`已隱藏題目（${progress.hiddenQuestionIds.length}）`;
    const query=panel.querySelector('#hidden-question-search').value.trim().toLowerCase();
    const matches=pack.questions.filter(q=>isQuestionHidden(q)&&q.question.toLowerCase().includes(query));
    const list=panel.querySelector('#hidden-question-list');list.replaceChildren();
    for(const question of matches.slice(0,50)){
      const item=document.createElement('li'),label=document.createElement('span');label.textContent=question.question;
      const restore=document.createElement('button');restore.type='button';restore.className='btn btn-secondary';restore.textContent='恢復出題';
      restore.onclick=()=>{setQuestionMark('hiddenQuestionIds',question.id,false);panel.querySelector('#hidden-question-search').focus();};item.append(label,restore);list.append(item);
    }
    panel.querySelector('#hidden-question-count').textContent=matches.length?`符合 ${matches.length} 題${matches.length>50?'，顯示前 50 題；可搜尋縮小範圍。':''}`:'沒有符合的隱藏題目。';
  }
  function initQuestionManager(){
    const panel=document.createElement('section');panel.id='personal-question-panel';
    panel.innerHTML='<h3>我的題目</h3><label class="personal-only"><input type="checkbox" id="only-personal-favorites"> 只練我的精選（可搭配章節、知識點或考期）</label><button type="button" class="btn btn-primary" id="btn-personal-favorites">練習我的精選</button><details><summary id="hidden-question-heading">已隱藏題目</summary><label for="hidden-question-search">搜尋隱藏題目</label><input type="search" id="hidden-question-search" placeholder="輸入題目關鍵字"><p id="hidden-question-count"></p><ul id="hidden-question-list"></ul></details>';
    document.querySelector('#quiz-setup-panel .quiz-config-card').append(panel);
    panel.querySelector('#btn-personal-favorites').onclick=()=>startQuiz('random','','all',pack.questions.filter(q=>progress.favoriteQuestionIds.includes(q.id)));
    panel.querySelector('#hidden-question-search').addEventListener('input',renderQuestionManager);renderQuestionManager();
  }

  // 主題管理
  function applyTheme(theme) {
    progress.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    saveProgress();
  }

  // 狀態管理
  let currentView = 'dashboard'; // 'dashboard' | 'reader' | 'search' | 'quiz' | 'settings'
  let currentChapterId = progress.lastPosition.chapterId || (pack.chapters[0] ? pack.chapters[0].id : '');

  // 測驗執行狀態
  let quizState = {
    mode: 'random', // 'chapter' | 'random' | 'wrong' | 'exam' | 'featured' | 'knowledge-point'
    knowledgePoint: '',
    pool: [],
    currentIndex: 0,
    answers: Object.create(null), // { [qId]: selectedIndex or Array }
    submitted: Object.create(null), // { [qId]: boolean }
    active: false
  };

  // DOM 參考快取
  const views = {
    dashboard: document.getElementById('view-dashboard'),
    reader: document.getElementById('view-reader'),
    search: document.getElementById('view-search'),
    quiz: document.getElementById('view-quiz'),
    settings: document.getElementById('view-settings')
  };

  const navTabBtns = document.querySelectorAll('.tab-btn');

  // 切換視圖
  function switchView(viewName) {
    currentView = viewName;
    Object.keys(views).forEach(key => {
      if (views[key]) {
        views[key].classList.toggle('active', key === viewName);
      }
    });

    navTabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'quiz') {renderQuizHistory();renderQuestionManager();}
    if (viewName === 'reader') renderReader();
    if (viewName === 'search') document.getElementById('search-input')?.focus();
  }

  // ===== 1. Dashboard 渲染 =====
  function renderDashboard() {
    const totalChapters = pack.chapters.length;
    const completedChapters = progress.completedChapters.length;
    
    // 計算答題統計
    let totalAttempts = 0;
    let totalWrong = 0;
    let totalCorrect = 0;
    let currentWrongCount = 0; // lastResult === false

    const statEntries = Object.entries(progress.questionStats).filter(([id]) => questionIds.has(id));
    for (const [, st] of statEntries) {
      totalAttempts += (st.attempts || 0);
      totalWrong += (st.wrongCount || 0);
      totalCorrect += (st.correctCount || 0);
      if (st.lastResult === false) {
        currentWrongCount++;
      }
    }

    const accuracyRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    // 更新 DOM
    document.getElementById('stat-completed-chapters').textContent = `${completedChapters} / ${totalChapters}`;
    document.getElementById('stat-total-attempts').textContent = statEntries.filter(([, stats]) => stats.attempts > 0).length;
    document.getElementById('stat-accuracy-rate').textContent = `${accuracyRate}%`;
    document.getElementById('stat-wrong-questions').textContent = currentWrongCount;

    // 最近學習章節
    const lastCh = pack.chapters.find(c => c.id === progress.lastPosition.chapterId);
    document.getElementById('stat-last-chapter').textContent = lastCh ? lastCh.title : '尚未開始';

    const continueButton = document.getElementById('shortcut-continue-read');
    continueButton.hidden = !pack.chapters.some(chapter => hasTeachingChapter(chapter.id));
    continueButton.querySelector('.shortcut-desc').textContent = lastCh ? `繼續：${lastCh.title}` : '從第一章開始';
    document.getElementById('shortcut-wrong-answers').querySelector('.shortcut-desc').textContent = `目前 ${currentWrongCount} 題待複習`;
    const reviewPoints = new Map();
    pack.questions.filter(question => progress.questionStats[question.id]?.lastResult === false).forEach(question => {
      (question.knowledgePoints?.length ? question.knowledgePoints : ['其他／未分類']).forEach(point => reviewPoints.set(point, (reviewPoints.get(point) || 0) + 1));
    });
    document.getElementById('knowledge-review-list').textContent = [...reviewPoints].sort((a,b) => b[1] - a[1]).slice(0,5).map(([point,count]) => `${point}：${count} 題待複習`).join('；') || '目前沒有待複習錯題。';
    // 弱點分析（依章節）
    const weaknessList = document.getElementById('weakness-list');
    weaknessList.innerHTML = '';

    const chapterStats = pack.chapters.map(ch => {
      const chQuestions = pack.questions.filter(q => q.chapterId === ch.id);
      let chAttempts = 0;
      let chCorrect = 0;
      let chWrong = 0;

      for (const q of chQuestions) {
        const st = progress.questionStats[q.id];
        if (st) {
          chAttempts += (st.attempts || 0);
          chCorrect += (st.correctCount || 0);
          chWrong += (st.wrongCount || 0);
        }
      }

      const rate = chAttempts > 0 ? Math.round((chCorrect / chAttempts) * 100) : null;
      return { chapter: ch, attempts: chAttempts, correct: chCorrect, wrong: chWrong, rate,
        practiced:chQuestions.filter(q => progress.questionStats[q.id]?.attempts > 0).length, total:chQuestions.length };
    });

    chapterStats.forEach(({ chapter, attempts, rate, practiced, total }) => {
      const item = document.createElement('div');
      item.className = 'weakness-item';

      let badgeHtml = '<span class="badge" style="background:var(--bg-surface-alt);color:var(--text-subtle);">未作答</span>';
      if (rate !== null && (practiced < 5 || practiced / total < 0.2)) {
        badgeHtml = '<span class="badge">資料不足，繼續練習</span>';
      } else if (rate !== null) {
        if (rate < THRESHOLDS.WEAK) {
          badgeHtml = `<span class="badge badge-danger">需要加強 (${rate}%)</span>`;
        } else if (rate < THRESHOLDS.MODERATE) {
          badgeHtml = `<span class="badge badge-warning">尚未穩定 (${rate}%)</span>`;
        } else {
          badgeHtml = `<span class="badge badge-success">穩定熟悉 (${rate}%)</span>`;
        }
      }

      item.innerHTML = `
        <div style="min-width:0;flex:1;">
          <div style="font-weight:700;font-size:0.95rem;">${escapeHtml(chapter.title)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);">已練 ${practiced} / ${total} 題 · 累計 ${attempts} 次</div>
        </div>
        <div>${badgeHtml}</div>
      `;
      weaknessList.appendChild(item);
    });
  }

  const chapterPracticeAnswers = new Map();
  function answerIsCorrect(question, selected) {
    if (question.type !== 'multiple-choice') return selected === question.answer;
    const expected = Array.isArray(question.answer) ? question.answer : [question.answer];
    return Array.isArray(selected) && expected.length === selected.length && expected.every(value => selected.includes(value));
  }
  function recordQuestionAnswer(question, correct) {
    const stats = progress.questionStats[question.id] || {attempts:0, wrongCount:0, correctCount:0};
    stats.attempts++;
    if (correct) stats.correctCount++;
    else stats.wrongCount++;
    stats.lastResult = correct;
    stats.lastAnsweredAt = new Date().toISOString();
    progress.questionStats[question.id] = stats;
    saveProgress();
  }
  function renderChapterPractice(container, questions) {
    container.replaceChildren();
    questions.forEach((question, index) => {
      const state = chapterPracticeAnswers.get(question.id), submitted = !!state?.submitted;
      const answers = Array.isArray(question.answer) ? question.answer : [question.answer];
      const selected = state?.selected === undefined ? [] : Array.isArray(state.selected) ? state.selected : [state.selected];
      const multiple = question.type === 'multiple-choice', form = document.createElement('form');
      form.className = 'chapter-practice-question';
      form.innerHTML = `<fieldset><legend>第 ${index + 1} 題・${multiple ? '多選題' : question.type === 'true-false' ? '是非題' : '單選題'}</legend>
        <div class="chapter-practice-stem">${window.StudyContent.render(question.question)}</div>
        <div class="chapter-inline-options">${question.options.map((option, optionIndex) => `<label class="option-item ${submitted && answers.includes(optionIndex) ? 'correct' : submitted && selected.includes(optionIndex) ? 'wrong' : ''}">
          <input type="${multiple ? 'checkbox' : 'radio'}" name="answer" value="${optionIndex}" ${selected.includes(optionIndex) ? 'checked' : ''} ${submitted ? 'disabled' : ''}>
          <span>${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}</span></label>`).join('')}</div></fieldset>
        <p class="chapter-inline-feedback" role="status" tabindex="-1">${submitted ? `${state.correct ? '作答正確' : '作答錯誤'}；正確答案：${answers.map(value => String.fromCharCode(65 + value)).join('、')}` : ''}</p>
        <button class="btn ${submitted ? 'btn-secondary' : 'btn-primary'}" type="submit">${submitted ? '重新作答' : '送出答案'}</button>`;
      form.prepend(createQuestionActions(question,()=>renderReader()));
      form.onchange = () => {
        const values = [...form.querySelectorAll('input:checked')].map(input => Number(input.value));
        chapterPracticeAnswers.set(question.id, {selected:multiple ? values : values[0], submitted:false});
      };
      form.onsubmit = event => {
        event.preventDefault();
        if (submitted) {
          chapterPracticeAnswers.delete(question.id);
          renderChapterPractice(container, questions);
          container.children[index].querySelector('input')?.focus();
          return;
        }
        const values = [...form.querySelectorAll('input:checked')].map(input => Number(input.value));
        if (!values.length) {
          form.querySelector('.chapter-inline-feedback').textContent = '請先選擇答案。';
          form.querySelector('input')?.focus();
          return;
        }
        const answer = multiple ? values : values[0], correct = answerIsCorrect(question, answer);
        chapterPracticeAnswers.set(question.id, {selected:answer, submitted:true, correct});
        recordQuestionAnswer(question, correct);
        renderChapterPractice(container, questions);
        container.children[index].querySelector('.chapter-inline-feedback').focus({preventScroll:true});
      };
      container.appendChild(form);
    });
    const answered = questions.filter(question => chapterPracticeAnswers.get(question.id)?.submitted);
    if (questions.length && answered.length === questions.length) {
      const actions = document.createElement('div');
      actions.className = 'learner-actions';
      const wrong = questions.filter(question => !chapterPracticeAnswers.get(question.id)?.correct);
      actions.innerHTML = `<p>本章練習完成：${questions.length - wrong.length} / ${questions.length} 題答對。</p><button type="button" class="btn btn-secondary" id="btn-practice-retry" ${wrong.length ? '' : 'hidden'}>重練本章錯題（${wrong.length} 題）</button><button type="button" class="btn btn-primary" id="btn-practice-next">${pack.chapters.findIndex(chapter => chapter.id === currentChapterId) < pack.chapters.length - 1 ? '下一章' : '回學習總覽'}</button>`;
      container.appendChild(actions);
      actions.querySelector('#btn-practice-retry').onclick = () => {
        wrong.forEach(question => chapterPracticeAnswers.delete(question.id));
        renderChapterPractice(container, questions);
        container.querySelector('input:not(:disabled)')?.focus();
      };
      actions.querySelector('#btn-practice-next').onclick = () => {
        const next = pack.chapters[pack.chapters.findIndex(chapter => chapter.id === currentChapterId) + 1];
        if (next) { currentChapterId = next.id; progress.lastPosition.sectionId = ''; renderReader(); window.scrollTo(0, 0); }
        else switchView('dashboard');
      };
    }
  }

  // ===== 2. 教材閱讀 Reader 渲染 =====
  function setTocOpen(open){
    document.getElementById('reader-toc-list').hidden=!open;
    const button=document.getElementById('btn-toggle-sidebar');
    button.textContent=open?'收合目錄':'展開目錄';button.setAttribute('aria-expanded',String(open));
  }
  function updateSectionNavigation(id){
    const select=document.getElementById('reader-section-select');
    if([...select.options].some(option=>option.value===id))select.value=id;
    document.getElementById('btn-prev-section').disabled=select.selectedIndex<=0;
    document.getElementById('btn-next-section').disabled=select.selectedIndex<0||select.selectedIndex>=select.options.length-1;
  }
  function renderReader() {
    const ch = pack.chapters.find(c => c.id === currentChapterId) || pack.chapters[0];
    if (!ch) return;

    currentChapterId = ch.id;
    if (progress.lastPosition.chapterId !== ch.id) progress.lastPosition.sectionId = '';
    progress.lastPosition.chapterId = ch.id;
    saveProgress();

    // 側邊目錄
    const tocList = document.getElementById('reader-toc-list');
    tocList.innerHTML = '';
    pack.chapters.forEach(c => {
      const li = document.createElement('li');
      li.className = `toc-item ${c.id === ch.id ? 'active' : ''} ${progress.completedChapters.includes(c.id) ? 'completed' : ''}`;
      li.textContent = c.title;
      li.tabIndex = 0;
      li.setAttribute('role','button');
      li.onclick = () => {
        currentChapterId = c.id;
        renderReader();
        if(matchMedia('(max-width:768px)').matches){setTocOpen(false);document.getElementById('chapter-heading').scrollIntoView({block:'start'});}
      };
      li.onkeydown = event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();li.click();}};
      tocList.appendChild(li);
    });

    // 標題與摘要
    document.getElementById('chapter-heading').textContent = ch.title;
    document.querySelector('.sidebar-title').textContent='章節目錄';
    document.getElementById('chapter-summary-text').textContent = ch.teachingSummary || ch.summary || '';

    // 完成狀態按鈕
    const isCompleted = progress.completedChapters.includes(ch.id);
    const completeBtn = document.getElementById('btn-toggle-complete');
    completeBtn.textContent = isCompleted ? '✓ 已讀本章' : '標記已讀';
    completeBtn.className = isCompleted ? 'btn btn-secondary' : 'btn btn-primary';

    // 渲染 Sections
    const container = document.getElementById('sections-container');
    container.innerHTML = '';

    readingSections(ch).forEach(sec => {
      const secDiv = document.createElement('div');
      secDiv.className = 'section-block'+(sec.id.endsWith('-overview')?' overview-section':'');
      secDiv.id = `sec-${sec.id}`;

      let keyPointsHtml = '';
      if (sec.keyPoints && sec.keyPoints.length > 0) {
        keyPointsHtml = `
          <div class="keypoints-box">
            <div class="keypoints-header">💡 核心重點速記</div>
            <ul class="keypoints-list">
              ${sec.keyPoints.map(kp => `<li>${window.StudyContent.render(kp)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      let notesHtml = '';
      if (sec.notes && sec.notes.length > 0) {
        notesHtml = `
          <div class="notes-box">
            <strong>補充備忘：</strong>
            ${window.StudyContent.render(sec.notes.join('；'))}
          </div>
        `;
      }

      secDiv.innerHTML = `
        <h3 class="section-title" tabindex="-1">${escapeHtml(sec.title)}</h3>
        ${sec.content ? `<div class="section-body">${window.StudyContent.render(sec.content)}</div>` : ''}
        ${keyPointsHtml}
        ${notesHtml}
      `;
      container.appendChild(secDiv);
    });
    const goals = document.createElement('aside');
    goals.className = 'learning-goals';
    goals.innerHTML = '<strong>讀完本章，試著自己說明：</strong><ul>' + ch.sections.slice(0,3).map(s => `<li>${escapeHtml(s.title)}</li>`).join('') + '</ul>';
    if(!ch.teachingSections)container.prepend(goals);
    window.StudyContent.initTeaching(container);
    const sectionSelect=document.getElementById('reader-section-select');
    sectionSelect.replaceChildren(...readingSections(ch).map(sec=>{const option=document.createElement('option');option.value=sec.id;option.textContent=sec.title;return option;}));
    updateSectionNavigation(progress.lastPosition.sectionId || readingSections(ch)[0]?.id);
    const practice = document.getElementById('chapter-practice-panel');
    const hasTeachingContent = pack.chapters.some(chapter => chapter.sections.some(section => section.content));
    const hasPracticeQuestions = pack.chapters.some(chapter => (chapter.practiceQuestionIds || pack.questions.filter(question => question.chapterId === chapter.id).slice(0, 10).map(question => question.id)).length > 0);
    practice.hidden = !hasTeachingContent || !hasPracticeQuestions;
    if (!practice.hidden) {
      const questionById = new Map(pack.questions.map(question => [question.id, question]));
      const preferred=(ch.practiceQuestionIds || []).map(id=>questionById.get(id)).filter(Boolean);
      const practiceQuestions=[...new Map([...preferred,...pack.questions.filter(q=>q.chapterId===ch.id)].filter(q=>!isQuestionHidden(q)).map(q=>[q.id,q])).values()].slice(0,10);
      document.getElementById('chapter-practice-title').textContent = /00$/.test(ch.id) ? `全科暖身練習（${practiceQuestions.length} 題）` : `本章練習（${practiceQuestions.length} 題）`;
      document.getElementById('chapter-practice-scope').textContent = ch.practiceConcepts?.length ? `涵蓋：${ch.practiceConcepts.join('、')}。` : '';
      if(practiceQuestions.length<10)document.getElementById('chapter-practice-scope').textContent+=` 已排除隱藏題目，目前可練 ${practiceQuestions.length} 題。`;
      renderChapterPractice(document.getElementById('chapter-practice-preview'), practiceQuestions);
    }
    const resume = progress.lastPosition.sectionId;
    if (resume) requestAnimationFrame(() => document.getElementById(`sec-${resume}`)?.scrollIntoView({block:'start'}));

    // 上一章、下一章按鈕狀態
    const currIdx = pack.chapters.findIndex(c => c.id === ch.id);
    const prevBtn = document.getElementById('btn-prev-chapter');
    const nextBtn = document.getElementById('btn-next-chapter');

    prevBtn.disabled = currIdx <= 0;
    nextBtn.disabled = currIdx >= pack.chapters.length - 1;

    prevBtn.onclick = () => {
      if (currIdx > 0) {
        currentChapterId = pack.chapters[currIdx - 1].id;
        renderReader();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    nextBtn.onclick = () => {
      if (currIdx < pack.chapters.length - 1) {
        currentChapterId = pack.chapters[currIdx + 1].id;
        renderReader();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    completeBtn.onclick = () => {
      const exists = progress.completedChapters.includes(ch.id);
      if (exists) {
        progress.completedChapters = progress.completedChapters.filter(id => id !== ch.id);
      } else {
        progress.completedChapters.push(ch.id);
      }
      saveProgress();
      renderReader();
    };
  }

  // ===== 3. 全文搜尋 Search =====
  function setupSearch() {
    const input = document.getElementById('search-input');
    const resultList = document.getElementById('search-results');

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        resultList.innerHTML = '<div style="color:var(--text-muted);padding:1rem 0;">輸入關鍵字搜尋章節、內文與重點...</div>';
        return;
      }

      const matches = [];
      for (const ch of pack.chapters) {
        // 章節標題
        if (ch.title.toLowerCase().includes(q)) {
          matches.push({
            chapter: ch,
            section: readingSections(ch)[0],
            snippet: `章節標題：${highlight(ch.title, q)}`,
            type: '章節'
          });
        }
        for (const sec of readingSections(ch)) {
          if (sec.title.toLowerCase().includes(q)) {
            matches.push({
              chapter: ch,
              section: sec,
              snippet: `小節標題：${highlight(sec.title, q)}`,
              type: '小節'
            });
          }
          const contentText = searchableContent(sec);
          if (contentText.toLowerCase().includes(q)) {
            const idx = contentText.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 40);
            const end = Math.min(contentText.length, idx + q.length + 40);
            const preview = contentText.slice(start, end);
            matches.push({
              chapter: ch,
              section: sec,
              snippet: `內文：...${highlight(preview, q)}...`,
              type: '教材內容'
            });
          }
          if (sec.keyPoints) {
            for (const kp of sec.keyPoints) {
              if (kp.toLowerCase().includes(q)) {
                matches.push({
                  chapter: ch,
                  section: sec,
                  snippet: `重點：${highlight(kp, q)}`,
                  type: '教材重點'
                });
              }
            }
          }
        }
      }

      if (matches.length === 0) {
        resultList.innerHTML = `<div style="color:var(--text-muted);padding:1rem 0;">查無符合「${escapeHtml(q)}」的內容</div>`;
        return;
      }

      resultList.innerHTML = '';
      matches.slice(0, 50).forEach(m => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.innerHTML = `
          <div class="search-result-path">${escapeHtml(m.chapter.title)} &gt; ${m.section ? escapeHtml(m.section.title) : ''} [${m.type}]</div>
          <div class="search-result-snippet">${m.snippet}</div>
        `;
        card.onclick = () => {
          currentChapterId = m.chapter.id;
          switchView('reader');
          if (m.section) {
            setTimeout(() => {
              const el = document.getElementById(`sec-${m.section.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        };
        resultList.appendChild(card);
      });
    });
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) => index % 2 ? `<span class="highlight">${escapeHtml(part)}</span>` : escapeHtml(part)).join('');
  }


  // ===== 4. 測驗引擎 Quiz Engine =====
  function startQuiz(mode, chapterId = '', count = 20, selectedPool = null, knowledgePoint = '') {
    quizState.mode = mode;
    quizState.knowledgePoint = knowledgePoint;
    quizState.answers = Object.create(null);
    quizState.submitted = Object.create(null);
    quizState.currentIndex = 0;
    quizState.active = true;

    let pool = [];
    if (selectedPool) {
      pool = [...selectedPool];
    } else if (mode === 'chapter') {
      pool = pack.questions.filter(q => q.chapterId === chapterId);
    } else if (mode === 'wrong') {
      // 曾經答錯或目前答錯的題目
      pool = pack.questions.filter(q => {
        const st = progress.questionStats[q.id];
        return st && st.lastResult === false;
      });
    } else {
      // random
      pool = [...pack.questions];
    }

    pool=pool.filter(question=>!isQuestionHidden(question)&&(!document.getElementById('only-personal-favorites')?.checked||progress.favoriteQuestionIds.includes(question.id)));
    // 洗牌
    if (mode === 'exam') pool.sort((a, b) => a.sourceExam.number - b.sourceExam.number);
    else if (mode !== 'featured') for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    if (count !== 'all' && Number.isInteger(count)) {
      pool = pool.slice(0, count);
    }

    quizState.pool = pool;

    if (pool.length === 0) {
      alert('此範圍沒有可出題目，請調整精選篩選或恢復隱藏題目。');
      quizState.active = false;
      document.getElementById('quiz-running-panel').style.display='none';
      document.getElementById('quiz-summary-panel').style.display='none';
      document.getElementById('quiz-setup-panel').style.display='block';
      return;
    }

    document.getElementById('quiz-setup-panel').style.display = 'none';
    document.getElementById('quiz-summary-panel').style.display = 'none';
    document.getElementById('quiz-running-panel').style.display = 'block';
    renderQuizCard();
    window.scrollTo(0, 0);
  }

  function renderQuizCard() {
    const focusedOption = document.activeElement?.dataset.option;
    const q = quizState.pool[quizState.currentIndex];
    if (!q) return;

    let actions=document.getElementById('quiz-question-actions');
    if(!actions){actions=document.createElement('div');actions.id='quiz-question-actions';document.getElementById('quiz-stem').before(actions);}
    actions.replaceChildren(createQuestionActions(q,()=>{
      if(!quizState.submitted[q.id]){quizState.pool.splice(quizState.currentIndex,1);delete quizState.answers[q.id];}
      else quizState.currentIndex++;
      if(quizState.currentIndex>=quizState.pool.length)showQuizSummary();else renderQuizCard();
    }));
    const total = quizState.pool.length;
    const currentNum = quizState.currentIndex + 1;

    document.getElementById('quiz-progress-text').textContent = `第 ${currentNum} / ${total} 題`;
    document.getElementById('quiz-chapter-tag').textContent = (pack.chapters.find(c => c.id === q.chapterId) || {}).title || q.chapterId;
    const examTag = document.getElementById('quiz-exam-tag');
    if (q.sourceExam) {
      examTag.textContent = [q.sourceExam.term, q.sourceExam.subject].filter(Boolean).join(' · ');
      examTag.hidden = false;
    } else {
      examTag.hidden = true;
    }
    document.getElementById('quiz-type-tag').textContent = q.type === 'multiple-choice' ? '多選題' : (q.type === 'true-false' ? '是非題' : '單選題');

    const sourceLabel = q.question.match(/^\s*【(?:場次\s*[^】]*|第\s*\d+\s*屆[^】]*)第\s*(\d+)\s*題】\s*/);
    document.getElementById('quiz-stem').textContent = sourceLabel && Number(sourceLabel[1]) === q.sourceExam?.number
      ? q.question.slice(sourceLabel[0].length)
      : q.question;

    const optionsContainer = document.getElementById('quiz-options-container');
    optionsContainer.innerHTML = '';

    const isSubmitted = !!quizState.submitted[q.id];
    const userSelected = quizState.answers[q.id];

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    q.options.forEach((optText, optIdx) => {
      const optDiv = document.createElement('button');
      optDiv.type = 'button';
      optDiv.disabled = isSubmitted;
      optDiv.dataset.option = String(optIdx);
      optDiv.className = 'option-item';

      let isSelected = false;
      if (q.type === 'multiple-choice') {
        isSelected = Array.isArray(userSelected) && userSelected.includes(optIdx);
      } else {
        isSelected = userSelected === optIdx;
      }

      if (isSelected) optDiv.classList.add('selected');
      optDiv.setAttribute('aria-pressed',String(isSelected));

      if (isSubmitted) {
        const isAnswer = q.type === 'multiple-choice'
          ? (Array.isArray(q.answer) && q.answer.includes(optIdx))
          : q.answer === optIdx;

        if (isAnswer) {
          optDiv.classList.add('correct');
        } else if (isSelected) {
          optDiv.classList.add('wrong');
        }
      }

      optDiv.innerHTML = `
        <span class="option-letter">${letters[optIdx] || optIdx + 1}</span>
        <span style="flex:1;">${escapeHtml(optText)}</span>
      `;

      if (!isSubmitted) {
        optDiv.onclick = () => {
          if (q.type === 'multiple-choice') {
            const arr = Array.isArray(quizState.answers[q.id]) ? [...quizState.answers[q.id]] : [];
            const pos = arr.indexOf(optIdx);
            if (pos > -1) arr.splice(pos, 1);
            else arr.push(optIdx);
            quizState.answers[q.id] = arr.sort((a, b) => a - b);
          } else {
            quizState.answers[q.id] = optIdx;
            // 單選點選後直接提供提交按鈕點擊，也可點選後立即作答
          }
          renderQuizCard();
        };
      }

      optionsContainer.appendChild(optDiv);
    });
    if (focusedOption !== undefined && !isSubmitted) optionsContainer.querySelector(`[data-option="${focusedOption}"]`)?.focus();

    // 詳解與回饋區塊
    const feedbackBox = document.getElementById('quiz-feedback-box');
    const submitBtn = document.getElementById('btn-quiz-submit');
    const nextBtn = document.getElementById('btn-quiz-next');

    if (isSubmitted) {
      submitBtn.style.display = 'none';
      nextBtn.style.display = 'inline-flex';
      feedbackBox.style.display = 'block';

      const isCorrect = answerIsCorrect(q, userSelected);

      feedbackBox.className = `feedback-box ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`;
      
      let ansLabel = '';
      if (q.type === 'multiple-choice') {
        ansLabel = (Array.isArray(q.answer) ? q.answer : []).map(idx => letters[idx] || idx + 1).join(', ');
      } else {
        ansLabel = letters[q.answer] || q.answer + 1;
      }

      feedbackBox.innerHTML = `
        <div style="font-weight:800;font-size:1.05rem;">
          ${isCorrect ? '✓ 作答正確！' : '✕ 作答錯誤！'} (正確答案：${ansLabel})
        </div>
        ${hasTeachingChapter(q.chapterId) ? '<button type="button" class="btn btn-secondary" id="btn-answer-reader">回到相關教材</button>' : ''}
      `;
      const readerButton = document.getElementById('btn-answer-reader');
      if (readerButton) readerButton.onclick = () => openRelatedChapter(q);
    } else {
      submitBtn.style.display = 'inline-flex';
      nextBtn.style.display = 'none';
      feedbackBox.style.display = 'none';
    }

    submitBtn.onclick = () => {
      if (quizState.submitted[q.id]) return;
      if (userSelected === undefined || (Array.isArray(userSelected) && userSelected.length === 0)) {
        alert('請先選擇答案！');
        return;
      }

      quizState.submitted[q.id] = true;

      // 紀錄進度
      const isCorrect = answerIsCorrect(q, userSelected);
      recordQuestionAnswer(q, isCorrect);

      renderQuizCard();
    };

    nextBtn.onclick = () => {
      if (quizState.currentIndex < quizState.pool.length - 1) {
        quizState.currentIndex++;
        renderQuizCard();
        window.scrollTo(0, 0);
      } else {
        // 完成此輪測驗
        showQuizSummary();
      }
    };
  }

  function openRelatedChapter(question) {
    currentChapterId = question.chapterId;
    const chapter = pack.chapters.find(ch => ch.id === question.chapterId);
    progress.lastPosition = {chapterId:question.chapterId, sectionId:chapter && readingSections(chapter).some(s => s.id === question.sectionId) ? question.sectionId : ''};
    switchView('reader');
  }
  function showQuizSummary() {
    quizState.active = false;
    const answered = quizState.pool.filter(q => quizState.submitted[q.id]);
    const wrong = answered.filter(q => !answerIsCorrect(q, quizState.answers[q.id]));
    const correctCount = answered.length - wrong.length;
    const examSource = quizState.pool[0]?.sourceExam;
    const oneExam = examSource && quizState.pool.every(q => q.sourceExam?.term === examSource.term && q.sourceExam.subject === examSource.subject);
    const featuredGroup = quizState.pool[0]?.featuredGroup;
    const oneFeaturedGroup = featuredGroup && quizState.pool.every(q => q.featuredGroup === featuredGroup);
    if(answered.length)progress.quizHistory.unshift({
      completedAt: new Date().toISOString(), mode: quizState.mode, questionCount: answered.length,
      correctCount, wrongCount: wrong.length, accuracy: answered.length ? Math.round(correctCount / answered.length * 100) : 0,
      ...(oneExam ? {term: examSource.term, subject: examSource.subject} : {}),
      ...(quizState.knowledgePoint ? {knowledgePoint: quizState.knowledgePoint} : {}),
      ...(oneFeaturedGroup ? {featuredGroup} : {})
    });
    progress.quizHistory.length = Math.min(progress.quizHistory.length, 20);
    saveProgress();
    document.getElementById('quiz-running-panel').style.display = 'none';
    document.getElementById('quiz-setup-panel').style.display = 'none';
    document.getElementById('quiz-summary-panel').style.display = 'block';
    document.getElementById('quiz-summary-title').textContent = answered.length === quizState.pool.length ? '測驗完成' : '測驗已結束';
    document.getElementById('quiz-summary-count').textContent = `${answered.length} / ${quizState.pool.length}`;
    document.getElementById('quiz-summary-correct').textContent = answered.length - wrong.length;
    document.getElementById('quiz-summary-wrong').textContent = wrong.length;
    document.getElementById('quiz-summary-accuracy').textContent = answered.length ? `${Math.round((answered.length - wrong.length) / answered.length * 100)}%` : '尚未作答';
    const retry = document.getElementById('btn-quiz-retry-wrong');
    retry.style.display = wrong.length ? 'inline-flex' : 'none';
    retry.onclick = () => startQuiz('wrong', '', 'all', wrong);
    document.getElementById('btn-quiz-restart').onclick = () => startQuiz(quizState.mode, '', 'all', quizState.pool, quizState.knowledgePoint);
    document.getElementById('btn-quiz-back-menu').onclick = () => {document.getElementById('quiz-summary-panel').style.display='none';document.getElementById('quiz-setup-panel').style.display='block';};
    let list = document.getElementById('quiz-summary-list');
    if (!list) {list = document.createElement('ul');list.id='quiz-summary-list';document.getElementById('quiz-summary-panel').append(list);}
    list.replaceChildren();
    for (const question of wrong) {
      const item = document.createElement('li');
      if (hasTeachingChapter(question.chapterId)) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'btn btn-secondary'; button.textContent = question.question;
        button.onclick = () => openRelatedChapter(question); item.append(button);
      } else item.textContent = question.question;
      list.append(item);
    }
    renderDashboard();
    renderQuizHistory();
  }

  function renderQuizHistory() {
    const panel = document.getElementById('quiz-history-panel');
    const list = document.getElementById('quiz-history-list');
    if (!panel || !list) return;
    list.replaceChildren();
    panel.hidden = progress.quizHistory.length === 0;
    for (const record of progress.quizHistory) {
      const item = document.createElement('li');
      const label = {chapter:'章節',random:'隨機',wrong:'錯題',exam:'歷屆考期',featured:'精選題','knowledge-point':'知識點'}[record.mode];
      const title = record.knowledgePoint ? `知識點：${record.knowledgePoint}` : record.term ? `${record.term} ${record.subject}` : record.featuredGroup ? `精選題組 ${record.featuredGroup.replace(/^c/, '')}` : label;
      item.textContent = `${new Date(record.completedAt).toLocaleString()}｜${title}｜${record.accuracy}%（${record.correctCount}/${record.questionCount}）`;
      list.append(item);
    }
  }

  // ===== 5. 備份與還原 Backup & Reset =====
  function exportProgressJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(progress, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `study-progress-${pack.id}.json`);
    dlAnchor.click();
  }

  function importProgressJson(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || data.format !== 'study-pack-progress-v1') {
        alert('匯入失敗：檔案格式不正確，非合法的 Study Pack 進度檔案。');
        return false;
      }
      if (data.packId !== pack.id) {
        alert(`匯入失敗：此進度檔屬於教材 [${data.packId}]，與目前的教材 [${pack.id}] 不匹配！`);
        return false;
      }
      const restored = normalizeProgress(data);
      if (!confirm('匯入會取代目前學習進度。請先匯出備份，確定繼續？')) return false;
      progress = restored;
      storageWritable = true;
      if (saveProgress()) {
        alert('學習紀錄已匯入並保存。');
        location.reload();
      } else {
        currentChapterId = progress.lastPosition.chapterId;
        switchView('dashboard');
        alert('紀錄已載入本頁，但未能永久保存，請立即匯出備份。');
      }
      return true;
    } catch (err) {
      alert(`匯入解析錯誤: ${err.message}`);
      return false;
    }
  }

  function resetProgress() {
    if (confirm('確定要清除所有學習紀錄與錯題統計嗎？\n此動作不可復原（但不會影響教材與題庫）。')) {
      if (confirm('請再次確認：是否真要清除所有作答進度？')) {
        try {
          localStorage.removeItem(STORAGE_KEY);
          alert('學習進度已成功清除。');
          location.reload();
        } catch (_) {showStorageWarning('無法清除瀏覽器紀錄，原資料仍保留。');}
      }
    }
  }

  // 工具輔助：HTML 跳脫
  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ===== 初始化事件綁定 =====
  function init() {
    loadProgress();
    initQuestionManager();
    if(pack.editions){
      const picker=document.createElement('nav');picker.className='edition-picker';picker.setAttribute('aria-label','題庫版本');
      const label=document.createElement('label');label.htmlFor='edition-select';label.textContent='題庫版本';
      const select=document.createElement('select');select.id='edition-select';
      for(const edition of pack.editions){const option=document.createElement('option');option.value=edition.file;option.textContent=`${edition.label}（${edition.period}）`;option.selected=edition.id===pack.id;select.append(option);}
      select.onchange=()=>{const link=document.createElement('a');link.href=select.value+'?view='+currentView;link.hidden=true;picker.append(link);link.click();link.remove();};
      picker.append(label,select);document.querySelector('.app-container').before(picker);
    }
    currentChapterId = pack.chapters.some(ch => ch.id === progress.lastPosition.chapterId) ? progress.lastPosition.chapterId : pack.chapters[0]?.id;
    document.getElementById('btn-storage-warning-export').onclick = exportProgressJson;
    const sidebarToggle = document.getElementById('btn-toggle-sidebar');
    sidebarToggle.setAttribute('aria-controls','reader-toc-list');
    const mobileReader=matchMedia('(max-width:768px)');
    const header=document.querySelector('.app-header'),catalog=document.getElementById('study-catalog-nav');
    const sectionNavigation=document.querySelector('.section-navigation');
    const headerSize=new ResizeObserver(()=>{document.documentElement.style.setProperty('--reader-top',`${header.offsetHeight+(catalog?.offsetHeight||0)}px`);document.documentElement.style.setProperty('--section-nav-height',`${sectionNavigation.offsetHeight}px`);});
    headerSize.observe(header);if(catalog)headerSize.observe(catalog);headerSize.observe(sectionNavigation);
    setTocOpen(!mobileReader.matches);
    mobileReader.addEventListener('change',event=>setTocOpen(!event.matches));
    sidebarToggle.onclick=()=>setTocOpen(document.getElementById('reader-toc-list').hidden);
    const sectionSelect=document.getElementById('reader-section-select');
    const goToSection=()=>{
      const target=document.getElementById('sec-'+sectionSelect.value);
      if(!target)return;
      const overview=target.querySelector('.chapter-overview');if(overview)overview.open=true;
      updateSectionNavigation(sectionSelect.value);
      progress.lastPosition.sectionId=sectionSelect.value;saveProgress();
      target.querySelector('.section-title').focus({preventScroll:true});target.querySelector('.section-title').scrollIntoView({block:'start',behavior:'instant'});
    };
    sectionSelect.onchange=goToSection;
    for(const [id,offset] of [['btn-prev-section',-1],['btn-next-section',1]])document.getElementById(id).onclick=()=>{sectionSelect.selectedIndex+=offset;goToSection();};
    document.getElementById('btn-section-toc').onclick=()=>{setTocOpen(true);document.getElementById('reader-sidebar').scrollIntoView({block:'start'});sidebarToggle.focus({preventScroll:true});};
    document.getElementById('sections-container').addEventListener('click', event => {
      const link = event.target.closest('a[data-chapter]');
      if (!link) return;
      event.preventDefault();
      progress.lastPosition.sectionId = '';
      currentChapterId = link.dataset.chapter;
      renderReader();
      window.scrollTo({top:0});
    });
    let readingFrame = 0;
    window.addEventListener('scroll', () => {
      if (currentView !== 'reader' || readingFrame) return;
      readingFrame = requestAnimationFrame(() => {
        readingFrame = 0;
        if (currentView !== 'reader') return;
        const sections = [...document.querySelectorAll('#sections-container .section-block')];
        const visible = sections.filter(section => section.getBoundingClientRect().top <= header.getBoundingClientRect().bottom+document.querySelector('.section-navigation').offsetHeight+20).at(-1) || sections[0];
        if (visible && progress.lastPosition.sectionId !== visible.id.slice(4)) {
          progress.lastPosition.sectionId = visible.id.slice(4);
          updateSectionNavigation(progress.lastPosition.sectionId);
          saveProgress();
        }
      });
    }, {passive:true});

    // 標題設定
    document.title = pack.title;
    document.getElementById('app-brand-title').textContent = pack.title;
    document.getElementById('app-brand-version').textContent = `v${pack.contentVersion || '1.0'}`;
    document.getElementById('hero-pack-title').textContent = pack.title;
    document.getElementById('hero-pack-desc').textContent = pack.description || '點選下方快速入口開始學習！';

    // 導航 Tab 事件
    navTabBtns.forEach(btn => {
      btn.onclick = () => switchView(btn.dataset.view);
    });

    // 主題選擇
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = progress.settings.theme || 'system';
      applyTheme(themeSelect.value);
      themeSelect.onchange = () => applyTheme(themeSelect.value);
    } else {
      applyTheme(progress.settings.theme || 'system');
    }

    // 快捷入口按鈕
    document.getElementById('shortcut-continue-read')?.addEventListener('click', () => switchView('reader'));
    document.getElementById('shortcut-random-quiz')?.addEventListener('click', () => {
      switchView('quiz');
      startQuiz('random', '', 10);
    });
    document.getElementById('shortcut-wrong-answers')?.addEventListener('click', () => {
      switchView('quiz');
      startQuiz('wrong', '', 'all');
    });

    document.getElementById('btn-quick-ten')?.addEventListener('click', () => startQuiz('random', '', 10));
    document.getElementById('btn-quick-wrong')?.addEventListener('click', () => startQuiz('wrong', '', 'all'));
    // 測驗設定表單初始化
    const quizChSelect = document.getElementById('quiz-select-chapter');
    if (quizChSelect) {
      pack.chapters.filter(c => pack.questions.some(q => q.chapterId === c.id)).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        quizChSelect.appendChild(opt);
      });
      quizChSelect.disabled = quizChSelect.options.length === 0;
      document.getElementById('btn-start-chapter-quiz').disabled = quizChSelect.disabled;
    }

    const knowledgeSelect = document.getElementById('quiz-select-knowledge-point');
    if (knowledgeSelect) {
      const knowledgeQuestions = new Map();
      for (const question of pack.questions) for (const label of question.knowledgePoints || []) {
        if (!knowledgeQuestions.has(label)) knowledgeQuestions.set(label, []);
        knowledgeQuestions.get(label).push(question);
      }
      [...knowledgeQuestions.entries()].sort(([a, questionsA], [b, questionsB]) => questionsB.length - questionsA.length || a.localeCompare(b, 'zh-Hant')).forEach(([label, questions]) => {
        const option = document.createElement('option');
        option.value = label;
        option.textContent = `${label}（${questions.length} 題）`;
        knowledgeSelect.appendChild(option);
      });
      const disabled = knowledgeQuestions.size === 0;
      knowledgeSelect.disabled = disabled;
      document.getElementById('knowledge-point-quiz-group').hidden = disabled;
      document.getElementById('btn-start-knowledge-point-quiz').disabled = disabled;
      document.getElementById('btn-start-knowledge-point-quiz').addEventListener('click', () => {
        const label = knowledgeSelect.value;
        const questions = knowledgeQuestions.get(label);
        if (questions?.length) startQuiz('knowledge-point', '', 20, questions, label);
      });
    }

    const examSelect = document.getElementById('quiz-select-exam');
    if (examSelect) {
      const exams = new Map();
      for (const question of pack.questions) {
        const source = question.sourceExam;
        if (source?.term && source.subject) exams.set(JSON.stringify([source.term, source.subject]), source);
      }
      [...exams.entries()]
        .sort(([, a], [, b]) => a.term.localeCompare(b.term, 'zh-Hant', {numeric:true}) || a.subject.localeCompare(b.subject, 'zh-Hant'))
        .forEach(([key, source]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = `${source.term} · ${source.subject}`;
          examSelect.appendChild(option);
        });
      examSelect.disabled = examSelect.options.length === 0;
      document.getElementById('btn-start-exam-quiz').disabled = examSelect.disabled;
    }

    const featuredSelect = document.getElementById('quiz-select-featured');
    if (featuredSelect) {
      const groups = new Map();
      for (const question of pack.questions) {
        if (!question.featuredGroup) continue;
        groups.set(question.featuredGroup, (groups.get(question.featuredGroup) || 0) + 1);
      }
      [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', {numeric:true})).forEach(([group, count]) => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = `精選題組 ${group.replace(/^c/, '')}（${count} 題）`;
        featuredSelect.appendChild(option);
      });
      document.getElementById('featured-quiz-group').hidden = groups.size === 0;
      document.getElementById('btn-start-featured-quiz').disabled = groups.size === 0;
    }

    document.getElementById('btn-start-chapter-quiz')?.addEventListener('click', () => {
      const cid = quizChSelect.value;
      startQuiz('chapter', cid, 'all');
    });

    document.getElementById('btn-start-exam-quiz')?.addEventListener('click', () => {
      const [term, subject] = JSON.parse(examSelect.value);
      const questions = pack.questions.filter(q => q.sourceExam?.term === term && q.sourceExam.subject === subject);
      startQuiz('exam', '', 'all', questions);
    });

    document.getElementById('btn-start-featured-quiz')?.addEventListener('click', () => {
      const group = featuredSelect.value;
      const questions = pack.questions.filter(q => q.featuredGroup === group).sort((a, b) => a.featuredRank - b.featuredRank);
      startQuiz('featured', '', 'all', questions);
    });

    document.getElementById('btn-start-random-quiz')?.addEventListener('click', () => {
      const countVal = document.getElementById('quiz-random-count').value;
      const count = countVal === 'all' ? 'all' : parseInt(countVal, 10);
      startQuiz('random', '', count);
    });

    document.getElementById('btn-start-wrong-quiz')?.addEventListener('click', () => {
      startQuiz('wrong', '', 'all');
    });

    document.getElementById('btn-exit-quiz')?.addEventListener('click', () => {
      if (confirm('結束本次測驗並查看已答結果？未作答題目不計分。')) {
        if (quizState.pool.some(question => quizState.submitted[question.id])) { showQuizSummary(); return; }
        quizState.active = false;
        document.getElementById('quiz-setup-panel').style.display = 'block';
        document.getElementById('quiz-running-panel').style.display = 'none';
        renderDashboard();
      }
    });

    // 備份與還原
    document.getElementById('btn-export-progress')?.addEventListener('click', exportProgressJson);
    document.getElementById('btn-import-progress-trigger')?.addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => importProgressJson(evt.target.result);
      reader.onerror = () => alert('無法讀取備份檔案，請重新選擇。');
      reader.readAsText(file);
    });
    document.getElementById('btn-reset-progress')?.addEventListener('click', resetProgress);

    setupSearch();
    const initialView = new URLSearchParams(location.search).get('view');
    switchView(initialView === 'quick-review' ? 'search' : ['reader','quiz','dashboard','search','settings'].includes(initialView) ? initialView : 'dashboard');
  }

  // 啟動應用程式
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
