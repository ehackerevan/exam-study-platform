(function () {
  const selector = '#quiz-stem,.q-text';
  function attach(question) {
    const text = question.textContent.replace(/^\s*【(?:場次\s*[^】]*|第\s*\d+\s*屆[^】]*)第\s*\d+\s*題】\s*/, '').trim();
    let link = question.nextElementSibling;
    if (!link?.classList.contains('answer-search')) {
      if (!text.trim()) return;
      link = document.createElement('a');
      link.className = 'answer-search';link.textContent = '查答案';
      link.target = '_blank';link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label','查答案：Google 搜尋本題（開啟新分頁）');
      question.after(link);
    }
    link.hidden = !text.trim();
    link.href = 'https://www.google.com/search?q=' + encodeURIComponent(text);
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches(selector)) attach(root);
    root.querySelectorAll(selector).forEach(attach);
  }
  new MutationObserver(records => {
    const questions = new Set();
    for (const record of records) {
      if (record.target.nodeType === 1 && record.target.matches(selector)) questions.add(record.target);
      for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
    }
    questions.forEach(attach);
  }).observe(document.documentElement,{childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>scan(document.body));
  else scan(document.body);
})();
