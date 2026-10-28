import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const answers = questions => questions.map(q => q.answer + 1).join('');

test('official new exams preserve all question numbers and published answer keys', () => {
  const fintech = read('教材/金融科技力重點教材/questions.json').questions.filter(q => q.id.startsWith('ft-22-'));
  const trust = read('教材/信託業務人員重點教材/full_exam_bank.json').c08.filter(q => q.term === 63);
  const investment = read('考古題/新增題庫/投資型保險/study-pack.json').questions;
  const derivatives = read('考古題/新增題庫/衍生性金融商品/study-pack.json').questions;
  const groups = [
    [fintech, '321243413431434223134434323243321244332243221431233233333111'],
    [trust.filter(q => q.subject === '信託法規'), '14332213221114422133132234322222323334333323234441'],
    [trust.filter(q => q.subject === '信託實務'), '44132132232344244124343413244441434241443344444443333134243131424331341231432413'],
    [investment.filter(q => q.id.startsWith('investment-1140914-1-')), '34134144432332244321121313424424211223132334243414'],
    [investment.filter(q => q.id.startsWith('investment-1140914-2-')), '2231444414134323413243334212133424433123334241344421423442321231441222132322344131433322413334333114'],
    [investment.filter(q => q.id.startsWith('investment-1150111-1-')), '22131331234421134224134344434211143323224433423244'],
    [investment.filter(q => q.id.startsWith('investment-1150111-2-')), '2132221323424344141121123311334142142241224244243321244244233144213121412214123433313134213314131324'],
    [derivatives.filter(q => q.id.startsWith('derivatives-第18期-')), '132412311224423333242332134333242341212113122443432231344224'],
    [derivatives.filter(q => q.id.startsWith('derivatives-第19期-')), '331214313412124244134213422142413321213224222142342211124324'],
    [derivatives.filter(q => q.id.startsWith('derivatives-第20期-')), '132414343421343434323133321312333212222322412414133122232222']
  ];
  for (const [questions, key] of groups) {
    assert.equal(questions.length, key.length);
    assert.equal(answers(questions), key);
    assert.equal(new Set(questions.map(q => q.id)).size, key.length);
    assert(questions.every(q => (q.question || q.stem) && q.options.length === 4 && q.options.every(Boolean)));
  }
});
