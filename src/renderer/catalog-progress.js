(function () {
  const courses = window.__CATALOG_PROGRESS__ || [];
  function refreshProgress() {
    for (const course of courses) {
      let saved;
      let unavailable = false;
      try {
        const raw = localStorage.getItem(`study-pack.${course.id}.progress`);
        saved = raw ? JSON.parse(raw) : null;
        if (saved && (saved.format !== 'study-pack-progress-v1' || saved.packId !== course.id || !Array.isArray(saved.completedChapters) || !saved.questionStats || typeof saved.questionStats !== 'object' || Array.isArray(saved.questionStats))) throw new Error('Invalid progress');
      } catch { saved = null; unavailable = true; }
      const completed = new Set(saved?.completedChapters || []);
      const read = course.chapters.filter(id => completed.has(id)).length;
      const practiced = course.questions.filter(id => Number.isSafeInteger(saved?.questionStats?.[id]?.attempts) && saved.questionStats[id].attempts > 0).length;
      for (const card of document.querySelectorAll('[data-pack]')) {
        if (card.dataset.pack !== course.id) continue;
        const reading = card.dataset.progressView === 'reader';
        const count = reading ? read : practiced;
        const total = reading ? course.chapters.length : course.questions.length;
        const percent = total ? Math.round(count / total * 100) : 0;
        const label = card.querySelector('.subject-progress-label');
        const bar = card.querySelector('progress');
        label.textContent = unavailable ? '無法讀取學習進度' : `${reading ? '已讀' : '已作答'} ${count.toLocaleString('zh-TW')} / ${total.toLocaleString('zh-TW')} ${reading ? '章' : '題'} · ${percent}%`;
        bar.hidden = unavailable;
        bar.value = percent;
        bar.textContent = `${percent}%`;
      }
    }
  }
  refreshProgress();
  window.addEventListener('pageshow', refreshProgress);
  window.addEventListener('focus', refreshProgress);
  window.addEventListener('storage', refreshProgress);
})();

