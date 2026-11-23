(function () {
  'use strict';
  function validate(data, id) {
    if (!data || data.format !== 'study-pack-progress-v1' || data.packId !== id ||
      !Array.isArray(data.completedChapters) || !data.completedChapters.every(id => typeof id === 'string') ||
      !data.questionStats || typeof data.questionStats !== 'object' || Array.isArray(data.questionStats) ||
      !data.lastPosition || typeof data.lastPosition.chapterId !== 'string' ||
      (data.lastPosition.sectionId !== undefined && typeof data.lastPosition.sectionId !== 'string') ||
      (data.quizHistory !== undefined && (!Array.isArray(data.quizHistory) || data.quizHistory.length > 20 || data.quizHistory.some(item =>
        !item || !['chapter','random','wrong','exam','featured','knowledge-point'].includes(item.mode) ||
        !Number.isSafeInteger(item.questionCount) || item.questionCount < 1 ||
        !Number.isSafeInteger(item.correctCount) || item.correctCount < 0 ||
        !Number.isSafeInteger(item.wrongCount) || item.wrongCount < 0 ||
        item.correctCount + item.wrongCount !== item.questionCount ||
        !Number.isSafeInteger(item.accuracy) || item.accuracy < 0 || item.accuracy > 100 ||
        typeof item.completedAt !== 'string' || !Number.isFinite(Date.parse(item.completedAt)) ||
        (item.term !== undefined && typeof item.term !== 'string') ||
        (item.subject !== undefined && typeof item.subject !== 'string') ||
        (item.knowledgePoint !== undefined && (typeof item.knowledgePoint !== 'string' || !item.knowledgePoint.trim())) ||
        (item.featuredGroup !== undefined && typeof item.featuredGroup !== 'string'))))) throw Error('進度結構不正確');
    for(const field of ['hiddenQuestionIds','favoriteQuestionIds'])if(data[field]!==undefined&&(!Array.isArray(data[field])||!data[field].every(id=>typeof id==='string')))throw Error('題目標記格式不正確');
    for (const record of Object.values(data.questionStats)) {
      if (!record || !['attempts','wrongCount','correctCount'].every(key => Number.isSafeInteger(record[key]) && record[key] >= 0) ||
        record.attempts !== record.wrongCount + record.correctCount || typeof record.lastResult !== 'boolean') throw Error('作答紀錄不正確');
    }
    return data;
  }
  let database;
  function open() {
    if (!database) database = new Promise((resolve, reject) => {
      let request;
      try { request = indexedDB.open('study-pack-write-lock-v1', 1); } catch (_) { reject(Error('無法取得安全保存鎖，請匯出本頁進度。')); return; }
      request.onupgradeneeded = () => request.result.createObjectStore('mutex');
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
      request.onerror = request.onblocked = () => reject(Error('無法取得安全保存鎖，請匯出本頁進度。'));
    });
    database.catch(() => { database = undefined; });
    return database;
  }
  async function exclusive(operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let transaction, result, failure;
      try {
        transaction = db.transaction('mutex', 'readwrite');
        // Every writer shares this transaction scope; no progress or lease data is stored in IDB.
        transaction.objectStore('mutex').get(0).onsuccess = () => {
          try { result = operation(); } catch (error) { failure = error; transaction.abort(); }
        };
      } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () => reject(failure || Error('安全保存失敗，請匯出本頁進度。'));
    });
  }
  function conflict() { const error = Error('另一分頁已變更學習進度；本頁尚未保存，請先匯出備份再重新載入。'); error.code = 'progress-conflict'; return error; }
  function replace(key, expected, next, beforeWrite) {
    return exclusive(() => {
      if (localStorage.getItem(key) !== expected) throw conflict();
      beforeWrite?.();
      if (next === null) localStorage.removeItem(key); else localStorage.setItem(key, next);
      return next;
    });
  }
  window.StudyProgress = {validate, exclusive, replace, conflict};
})();
