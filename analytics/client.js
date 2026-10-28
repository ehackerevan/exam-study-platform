(function () {
  const base = 'https://study-pack-metrics.ehackerevan.workers.dev';
  let pack, totals = null, questions = null, failed = false;
  const number = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  function update() {
    for (const node of document.querySelectorAll('[data-metrics-question]')) {
      node.textContent = failed ? '作答次數暫時無法取得' : questions ? `作答 ${number(questions[node.dataset.metricsQuestion]).toLocaleString('zh-TW')} 次` : '統計載入中';
    }
    for (const card of document.querySelectorAll('[data-metrics-course]')) {
      let node = card.querySelector('.study-metrics-course');
      if (!node) { node = document.createElement('p'); node.className = 'study-metrics-course'; node.style.fontSize = '.85rem'; card.querySelector('.subject-meta').after(node); }
      const row = totals?.[card.dataset.metricsCourse];
      node.textContent = failed ? '統計暫時無法取得' : totals ? `瀏覽 ${number(row?.view).toLocaleString('zh-TW')} 次 · 作答 ${number(row?.answer).toLocaleString('zh-TW')} 次` : '統計載入中';
    }
  }
  function question(id, target) {
    const node = document.createElement('span'); node.dataset.metricsQuestion = id;
    node.style.display = 'block'; node.style.fontSize = '.85rem';
    target.append(node);
    node.textContent = failed ? '作答次數暫時無法取得' : questions ? `作答 ${number(questions[id]).toLocaleString('zh-TW')} 次` : '統計載入中';
  }
  async function send(type, id) {
    if (!pack) return;
    const event = {type, course:pack.id};
    if (id) event.question = id;
    try {
      const response = await fetch(base+'/event', {method:'POST', credentials:'omit', keepalive:true,
        headers:{'Content-Type':'text/plain'}, body:JSON.stringify(event)});
      if (response.ok && type === 'answer' && questions) {
        questions[id] = number(questions[id]) + 1;
        if (totals?.[pack.id]) totals[pack.id].answer = number(totals[pack.id].answer) + 1;
        update();
      }
    } catch (_) {}
  }
  window.StudyMetrics = {question, update, answer:id => { void send('answer', id); }};
  document.addEventListener('DOMContentLoaded', async () => {
    pack = window.__STUDY_PACK__;
    update();
    if (pack) await send('view');
    try {
      const response = await fetch(base+'/counts'+(pack ? '?course='+encodeURIComponent(pack.id) : ''), {credentials:'omit'});
      if (!response.ok) throw Error('unavailable');
      const data = await response.json();
      totals = Object.create(null); questions = Object.create(null);
      for (const row of data.totals) { totals[row.course] ||= {}; totals[row.course][row.type] = number(row.total); }
      for (const row of data.questions) questions[row.question] = number(row.total);
    } catch (_) { failed = true; }
    update();
  }, {once:true});
})();
