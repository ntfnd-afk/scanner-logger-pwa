import { getAll, getAllByIndex } from '../db/index.js';
import { APP, updateItemsIndicator } from '../state/appState.js';

const $ = (s)=>document.querySelector(s);

function ymd(ts){ const d=new Date(ts); const y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), day=('0'+d.getDate()).slice(-2); return `${y}-${m}-${day}`; }
function formatTime(ts){ try{ return new Date(ts).toLocaleTimeString(); }catch(e){ return '' } }

async function getTodayEvents(){ const today=ymd(Date.now()); try{ if(typeof getAllByIndex==='function') return await getAllByIndex(APP.db,'events','byDay',today); }catch(_){} const rows=await getAll(APP.db,'events'); return rows.filter(r=> r.day===today); }

export function toggleAcc(el){ el.classList.toggle('open'); }

// Рабочий стол - главный экран с метриками
export function renderDashboardTab(boxEl){
  boxEl.className='tab-dashboard';
  boxEl.innerHTML=`
    <section id="statusBar" class="status status--ok card" role="status" aria-live="polite">
      <div class="status-new">
        <div class="status-header">
          <div id="operatorName" class="operator-name">${APP.state.operator || 'Оператор'}</div>
          <div id="onlineIndicator" class="online-dot ${APP.state.online ? '' : 'offline'}" title="${APP.state.online ? 'Онлайн' : 'Оффлайн'}"></div>
        </div>
        <div class="status-body">
          <div class="metrics-left">
            <div class="metric-row">
              <div class="metric-item">
                <div class="metric-label">Склад</div>
                <div id="cityVal" class="metric-value">${APP.state.city || '—'}</div>
              </div>
              <div class="metric-divider"></div>
              <div class="metric-item">
                <div class="metric-label">Клиент</div>
                <div id="clientVal" class="metric-value">${APP.state.client || '—'}</div>
              </div>
            </div>
            <div class="metric-row">
              <div class="metric-item">
                <div class="metric-label">№ короба</div>
                <div id="boxVal" class="metric-value">${APP.state.box ? (APP.state.box.split('/')[1] || APP.state.box) : '—'}</div>
              </div>
              <div class="metric-divider"></div>
              <div class="metric-item">
                <div class="metric-label">время открытия</div>
                <div id="boxStartVal" class="metric-value">${APP.state.boxStart ? new Date(APP.state.boxStart).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : '—'}</div>
              </div>
            </div>
          </div>
          <div class="count-right">
            <div id="itemsCountVal" class="count-huge">${APP.state.box ? (APP.state.itemsInBox || 0) : (APP.state.lastBoxItemsCount || 0)}</div>
          </div>
        </div>
      </div>
    </section>
  `;
  updateItemsIndicator();
  window.enableFocusLoop?.(true);
}

function humanLine(r){ const mapType={ITEM:'Отсканирован',BOX:'Открыт короб',CLOSE:'Закрыт короб',CITY:'Открыт город',CITY_CLOSE:'Закрыт город',ERROR:'ОШИБКА'}; const t=(mapType[r.type]||r.type); let desc=''; if(r.type==='ITEM') desc=`ШК ${r.code}`; else if(r.type==='BOX') desc=`${r.code}`; else if(r.type==='CITY'||r.type==='CITY_CLOSE') desc=`${r.city||r.code||''}`; else if(r.type==='ERROR'){ const mapErr={NO_BOX:'Не открыт короб',NO_CITY:'Не открыт город',BOX_NOT_CLOSED:'Сначала закройте короб',CITY_NOT_CLOSED:'Сначала закройте город'}; desc=mapErr[r.code]||(r.code||''); } else desc=r.code||''; return {t,desc}; }

export async function renderActionsTab(boxEl){
  const rows = (await getTodayEvents()).sort((a,b)=> b.timestamp - a.timestamp).slice(0,200);
  boxEl.innerHTML='';
  if(rows.length===0){ 
    boxEl.innerHTML='<div class="chip" style="text-align:center;padding:2rem 1rem;"><div style="font-size:3rem;margin-bottom:.5rem;">📋</div><div style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem;">Нет действий</div><div style="color:var(--text-dim);font-size:.95rem;">Действия появятся после начала работы</div></div>'; 
    window.enableFocusLoop?.(true); 
    return; 
  }
  const wrap=document.createElement('div'); wrap.className='lines';
  rows.forEach(r=>{
    const {t,desc}=humanLine(r);
    const el=document.createElement('div'); el.className='line';
    el.innerHTML = `<div class="time">${new Date(r.timestamp).toLocaleTimeString()}</div>
                    <div class="main"><span class="type">${t}</span><span class="code">${desc}</span></div>`;
    wrap.appendChild(el);
  });
  boxEl.appendChild(wrap);
  window.enableFocusLoop?.(true);
}

export function initTabs(){
  document.querySelectorAll('.nav-tab').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      document.querySelectorAll('.nav-tab').forEach(b=> { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected','true');
      const tab=btn.dataset.tab;
      const box=$('#tabContent');
      box.innerHTML='';
      
      if(tab==='dashboard'){
        renderDashboardTab(box);
      } else if(tab==='actions'){
        box.className='list list--actions card';
        await renderActionsTab(box);
      } else if(tab==='boxes'){
        box.className='list list--boxes card';
        const rows=await getTodayEvents();
        const boxes=new Map();
        rows.forEach(r=>{ if(r.box){ const rec=(boxes.get(r.box)||{items:0,events:[]}); if(r.type==='ITEM') rec.items++; rec.events.push(r); boxes.set(r.box,rec); } });
        const arr=[...boxes.entries()].sort((a,b)=>{ const ta=Math.max(...a[1].events.map(e=>e.timestamp)); const tb=Math.max(...b[1].events.map(e=>e.timestamp)); return tb-ta; });
        if(arr.length===0){ box.innerHTML='<div class="chip">Нет коробов</div>'; return; }
        const list=document.createElement('div'); list.className='accordion';
        arr.forEach(([boxId,rec])=>{ const it=document.createElement('div'); it.className='acc-item'; const hd=document.createElement('div'); hd.className='acc-hd'; const short=boxId.includes('/')?boxId.split('/')[1]:boxId; hd.innerHTML=`<span class="badge">${rec.items}</span><span class="acc-title">${boxId.includes('/')?boxId.split('/')[0]:boxId} — короб № ${boxId.includes('/')?boxId.split('/')[1]:boxId}</span>`; hd.addEventListener('click',()=>toggleAcc(it)); const bd=document.createElement('div'); bd.className='acc-bd'; const items=rec.events.filter(e=> e.type==='ITEM').sort((a,b)=> b.timestamp-a.timestamp); if(items.length===0) bd.innerHTML='<div class="hint">Нет товаров</div>'; else items.forEach(e=>{ const row=document.createElement('div'); row.className='chip'; row.innerHTML=`<span>${new Date(e.timestamp).toLocaleTimeString()}</span><small>${e.code}</small>`; bd.appendChild(row); }); it.appendChild(hd); it.appendChild(bd); list.appendChild(it); });
        box.appendChild(list);
        window.enableFocusLoop?.(true);
      }
    });
  });
}


