/** ====== НАСТРОЙКИ ====== */
var SPREADSHEET_ID = '1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4';  // ID таблицы
var SHEET_PREFIX   = 'raw_log_';                                         // листы: raw_log_YYYY_MM
var HEADER         = ['uuid','ts','type','operator','client','city','box','code','details','receivedAt','source'];
var TZ             = 'Europe/Moscow';

/** ====== ВСПОМОГАТЕЛЬНЫЕ ====== */
// keep a single _json (removed duplicate later in file)
// removed duplicate _json definition
function _monthKey(ts){
  var d = ts ? new Date(ts) : new Date();
  if (isNaN(d)) d = new Date();
  return Utilities.formatDate(d, TZ, 'yyyy_MM');      // например 2025_09
}
function _getOrCreateSheet(ss, name){
  var sh = ss.getSheetByName(name);
  if (!sh){
    sh = ss.insertSheet(name);
    sh.appendRow(HEADER);                              // шапка 1 раз
  }
  return sh;
}
function _safeParseBody(e){
  // PWA шлёт text/plain JSON → e.postData.contents уже строка JSON.
  // Но на всякий случай поддержим urlencoded "events=..." и application/json.
  if (!e || !e.postData || !e.postData.contents) return {};
  var raw = e.postData.contents;

  // Если тело пришло как form-urlencoded (events=%7B...%7D)
  if (/^\s*events=/.test(raw)){
    try {
      var dec = decodeURIComponent(raw.replace(/^\s*events=/,''));
      return { events: JSON.parse(dec) };
    } catch(_){}
  }

  try { return JSON.parse(raw) || {}; } catch(_){ return {}; }
}
function _ymd(ts){
  return Utilities.formatDate(new Date(ts||Date.now()), TZ, 'yyyy-MM-dd');
}

/** ====== ОСНОВНОЙ POST ====== */
function doPost(e){
  // --- парсим тело запроса
  var data = _safeParseBody(e);
  // --- API-маршрутизация для PWA (verify-ACK и альтернативный вход ingest)
  if (data && data.api === 'has_uuids') {
    // вернём список uuid, которые уже есть в текущем месячном листе
    return _json(_sl_hasUuids(data.uuids || []));  // _json у тебя уже есть
  }

  // Поддержим формат: { api:'ingest', records:[...] }
  if (data && data.api === 'ingest' && Array.isArray(data.records)) {
    data.rows = data.records; // чтобы дальше работала твоя текущая логика
  }
  var incoming = data.events || data.rows || data.records || [];
  if (!incoming || !incoming.length) return _json({ ok:true, count:0 });

  // --- нормализуем записи
  var events = [];
  for (var i=0; i<incoming.length; i++){
    var r  = incoming[i] || {};
    var ts = (r.ts != null) ? Number(r.ts) : Number(r.timestamp);
    if (!ts || isNaN(ts)) ts = Date.now();
    events.push({
      uuid    : String(r.uuid || ''),
      ts      : ts,
      type    : String(r.type || ''),
      operator: String(r.operator || ''),
      client  : String(r.client || ''),
      city    : String(r.city || ''),
      box     : String(r.box || ''),
      code    : String(r.code || '')
    });
  }
  if (!events.length) return _json({ ok:true, count:0 });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try{
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var groups = {};                                      // по месяцам
    for (var j=0; j<events.length; j++){
      var ev = events[j];
      var sheetName = SHEET_PREFIX + _monthKey(ev.ts);
      (groups[sheetName] = groups[sheetName] || []).push(ev);
    }

    var totalWritten = 0;
    var todayStr = _ymd(Date.now());                      // 'yyyy-MM-dd'

    // --- пишем группами по листам
    for (var name in groups){
      var pack = groups[name];
      var sh   = _getOrCreateSheet(ss, name);

      // Дедуп по всему листу + быстрый кэш-барьер
      var existing = {};
      var lastRow  = sh.getLastRow();
      if (lastRow > 1){
        var vals = sh.getRange(2, 1, lastRow - 1, 1).getValues(); // только uuid
        for (var r=0; r<vals.length; r++){ var u = vals[r][0]; if (u) existing[String(u)] = true; }
      }

      // набираем новые строки
      var rows = [];
      var cache = CacheService.getScriptCache();
      for (var k=0; k<pack.length; k++){
        var ev2 = pack[k];
        var uid = String(ev2.uuid||'');
        if (!uid) continue;
        // быстрый барьер: если uuid уже в кэше — пропускаем
        if (cache.get('uuid:'+uid)) continue;
        if (!existing[uid]){
          rows.push([
            uid,
            new Date(ev2.ts),                  // ts как Date → видно дату и время
            ev2.type,
            ev2.operator,
            ev2.client,
            ev2.city,
            ev2.box,
            ev2.code,
            ev2.details || '',                 // details
            new Date(),                        // receivedAt
            'pwa'
          ]);
          existing[uid] = true;
          cache.put('uuid:'+uid, '1', 1800); // 30 минут
        }
      }

      if (rows.length){
        var start = sh.getLastRow() + 1;
        sh.getRange(start, 1, rows.length, HEADER.length).setValues(rows);
        // Форматы времени
        sh.getRange(start, 2, rows.length, 1).setNumberFormat('dd.MM.yyyy HH:mm:ss'); // ts
        sh.getRange(start, 10, rows.length, 1).setNumberFormat('dd.MM.yyyy HH:mm:ss'); // receivedAt
        totalWritten += rows.length;
      }
    }

    return _json({ ok:true, count: totalWritten });

  } catch (err){
    return _json({ ok:false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/***** ====== DASHBOARD SETTINGS ====== *****/
const DASHBOARD_SPREADSHEET_ID = '1MOvQCiWBY4FE8K8NOWU7x2nMm-4H0NMoTqUuBOnVye4'; // <-- ВСТАВЬ ID своей книги
const DASHBOARD_SHEET_PREFIX   = 'raw_log_';                  // raw_log_yyyy_MM
const DASHBOARD_TZ             = 'Europe/Moscow';
const DASHBOARD_ONLINE_MS      = 5 * 60 * 1000;               // 5 минут
const DASHBOARD_CACHE_TTL      = 10;                          // секунд
const DASHBOARD_API_KEY        = '';             // опционально: задай строку-ключ (и добавляй ?key=...)

/***** ====== DASHBOARD ROUTER (doGet) ====== *****/
/* НЕ ломает твой doPost. Если откроешь WebApp с ?page=dashboard — отдадим HTML-дашборд,
   иначе — безопасный ping (или оставь return пустым, если у тебя уже был doGet). */
// Unified doGet router (merged with duplicates below)
function doGet(e){
  const p = (e && e.parameter) ? e.parameter : {};

  // Optional simple key protection for API endpoints
  if (DASHBOARD_API_KEY && p.api && p.key !== DASHBOARD_API_KEY) {
    return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
  }

  // API: state / boxes / clients
  if (p.api === 'state') {
    return _json(getDashboardState({ date:p.date||'', operator:p.operator||'', client:p.client||'' }));
  }
  if (p.api === 'boxes') {
    return _json(getBoxesState({ date:p.date||'', operator:p.operator||'', client:p.client||'' }));
  }
  if (p.api === 'clients') {
    return _json(getClientsState({ date:p.date||'', operator:p.operator||'', client:p.client||'' }));
  }
  
  // API для удаления товаров (только для операторов)
  if (p.api === 'remove_item') {
    return _json(removeItemFromBox({
      operator: p.operator || '',
      box: p.box || '',
      code: p.code || '',
      reason: p.reason || ''
    }));
  }
  
  // API для массового удаления товаров по UUID
  if (p.api === 'bulk_remove_items') {
    return _json(bulkRemoveItems({
      operator: p.operator || '',
      uuids: p.uuids || '',
      reason: p.reason || ''
    }));
  }
  
  // API для получения логов удалений
  if (p.api === 'removal_logs') {
    return _json(getRemovalLogs({
      date: p.date || '',
      operator: p.operator || '',
      client: p.client || ''
    }));
  }

  // export helper lists for cascading filters
  if (p.api === 'export_lists') {
    const lists = getExportLists({ dateFrom:p.dateFrom||p.date||'', dateTo:p.dateTo||p.date||'', client:p.client||'', city:p.city||'' });
    return _json(lists);
  }

  // Export endpoints
  if (p.api === 'export') {
    const type = p.type === 'clients' ? 'clients' : 'boxes';
    const data = exportCsv({ date:p.date||'', operator:p.operator||'', client:p.client||'' }, type);
    const b64  = Utilities.base64Encode(data.content, Utilities.Charset.UTF_8);
    const html = '<a id="dl" href="data:text/csv;charset=utf-8;base64,'+ b64 +'" download="'+ data.filename +'">download</a>'+
                 '<script>document.getElementById("dl").click();</script>';
    return HtmlService.createHtmlOutput(html)
      .setTitle('Экспорт CSV')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (p.api === 'export_gs') {
    const type = p.type === 'clients' ? 'clients' : 'boxes';
    const url = exportToGoogleSheet({ date:p.date||'', operator:p.operator||'', client:p.client||'' }, type);
    return HtmlService.createHtmlOutput('<script>top.location.href='+ JSON.stringify(url) +';</script>')
      .setTitle('Экспорт в Google Sheets')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (p.api === 'export_gs_range') {
    const url = exportRangeToGoogleSheetSimple({ dateFrom:p.dateFrom||'', dateTo:p.dateTo||'', operator:p.operator||'', client:p.client||'' });
    return HtmlService.createHtmlOutput('<script>top.location.href='+ JSON.stringify(url) +';</script>')
      .setTitle('Экспорт диапазона')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Dashboard page
  if (p.page === 'dashboard') {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Scanner Logger — Operator Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (p.api === 'export_lists'){
    return _json(getExportLists({ dateFrom:p.dateFrom||'', dateTo:p.dateTo||'' }));
  }

  if (p.api === 'raw'){
    return _json(getRawLogs({ date:p.date||'', operator:p.operator||'' }));
  }
  if (p.api === 'raw_ops'){
    return _json(getRawOperators({ date:p.date||'' }));
  }
  
  // API для логов удалений
  if (p.api === 'removals') {
    return _json(getRemovalLogs({ 
      date: p.date || '', 
      operator: p.operator || '', 
      client: p.client || '' 
    }));
  }

  // Default ping
  return ContentService.createTextOutput('ok');
}




/***** ====== API для фронта дашборда ====== *****/
function getDashboardState(filters){
  filters = filters || {};
  const cacheKey = 'DB_STATE_V2:' + JSON.stringify({
    d: filters.date || 'today',
    o: filters.operator || '',
    c: filters.client || ''
  });
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const rows  = _dash_readDay_(filters);
  const state = _dash_buildState_(rows, filters);

  cache.put(cacheKey, JSON.stringify(state), DASHBOARD_CACHE_TTL);
  return state;
}



/***** ====== HELPERS (общие) ====== *****/
function _json(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function _dash_monthKey_(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  return `${y}_${m}`;
}
function _dash_openSheetFor_(d){
  const ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
  const name = DASHBOARD_SHEET_PREFIX + _dash_monthKey_(d);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Не найден лист: ${name}`);
  return sh;
}
function _dash_dayRangeMs_(dateStr){ // YYYY-MM-DD (локально МСК)
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const y = d.getFullYear(), m = d.getMonth(), dd = d.getDate();
  const start = new Date(y, m, dd, 0, 0, 0, 0).getTime();
  const end   = new Date(y, m, dd, 23, 59, 59, 999).getTime();
  return {start, end, date: new Date(y, m, dd)};
}
function _dash_parseDDMMYYYY_HHMMSS_(s){
  try{
    const [d,t] = String(s).split(' ');
    const [dd,mm,yy] = d.split('.').map(Number);
    const [HH,MM,SS] = t.split(':').map(Number);
    return new Date(yy, mm-1, dd, HH, MM, SS).getTime();
  }catch(e){ return 0; }
}

/** Читаем строки за день (с учётом того, что ts/receivedAt могут быть Date) + фильтры */
function _dash_readDay_(filters){
  const {start, end, date} = _dash_dayRangeMs_(filters.date || '');
  const sh = _dash_openSheetFor_(date);
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const header = values.shift().map(h=> String(h).trim());
  const idx = Object.fromEntries(header.map((h,i)=>[h, i]));

  const rows = [];
  for (const r of values){
    const tsCell = r[idx.ts];
    let tsMs = 0;
    if (tsCell instanceof Date) tsMs = tsCell.getTime(); else tsMs = _dash_parseDDMMYYYY_HHMMSS_(tsCell);
    if (!tsMs || tsMs < start || tsMs > end) continue;

    const receivedCell = r[idx.receivedAt] ?? r[idx.ts];
    let receivedAtMs = 0;
    if (receivedCell instanceof Date) receivedAtMs = receivedCell.getTime(); else receivedAtMs = _dash_parseDDMMYYYY_HHMMSS_(receivedCell);

    const obj = {
      uuid:       r[idx.uuid],
      ts:         (tsCell instanceof Date) ? Utilities.formatDate(tsCell, DASHBOARD_TZ, 'dd.MM.yyyy HH:mm:ss') : String(tsCell),
      type:       r[idx.type],
      operator:   r[idx.operator],
      client:     r[idx.client],
      city:       r[idx.city],
      box:        r[idx.box],
      code:       r[idx.code],
      details:    r[idx.details] || '',
      receivedAt: (receivedCell instanceof Date) ? Utilities.formatDate(receivedCell, DASHBOARD_TZ, 'dd.MM.yyyy HH:mm:ss') : String(receivedCell),
      source:     r[idx.source] || 'pwa',
      tsMs,
      receivedAtMs
    };

    // фильтры по оператору/клиенту
    if (filters.operator && String(obj.operator) !== String(filters.operator)) continue;
    if (filters.city     && String(obj.city)     !== String(filters.city))     continue;
    if (filters.client   && String(obj.client)   !== String(filters.client))   continue;

    rows.push(obj);
  }
  return rows;
}
// Сырые логи за день (сортировка по receivedAtMs/tsMs, фильтр по оператору)
function getRawLogs(filters){
  filters = filters || {};
  const rows = _dash_readDay_(filters);
  rows.sort((a,b)=> (b.receivedAtMs - a.receivedAtMs) || (b.tsMs - a.tsMs));
  if (filters.operator) {
    return rows.filter(r=> String(r.operator) === String(filters.operator));
  }
  return rows;
}

function getRawOperators(filters){
  const rows = _dash_readDay_(filters || {});
  const ops = Array.from(new Set(rows.map(r=> r.operator).filter(Boolean))).sort();
  return { operators: ops };
}
/***** ====== ЧТЕНИЕ «СЕГОДНЯ» ИЗ RAW ====== *****/
function _dash_readToday_(){
  const sh = _dash_openSheetFor_(new Date());
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const header = values.shift().map(h=> String(h).trim());
  const idx = Object.fromEntries(header.map((h,i)=>[h, i]));

  // Границы "сегодня" в МСК
  const tz = DASHBOARD_TZ;
  const now = new Date();
  const y = Utilities.formatDate(now, tz, 'yyyy');
  const m = Utilities.formatDate(now, tz, 'MM');
  const d = Utilities.formatDate(now, tz, 'dd');
  const dayStart = new Date(Number(y), Number(m)-1, Number(d), 0, 0, 0).getTime();
  const dayEnd   = new Date(Number(y), Number(m)-1, Number(d), 23, 59, 59, 999).getTime();

  const rows = [];
  for (const r of values){
    const tsCell = r[idx.ts];

    // ts может быть Date или строкой "dd.MM.yyyy HH:mm:ss"
    let tsMs = 0;
    if (tsCell instanceof Date) {
      tsMs = tsCell.getTime();
    } else {
      tsMs = _dash_parseDDMMYYYY_HHMMSS_(tsCell);
    }
    if (!tsMs || tsMs < dayStart || tsMs > dayEnd) continue;

    const receivedCell = r[idx.receivedAt] ?? r[idx.ts];
    let receivedAtMs = 0;
    if (receivedCell instanceof Date) {
      receivedAtMs = receivedCell.getTime();
    } else {
      receivedAtMs = _dash_parseDDMMYYYY_HHMMSS_(receivedCell);
    }

    rows.push({
      uuid:       r[idx.uuid],
      ts:         (tsCell instanceof Date)
                    ? Utilities.formatDate(tsCell, tz, 'dd.MM.yyyy HH:mm:ss')
                    : String(tsCell),
      type:       r[idx.type],
      operator:   r[idx.operator],
      client:     r[idx.client],
      city:       r[idx.city],
      box:        r[idx.box],
      code:       r[idx.code],
      details:    r[idx.details] || '',
      receivedAt: (receivedCell instanceof Date)
                    ? Utilities.formatDate(receivedCell, tz, 'dd.MM.yyyy HH:mm:ss')
                    : String(receivedCell),
      source:     r[idx.source] || 'pwa',
      tsMs,
      receivedAtMs
    });
  }
  return rows;
}

/***** ====== АГРЕГАТЫ ДЛЯ ДАШБОРДА ====== *****/
/** Агрегаты: теперь учитывают фильтры (если нужны) */
function _dash_buildState_(rows, filters){
  const now = Date.now();

  // Последнее событие на оператора (по receivedAtMs -> tsMs)
  const lastByOp = new Map();
  for (const r of rows){
    const k = r.operator || '—';
    const cur = lastByOp.get(k);
    if (!cur || r.receivedAtMs > cur.receivedAtMs || (r.receivedAtMs===cur?.receivedAtMs && r.tsMs > cur.tsMs)){
      lastByOp.set(k, r);
    }
  }

  // Счётчики за день (ITEM только по уникальным uuid)
  const cntItems = new Map(), cntErr = new Map();
  const seenByOp = new Map();
  for (const r of rows){
    if (r.type==='ITEM'){
      const op = r.operator||''; const u = String(r.uuid||'');
      if (!seenByOp.has(op)) seenByOp.set(op, new Set());
      const set = seenByOp.get(op);
      if (!set.has(u)) { set.add(u); cntItems.set(op, (cntItems.get(op)||0)+1); }
    }
    if (r.type==='ERROR') cntErr.set(r.operator, (cntErr.get(r.operator)||0)+1);
  }

  const operators = Array.from(lastByOp.entries()).map(([op,last])=>({
    operator:    op,
    online:      (now - last.receivedAtMs) <= DASHBOARD_ONLINE_MS,
    onlineAgeSec: Math.floor((now - last.receivedAtMs)/1000),
    lastSeenMs:  last.receivedAtMs,
    lastClient:  last.client || '',
    lastCity:    last.city || '',
    lastBox:     last.box || '',
    itemsToday:  cntItems.get(op)||0,
    errorsToday: cntErr.get(op)||0,
    lastSeenAt:  last.receivedAt || last.ts
  })).sort((a,b)=> Number(b.online)-Number(a.online) || b.itemsToday-a.itemsToday);

  // Клиенты
  const byClient = new Map();
  for (const r of rows){
    const k = r.client || '—';
    const c = byClient.get(k) || {client:k, items:0, boxesOpen:0, boxesClose:0, errors:0};
    if (r.type==='ITEM')  c.items++;
    if (r.type==='BOX')   c.boxesOpen++;
    if (r.type==='CLOSE') c.boxesClose++;
    if (r.type==='ERROR') c.errors++;
    byClient.set(k, c);
  }
  const clients = Array.from(byClient.values()).sort((a,b)=> b.items-a.items);

  // Лента (подсветку ошибок сделаем на фронте)
  const feed = rows
    .sort((a,b)=> (b.receivedAtMs - a.receivedAtMs) || (b.tsMs - a.tsMs))
    .slice(0, 100)
    .map(r=>({ ts:r.ts, operator:r.operator, type:r.type, client:r.client, city:r.city, box:r.box, code:r.code }));

  const summary = {
    items:  new Set(rows.filter(r=>r.type==='ITEM').map(r=> String(r.uuid||''))).size,
    opens:  rows.filter(r=>r.type==='BOX').length,
    closes: rows.filter(r=>r.type==='CLOSE').length,
    errors: rows.filter(r=>r.type==='ERROR').length
  };

  // для выпадающих фильтров отдаём списки уникальных операторов/клиентов за день
  const operatorsList = Array.from(new Set(rows.map(r=> r.operator).filter(Boolean))).sort();
  const clientsList   = Array.from(new Set(rows.map(r=> r.client).filter(Boolean))).sort();
  const citiesList    = Array.from(new Set(rows.map(r=> r.city).filter(Boolean))).sort();
  return { generatedAt: new Date().toISOString(), operators, clients, feed, summary, filters, operatorsList, clientsList, citiesList };
}

/***** ====== INCLUDE HTML (если нужно) ====== *****/
// Позволяет в index.html писать <?= include('part') ?> для инклюдов
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/***** ====== GROUPING: BOXES / CLIENTS ====== *****/

// утилита: выделить номер короба после "/"
function _onlyBoxNumber(value){
  if (!value) return '';
  const s = String(value);
  const i = s.indexOf('/');
  return i > -1 ? s.slice(i + 1) : s;
}

// сгруппировать «за день» по клиенту/коробу с деталями сканов
function _buildBoxesState_(rows){
  const byClient = new Map(); // client -> Map(city -> Map(boxNo -> {...}))
  for (const r of rows){
    const client = r.client || '—';
    const city   = r.city   || '—';
    const boxNo  = _onlyBoxNumber(r.box) || '—';

    if (!byClient.has(client)) byClient.set(client, new Map());
    const byCity = byClient.get(client);
    if (!byCity.has(city)) byCity.set(city, new Map());
    const boxes = byCity.get(city);
    if (!boxes.has(boxNo)) boxes.set(boxNo, {client, city, boxNo, items:[], firstAt:r.ts, lastAt:r.ts, operators:new Set(), uuids:new Set()});

    const entry = boxes.get(boxNo);
    if (r.type === 'ITEM'){
      const u = String(r.uuid||'');
      if (!entry.uuids.has(u)){
        entry.uuids.add(u);
        entry.items.push({ts:r.ts, code:r.code, operator:r.operator, uuid:u});
      }
    }
    entry.operators.add(r.operator);
    if (r.tsMs < _dash_parseDDMMYYYY_HHMMSS_(entry.firstAt)) entry.firstAt = r.ts;
    if (r.tsMs > _dash_parseDDMMYYYY_HHMMSS_(entry.lastAt))  entry.lastAt  = r.ts;
  }

  const clients = [];
  byClient.forEach((byCity, client)=>{
    const cities = [];
    byCity.forEach((boxes, city)=>{
      const boxArr = Array.from(boxes.values()).map(b=>({
        client: b.client,
        city:   b.city,
        boxNo:  b.boxNo,
        items:  b.items.sort((a,b)=> _dash_parseDDMMYYYY_HHMMSS_(a.ts) - _dash_parseDDMMYYYY_HHMMSS_(b.ts)),
        firstAt: b.firstAt,
        lastAt:  b.lastAt,
        operators: Array.from(b.operators).filter(Boolean).sort(),
        itemsCount: b.uuids.size
      })).sort((a,b)=> b.itemsCount - a.itemsCount || a.boxNo.localeCompare(b.boxNo));
      cities.push({
        city,
        boxes: boxArr,
        totalItems: boxArr.reduce((s,x)=>s+x.itemsCount,0),
        totalBoxes: boxArr.length
      });
    });
    cities.sort((a,b)=> b.totalItems - a.totalItems || a.city.localeCompare(b.city));
    clients.push({
      client,
      cities,
      totalItems: cities.reduce((s,c)=> s + c.totalItems, 0),
      totalBoxes: cities.reduce((s,c)=> s + c.totalBoxes, 0)
    });
  });
  clients.sort((a,b)=> b.totalItems - a.totalItems || a.client.localeCompare(b.client));
  return {clients};
}

// сгруппировать по клиенту -> список коробов -> список сканов (для вкладки "Клиенты")
// (по сути то же самое, просто пригодно для прямого рендера)
function _buildClientsState_(rows){
  return _buildBoxesState_(rows); // один и тот же формат удобен для обеих вкладок
}

/***** ====== API: BOXES / CLIENTS / EXPORT ====== *****/

function getBoxesState(filters){
  filters = filters || {};
  // ❶ формируем ключ кэша
  const cacheKey = 'DB_BOXES_V1:' + JSON.stringify({
    d: filters.date || 'today',
    o: filters.operator || '',
    c: filters.client || ''
  });
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);   // ❷ отдадим кэш сразу

  // ❸ читаем и строим
  const rows = _dash_readDay_(filters);
  const data = _buildBoxesState_(rows);
  const state = { generatedAt: new Date().toISOString(), filters, ...data };

  // ❹ кладем в кэш
  cache.put(cacheKey, JSON.stringify(state), DASHBOARD_CACHE_TTL);
  return state;
}


function getClientsState(filters){
  filters = filters || {};
  const cacheKey = 'DB_CLIENTS_V1:' + JSON.stringify({
    d: filters.date || 'today',
    o: filters.operator || '',
    c: filters.client || ''
  });
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const rows = _dash_readDay_(filters);
  const data = _buildClientsState_(rows);  // у нас он использует тот же билдер
  const state = { generatedAt: new Date().toISOString(), filters, ...data };

  cache.put(cacheKey, JSON.stringify(state), DASHBOARD_CACHE_TTL);
  return state;
}


// простой CSV-экспорт (без Advanced Drive). type: "boxes" | "clients"
function exportCsv(filters, type){
  filters = filters || {};
  const rows = _dash_readDay_(filters);
  const data = (type === 'clients') ? _buildClientsState_(rows) : _buildBoxesState_(rows);

  const out = [];
  if (type === 'clients'){
    out.push(['client','boxNo','code','scanAt','operator']);
    data.clients.forEach(c=>{
      c.boxes.forEach(b=>{
        if (!b.items.length){
          out.push([c.client, b.boxNo, '', b.firstAt||'', (b.operators[0]||'')]);
        } else {
          b.items.forEach(it=>{
            // защитим ШК от научной записи в Excel
            const safeCode = it.code ? '="' + String(it.code) + '"' : '';
            out.push([c.client, b.boxNo, safeCode, it.ts||'', it.operator||'']);
          });
        }
      });
    });
  } else { // boxes
    out.push(['client','boxNo','itemsCount','firstAt','lastAt','operators','code','scanAt','operator']);
    data.clients.forEach(c=>{
      c.boxes.forEach(b=>{
        if (!b.items.length){
          out.push([c.client, b.boxNo, 0, b.firstAt||'', b.lastAt||'', (b.operators||[]).join(', '), '', '', '']);
        } else {
          b.items.forEach((it, idx)=>{
            const safeCode = it.code ? '="' + String(it.code) + '"' : '';
            out.push([
              c.client, b.boxNo,
              idx===0 ? b.items.length : '',
              idx===0 ? (b.firstAt||'') : '',
              idx===0 ? (b.lastAt||'')  : '',
              idx===0 ? (b.operators||[]).join(', ') : '',
              safeCode, it.ts||'', it.operator||''
            ]);
          });
        }
      });
    });
  }

  // ; как разделитель для RU Excel, и BOM для UTF-8
  const csv = out.map(r=>r.map(v=>{
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(';')).join('\n');

  return {
    filename: `export_${type}_${Utilities.formatDate(new Date(), DASHBOARD_TZ, 'yyyyMMdd_HHmmss')}.csv`,
    mime: 'text/csv',
    // BOM (\uFEFF) чтобы Excel понял UTF-8
    content: '\uFEFF' + csv
  };
}


// Вернём полный URL текущего деплоя с нужными query-параметрами
function buildExportUrl(filters, type){
  const base = ScriptApp.getService().getUrl(); // абсолютный /exec URL
  const params = {
    api: 'export',
    type: (type === 'clients' ? 'clients' : 'boxes'),
    date: (filters && filters.date) || '',
    operator: (filters && filters.operator) || '',
    client: (filters && filters.client) || ''
  };
  const q = Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
  return base + '?' + q;
}


// (removed duplicate doGet; unified router is defined earlier)

function exportToGoogleSheet(filters, type){
  const rows = _dash_readDay_(filters || {});
  const data = (type === 'clients') ? _buildClientsState_(rows) : _buildBoxesState_(rows);

  // Готовим плоскую таблицу
  let header, values = [];
  if (type === 'clients'){
    header = ['Клиент','Короб','ШК','Время скана','Оператор'];
    data.clients.forEach(c=>{
      c.boxes.forEach(b=>{
        if (!b.items.length){
          values.push([c.client, b.boxNo, '', b.firstAt||'', (b.operators[0]||'')]);
        } else {
          const seen = new Set();
          b.items.forEach(it=>{
            const uid = String(it.uuid||'');
            if (seen.has(uid)) return; seen.add(uid);
            values.push([c.client, b.boxNo, String(it.code||''), it.ts||'', it.operator||'']);
          });
        }
      });
    });
  } else { // boxes
    header = ['Клиент','Короб','Кол-во сканов','Первый скан','Последний скан','Операторы','ШК','Время скана','Оператор'];
    data.clients.forEach(c=>{
      c.boxes.forEach(b=>{
        if (!b.items.length){
          values.push([c.client, b.boxNo, 0, b.firstAt||'', b.lastAt||'', (b.operators||[]).join(', '), '', '', '']);
        } else {
          const seen = new Set();
          let idx = 0;
          b.items.forEach(it=>{
            const uid = String(it.uuid||'');
            if (seen.has(uid)) return; seen.add(uid);
            values.push([
              c.client, b.boxNo,
              idx===0 ? b.items.length : '',
              idx===0 ? (b.firstAt||'') : '',
              idx===0 ? (b.lastAt||'')  : '',
              idx===0 ? (b.operators||[]).join(', ') : '',
              String(it.code||''), it.ts||'', it.operator||''
            ]);
            idx++;
          });
        }
      });
    });
  }

  // Создаём таблицу
  // Название: YYYY-MM-DD — Клиент — Город
  const datePart = (filters && filters.date) ? String(filters.date) : Utilities.formatDate(new Date(), DASHBOARD_TZ, 'yyyy-MM-dd');
  const clientPart = (filters && filters.client) ? String(filters.client) : 'all';
  const cityPart   = (filters && filters.city)   ? String(filters.city)   : 'all';
  const name = `${datePart} — ${clientPart} — ${cityPart}`;
  const ss = SpreadsheetApp.create(name);
  const sh = ss.getActiveSheet();
  sh.clear();

  // Записываем
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight('bold');
  if (values.length){
    sh.getRange(2,1,values.length,header.length).setValues(values);
  }

  // Форматы: код как текст, даты — dd.MM.yyyy HH:mm:ss
  const headersMap = Object.fromEntries(header.map((h,i)=>[h, i+1]));
  if (headersMap['ШК']) {
    sh.getRange(2, headersMap['ШК'], Math.max(values.length,1), 1).setNumberFormat('@'); // текст
  }
  ['Время скана','Первый скан','Последний скан'].forEach(h=>{
    if (headersMap[h]){
      sh.getRange(2, headersMap[h], Math.max(values.length,1), 1).setNumberFormat('dd"."MM"."yyyy" "HH":"mm":"ss');
    }
  });

  sh.autoResizeColumns(1, header.length);
  return ss.getUrl(); // вернём ссылку
}

// ===== УПРОЩЁННЫЙ ЭКСПОРТ В GS: Клиент | Короб | ШК | Время скана | Оператор
function exportToGoogleSheetSimple(filters) {
  const rows = _dash_readDay_(filters || {});             // читаем день
  const data = _buildBoxesState_(rows);                   // уже группирует клиент→короб→items

  const header = ['Клиент','Короб','ШК','Время скана','Оператор'];
  const values = [];

  data.clients.forEach(c=>{
    c.boxes.forEach(b=>{
      if (!b.items.length) {
        // если сканов не было — строка-заглушка (по желанию можно пропустить)
        values.push([c.client, b.boxNo, '', b.firstAt || '', (b.operators?.[0] || '')]);
      } else {
        b.items.forEach(it=>{
          values.push([c.client, b.boxNo, String(it.code||''), it.ts || '', it.operator || '']);
        });
      }
    });
  });

  const name = `Export_simple_${Utilities.formatDate(new Date(), DASHBOARD_TZ, 'yyyy-MM-dd_HH-mm-ss')}`;
  const ss = SpreadsheetApp.create(name);
  const sh = ss.getActiveSheet();
  sh.clear();
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight('bold');
  if (values.length) sh.getRange(2,1,values.length,header.length).setValues(values);

  // форматы
  const map = Object.fromEntries(header.map((h,i)=>[h,i+1]));
  if (map['ШК']) sh.getRange(2, map['ШК'], Math.max(values.length,1), 1).setNumberFormat('@');
  if (map['Время скана']) sh.getRange(2, map['Время скана'], Math.max(values.length,1), 1)
                           .setNumberFormat('dd"."MM"."yyyy" "HH":"mm":"ss');
  sh.autoResizeColumns(1, header.length);
  return ss.getUrl();
}

function exportToGoogleSheetSimpleRPC(filters){
  return exportToGoogleSheetSimple(filters || {});
}


function buildExportGsUrl(filters, type){
  const base = ScriptApp.getService().getUrl();
  const params = {
    api: 'export_gs',
    type: (type === 'clients' ? 'clients' : 'boxes'),
    date: (filters && filters.date) || '',
    operator: (filters && filters.operator) || '',
    client: (filters && filters.client) || ''
  };
  const q = Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');
  return base + '?' + q;
}
// Прочитать записи за диапазон дат (включительно) по фильтрам
function _dash_readRange_(filters){
  filters = filters || {};
  const tz = DASHBOARD_TZ;
  const parse = _dash_parseDDMMYYYY_HHMMSS_; // уже есть в твоём коде

  // ожидаем ISO-даты 'yyyy-MM-dd' в filters.dateFrom / dateTo
  const dateFromIso = filters.dateFrom || filters.date || ''; // если не передали — fallback на выбранный день
  const dateToIso   = filters.dateTo   || filters.date || '';

  if (!dateFromIso || !dateToIso) {
    // если нет диапазона — читаем день
    return _dash_readDay_(filters);
  }

  // границы в ms (локальное TZ)
  const fromMs = new Date(dateFromIso + 'T00:00:00').getTime();
  const toMs   = new Date(dateToIso   + 'T23:59:59').getTime();

  // месяцы, которые пересекают диапазон
  function monthKeyOfIso(iso){ const [y,m] = iso.split('-'); return `${y}_${m}`; }
  const startKey = monthKeyOfIso(dateFromIso);
  const endKey   = monthKeyOfIso(dateToIso);

  // соберём ключи между startKey..endKey
  const keys = [];
  let y = +startKey.split('_')[0], m = +startKey.split('_')[1];
  while (true){
    keys.push(`${y}_${String(m).padStart(2,'0')}`);
    if (`${y}_${String(m).padStart(2,'0')}` === endKey) break;
    m++; if (m>12){ m=1; y++; }
  }

  const out = [];
  keys.forEach(k=>{
    const shName = `${DASHBOARD_SHEET_PREFIX}${k}`; // raw_log_yyyy_MM
    const ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
    const sh = ss.getSheetByName(shName);
    if (!sh) return;

    const values = sh.getDataRange().getValues();
    const header = values.shift();
    const col = {}; header.forEach((h,i)=> col[h]=i);

    values.forEach(r=>{
      const ts = r[col['ts']];
      if (!ts) return;
      // ts хранится как 'dd.MM.yyyy HH:mm:ss'
      const ms = parse(ts);
      if (ms < fromMs || ms > toMs) return;

      const row = {
        uuid: r[col['uuid']],
        ts: ts,
        tsMs: ms,
        type: r[col['type']],
        operator: r[col['operator']],
        client: r[col['client']],
        city:   r[col['city']],
        city: r[col['city']],
        box: r[col['box']],
        code: r[col['code']],
        receivedAt: r[col['receivedAt']] || ts
      };

      // фильтры
      if (filters.operator && String(row.operator) !== String(filters.operator)) return;
      if (filters.city     && String(row.city)     !== String(filters.city))     return;
      if (filters.client && String(row.client) !== String(filters.client)) return;

      out.push(row);
    });
  });

  // отсортируем по времени
  out.sort((a,b)=> a.tsMs - b.tsMs);
  return out;
}

// В Sheets — диапазон дат, простые колонки
function exportRangeToGoogleSheetSimple(filters){
  const rows = _dash_readRange_(filters || {});
  // Сгруппировать клиент→короб, но нам нужен плоский список сканов
  // Берём только ITEM (по твоей логике)
  const header = ['Клиент','Короб','ШК','Время скана','Оператор'];
  const values = [];
  // Уберём дубли по uuid в диапазоне
  const seen = new Set();

  // Сортировка: клиент → номер короба → время скана
  rows.sort((a,b)=>{
    const cmpClient = String(a.client||'').localeCompare(String(b.client||''));
    if (cmpClient !== 0) return cmpClient;
    const aNo = parseInt(_onlyBoxNumber(a.box||'') || '0', 10);
    const bNo = parseInt(_onlyBoxNumber(b.box||'') || '0', 10);
    if (aNo !== bNo) return aNo - bNo;
    const at = (typeof a.tsMs === 'number') ? a.tsMs : _dash_parseDDMMYYYY_HHMMSS_(a.ts||'');
    const bt = (typeof b.tsMs === 'number') ? b.tsMs : _dash_parseDDMMYYYY_HHMMSS_(b.ts||'');
    return at - bt;
  });


  rows.forEach(r=>{
    if (r.type !== 'ITEM') return;
    const uid = String(r.uuid||'');
    if (seen.has(uid)) return;
    seen.add(uid);
    const boxNo = _onlyBoxNumber(r.box || '');
    values.push([r.client || '—', boxNo || '—', String(r.code||''), r.ts || '', r.operator || '']);
  });

  const datePart = `${filters?.dateFrom||''}..${filters?.dateTo||''}`.replace(/^\.+|\.+$/g,'') || Utilities.formatDate(new Date(), DASHBOARD_TZ, 'yyyy-MM-dd');
  const clientPart = (filters && filters.client) ? String(filters.client) : 'all';
  const cityPart   = (filters && filters.city)   ? String(filters.city)   : 'all';
  const name = `${datePart} — ${clientPart} — ${cityPart}`;
  const ss = SpreadsheetApp.create(name);
  const sh = ss.getActiveSheet();
  sh.clear();
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight('bold');
  if (values.length) sh.getRange(2,1,values.length,header.length).setValues(values);

  const map = Object.fromEntries(header.map((h,i)=>[h,i+1]));
  if (map['ШК']) sh.getRange(2, map['ШК'], Math.max(values.length,1), 1).setNumberFormat('@');
  if (map['Время скана']) sh.getRange(2, map['Время скана'], Math.max(values.length,1), 1)
                           .setNumberFormat('dd"."MM"."yyyy" "HH":"mm":"ss');
  sh.autoResizeColumns(1, header.length);
  return ss.getUrl();
}

// RPC для фронта
function exportRangeToGoogleSheetSimpleRPC(filters){
  return exportRangeToGoogleSheetSimple(filters || {});
}

// Возвращает списки для каскадных фильтров экспорта по диапазону дат
// { clients:[...], citiesByClient:{client:[cities]}, operatorsByClientCity:{client||city:[ops]} }
function getExportLists(filters){
  const rows = _dash_readRange_(filters || {});
  const clients = Array.from(new Set(rows.map(r=> r.client).filter(Boolean))).sort();
  const citiesByClient = {};
  const operatorsByClientCity = {};
  clients.forEach(c=> citiesByClient[c]=[]);
  rows.forEach(r=>{
    const c = r.client||''; const city = r.city||''; const op = r.operator||'';
    if (c){ if (!citiesByClient[c]) citiesByClient[c]=[]; if (city && !citiesByClient[c].includes(city)) citiesByClient[c].push(city); }
    const key = c+'||'+city;
    if (!operatorsByClientCity[key]) operatorsByClientCity[key]=[];
    if (op && !operatorsByClientCity[key].includes(op)) operatorsByClientCity[key].push(op);
  });
  Object.values(citiesByClient).forEach(arr=> arr.sort());
  Object.values(operatorsByClientCity).forEach(arr=> arr.sort());
  return { clients, citiesByClient, operatorsByClientCity };
}

function dedupeMonthByUuid(sheetName = 'raw_log_2025_09') {
  const ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName); // напр. 'raw_log_2025_09'
  if (!sh) throw new Error('Лист не найден: ' + sheetName);

  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return 0;

  const header = values[0];
  const col = {};
  header.forEach((h,i)=> col[h]=i);

  if (col['uuid'] == null) throw new Error('Нет колонки uuid');

  const seen = new Set();
  // собираем индексы строк на удаление (1-based в таблице)
  const toDelete = [];
  for (let i = 1; i < values.length; i++){
    const row = values[i];
    const u = String(row[col['uuid']] || '').trim().toLowerCase();
    if (!u) continue;
    if (seen.has(u)){
      toDelete.push(i+1); // сдвиг на заголовок
    } else {
      seen.add(u);
    }
  }

  // удаляем снизу вверх
  for (let i = toDelete.length - 1; i >= 0; i--){
    sh.deleteRow(toDelete[i]);
  }

  return toDelete.length;
}

/***** ====== УДАЛЕНИЕ ТОВАРОВ ====== *****/
function removeItemFromBox(params) {
  const { operator, box, code, reason } = params;
  
  // Проверка авторизации оператора
  if (!operator || operator.trim() === '') {
    return { ok: false, error: 'Не указан оператор' };
  }
  
  if (!box || !code) {
    return { ok: false, error: 'Не указаны короб или код товара' };
  }
  
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    // Создаем событие удаления
    const removeEvent = {
      uuid: Utilities.getUuid(),
      ts: Date.now(),
      type: 'REMOVE',
      operator: operator.trim(),
      client: box.split('/')[0] || '',
      city: '', // будет заполнено из исходного события
      box: box,
      code: code,
      details: reason || 'Удалено оператором через дашборд'
    };
    
    // Записываем событие удаления в текущий месячный лист
    const ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
    const sheetName = DASHBOARD_SHEET_PREFIX + _dash_monthKey_(new Date());
    const sh = _getOrCreateSheet(ss, sheetName);
    
    const row = [
      removeEvent.uuid,
      new Date(removeEvent.ts),
      removeEvent.type,
      removeEvent.operator,
      removeEvent.client,
      removeEvent.city,
      removeEvent.box,
      removeEvent.code,
      removeEvent.details || '', // details
      new Date(), // receivedAt
      'dashboard'
    ];
    
    sh.appendRow(row);
    
    // Форматируем время
    const lastRow = sh.getLastRow();
    sh.getRange(lastRow, 2, 1, 1).setNumberFormat('dd.MM.yyyy HH:mm:ss'); // ts
    sh.getRange(lastRow, 10, 1, 1).setNumberFormat('dd.MM.yyyy HH:mm:ss'); // receivedAt
    
    // Очищаем кэш для обновления данных
    const cache = CacheService.getScriptCache();
    cache.remove('DB_STATE_V2:*');
    cache.remove('DB_BOXES_V1:*');
    cache.remove('DB_CLIENTS_V1:*');
    
    return { 
      ok: true, 
      message: `Товар ${code} удален из короба ${box}`,
      removeEvent: removeEvent
    };
    
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

/***** ====== ЛОГИ УДАЛЕНИЙ ====== */
function getRemovalLogs(filters) {
  filters = filters || {};
  
  try {
    const rows = _dash_readDay_(filters);
    
    // Фильтруем только события удаления
    const removalEvents = rows.filter(r => 
      r.type === 'REMOVE' || 
      r.type === 'BULK_REMOVE'
    );
    
    // Сортируем по времени (новые сверху)
    removalEvents.sort((a, b) => b.tsMs - a.tsMs);
    
    // Форматируем для отображения
    const formattedLogs = removalEvents.map(event => {
      let details = '';
      let reason = '';
      
      if (event.type === 'REMOVE') {
        details = `ШК: ${event.code}`;
        reason = event.details || 'Не указана';
      } else if (event.type === 'BULK_REMOVE') {
        details = event.code; // "Удалено N товаров"
        reason = event.details || 'Не указана';
      }
      
      return {
        timestamp: event.ts,
        operator: event.operator || '—',
        type: event.type,
        client: event.client || '—',
        box: event.box || '—',
        details: details,
        reason: reason,
        tsMs: event.tsMs
      };
    });
    
    return {
      ok: true,
      logs: formattedLogs,
      total: formattedLogs.length,
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      ok: false,
      error: String(error),
      logs: [],
      total: 0
    };
  }
}

/***** ====== МАССОВОЕ УДАЛЕНИЕ ТОВАРОВ ====== */
function bulkRemoveItems(params) {
  const { operator, uuids, reason } = params;
  
  // Проверка авторизации оператора
  if (!operator || operator.trim() === '') {
    return { ok: false, error: 'Не указан оператор' };
  }
  
  if (!uuids || uuids.trim() === '') {
    return { ok: false, error: 'Не указаны UUID товаров для удаления' };
  }
  
  const uuidList = uuids.split(',').map(u => u.trim()).filter(u => u);
  if (uuidList.length === 0) {
    return { ok: false, error: 'Список UUID пуст' };
  }
  
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    const ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
    const sheetName = DASHBOARD_SHEET_PREFIX + _dash_monthKey_(new Date());
    const sh = _getOrCreateSheet(ss, sheetName);
    
    const values = sh.getDataRange().getValues();
    if (values.length <= 1) {
      return { ok: false, error: 'Нет данных для удаления' };
    }
    
    const header = values[0];
    const col = {};
    header.forEach((h, i) => col[h] = i);
    
    if (col['uuid'] == null) {
      return { ok: false, error: 'Нет колонки uuid в таблице' };
    }
    
    // Находим строки для удаления
    const rowsToDelete = [];
    const removedItems = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const uuid = String(row[col['uuid']] || '').trim();
      
      if (uuidList.includes(uuid)) {
        rowsToDelete.push(i + 1); // +1 потому что строки в Sheets начинаются с 1
        removedItems.push({
          uuid: uuid,
          code: row[col['code']] || '',
          box: row[col['box']] || '',
          operator: row[col['operator']] || ''
        });
      }
    }
    
    if (rowsToDelete.length === 0) {
      return { ok: false, error: 'Не найдены товары с указанными UUID' };
    }
    
    // Удаляем строки снизу вверх (чтобы индексы не сбивались)
    rowsToDelete.sort((a, b) => b - a);
    for (const rowIndex of rowsToDelete) {
      sh.deleteRow(rowIndex);
    }
    
    // Создаем событие массового удаления для аудита
    const auditEvent = {
      uuid: Utilities.getUuid(),
      ts: Date.now(),
      type: 'BULK_REMOVE',
      operator: operator.trim(),
      client: removedItems.length > 0 ? removedItems[0].client : '',
      city: '',
      box: removedItems.length > 0 ? removedItems[0].box : '',
      code: `Удалено ${removedItems.length} товаров`,
      details: reason || 'Массовое удаление через дашборд'
    };
    
    const auditRow = [
      auditEvent.uuid,
      new Date(auditEvent.ts),
      auditEvent.type,
      auditEvent.operator,
      auditEvent.client,
      auditEvent.city,
      auditEvent.box,
      auditEvent.code,
      auditEvent.details || '', // details
      new Date(), // receivedAt
      'dashboard'
    ];
    
    sh.appendRow(auditRow);
    
    // Форматируем время для аудита
    const lastRow = sh.getLastRow();
    sh.getRange(lastRow, 2, 1, 1).setNumberFormat('dd.MM.yyyy HH:mm:ss'); // ts
    sh.getRange(lastRow, 10, 1, 1).setNumberFormat('dd.MM.yyyy HH:mm:ss'); // receivedAt
    
    // Очищаем кэш для обновления данных
    const cache = CacheService.getScriptCache();
    cache.remove('DB_STATE_V2:*');
    cache.remove('DB_BOXES_V1:*');
    cache.remove('DB_CLIENTS_V1:*');
    
    return { 
      ok: true, 
      message: `Удалено ${removedItems.length} товаров`,
      removedCount: removedItems.length,
      removedItems: removedItems,
      auditEvent: auditEvent
    };
    
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}
