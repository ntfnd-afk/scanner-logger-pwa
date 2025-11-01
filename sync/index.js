import { put, getAll } from '../db/index.js';
import { APP, setStatePill, render } from '../state/appState.js';

let syncInFlight = false;
const MAX_BATCH = 20;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 секунды между попытками

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function syncNow(){
  if(syncInFlight) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }
  if(!APP.state.syncUrl){ alert('Укажите SYNC_URL в меню.'); return; }
  
  setStatePill('warn','SYNC');
  const statusMeta=document.querySelector('#statusMeta');
  if(statusMeta) statusMeta.textContent='Синхронизация...';
  
  const all=await getAll(APP.db,'events');
  let unsent=all.filter(r=>!r.synced);
  
  if(unsent.length===0){ 
    setStatePill('ok','IDLE'); 
    if(statusMeta) statusMeta.textContent='Данные уже синхронизированы'; 
    return; 
  }
  
  console.log(`📤 Starting sync: ${unsent.length} unsent events (batch size: ${MAX_BATCH})`);
  
  if(unsent.length>MAX_BATCH) {
    console.warn(`⚠️ Too many unsent events (${unsent.length}), sending first ${MAX_BATCH}`);
    unsent=unsent.slice(0,MAX_BATCH);
  }
  
  try{
    syncInFlight=true;
    const apiUrl=APP.state.syncUrl || 'https://scanner-api.fulfilment-one.ru';
    const apiKey=APP.state.apiKey || 'ihkLCIfVDynpEcr14NxuO8ZBWKHzMU60';
    
    console.log(`🌐 Syncing to: ${apiUrl}/api/v1/events/batch`);
    
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
    
    let lastError = null;
    let resp = null;
    let data = null;
    
    // Попытки с retry
    for(let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if(attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY}ms...`);
          await sleep(RETRY_DELAY);
          if(statusMeta) statusMeta.textContent=`Повторная попытка ${attempt}/${MAX_RETRIES}...`;
        }
        
        const startTime = Date.now();
        
        resp = await fetch(`${apiUrl}/api/v1/events/batch`, {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'X-API-Key':apiKey
          },
          body:JSON.stringify({events:events}),  // API ожидает {events: [...]}
          signal: AbortSignal.timeout(10000)  // 10 секунд таймаут
        });
        
        const duration = Date.now() - startTime;
        console.log(`⏱️ Request took ${duration}ms (attempt ${attempt})`);
        
        if(!resp.ok){
          const errorText=await resp.text();
          console.error(`❌ HTTP ${resp.status}:`, errorText);
          
          // Не ретраим 4xx ошибки (кроме 429 - rate limit)
          if(resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
            throw new Error(`HTTP ${resp.status}: ${errorText.substring(0, 200)}`);
          }
          
          lastError = new Error(`HTTP ${resp.status}: ${errorText.substring(0, 200)}`);
          continue; // Пробуем еще раз
        }
        
        data = await resp.json();
        console.log('📊 Response:', data);
        
        // Успешно получили ответ, выходим из цикла
        break;
        
      } catch(e) {
        lastError = e;
        console.warn(`⚠️ Attempt ${attempt} failed:`, e.message);
        
        // Если это последняя попытка или критическая ошибка - выбрасываем
        if(attempt === MAX_RETRIES || e.message.includes('401') || e.message.includes('403')) {
          throw e;
        }
      }
    }
    
    // Если после всех попыток нет данных - выбрасываем последнюю ошибку
    if(!data) {
      throw lastError || new Error('Failed to sync after all retries');
    }
    
    if(!data.ok){ 
      console.error('❌ Sync failed:', data.errors);
      throw new Error(data.errors?.join(', ')||'Sync failed'); 
    }
    
    // Проверяем наличие ошибок валидации
    if(data.errors && data.errors.length > 0){
      console.warn('⚠️ Sync warnings:', data.errors);
    }
    
    // Отмечаем события как синхронизированные (только успешно вставленные)
    // Если есть дубликаты - они тоже помечаются как synced (это нормально)
    for(const r of unsent){ r.synced=true; await put(APP.db,'events',r); }
    APP.state.lastSync=Date.now(); 
    APP.state.lastSyncError=false; 
    setStatePill('ok','IDLE');
    
    // Логируем статистику
    console.log(`✅ Sync complete: ${data.inserted} inserted, ${data.skipped} skipped (duplicates)`);
    
    // Сбрасываем firstUnsentTs
    if(window.resetFirstUnsentTs) window.resetFirstUnsentTs();
    
    if(statusMeta) statusMeta.textContent=`✓ Синхронизировано: ${data.inserted} новых`;
    
  }catch(e){ 
    console.error('❌ Sync error:', e);
    console.error('Error details:', {
      name: e.name,
      message: e.message,
      stack: e.stack
    });
    
    APP.state.lastSyncError=true; 
    setStatePill('error','SYNC ERR');
    
    // Показываем пользователю понятное сообщение
    if(statusMeta) {
      if(e.name === 'TimeoutError' || e.message.includes('timeout')) {
        statusMeta.textContent='⚠️ Таймаут соединения';
      } else if(e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        statusMeta.textContent='⚠️ Нет соединения с сервером';
      } else if(e.message.includes('401')) {
        statusMeta.textContent='⚠️ Ошибка авторизации (API Key)';
      } else if(e.message.includes('500')) {
        statusMeta.textContent='⚠️ Ошибка сервера';
      } else {
        statusMeta.textContent=`⚠️ Ошибка: ${e.message.substring(0, 50)}`;
      }
    }
  }
  finally{ 
    syncInFlight=false; 
    render(); 
  }
}

