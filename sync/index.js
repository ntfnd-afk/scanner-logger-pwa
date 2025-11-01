import { put, getAll } from '../db/index.js';
import { APP, setStatePill, render } from '../state/appState.js';

let syncInFlight = false;
const MAX_BATCH = 20;

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
    const apiUrl=APP.state.syncUrl || 'https://scanner-api.fulfilment-one.ru';
    const apiKey=APP.state.apiKey || 'ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60';
    
    // Формат для нового FastAPI бэкенда
    const events=unsent.map(r=>({
      uuid:r.uuid,
      ts:r.timestamp,  // API ожидает 'ts', а не 'timestamp'
      type:r.type,
      operator:r.operator,
      client:r.client||'',
      city:r.city||'',
      box:r.box||'',
      code:r.code||'',
      source:'pwa',
      details:r.details||''
    }));
    
    const resp=await fetch(`${apiUrl}/api/v1/events/batch`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-API-Key':apiKey
      },
      body:JSON.stringify({events:events})  // API ожидает {events: [...]}
    });
    
    if(!resp.ok){
      const errorText=await resp.text();
      throw new Error(`HTTP ${resp.status}: ${errorText}`);
    }
    
    const data=await resp.json();
    if(!data.ok){ throw new Error(data.errors?.join(', ')||'Sync failed'); }
    
    // Отмечаем события как синхронизированные
    for(const r of unsent){ r.synced=true; await put(APP.db,'events',r); }
    APP.state.lastSync=Date.now(); APP.state.lastSyncError=false; setStatePill('ok','IDLE');
    
    // Сбрасываем firstUnsentTs
    if(window.resetFirstUnsentTs) window.resetFirstUnsentTs();
  }catch(e){ 
    console.error('Sync error:', e); 
    APP.state.lastSyncError=true; 
    setStatePill('error','SYNC ERR'); 
  }
  finally{ syncInFlight=false; render(); }
}

