import fs from 'node:fs';

const directory = new URL('../教材/永續發展基礎能力重點教材/', import.meta.url);
export const esgLearning = JSON.parse(fs.readFileSync(new URL('學習設計.json', directory), 'utf8'));
const financeQuestions = JSON.parse(fs.readFileSync(new URL('../教材/教學單元/永續金融練習.json', import.meta.url), 'utf8'));
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function financePractice(id) {
  const questions=financeQuestions.filter(q=>q.chapterId===id);
  if(!questions.length)return '';
  return `<details class="finance-practice"><summary>應用練習（${questions.length}題自編）</summary>${questions.map(q=>`<div id="${q.id}" class="finance-question"><p>${escape(q.prompt).replaceAll('\n','<br>')}</p><details><summary>查看解析</summary><p>${escape(q.answer).replaceAll('\n','<br>')}</p></details></div>`).join('')}</details>`;
}

export function learningSections(id) {
  const data = esgLearning[id];
  if (id === 'esg00') return [{id:'esg00-study-method',title:'如何學習與複習',content:'<div class="knowledge-topic"><p>先讀概念與比較表，再關閉教材回答回憶題，最後查看答案。答錯時補上遺漏的條件，再練本章題目。</p><p>可於隔日、第3、7、14天重答；能說明理由者拉長間隔，答錯者隔日重測。數字與期限須連同適用主體及版本記憶。</p></div>',keyPoints:[],notes:[]}];
  if (!data) return [];
  return [
    {id: id+'-learning-start', title:'先懂什麼', content:`<p>${escape(data.map)}</p>`, keyPoints:[], notes:[]},
    {id: id+'-learning-recall', title:'主動回憶', content:`<ol>${data.questions.map(q=>`<li>${escape(q)}</li>`).join('')}</ol><details><summary>查看答案與判斷依據</summary><ol>${data.answers.map(a=>`<li>${escape(a)}</li>`).join('')}</ol></details>`, keyPoints:[], notes:[]},
    {id: id+'-learning-recap', title:'考前快速複習', content:`<p>${escape(data.recap)}</p>`, keyPoints:[], notes:[]}
  ].map(section => ({...section, content:'<div class="knowledge-topic">'+section.content+(section.id.endsWith('-learning-recall')?financePractice(id):'')+'</div>'}));
}

export function writeIntegratedText() {
  let output = '# 永續發展基礎能力：整合學習教材\n\n先讀概念與比較表，再關閉教材作答，最後查看答案。答錯時回查條件，再練本章題目。可於隔日、第3、7、14天重答，依掌握程度調整間隔。數字與期限須連同適用主體及版本記憶。\n\n';
  for (const file of fs.readdirSync(directory).filter(f=>/^\d\d_.*\.md$/.test(f)).sort()) {
    const source = fs.readFileSync(new URL(file,directory),'utf8');
    const id = source.match(/^id: (.+)$/m)?.[1];
    const body = source.replace(/^---[\s\S]*?---\s*/, '').replace(/^(#{1,5}) /gm,'#$1 ').replace(/歷屆常見易錯觀念/g,'潛在易錯點').replace(/責任保險原則（PSI）/g,'永續保險原則（PSI）');
    const data = esgLearning[id];
    const firstBreak = body.indexOf('\n');
    output += body.slice(0,firstBreak)+'\n\n';
    if(data) output += `### 先懂什麼\n\n${data.map}\n\n`;
    output += body.slice(firstBreak).trim()+`\n\n`;
    if(data) output += `### 主動回憶\n\n${data.questions.map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\n<details><summary>作答後查看答案</summary>\n\n${data.answers.map((a,i)=>`${i+1}. ${a}`).join('\n')}\n\n</details>\n\n${financePractice(id)}\n\n### 考前快速複習\n\n${data.recap}\n\n`;
  }
  output += '## 版本提醒\n\n數字、期限與制度要求須連同適用主體及版本閱讀。歷屆題目按原考期判斷；本次整理未重新查核法規時效。\n';
  fs.writeFileSync(new URL('../教材/永續發展_整合學習教材.md',import.meta.url),output);
}
