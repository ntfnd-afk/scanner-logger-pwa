export function openDB(name, version, migrations){
  return new Promise((resolve, reject)=>{ const req=indexedDB.open(name,version); req.onupgradeneeded=(ev)=>{ const db=req.result; migrations&&migrations(db,ev.oldVersion,ev.newVersion); }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
}
export function tx(db, store, mode='readonly'){ const t=db.transaction(store,mode); return [t,t.objectStore(store)]; }
export function put(db, store, value){ return new Promise((res,rej)=>{ const [t,s]=tx(db,store,'readwrite'); const r=s.put(value); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
export function add(db, store, value){ return new Promise((res,rej)=>{ const [t,s]=tx(db,store,'readwrite'); const r=s.add(value); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
export function getAll(db, store){ return new Promise((res,rej)=>{ const [t,s]=tx(db,store); const r=s.getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
export function getAllByIndex(db, store, index, query){ return new Promise((res,rej)=>{ const [t,s]=tx(db,store); const i=s.index(index); const r=i.getAll(query); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
