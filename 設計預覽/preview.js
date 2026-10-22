(() => {
  const lessons = [...document.querySelectorAll('.lesson')];
  const selector = document.getElementById('subject-select');
  const picker = document.querySelector('.chapter-picker');
  const links = [...document.querySelectorAll('.chapter-list a')];
  const mobile = matchMedia('(max-width:860px)');
  const defaultLesson = 'aml-aml02';

  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('main-content').focus();
  });

  function showLesson() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ''; }
    const selected = lessons.find(lesson => lesson.id === id) || document.getElementById(defaultLesson);
    lessons.forEach(lesson => lesson.classList.toggle('is-active', lesson === selected));
    document.querySelectorAll('.course-navigation').forEach(nav => nav.classList.toggle('is-active', nav.dataset.course === selected.dataset.course));
    links.forEach(link => {
      if (link.hash === '#' + selected.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    selector.value = selected.dataset.course;
    document.title = selected.dataset.shortTitle + '｜各科教材・白話圖解';
    if (mobile.matches) picker.open = false;
    window.scrollTo(0, 0);
    if (document.documentElement.classList.contains('enhanced')) selected.querySelector('h2').focus({preventScroll:true});
  }

  selector.addEventListener('change', () => {
    const first = lessons.find(lesson => lesson.dataset.course === selector.value);
    location.hash = first.id;
  });
  window.addEventListener('hashchange', showLesson);
  mobile.addEventListener('change', () => { picker.open = !mobile.matches; });

  function selectStep(lesson, index) {
    const buttons = [...lesson.querySelectorAll('.map-node')];
    buttons.forEach((button, i) => {
      button.classList.toggle('is-selected', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
    lesson.querySelectorAll('.step-detail').forEach((detail, i) => detail.classList.toggle('is-selected', i === index));
    lesson.querySelectorAll('.map-track span').forEach((bar, i) => bar.classList.toggle('active', i <= index));
    const next = lesson.querySelector('.next-step');
    next.textContent = index === buttons.length - 1 ? '再看一次 ↺' : '下一步 →';
    next.dataset.step = String((index + 1) % buttons.length);
  }
  lessons.forEach(lesson => {
    lesson.querySelectorAll('.map-node').forEach((button, index) => button.addEventListener('click', () => selectStep(lesson, index)));
    lesson.querySelector('.next-step').addEventListener('click', event => selectStep(lesson, Number(event.currentTarget.dataset.step)));
    selectStep(lesson, 0);
  });

  document.querySelectorAll('.practice-form').forEach(form => {
    const feedback = form.querySelector('.quiz-feedback');
    form.addEventListener('change', () => {
      feedback.hidden = true;
      form.querySelectorAll('.option').forEach(label => label.classList.remove('is-correct', 'is-wrong'));
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const selected = [...form.querySelectorAll('input:checked')].map(input => Number(input.value));
      feedback.hidden = false;
      if (!selected.length) {
        feedback.textContent = '先選擇答案，再核對。';
        form.querySelector('input').focus();
        return;
      }
      const answer = JSON.parse(form.dataset.answer);
      const correct = selected.length === answer.length && selected.every(value => answer.includes(value));
      const letters = answer.map(value => String.fromCharCode(65 + value)).join('、');
      feedback.textContent = (correct ? '✓ 與來源答案一致。' : '再對照一次。') + ' 來源答案：' + letters + '。';
      form.querySelectorAll('input').forEach(input => {
        const label = input.closest('.option');
        label.classList.toggle('is-correct', answer.includes(Number(input.value)));
        label.classList.toggle('is-wrong', input.checked && !answer.includes(Number(input.value)));
      });
    });
  });
  showLesson();
  picker.open = !mobile.matches;
  document.documentElement.classList.remove('without-js');
  document.documentElement.classList.add('enhanced');
})();
