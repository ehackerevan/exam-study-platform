(function(){
 const endpoint='https://study-pack-sync.ehackerevan.workers.dev';
 let account='',course='',key='',metaKey='',meta=null,enabled=false,timer=null,busy=null,statusNode=null,validator=null;
 function status(text){if(statusNode)statusNode.textContent=text;}
 function conflict(){enabled=false;status('其他裝置的進度已變更；為避免覆蓋，同步已暫停。請先匯出本機備份，或選擇改用雲端進度。');const button=document.getElementById('sync-use-cloud');if(button)button.style.display='';}
 async function request(data){
  const response=await fetch(endpoint,{method:'POST',credentials:'include',headers:{'Content-Type':'text/plain'},body:JSON.stringify(data),signal:AbortSignal.timeout(3000)});
  if(!response.ok){const e=new Error('request');e.status=response.status;throw e;}
  return response.json();
 }
 function hasPendingProgress(){
  return Object.keys(localStorage).some(name=>{
   if(!name.startsWith('study-pack.account.')||!name.endsWith('.progress.sync'))return false;
   try{return JSON.parse(localStorage.getItem(name)).dirty;}catch{return true;}
  });
 }
 function storeMeta(){localStorage.setItem(metaKey,JSON.stringify(meta));}
 function panel(){
  const target=document.querySelector('#view-settings > div') || document.getElementById('catalog-login'); if(!target)return;
  const box=document.createElement('section');box.className='form-group';box.setAttribute('aria-labelledby','sync-title');
  box.innerHTML='<h3 id="sync-title">雲端學習進度</h3><p>使用代號登入，即可在其他裝置取回進度。代號須為 12–64 個英文字母、數字或符號，至少包含字母與數字。代號就是進度的唯一鑰匙，請妥善保存，遺失無法找回。</p><label for="sync-code">登入代號</label><input class="select-dropdown" id="sync-code" type="password" autocomplete="off" maxlength="64" style="width:100%;margin:.5rem 0"><div style="display:flex;flex-wrap:wrap;gap:.5rem"><button type="button" class="btn btn-primary" id="sync-login">登入</button><button type="button" class="btn btn-secondary" id="sync-register">首次建立代號</button><button type="button" class="btn btn-secondary" id="sync-logout">登出</button><button type="button" class="btn btn-secondary" id="sync-use-cloud" style="display:none">改用雲端進度</button></div><p id="sync-status" role="status" aria-live="polite"></p><hr>';
  target.querySelector('h2').after(box);statusNode=box.querySelector('#sync-status');
  const code=box.querySelector('#sync-code');
  box.querySelector('label[for=sync-code]').style.display=account?'none':'';
  code.style.display=account?'none':'';
  for(const action of ['login','register']) box.querySelector('#sync-'+action).style.display=account?'none':'';
  box.querySelector('#sync-logout').style.display=account?'':'none';
  const tab=document.querySelector('[data-view=settings]');if(tab)tab.textContent='⚙️ 設定／登入';
  const reset=document.getElementById('btn-reset-progress');if(account&&reset)reset.previousElementSibling.textContent='清除此教材在本機及雲端的學習進度。教材內容與題庫不受影響。';
  for(const action of ['login','register']) box.querySelector('#sync-'+action).onclick=async()=>{
   const value=code.value;
   if(!/^[A-Za-z0-9!@#$%^&*_.-]{12,64}$/.test(value)||!/[A-Za-z]/.test(value)||!/[0-9]/.test(value)){status('代號格式不符，請輸入至少 12 碼且含字母與數字。');return;}
   if(action==='register'&&!confirm('建立後請自行保存代號，遺失無法找回。確定建立？'))return;
   status('處理中…');
   try{
    await request({action,code:value});code.value='';
    try{await request({action:'session'});}catch{status('登入後無法保存工作階段；請允許此網站使用跨網站 Cookie。');return;}
    location.reload();
   }catch(e){code.value='';status(e.status===409?'此代號已被使用，請改用其他代號。':e.status===401?'代號不正確。':e.status===429?'操作過於頻繁，請稍後再試。':'連線失敗，或瀏覽器阻擋跨網站 Cookie；進度仍保存在本機。');}
  };
  box.querySelector('#sync-use-cloud').onclick=async()=>{
   if(!confirm('將先保留本機備份，再使用最新雲端進度。確定繼續？'))return;
   try{const current=await request({action:'read',course});if(!current.data)throw Error('missing');validator(current.data);const previous=localStorage.getItem(key);if(previous!==null)localStorage.setItem(key+'.backup.'+Date.now(),previous);localStorage.setItem(key,JSON.stringify(current.data));meta={revision:current.revision,dirty:false};storeMeta();location.reload();}catch{status('無法載入雲端進度，本機紀錄仍保留。');}
  };
  box.querySelector('#sync-logout').onclick=async()=>{
   if((meta?.dirty||(!course&&hasPendingProgress()))&&!confirm('本機尚有未同步的進度，登出後會保留在此瀏覽器；確定登出？'))return;
   try{await request({action:'logout'});localStorage.removeItem('study-pack.sync.account');location.reload();}catch{status('登出失敗，請檢查網路後重試。');}
  };
  status(account?(course?(enabled?'已登入，進度同步中。':'已登入；同步暫停，本機進度保留。'):'已登入。'):'未登入，進度保存在此瀏覽器。');
 }
 async function bootstrap(id, guestKey, normalize){
  course=id;validator=normalize;let remote;
  try{account=(await request({action:'session'})).account;if(!/^[a-f0-9-]{36}$/.test(account))throw Error('session');
   localStorage.setItem('study-pack.sync.account',account);remote=await request({action:'read',course});
  }catch(e){
   if(e.status===401){account='';try{localStorage.removeItem('study-pack.sync.account');}catch{}panel();return guestKey;}
   try{
    account=account||localStorage.getItem('study-pack.sync.account')||'';
    if(!/^[a-f0-9-]{36}$/.test(account))throw Error('no local account');
    key=`study-pack.account.${account}.${course}.progress`;metaKey=key+'.sync';
    meta=JSON.parse(localStorage.getItem(metaKey)||'null')||{revision:0,dirty:false};
    if(!Number.isSafeInteger(meta.revision)||typeof meta.dirty!=='boolean')throw Error('meta');
    storeMeta();enabled=true;panel();status('暫時離線，使用此帳號的本機進度；連線後會重試同步。');if(meta.dirty)changed();return key;
   }catch{account='';panel();status('雲端連線失敗，訪客進度保存在此瀏覽器。');return guestKey;}
  }
  key=`study-pack.account.${account}.${course}.progress`;metaKey=key+'.sync';
  try{
   let local=localStorage.getItem(key);const stored=localStorage.getItem(metaKey);meta=stored?JSON.parse(stored):null;
   if(remote.data){normalize(remote.data);}
   if(!meta){
    if(local!==null){panel();status('本機同步資訊不完整，為保護進度已暫停同步。請先匯出備份。');return key;}
    if(remote.data){localStorage.setItem(key,JSON.stringify(remote.data));meta={revision:remote.revision,dirty:false};}
    else {const guest=localStorage.getItem(guestKey);meta={revision:0,dirty:false};if(guest&&confirm('要將此瀏覽器原有的本學科進度複製到這個帳號嗎？原資料會保留。')){normalize(JSON.parse(guest));localStorage.setItem(key,guest);meta.dirty=true;}}
   }else if(!Number.isSafeInteger(meta.revision)||typeof meta.dirty!=='boolean'){throw Error('meta');}
   else if(meta.dirty && meta.revision!==remote.revision){panel();conflict();return key;}
   else if(!meta.dirty && meta.revision!==remote.revision){
    if(remote.data)localStorage.setItem(key,JSON.stringify(remote.data));
    meta={revision:remote.revision,dirty:false};
   }
   storeMeta();enabled=true;panel();if(meta.dirty)changed();return key;
  }catch(e){panel();status('進度無法安全讀取，同步已暫停；原有資料未刪除。');return key;}
 }
 function markDirty(){if(!enabled)return;try{meta.dirty=true;storeMeta();}catch{enabled=false;status('無法保存同步狀態，已暫停同步。');}}
 function changed(){if(!enabled)return;clearTimeout(timer);timer=setTimeout(()=>{void flush();},1000);status('進度待同步…');}
 async function flush(){
  clearTimeout(timer);if(!enabled||!meta?.dirty)return;
  if(busy)return busy;
  busy=(async()=>{while(enabled&&meta.dirty){
   const snapshot=localStorage.getItem(key);if(snapshot===null){enabled=false;status('本機進度無法讀取，已暫停同步。');break;}
   try{const result=await request({action:'write',course,revision:meta.revision,progress:JSON.parse(snapshot)});meta.revision=result.revision;meta.dirty=localStorage.getItem(key)!==snapshot;storeMeta();status(meta.dirty?'進度待同步…':'進度已同步。');}
   catch(e){if(e.status===409){conflict();}else {status('同步失敗，進度保存在本機；恢復連線後會重試。');timer=setTimeout(()=>{void flush();},30000);}break;}
  }})();try{await busy;}finally{busy=null;}
 }
 window.addEventListener('online',()=>{void flush();});
 window.StudySync={bootstrap,markDirty,changed,flush};
 document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('catalog-login')) {
  const login=document.getElementById('catalog-login');login.hidden=false;
  document.querySelector('a[href="#catalog-login"]')?.addEventListener('click',()=>{login.open=true;});
  request({action:'session'}).then(result=>{
   if(!/^[a-f0-9-]{36}$/.test(result.account))throw Error('session');
   account=result.account;localStorage.setItem('study-pack.sync.account',account);panel();
  }).catch(error=>{if(error.status===401)localStorage.removeItem('study-pack.sync.account');panel();});
 }});
})();
