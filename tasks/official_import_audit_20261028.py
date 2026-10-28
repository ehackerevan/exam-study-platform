from pathlib import Path
import pymupdf,re,json
root=Path('考古題/官方來源_20261028');out=[]
for p in root.rglob('*試題.pdf'):
 if '參考文件' in str(p):continue
 s=''
 for pg in pymupdf.open(p):
  blocks=pg.get_text('blocks'); blocks.sort(key=lambda b:(b[0]>=pg.rect.width/2,b[1],b[0])); s+='\n'+'\n'.join(x[4] for x in blocks)
 ms=list(re.finditer(r'(?m)^\s*(\d{1,3})\s*[.．](?!\d)\s*(?=\S)',s)); assert [int(m[1]) for m in ms]==list(range(1,len(ms)+1)),str(p)
 if '投資型保險' in str(p):ans=p.with_name(p.name.replace('試題','解答')); col=None
 else:ans=p.with_name('解答.pdf');col=1 if '法規試題' in p.name else 2 if '實務試題' in p.name else 1
 tables=[t.extract() for pg in pymupdf.open(ans) for t in pg.find_tables().tables]; answers={}
 for rows in tables:
  if col is None:
   for a,b in zip(rows[::2],rows[1::2]):
    if a[0]=='題號' and b[0]=='標準答案':
     for n,v in zip(a[1:],b[1:]):
      if n and n.isdigit(): answers[int(n)]=v
  else:
   for row in rows:
    if row[0] and row[0].isdigit() and len(row)>col and int(row[0])<=len(ms): answers[int(row[0])]=row[col]
 assert set(answers)==set(range(1,len(ms)+1)),(str(p),len(answers))
 for i,m in enumerate(ms):
  number=int(m[1]);chunk=s[m.end():ms[i+1].start() if i+1<len(ms) else len(s)]
  chunk=re.sub(r'【請接續(?:背面|下頁)】','',chunk);chunk=re.sub(r'第二部分：第\s*41\s*~\s*60\s*題[^\n]*','',chunk)
  opts=list(re.finditer(r'(?<!\d)\([1-4]\)',chunk)); assert [x.group() for x in opts]==['(1)','(2)','(3)','(4)'],(str(p),number)
  clean=lambda x:re.sub(r'\s+',' ',x).strip()
  question=clean(chunk[:opts[0].start()]); options=[clean(chunk[o.end():opts[j+1].start() if j<3 else len(chunk)]) for j,o in enumerate(opts)]
  raw=str(answers[number] or '').strip()
  assert question and all(options),(str(p),number)
  out.append({'file':str(p),'number':number,'question':question,'options':options,'answerRaw':raw})

ft=json.loads(Path('教材/金融科技力重點教材/questions.json').read_text(encoding='utf8'))['questions']
bank=json.loads(Path('教材/信託業務人員重點教材/full_exam_bank.json').read_text(encoding='utf8'))
inv=json.loads(Path('考古題/新增題庫/投資型保險/study-pack.json').read_text(encoding='utf8'))['questions']
der=json.loads(Path('考古題/新增題庫/衍生性金融商品/study-pack.json').read_text(encoding='utf8'))['questions']
records={q['id']:q for q in ft+bank['c08']+inv+der}
assert len(out)==670
for q in out:
 p=Path(q['file']); category=p.parts[2]; exam=p.parts[3]; n=q['number']
 if category=='金融科技力': id=f'ft-22-{n}'
 elif category=='信託業務人員': id=f"past-63-{'law' if '法規' in p.name else 'practice'}-{n}"
 elif category=='投資型保險': id=f"investment-{exam}-{1 if '第一節' in p.name else 2}-{n}"
 else: id=f'derivatives-{exam}-{n}'
 record=records[id]; stem=record.get('stem',record.get('question',''))
 assert stem==q['question'] or stem.endswith('】'+q['question']),id
 assert record['options']==q['options'] and record['answer']==int(q['answerRaw'].splitlines()[0])-1,id
assert records['derivatives-第20期-9']['explanation']=='官方答案表註記：114/7/15 法規修改。'
print('PASS: 670 source PDF questions, options, answer indices, and official note')
