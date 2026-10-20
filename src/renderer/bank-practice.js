(function () {
  const results = new Map();
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function updateScore() {
    const submitted = [...results.values()].filter(result => result.submitted);
    const correct = submitted.filter(result => result.correct).length;
    document.getElementById('bank-score').textContent = `本次已答 ${submitted.length} 題 · 答對 ${correct} 題 · 答錯 ${submitted.length - correct} 題 · 正確率 ${submitted.length ? Math.round(correct / submitted.length * 100) : 0}%`;
  }
  function saveAnswer(question, correct) {
    const key = `study-pack.${question.packId}.progress`;
    const stored = localStorage.getItem(key);
    const progress = stored ? JSON.parse(stored) : {
      format:'study-pack-progress-v1', packId:question.packId, schemaVersion:1, contentVersion:question.contentVersion,
      completedChapters:[], questionStats:{}, quizHistory:[], lastPosition:{chapterId:'',sectionId:''}, settings:{theme:'system'}
    };
    if (progress.format !== 'study-pack-progress-v1' || progress.packId !== question.packId ||
        !Array.isArray(progress.completedChapters) || !progress.lastPosition || !progress.settings ||
        !progress.questionStats || typeof progress.questionStats !== 'object' || Array.isArray(progress.questionStats)) throw Error('進度格式異常');
    const stats = progress.questionStats[question.id] || {attempts:0,wrongCount:0,correctCount:0};
    if (!['attempts','wrongCount','correctCount'].every(field => Number.isSafeInteger(stats[field]) && stats[field] >= 0) || stats.attempts !== stats.wrongCount + stats.correctCount) throw Error('作答紀錄異常');
    stats.attempts++;
    if (correct) stats.correctCount++; else stats.wrongCount++;
    stats.lastResult = correct; stats.lastAnsweredAt = new Date().toISOString();
    progress.questionStats[question.id] = stats;
    localStorage.setItem(key, JSON.stringify(progress));
  }
  function createCard(question) {
    const key = `${question.packId}:${question.id}`;
    const result = results.get(key);
    const submitted = !!result?.submitted;
    const expected = String(question.answer).split(',').map(value => Number(value.trim()) - 1);
    const selected = result?.selected || [];
    const multiple = question.type === 'multiple-choice';
    const card = document.createElement('article'); card.className = 'q-card';
    card.innerHTML = `<div class="q-card-header"><div class="q-tags"><span class="tag-cat">${escape(question.category)}</span><span>${escape(question.period)} · ${escape(question.subject)} · 第 ${escape(question.number)} 題</span><span>${multiple ? '多選題' : '單選題'}</span></div></div>
      <div class="q-text">${escape(question.text)}</div>
      <a href="${escape(question.studyHref)}">到本學科練習</a>
      <form><fieldset><legend>${multiple ? '請選出所有正確選項' : '請選擇一個答案'}</legend>
      <div class="chapter-inline-options">${question.options.map((option,index) => `<label class="option-item ${submitted && expected.includes(index) ? 'correct' : submitted && selected.includes(index) ? 'wrong' : ''}"><input type="${multiple ? 'checkbox' : 'radio'}" name="answer" value="${index}" ${selected.includes(index) ? 'checked' : ''} ${submitted ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}. ${escape(option)}</span></label>`).join('')}</div></fieldset>
      <p class="bank-feedback" role="status" tabindex="-1">${submitted ? `${result.correct ? '作答正確' : '作答錯誤'}；正確答案：${expected.map(index => String.fromCharCode(65 + index)).join('、')}${result.saved ? '。' : '。進度儲存失敗，原有紀錄未覆寫。'}` : ''}</p>
      <button type="submit">${submitted ? '重新作答' : '送出答案'}</button></form>`;
    const form = card.querySelector('form');
    form.onchange = () => results.set(key, {selected:[...form.querySelectorAll('input:checked')].map(input => Number(input.value)),submitted:false});
    form.onsubmit = event => {
      event.preventDefault();
      if (submitted) {
        results.delete(key); const replacement = createCard(question); card.replaceWith(replacement); updateScore(); replacement.querySelector('input').focus(); return;
      }
      const values = [...form.querySelectorAll('input:checked')].map(input => Number(input.value));
      if (!values.length) { card.querySelector('.bank-feedback').textContent = '請先選擇答案。'; form.querySelector('input').focus(); return; }
      const correct = values.length === expected.length && expected.every(value => values.includes(value));
      let saved = false;
      try { saveAnswer(question, correct); saved = true; } catch (_) {}
      results.set(key, {selected:values, submitted:true, correct, saved});
      const replacement = createCard(question); card.replaceWith(replacement); updateScore(); replacement.querySelector('.bank-feedback').focus({preventScroll:true});
    };
    return card;
  }
  window.StudyBankPractice = {createCard,updateScore};
})();
