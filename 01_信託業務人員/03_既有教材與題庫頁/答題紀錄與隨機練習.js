(function(root) {
  const KEY = 'trust_exam_progress_v1';
  function load(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return {records:{}, writable:true, message:''};
      const data = JSON.parse(raw);
      if (data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw new Error('format');
      for (const [key,r] of Object.entries(data.records)) {
        if (!/^\d{2}-[12]-\d{1,2}$/.test(key) || !r || !Number.isSafeInteger(r.attempts) || r.attempts<1 || !Number.isSafeInteger(r.wrong) || r.wrong<0 || r.wrong>r.attempts || typeof r.lastCorrect!=='boolean' || !Number.isInteger(r.selected) || r.selected<1 || r.selected>4 || !Number.isFinite(Date.parse(r.lastAt))) throw new Error('record');
      }
      return {records:data.records, writable:true, message:''};
    } catch (_) {
      return {records:{}, writable:false, message:'無法讀取原有紀錄，目前只暫存本次作答，不會覆蓋原資料。'};
    }
  }
  function save(storage, records) {
    try {storage.setItem(KEY, JSON.stringify({version:1, records}));return '';}
    catch (_) {return '瀏覽器無法保存紀錄，本次作答暫存在頁面，關閉或重新整理後會消失。';}
  }
  function key(q) {return `${q.p}-${q.s}-${q.n}`;}
  function record(records,q,selected) {
    const id=key(q),old=records[id]||{attempts:0,wrong:0};
    const correct=(String(q.a).match(/[1-4]/g)||[]).includes(String(selected));
    records[id]={attempts:old.attempts+1,wrong:old.wrong+(correct?0:1),lastCorrect:correct,selected,lastAt:new Date().toISOString()};
    return correct;
  }
  function stats(records,questions) {
    const result={attempts:0,wrong:0,unresolved:[],topics:[]},topics=new Map();
    for(const q of questions) {
      const r=records[key(q)];if(!r)continue;
      result.attempts+=r.attempts;result.wrong+=r.wrong;
      if(!r.lastCorrect)result.unresolved.push(q);
      const t=topics.get(q.tp)||{topic:q.tp||'未分類',attempts:0,wrong:0};
      t.attempts+=r.attempts;t.wrong+=r.wrong;topics.set(q.tp,t);
    }
    result.topics=[...topics.values()].filter(t=>t.wrong>0).sort((a,b)=>b.wrong-a.wrong || b.wrong/b.attempts-a.wrong/a.attempts || a.topic.localeCompare(b.topic,'zh-Hant'));
    return result;
  }
  function sample(pool) {
    const copy=pool.slice();
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
    return copy.slice(0,20);
  }
  const api={load,save,key,record,stats,sample};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TrustPractice=api;
})(typeof window==='undefined'?globalThis:window);
