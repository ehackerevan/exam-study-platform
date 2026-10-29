(function(){
 const courses=['trust-exam','fintech-exam-pack','consumer-finance-exam-pack','esg-sustainability-pack','aml-cft-exam-pack','financial-market-ethics-official-bank-113','financial-market-ethics-official-bank-116','investment-insurance-exam','derivatives-sales-exam'];
 const pages=['信託業務人員重點教材.html','金融科技力重點教材.html','消費金融內部控制與稽核重點教材.html','永續發展基礎能力重點教材.html','防制洗錢與打擊資恐重點教材.html','金融市場常識與職業道德題庫.html','金融市場常識與職業道德題庫_116年版.html','投資型保險題庫.html','衍生性金融商品題庫.html','歷屆考古題_完整題庫大全.html'];
 const endpoint='https://study-pack-sync.ehackerevan.workers.dev';
 const guestKey=id=>`study-pack.${id}.progress`, accountKey=(account,id)=>`study-pack.account.${account}.${id}.progress`;
 const indicator=document.getElementById('backup-status'), output=document.getElementById('backup-export'), input=document.getElementById('backup-file'), restore=document.getElementById('backup-import');
 if(!indicator||!output||!input||!restore)return;
 const status=text=>{indicator.textContent=text;};
 async function api(data){const r=await fetch(endpoint,{method:'POST',credentials:'include',headers:{'Content-Type':'text/plain'},body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});if(!r.ok){const e=Error('雲端服務無法使用');e.status=r.status;throw e;}return r.json();}
 async function cloud(){
  if(location.protocol==='file:'||location.origin==='null')return null;
  try{const session=await api({action:'session'});if(!/^[a-f0-9-]{36}$/.test(session.account))throw Error('帳號格式錯誤');return {id:session.account,items:(await api({action:'read-all'})).items};}
  catch(e){if(e.status===401&&!localStorage.getItem('study-pack.sync.account'))return null;throw Error('無法讀取完整的雲端紀錄，請先登入並確認網路正常。');}
 }
 function valid(value,id){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.format!=='study-pack-progress-v1'||value.packId!==id||!Array.isArray(value.completedChapters)||!value.completedChapters.every(x=>typeof x==='string')||!value.questionStats||typeof value.questionStats!=='object'||Array.isArray(value.questionStats)||!value.lastPosition||typeof value.lastPosition.chapterId!=='string'||(value.lastPosition.sectionId!==undefined&&typeof value.lastPosition.sectionId!=='string'))return false;
  for(const field of ['hiddenQuestionIds','favoriteQuestionIds'])if(value[field]!==undefined&&(!Array.isArray(value[field])||!value[field].every(x=>typeof x==='string')))return false;
  for(const q of Object.values(value.questionStats))if(!q||!['attempts','wrongCount','correctCount'].every(k=>Number.isSafeInteger(q[k])&&q[k]>=0)||q.attempts!==q.wrongCount+q.correctCount||typeof q.lastResult!=='boolean')return false;
  if(value.quizHistory!==undefined&&(!Array.isArray(value.quizHistory)||value.quizHistory.length>20||value.quizHistory.some(x=>!x||!['chapter','random','wrong','exam','featured','knowledge-point'].includes(x.mode)||!Number.isSafeInteger(x.questionCount)||x.questionCount<1||!Number.isSafeInteger(x.correctCount)||x.correctCount<0||!Number.isSafeInteger(x.wrongCount)||x.wrongCount<0||x.correctCount+x.wrongCount!==x.questionCount||!Number.isSafeInteger(x.accuracy)||x.accuracy<0||x.accuracy>100||typeof x.completedAt!=='string'||!Number.isFinite(Date.parse(x.completedAt))||['term','subject','knowledgePoint','featuredGroup'].some(k=>x[k]!==undefined&&typeof x[k]!=='string')||(x.knowledgePoint!==undefined&&!x.knowledgePoint.trim()))))return false;
  return true;
 }
 function entries(obj){if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(id=>!courses.includes(id)))throw Error('備份學科格式不正確。');for(const [id,value] of Object.entries(obj))if(!valid(value,id))throw Error(`「${id}」的進度格式不正確。`);return Object.entries(obj);}
 function parse(raw,id){const v=JSON.parse(raw);if(!valid(v,id))throw Error(`「${id}」的進度格式不正確，請先匯出單科備份。`);return v;}
 async function material(page){
  try{if(window.parent!==window&&typeof window.parent.readPage==='function'){const result=window.parent.readPage(page);if(typeof result==='string')return result;}}
  catch{}
  if(location.protocol==='file:')throw Error('無法讀取其他教材，請從整合版單檔或線上學科目錄匯出。');
  const r=await fetch(page,{credentials:'omit',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`無法下載 ${page}，請檢查網路。`);return r.text();
 }
 async function makeBackup(){
  const connection=await cloud(),guest=Object.create(null),account=Object.create(null);
  for(const id of courses){const value=localStorage.getItem(guestKey(id));if(value!==null)guest[id]=parse(value,id);}
  if(connection){
   if(!Array.isArray(connection.items))throw Error('雲端紀錄格式不正確。');
   const rows=new Map(connection.items.map(x=>[x.course,x]));
   for(const id of courses){const row=rows.get(id),key=accountKey(connection.id,id),raw=localStorage.getItem(key),m=localStorage.getItem(key+'.sync'),meta=m?JSON.parse(m):null;
    if(row&&(!Number.isSafeInteger(row.revision)||!valid(row.data,id)))throw Error(`「${id}」的雲端紀錄不正確。`);
    if(meta?.dirty&&meta.revision!==(row?.revision||0))throw Error(`「${id}」有尚未解決的同步衝突，請先到該學科處理。`);
    if(meta?.dirty&&!raw)throw Error(`「${id}」的本機紀錄不完整。`);
    if(meta?.dirty)account[id]=parse(raw,id);else if(row)account[id]=row.data;else if(raw)account[id]=parse(raw,id);
   }
  }
  status('正在收集所有教材與題庫，請稍候…');const html=await Promise.all(pages.map(material));
  return {format:'study-pack-complete-backup-v1',exportedAt:new Date().toISOString(),materials:Object.fromEntries(pages.map((page,i)=>[page,html[i]])),records:{guest,account}};
 }
 function addChange(changes,key,value){changes.push({key,before:localStorage.getItem(key),after:value});}
 async function importBackup(file){
  if(!file||file.size>50*1024*1024)throw Error('請選擇小於 50 MB 的整合備份檔。');let backup;try{backup=JSON.parse(await file.text());}catch{throw Error('備份檔不是有效的 JSON。');}
  if(!backup||backup.format!=='study-pack-complete-backup-v1'||!backup.materials||typeof backup.materials!=='object'||!backup.records)throw Error('這不是整合備份檔；舊版單科備份請到該科設定匯入。');
  for(const page of pages)if(typeof backup.materials[page]!=='string')throw Error('備份缺少教材或題庫，未匯入任何資料。');
  const guests=entries(backup.records.guest),accounts=entries(backup.records.account),connection=await cloud();
  if(accounts.length&&!connection)throw Error('此備份包含雲端帳號紀錄，請先登入代號，再匯入。');
  const rows=new Map((connection?.items||[]).map(x=>[x.course,x]));
  if(!confirm(`將還原 ${guests.length} 科訪客紀錄與 ${accounts.length} 科帳號紀錄，並保留網站最新版教材和題庫。原紀錄會先保留在本機備份；請先關閉其他學科分頁。確定繼續？`))return;
  const changes=[],stamp=Date.now();
  for(const [id,value] of guests){const key=guestKey(id),old=localStorage.getItem(key);if(old!==null)addChange(changes,key+'.backup.'+stamp,old);addChange(changes,key,JSON.stringify(value));}
  for(const [id,value] of accounts){const key=accountKey(connection.id,id),old=localStorage.getItem(key),m=localStorage.getItem(key+'.sync'),meta=m?JSON.parse(m):null,row=rows.get(id),revision=row?.revision||0;
   if(meta?.dirty&&meta.revision!==revision)throw Error(`「${id}」有尚未解決的同步衝突，請先到該學科處理。`);
   if(old!==null)addChange(changes,key+'.backup.'+stamp,old);else if(row)addChange(changes,key+'.backup.'+stamp,JSON.stringify(row.data));
   addChange(changes,key,JSON.stringify(value));addChange(changes,key+'.sync',JSON.stringify({revision,dirty:true}));
  }
  const changed=[];try{for(const c of changes){localStorage.setItem(c.key,c.after);changed.push(c);}}
  catch(e){for(const c of changed.reverse())try{if(c.before===null)localStorage.removeItem(c.key);else localStorage.setItem(c.key,c.before);}catch{}throw Error('本機空間不足，已嘗試恢復匯入前資料。');}
  const failed=[];
  for(const [id,value] of accounts){const key=accountKey(connection.id,id),m=JSON.parse(localStorage.getItem(key+'.sync'));try{const result=await api({action:'write',course:id,revision:m.revision,progress:value});const current=localStorage.getItem(key);localStorage.setItem(key+'.sync',JSON.stringify({revision:result.revision,dirty:current!==JSON.stringify(value)}));}catch{failed.push(id);}}
  status(failed.length?`已還原本機紀錄；${failed.length} 科尚未同步，請開啟該科處理。`:'已還原全部個人紀錄；網站教材與題庫保持最新版。');
  window.dispatchEvent(new Event('storage'));
 }
 output.onclick=async()=>{output.disabled=true;restore.disabled=true;try{status('正在收集進度…');const data=await makeBackup(),url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`study-pack-complete-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('整合備份已下載，包含教材、題庫與可讀取的個人紀錄。');}catch(e){status(e.message||'備份失敗，請稍後再試。');}finally{output.disabled=false;restore.disabled=false;}};
 restore.onclick=()=>input.click();input.onchange=async()=>{if(!input.files.length)return;output.disabled=true;restore.disabled=true;try{status('正在檢查備份…');await importBackup(input.files[0]);}catch(e){status(e.message||'匯入失敗，原紀錄未覆寫。');}finally{input.value='';output.disabled=false;restore.disabled=false;}};
})();
