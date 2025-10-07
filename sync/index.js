import { put, getAll } from '../db/index.js';
import { APP, setStatePill, render } from '../state/appState.js';

let syncInFlight = false;
const MAX_BATCH = 40;

export async function syncNow(){
  if(syncInFlight) return;
  if(!APP.state.syncUrl){ alert('Укажите SYNC_URL в меню.'); return; }
  setStatePill('warn','SYNC');
  const statusMeta=document.querySelector('#statusMeta');
  if(statusMeta) statusMeta.textContent='Синхронизация...';
  const all=await getAll(APP.db,'events');
  let unsent=all.filter(r=>!r.synced);
  if(unsent.length===0){ setStatePill('ok','IDLE'); if(statusMeta) statusMeta.textContent='Данные уже синхронизированы'; return; }
  if(unsent.length>MAX_BATCH) unsent=unsent.slice(0,MAX_BATCH);
  try{
    syncInFlight=true;
    const url=APP.state.syncUrl;
    const events=unsent.map(r=>({uuid:r.uuid,ts:r.timestamp,type:r.type,operator:r.operator,client:r.client,city:r.city,box:r.box,code:r.code}));
    const payload=JSON.stringify({events});
    const usePlain=APP.state.sendPlain!==false; // Читаем из настроек
    const resp=await fetch(url,{method:'POST',headers:usePlain?{'Content-Type':'text/plain;charset=UTF-8'}:{'Content-Type':'application/json'},body:payload});
    const text=await resp.text();
    let data=null; try{ data=JSON.parse(text);}catch(_){ data=null; }
    if(!resp.ok || !data || data.ok!==true){ const msg=!resp.ok?`HTTP ${resp.status}`:(data?(data.error||'ok:false'):'bad json'); throw new Error(msg); }
    for(const r of unsent){ r.synced=true; await put(APP.db,'events',r); }
    APP.state.lastSync=Date.now(); APP.state.lastSyncError=false; setStatePill('ok','IDLE');
    // Импортируем и сбрасываем firstUnsentTs из app.js через глобальный объект window
    if(window.resetFirstUnsentTs) window.resetFirstUnsentTs();
  }catch(e){ console.error(e); APP.state.lastSyncError=true; setStatePill('error','SYNC ERR'); }
  finally{ syncInFlight=false; render(); }
}

