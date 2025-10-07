import { getAll, getAllByIndex } from '../db/index.js';
import { APP } from '../state/appState.js';

const $ = (s)=>document.querySelector(s);

function ymd(ts){ const d=new Date(ts); const y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), day=('0'+d.getDate()).slice(-2); return `${y}-${m}-${day}`; }
function formatTime(ts){ try{ return new Date(ts).toLocaleTimeString(); }catch(e){ return '' } }

async function getTodayEvents(){ const today=ymd(Date.now()); try{ if(typeof getAllByIndex==='function') return await getAllByIndex(APP.db,'events','byDay',today); }catch(_){} const rows=await getAll(APP.db,'events'); return rows.filter(r=> r.day===today); }

export function toggleAcc(el){ el.classList.toggle('open'); }

function humanLine(r){ const mapType={ITEM:'Отсканирован',BOX:'Открыт короб',CLOSE:'Закрыт короб',CITY:'Открыт город',CITY_CLOSE:'Закрыт город',ERROR:'ОШИБКА'}; const t=(mapType[r.type]||r.type); let desc=''; if(r.type==='ITEM') desc=`ШК ${r.code}`; else if(r.type==='BOX') desc=`${r.code}`; else if(r.type==='CITY'||r.type==='CITY_CLOSE') desc=`${r.city||r.code||''}`; else if(r.type==='ERROR'){ const mapErr={NO_BOX:'Не открыт короб',NO_CITY:'Не открыт город',BOX_NOT_CLOSED:'Сначала закройте короб',CITY_NOT_CLOSED:'Сначала закройте город'}; desc=mapErr[r.code]||(r.code||''); } else desc=r.code||''; return {t,desc}; }

export async function renderActionsTab(boxEl){
  boxEl.className='list list--actions';
  const rows = (await getTodayEvents()).sort((a,b)=> b.timestamp - a.timestamp).slice(0,200);
  boxEl.innerHTML='';
  if(rows.length===0){ boxEl.innerHTML='<div class="chip">Пока пусто</div>'; window.enableFocusLoop?.(true); return; }
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
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      document.querySelectorAll('.tab').forEach(b=> b.classList.remove('active'));
      btn.classList.add('active');
      const tab=btn.dataset.tab;
      const box=$('#tabContent');
      box.innerHTML='';
      box.className='list';
      if(tab==='actions'){
        await renderActionsTab(box);
      } else if(tab==='today'){
        box.classList.remove('list--actions');
        window.enableFocusLoop?.(true);
        const rows=await getTodayEvents();
        const items=rows.filter(r=> r.type==='ITEM').length;
        const opened=rows.filter(r=> r.type==='BOX').length;
        const closed=rows.filter(r=> r.type==='CLOSE').length;
        const errors=rows.filter(r=> String(r.type).toUpperCase()==='ERROR').length;
        const kpi=document.createElement('div'); kpi.className='kpi';
        [['ITEM',items],['Открыто',opened],['Закрыто',closed],['Ошибок',errors]].forEach(([name,val])=>{
          const el=document.createElement('div'); el.className='chip'; el.innerHTML=`<strong>${val}</strong> <small>${name}</small>`; kpi.appendChild(el);
        });
        box.appendChild(kpi);
        const hdr=document.createElement('div'); hdr.className='hint'; hdr.style.marginTop='.6rem'; hdr.textContent='Последние события:'; box.appendChild(hdr);
        if(rows.length===0){ box.appendChild(Object.assign(document.createElement('div'),{className:'chip',textContent:'Пока пусто'})); }
        else {
          rows.slice(-15).reverse().forEach(r=>{ const el=document.createElement('div'); el.className='chip'; el.innerHTML=`<span>${formatTime(r.timestamp)} · ${r.type}</span><small>${r.code||''}</small>`; box.appendChild(el); });
        }
      } else if(tab==='clients'){
        box.classList.remove('list--actions');
        window.enableFocusLoop?.(true);
        const rows=await getTodayEvents();
        const byClient=new Map();
        rows.forEach(r=>{ if(!r.client) return; const c=byClient.get(r.client)||{items:0,boxes:new Set()}; if(r.type==='ITEM') c.items++; if(r.box) c.boxes.add(r.box); byClient.set(r.client,c); });
        const clients=[...byClient.entries()].sort((a,b)=> (b[1].boxes.size - a[1].boxes.size) || a[0].localeCompare(b[0]));
        if(clients.length===0){ box.innerHTML='<div class="chip">Пока нет клиентов за сегодня</div>'; }
        else {
          const grid=document.createElement('div'); grid.className='grid-sm';
          clients.forEach(([name,meta])=>{ const card=document.createElement('div'); card.className='chip card-btn'; card.innerHTML=`<strong>${name}</strong><small>коробов: ${meta.boxes.size}</small>`; card.addEventListener('click',()=> openClient(name)); grid.appendChild(card); });
          box.appendChild(grid);
        }
        async function openClient(client){
          box.innerHTML='';
          const rows2=rows.filter(r=> r.client===client && (!APP.state.operator || r.operator===APP.state.operator));
          const boxesMap=new Map();
          rows2.forEach(r=>{ if(r.box){ const rec=(boxesMap.get(r.box)||{items:0,events:[]}); if(r.type==='ITEM') rec.items++; rec.events.push(r); boxesMap.set(r.box,rec);} });
          const boxesArr=[...boxesMap.entries()].sort((a,b)=>{ const ta=Math.max(...a[1].events.map(e=>e.timestamp)); const tb=Math.max(...b[1].events.map(e=>e.timestamp)); return tb-ta; });
          const back=document.createElement('div'); back.className='row';
          const btnBack=document.createElement('button'); btnBack.className='btn'; btnBack.textContent='← Все клиенты';
          btnBack.addEventListener('click',()=>{ box.innerHTML=''; const ev=new Event('click'); document.querySelector('.tab[data-tab="clients"]').dispatchEvent(ev); });
          back.appendChild(btnBack); box.appendChild(back);
          const title=document.createElement('div'); title.className='hint'; title.textContent=`Клиент: ${client}`; box.appendChild(title);
          if(boxesArr.length===0){ box.appendChild(Object.assign(document.createElement('div'),{className:'chip',textContent:'Нет коробов'})); return; }
          const list=document.createElement('div'); list.className='accordion';
          boxesArr.forEach(([boxId,rec])=>{ const it=document.createElement('div'); it.className='acc-item'; const hd=document.createElement('div'); hd.className='acc-hd'; const short=boxId.includes('/')?boxId.split('/')[1]:boxId; hd.innerHTML=`<span class="acc-title">${boxId.includes('/')?boxId.split('/')[0]:boxId} — короб № ${short}</span><span class="badge">${rec.items}</span>`; hd.addEventListener('click',()=>toggleAcc(it)); const bd=document.createElement('div'); bd.className='acc-bd'; const items=rec.events.filter(e=> e.type==='ITEM').sort((a,b)=> b.timestamp-a.timestamp); if(items.length===0) bd.innerHTML='<div class="hint">Нет товаров</div>'; else items.forEach(e=>{ const row=document.createElement('div'); row.className='chip'; row.innerHTML=`<span>${new Date(e.timestamp).toLocaleTimeString()}</span><small>${e.code}</small>`; bd.appendChild(row); }); it.appendChild(hd); it.appendChild(bd); list.appendChild(it); }); box.appendChild(list);
        }
      } else if(tab==='boxes'){
        box.classList.add('list--one');
        const rows=await getTodayEvents();
        const boxes=new Map();
        rows.forEach(r=>{ if(r.box){ const rec=(boxes.get(r.box)||{items:0,events:[]}); if(r.type==='ITEM') rec.items++; rec.events.push(r); boxes.set(r.box,rec); } });
        const arr=[...boxes.entries()].sort((a,b)=>{ const ta=Math.max(...a[1].events.map(e=>e.timestamp)); const tb=Math.max(...b[1].events.map(e=>e.timestamp)); return tb-ta; });
        if(arr.length===0){ box.innerHTML='<div class="chip">Нет коробов</div>'; return; }
        const list=document.createElement('div'); list.className='accordion';
        arr.forEach(([boxId,rec])=>{ const it=document.createElement('div'); it.className='acc-item'; const hd=document.createElement('div'); hd.className='acc-hd'; const short=boxId.includes('/')?boxId.split('/')[1]:boxId; hd.innerHTML=`<span class="badge">${rec.items}</span><span class="acc-title">${boxId.includes('/')?boxId.split('/')[0]:boxId} — короб № ${boxId.includes('/')?boxId.split('/')[1]:boxId}</span>`; hd.addEventListener('click',()=>toggleAcc(it)); const bd=document.createElement('div'); bd.className='acc-bd'; const items=rec.events.filter(e=> e.type==='ITEM').sort((a,b)=> b.timestamp-a.timestamp); if(items.length===0) bd.innerHTML='<div class="hint">Нет товаров</div>'; else items.forEach(e=>{ const row=document.createElement('div'); row.className='chip'; row.innerHTML=`<span>${new Date(e.timestamp).toLocaleTimeString()}</span><small>${e.code}</small>`; bd.appendChild(row); }); it.appendChild(hd); it.appendChild(bd); list.appendChild(it); });
        box.appendChild(list);
      }
    });
  });
}


