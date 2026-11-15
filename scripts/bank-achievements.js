import fs from 'node:fs';

// Only explicit exam identity and identical options/answers may share saved progress.
export function attachBankAchievements(html) {
  html = html.replace(/<script id="study-bank-achievements">[\s\S]*?<\/script>/, '');
  const raw = JSON.parse(html.match(/const RAW_QUESTIONS = (\[.*\]);/)[1]);
  const definitions = [
    ['金融科技力', '金融科技力重點教材.html', null],
    ['消費金融', '消費金融內部控制與稽核重點教材.html', null],
    ['永續發展', '永續發展基礎能力重點教材.html', '永續發展基礎能力'],
    ['防制洗錢', '防制洗錢與打擊資恐重點教材.html', '防制洗錢與打擊資恐']
  ];
  const term = value => String(value).replace(/^第\s*(\d+)\s*[屆期]$/, '$1');
  const key = (category, period, subject, number) => JSON.stringify([category, term(period), subject, Number(number)]);
  const rawCounts = new Map();
  for (const question of raw) { const id = key(question.category, question.period, question.subject, question.number); rawCounts.set(id, (rawCounts.get(id) || 0) + 1); }
  const links = Object.create(null), packs = [];
  for (const [category, file, subject] of definitions) {
    const pack = JSON.parse(fs.readFileSync('dist/' + file, 'utf8').match(/window\.__STUDY_PACK__\s*=\s*({.*});/)[1]);
    packs.push({id:pack.id, title:category, contentVersion:pack.contentVersion, questions:pack.questions.map(({id}) => ({id}))});
    const exams = new Map();
    for (const question of pack.questions) {
      if (!question.sourceExam) continue;
      const source = question.sourceExam, id = key(category, source.term, source.subject, source.number);
      const matches = exams.get(id) || []; matches.push(question); exams.set(id, matches);
    }
    for (const question of raw.filter(item => item.category === category)) {
      const rawKey = key(category, question.period, question.subject, question.number);
      const matches = exams.get(key(category, question.period, subject || question.subject, question.number));
      if (rawCounts.get(rawKey) !== 1 || matches?.length !== 1) continue;
      const canonical = matches[0], expected = (Array.isArray(canonical.answer) ? canonical.answer : [canonical.answer]).map(value => value + 1).sort().join(',');
      if (String(question.answer).split(',').map(value => Number(value.trim())).sort().join(',') !== expected || JSON.stringify(question.options) !== JSON.stringify(canonical.options)) continue;
      links[rawKey] = {id:canonical.id, packId:pack.id, contentVersion:pack.contentVersion, studyHref:file + '?view=quiz'};
    }
  }
  const serialize = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const sources = ['achievements.js', 'bank-practice.js'].map(file => fs.readFileSync('src/renderer/' + file, 'utf8')).join('\n');
  const script = `${sources}\n(function(){
    const links=${serialize(links)}, packs=${serialize(packs)};
    window.__BANK_ACHIEVEMENT_COVERAGE__={mapped:${Object.keys(links).length},excluded:${raw.length - Object.keys(links).length}};
    const key=q=>JSON.stringify([q.category,String(q.period).replace(/^第\\s*(\\d+)\\s*[屆期]$/,'$1'),q.subject,Number(q.number)]);
    const score=document.createElement('p');score.id='bank-score';score.setAttribute('role','status');document.getElementById('questionsContainer').before(score);
    window.StudyBankPractice.configure(packs);
    const original=renderQuestions;
    renderQuestions=function(list){original(list);const cards=[...document.querySelectorAll('#questionsContainer>.q-card')];list.slice(0,300).forEach((q,i)=>{const match=links[key(q)];if(match&&cards[i]){const card=cards[i];card.dataset.savedPractice='true';card.querySelector('.options-list').replaceWith(window.StudyBankPractice.createCard({...q,...match},true));card.querySelector('.btn-reveal').onclick=()=>{const expected=String(q.answer).split(',').map(x=>Number(x.trim())-1);card.querySelectorAll('label').forEach((label,index)=>{if(expected.includes(index))label.classList.add('correct');});const feedback=card.querySelector('.bank-feedback');feedback.textContent='標準答案：'+expected.map(i=>String.fromCharCode(65+i)).join('、')+'。查看答案不計入學習進度。';};}});window.StudyBankPractice.updateScore();};
    applyFilters();
  })();`;
  console.log(`Bank achievement mapping: ${Object.keys(links).length} included / ${raw.length - Object.keys(links).length} excluded (ambiguous or not identical)`);
  return html.replace('</body>', () => `<script id="study-bank-achievements">\n${script}\n</script>\n</body>`);
}
