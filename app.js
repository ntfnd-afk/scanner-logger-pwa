import { openDB, put, add, getAll, getAllByIndex } from './db/index.js';
import { requestWakeLock, initWakeLock } from './features/wakelock.js';
import { initOrientation } from './features/orientation.js';
import { syncNow } from './sync/index.js';
import { APP, applyTheme, setStatePill, updateItemsIndicator, render } from './state/appState.js';
import { initTabs, renderActionsTab, renderDashboardTab, toggleAcc } from './ui/tabs.js';
const $=(s)=>document.querySelector(s);
const MESSAGES={NO_CITY:'Сначала откройте город',NO_BOX:'Сначала откройте короб',BOX_NOT_CLOSED:'Сначала закройте текущий короб',CITY_NOT_CLOSED:'Сначала закройте текущий город',CITY_CLOSED:'Город закрыт',BOX_CLOSED:'Короб закрыт',SYNC_ERROR:'Ошибка синхронизации',BOX_TIMEOUT:'Короб автоматически закрыт',CYRILLIC_ERROR:'Ошибка: кириллица в QR-коде'};
function say(code){ if(MESSAGES[code]) speak(MESSAGES[code]); }
let debounceTimer=null; const DEBOUNCE_MS=1000; const MAX_BATCH=20; let sendingNow=false; let firstUnsentTs=null;
function setSending(on){ 
  sendingNow=on; 
  const el=$('#itemsCountVal'); 
  if(!el) return; 
  if(on){ 
    if(!el.querySelector('.spin')){ 
      const s=document.createElement('i'); 
      s.className='spin'; 
      el.appendChild(s);
    } 
  } else { 
    const s=el.querySelector('.spin'); 
    if(s) s.remove(); 
  } 
}
window.resetFirstUnsentTs = () => { firstUnsentTs = null; setSending(false); };
function scheduleDebouncedSync(){ 
  if(debounceTimer) clearTimeout(debounceTimer); 
  setSending(true); 
  debounceTimer=setTimeout(()=>{ if(APP.state.online) syncNow(); }, DEBOUNCE_MS); 
}

async function initDB(){ APP.db=await openDB('scannerlogger',5,(db,oldV)=>{ if(oldV<1){ const st=db.createObjectStore('settings',{keyPath:'key'}); const ev=db.createObjectStore('events',{keyPath:'uuid'}); ev.createIndex('byDay','day'); } if(oldV<2){ db.createObjectStore('box',{keyPath:'id'}); } }); }
function speak(t){ try{ if(!APP.state.speech) return; const u=new SpeechSynthesisUtterance(t); u.lang='ru-RU'; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch(e){} }
function hasCyrillic(text){ return /[а-яё]/i.test(text); }
function uuid(){ return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)); }
function ymd(ts){ const d=new Date(ts); const y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), day=('0'+d.getDate()).slice(-2); return `${y}-${m}-${day}`; }
function formatTime(ts){ try{ return new Date(ts).toLocaleTimeString(); }catch(e){ return '' } }
function withToken(url){ return url; }

async function loadSettings(){ 
  const rows=await getAll(APP.db,'settings'); 
  rows.forEach(r=> APP.state[r.key]=r.value); 
  $('#operatorInput').value=APP.state.operator||''; 
  $('#syncUrlInput').value=APP.state.syncUrl||''; 
  $('#sendPlainInput').checked=APP.state.sendPlain!==false; 
  applyTheme(APP.state.theme||'dark'); 
  $('#themeToggle').checked=(APP.state.theme==='light'); 
  
  // Восстановление состояния работы (город, короб)
  // Преобразуем пустые строки в null
  if(APP.state.city===''){ APP.state.city=null; }
  if(APP.state.box===''){ APP.state.box=null; }
  if(APP.state.client===''){ APP.state.client=null; }
  
  // Преобразуем числа
  if(typeof APP.state.itemsInBox==='string'){ APP.state.itemsInBox=parseInt(APP.state.itemsInBox)||0; }
  if(typeof APP.state.boxStart==='string'){ APP.state.boxStart=parseInt(APP.state.boxStart)||null; }
  
  // Отладочный лог
  console.log('🔄 Восстановление состояния:', {
    city: APP.state.city,
    box: APP.state.box,
    client: APP.state.client,
    itemsInBox: APP.state.itemsInBox,
    boxStart: APP.state.boxStart
  });
  
  // Устанавливаем статус
  if(APP.state.city){ setStatePill('ok','CITY'); }
  if(APP.state.box){ setStatePill('ok','BOX'); }
}
async function saveSetting(k,v){ APP.state[k]=v; await put(APP.db,'settings',{key:k,value:v}); }
async function saveAllSettings(){ await Promise.all([ saveSetting('syncUrl',$('#syncUrlInput').value.trim()), saveSetting('operator',$('#operatorInput').value.trim()), saveSetting('sendPlain',$('#sendPlainInput').checked) ]); const s=$('#saveStatus'); s.textContent='✓ Сохранено'; setTimeout(()=> s.textContent='', 1800); }

// Автосохранение состояния работы
async function saveWorkState(){ 
  await Promise.all([
    saveSetting('city', APP.state.city||''),
    saveSetting('box', APP.state.box||''),
    saveSetting('client', APP.state.client||''),
    saveSetting('itemsInBox', APP.state.itemsInBox||0),
    saveSetting('boxStart', APP.state.boxStart||null)
  ]);
}

async function logEvent(ev){ const ts=Date.now(); const row={uuid:uuid(),timestamp:ts,day:ymd(ts),operator:APP.state.operator||'',client:APP.state.client||'',city:APP.state.city||'',box:APP.state.box||'',code:ev.code||'',type:ev.type||'',source:'pwa',details:ev.details||''}; await add(APP.db,'events',row); if(!firstUnsentTs) firstUnsentTs=row.timestamp; const activeTab=document.querySelector('.nav-tab.active')?.dataset.tab; if(activeTab==='actions'){ const box=$('#tabContent'); box.className='list list--actions card'; await renderActionsTab(box); } else if(activeTab==='dashboard'){ render(); } return row; }

let focusTimer=null; function enableFocusLoop(on){ APP.focusEnabled=on; const input=$('#scan-input'); if(!on){ input.blur(); if(focusTimer){ clearInterval(focusTimer); focusTimer=null; } return; } const focusInput=()=>input.focus({preventScroll:true}); if(focusTimer) clearInterval(focusTimer); focusTimer=setInterval(()=>{ if(APP.focusEnabled && document.activeElement!==input) focusInput(); },800); focusInput(); }
window.enableFocusLoop = enableFocusLoop;
function initScanner(){ const input=$('#scan-input'); addEventListener('keydown',()=>{ if(APP.focusEnabled && document.activeElement!==input) input.focus({preventScroll:true}); }); input.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ const code=input.value.trim(); input.value=''; onScan(code); e.preventDefault(); } }); enableFocusLoop(true); }

async function onScan(code){
  if(!code) return;
  
  // Проверка на кириллицу в QR-коде
  if(hasCyrillic(code)){
    setStatePill('error','CYRILLIC');
    say('CYRILLIC_ERROR');
    await logEvent({type:'ERROR',code:'CYRILLIC_ERROR',details:code});
    render();
    return;
  }
  
  let t='ITEM';
  if(/^CITY:/i.test(code)) t='CITY'; else if(/^BOX:/i.test(code)) t='BOX';

  if(t==='CITY'){
    if(/^CITY:CLOSE$/i.test(code)){
      if(APP.state.box){ setStatePill('warn','BOX OPEN'); say('BOX_NOT_CLOSED'); await logEvent({type:'ERROR',code:'BOX_NOT_CLOSED'}); render(); return; }
      if(!APP.state.city){ setStatePill('warn','NO CITY'); say('NO_CITY'); await logEvent({type:'ERROR',code:'NO_CITY'}); render(); return; }
      // Немедленный сброс и отмена дебаунса перед закрытием города
      if(debounceTimer) { clearTimeout(debounceTimer); debounceTimer=null; setSending(false); }
      await logEvent({type:'CITY_CLOSE',code:APP.state.city});
      if(APP.state.online) { try{ await syncNow(); }catch(_){} }
      APP.state.city=null; say('CITY_CLOSED'); setStatePill('ok','IDLE'); await saveWorkState(); render(); return;
    }
    if(APP.state.city && APP.state.city!==code.substring(5)){ setStatePill('warn','NEED CLOSE'); say('CITY_NOT_CLOSED'); await logEvent({type:'ERROR',code:'CITY_NOT_CLOSED'}); return; }
    APP.state.city=code.substring(5); setStatePill('ok','CITY'); await logEvent({type:'CITY',code:APP.state.city}); await saveWorkState(); render();
  } else if(t==='BOX'){
    if(!APP.state.city){ setStatePill('warn','NO CITY'); say('NO_CITY'); await logEvent({type:'ERROR',code:'NO_CITY'}); render(); return; }
    const val=code.substring(4);
    if(APP.state.box && APP.state.box===val){
      // Закрытие текущего короба — синхронизируем немедленно и отменяем дебаунс
      if(debounceTimer) { clearTimeout(debounceTimer); debounceTimer=null; setSending(false); }
      await logEvent({type:'CLOSE',code:APP.state.box});
      if(APP.state.online) { try{ await syncNow(); }catch(_){} }
      // Сохраняем количество товаров для отображения до открытия нового короба
      APP.state.lastBoxItemsCount = APP.state.itemsInBox;
      APP.state.box=null; APP.state.client=null; APP.state.itemsInBox=0; APP.state.boxStart=null; setStatePill('ok','IDLE'); await saveWorkState(); render();
    } else {
      if(APP.state.box){
        // Самовосстановление: если уже есть CLOSE для этого бокса за последнюю минуту — сбрасываем состояние и продолжаем
        try{
          const rows=await getAll(APP.db,'events');
          const recentClose=rows.slice(-50).reverse().find(r=> r.type==='CLOSE' && r.box===APP.state.box);
          if(recentClose){ APP.state.box=null; APP.state.client=null; APP.state.itemsInBox=0; APP.state.boxStart=null; setStatePill('ok','IDLE'); render(); }
          else { setStatePill('warn','NEED CLOSE'); say('BOX_NOT_CLOSED'); await logEvent({type:'ERROR',code:'BOX_NOT_CLOSED'}); return; }
        }catch(_){ setStatePill('warn','NEED CLOSE'); say('BOX_NOT_CLOSED'); await logEvent({type:'ERROR',code:'BOX_NOT_CLOSED'}); return; }
      }
      const [client]=val.split('/'); APP.state.client=client||''; APP.state.box=val; APP.state.boxStart=Date.now(); APP.state.itemsInBox=0; APP.state.lastBoxItemsCount=0; await logEvent({type:'BOX',code:val}); setStatePill('ok','BOX'); await saveWorkState(); render();
    }
  } else {
    if(!APP.state.box){ setStatePill('warn','NO BOX'); say('NO_BOX'); await logEvent({type:'ERROR',code:'NO_BOX'}); render(); return; }
    APP.state.itemsInBox+=1; await logEvent({type:'ITEM',code}); await saveWorkState(); render(); updateItemsIndicator(); scheduleDebouncedSync();
  }
}

function setSyncDebug(msg){ /* debug removed in v22d */ }
// syncNow moved to ./sync/index.js
async function testSync(){ if(!APP.state.syncUrl){ alert('Укажите SYNC_URL'); return; } try{ const url=withToken(APP.state.syncUrl); const pingUrl=url+(url.includes('?')?'&':'?')+'ping=1'; const resp=await fetch(pingUrl,{method:'GET'}); const text=await resp.text(); }catch(e){} }
async function exportCSV(){ const today=ymd(Date.now()); const rows=(await getAll(APP.db,'events')).filter(r=> r.day===today); const header=['uuid','timestamp','operator','client','city','box','code','type','source']; const csv=[header.join(',')].concat(rows.map(r=> header.map(k=>JSON.stringify(r[k]??'')).join(','))).join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download=`scanner_log_${today}.csv`; a.click(); URL.revokeObjectURL(url); }
function initTheme(){ const t=$('#themeToggle'); t.checked=(APP.state.theme==='light'); t.addEventListener('change', async ()=>{ const m=t.checked?'light':'dark'; applyTheme(m); await saveSetting('theme', m); }); }
function needInit(){ return !APP.state.syncUrl || !APP.state.operator; }
function openInitDialog(){ const d=$('#init-dlg'); $('#init-sync').value=APP.state.syncUrl||''; $('#init-operator').value=APP.state.operator||''; d.showModal(); }
function bindInitDialog(){ $('#init-save').addEventListener('click', async ()=>{ const u=$('#init-sync').value.trim(); const o=$('#init-operator').value.trim(); if(!u||!o){ alert('Заполните оба поля'); return; } await saveSetting('syncUrl',u); await saveSetting('operator',o); $('#init-dlg').close(); document.querySelector('.tab.active').click(); }); $('#init-cancel').addEventListener('click', ()=> $('#init-dlg').close()); }
function initNetwork(){ 
  const upd=()=>{ 
    const wasOnline = APP.state.online;
    APP.state.online=navigator.onLine; 
    
    if(APP.state.online && !wasOnline) {
      console.log('🌐 Network restored, attempting sync...');
      setStatePill('ok', 'ONLINE');
      // Пытаемся синхронизировать при восстановлении соединения
      setTimeout(() => {
        if(APP.state.online) syncNow();
      }, 1000);
    } else if(!APP.state.online && wasOnline) {
      console.log('📡 Network lost');
      setStatePill('warn', 'OFFLINE');
    }
    
    render(); 
  }; 
  
  addEventListener('online',upd); 
  addEventListener('offline',upd); 
  upd(); 
  
  // Периодическая проверка соединения (каждые 30 секунд)
  setInterval(() => {
    if(navigator.onLine !== APP.state.online) {
      console.log('🔍 Network state changed detected');
      upd();
    }
  }, 30000);
}
async function getTodayEvents(){ const today=ymd(Date.now()); if(typeof getAllByIndex==='function'){ try{ return await getAllByIndex(APP.db,'events','byDay',today); }catch(_){ /* fallback to full scan below */ } } const rows=await getAll(APP.db,'events'); return rows.filter(r=> r.day===today); }
// moved to ui/tabs.js
// tabs moved to ./ui/tabs.js

// moved to ui/tabs.js: humanLine, renderActionsTab

function initSettings(){ $('#operatorInput').addEventListener('change',e=> saveSetting('operator',e.target.value.trim())); $('#syncUrlInput').addEventListener('change',e=> saveSetting('syncUrl',e.target.value.trim())); $('#sendPlainInput').addEventListener('change',e=> saveSetting('sendPlain',e.target.checked)); $('#btnSave').addEventListener('click',saveAllSettings); $('#btnSync').addEventListener('click',syncNow); const sn=$('#btnSyncNow'); if(sn) sn.addEventListener('click',()=>{ if(APP.state.online) syncNow(); }); $('#btnTest').addEventListener('click',testSync); $('#btnResendToday').addEventListener('click', async ()=>{ const today=ymd(Date.now()); const rows=await getAll(APP.db,'events'); let changed=0; for(const r of rows){ if(r.day===today){ if(r.synced){ r.synced=false; await put(APP.db,'events',r); changed++; } } } if(APP.state.online) syncNow(); }); $('#btnUpdateApp').addEventListener('click', async ()=>{ if('serviceWorker' in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.update())); } location.reload(); }); }
function initDrawerFocusControl(){ const d=$('#drawer'); d.addEventListener('change',()=>{ enableFocusLoop(!d.checked); }); const navMenuBtn=$('#navMenuBtn'); if(navMenuBtn) navMenuBtn.addEventListener('click',()=>{ d.checked=!d.checked; enableFocusLoop(!d.checked); }); }
function initSW(){ if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(console.error); } }

(async function boot(){ 
  await initDB(); 
  await loadSettings(); 
  bindInitDialog(); 
  initTheme(); 
  initNetwork(); 
  initSettings(); 
  initTabs(); 
  const firstTab=document.querySelector('.nav-tab.active'); 
  if(firstTab) firstTab.click(); 
  render(); // Восстановление UI после загрузки состояния
  initScanner(); 
  initDrawerFocusControl(); 
  initSW(); 
  initWakeLock(); 
  requestWakeLock(); 
  initOrientation(); 
  if(!APP.state.syncUrl || !APP.state.operator) openInitDialog(); 
  
  // Периодическая синхронизация каждые 10 секунд
  setInterval(()=>{ if(APP.state.online) syncNow(); },10000); 
  
  // Автоматическое закрытие коробов через 60 минут бездействия
  setInterval(()=>{ 
    if(APP.state.box && APP.state.boxStart){
      const inactiveTime = Date.now() - APP.state.boxStart;
      if(inactiveTime > 60*60*1000){ // 60 минут
        logEvent({type:'AUTO_CLOSE',code:APP.state.box});
        APP.state.lastBoxItemsCount = APP.state.itemsInBox;
        APP.state.box=null; 
        APP.state.client=null; 
        APP.state.itemsInBox=0; 
        APP.state.boxStart=null; 
        setStatePill('warn','AUTO_CLOSE'); 
        say('BOX_TIMEOUT');
        render();
      }
    }
  }, 60000); // Проверка каждую минуту
})();
(function(){ const box=document.querySelector('#tabContent'); let t=null; const pause=()=>{ if(typeof enableFocusLoop==='function'){ enableFocusLoop(false); if(t) clearTimeout(t); t=setTimeout(()=> enableFocusLoop(true), 2000);} }; ['pointerdown','focusin'].forEach(ev=> box.addEventListener(ev,pause)); })();
