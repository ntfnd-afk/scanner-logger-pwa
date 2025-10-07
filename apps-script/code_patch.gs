// ========= Scanner Logger – GAS Patch (safe, no conflicts) =========
// Добавь ЭТО в новый файл code_patch.gs (или в конец проекта). doPost/doGet не трогаем.

function _sl_jsonOut(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Cache-Control','no-store');
}
function _sl_jsonErr(e){
  return _sl_jsonOut({ ok:false, error:String(e && e.message || e) });
}
function _sl_monthSheetName(d){
  d = d || new Date();
  var prefix = (typeof DASHBOARD_SHEET_PREFIX !== 'undefined' ? DASHBOARD_SHEET_PREFIX : 'raw_log_');
  var tz     = (typeof DASHBOARD_TZ           !== 'undefined' ? DASHBOARD_TZ           : 'Europe/Moscow');
  return prefix + Utilities.formatDate(d, tz, 'yyyy_MM');
}
function _sl_ensureSheet(ss, name, header){
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,header.length).setValues([header]);
  } else if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,header.length).setValues([header]);
  }
  return sh;
}
function _sl_normUuid(u){ return String(u||'').trim().toLowerCase(); }

// --- VERIFY-ACK: вернуть те uuid, которые уже есть в текущем месяце
function _sl_hasUuids(uuids){
  try{
    uuids = Array.isArray(uuids) ? uuids : [];
    var ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
    var sh = ss.getSheetByName(_sl_monthSheetName()) || null;
    if (!sh) return { ok:true, present: [] };

    var last = sh.getLastRow();
    var colA = last>1 ? sh.getRange(2,1,last-1,1).getValues() : [];
    var set  = new Set(colA.map(function(r){ return _sl_normUuid(r[0]); }));
    var present = uuids.filter(function(u){ return set.has(_sl_normUuid(u)); });
    return { ok:true, present:present };
  }catch(e){ return { ok:false, error:String(e) }; }
}

// --- Надёжный приём батча логов с антидубликатами по uuid + кэш
function _sl_ingestLogs(records){
  if (!Array.isArray(records) || !records.length) return { ok:true, inserted:0, skipped:0 };

  var lock = LockService.getScriptLock();
  lock.tryLock(30 * 1000);
  try{
    var ss = SpreadsheetApp.openById(DASHBOARD_SPREADSHEET_ID);
    var sh = _sl_ensureSheet(ss, _sl_monthSheetName(), ['uuid','ts','type','operator','client','city','box','code','receivedAt','source']);

    var last = sh.getLastRow();
    var existed = new Set();
    if (last > 1){
      var uuids = sh.getRange(2,1,last-1,1).getValues();
      for (var i=0;i<uuids.length;i++){
        var u = uuids[i][0];
        if (u) existed.add(_sl_normUuid(u));
      }
    }

    var cache = CacheService.getScriptCache(); // быстрый барьер на 10 минут
    var toWrite = [];
    var skipped = 0;

    for (var j=0;j<records.length;j++){
      var r = records[j];
      var u = _sl_normUuid(r.uuid);
      if (!u){ skipped++; continue; }
      if (cache.get('uuid:'+u)){ skipped++; continue; }
      if (existed.has(u)){ skipped++; continue; }

      toWrite.push([
        r.uuid,
        r.ts,             // 'dd.MM.yyyy HH:mm:ss'
        r.type,
        r.operator,
        r.client,
        r.city,
        r.box,
        r.code,
        r.receivedAt || r.ts,
        r.source || 'pwa'
      ]);
      cache.put('uuid:'+u, '1', 600); // 10 минут
    }

    if (toWrite.length){
      sh.getRange(sh.getLastRow()+1, 1, toWrite.length, 10).setValues(toWrite);
    }

    return { ok:true, inserted: toWrite.length, skipped: skipped };
  }catch(e){
    return { ok:false, error:String(e) };
  }finally{
    try{ lock.releaseLock(); }catch(_){}
  }
}
