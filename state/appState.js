import { getAll } from '../db/index.js';

export const APP = { version:'v32-cyrillic-check', db:null, focusEnabled:true, state:{ city:null, client:null, box:null, boxStart:null, itemsInBox:0, lastBoxItemsCount:0, online:navigator.onLine, lastSync:null, lastSyncError:false, theme:'light', operator:'', syncUrl:'', sendPlain:true, speech:true } };

export function applyTheme(mode){ const root=document.documentElement; if(mode==='light'){ root.setAttribute('data-theme','light'); } else { root.setAttribute('data-theme','dark'); } }

export function setStatePill(type='ok',text='IDLE'){ const bar=document.querySelector('#statusBar'); if(!bar) return; bar.classList.remove('status--ok','status--warn','status--error'); bar.classList.add(`status--${type}`); const pill=document.querySelector('#statePill'); if(pill) pill.textContent=text; }

export async function updateItemsIndicator(){ 
  const el=document.querySelector('#itemsCountVal'); 
  if(!el) return; 
  el.classList.remove('ok','err'); 
  
  // Для закрытых коробов не проверяем синхронизацию
  if(!APP.state.box) return;
  
  const all=await getAll(APP.db,'events'); 
  const itemsForBox=all.filter(r=> r.type==='ITEM' && r.box===APP.state.box); 
  const pending=itemsForBox.filter(r=>!r.synced).length; 
  
  if(APP.state.lastSyncError){ 
    el.classList.add('err'); 
  } else if((APP.state.itemsInBox||0)>0 && pending===0){ 
    el.classList.add('ok'); 
  }
}

export function render(){ 
  const operatorName=document.querySelector('#operatorName'); 
  if(operatorName) operatorName.textContent=APP.state.operator||'Оператор';
  const cityVal=document.querySelector('#cityVal'); 
  if(cityVal) cityVal.textContent=APP.state.city||'—'; 
  const clientVal=document.querySelector('#clientVal'); 
  if(clientVal) clientVal.textContent=APP.state.client||'—'; 
  const boxVal=document.querySelector('#boxVal'); 
  if(boxVal) boxVal.textContent=APP.state.box?(APP.state.box.split('/')[1]||APP.state.box):'—'; 
  const boxStartVal=document.querySelector('#boxStartVal'); 
  if(boxStartVal) boxStartVal.textContent=APP.state.boxStart?new Date(APP.state.boxStart).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'—'; 
  const itemsCountVal=document.querySelector('#itemsCountVal'); 
  if(itemsCountVal) {
    // Показываем количество товаров: если короб открыт - текущее, если закрыт - последнее
    const displayCount = APP.state.box ? APP.state.itemsInBox : (APP.state.lastBoxItemsCount || 0);
    itemsCountVal.textContent=String(displayCount);
  } 
  updateItemsIndicator(); 
  const onlineIndicator=document.querySelector('#onlineIndicator'); 
  if(onlineIndicator){ 
    onlineIndicator.classList.toggle('offline',!APP.state.online); 
    onlineIndicator.title=APP.state.online?'Онлайн':'Оффлайн'; 
  } 
}

