/**
 * Asistent – motor.
 * Skript patří k jedné Google Tabulce a smí sahat jen na ni (oprávnění
 * spreadsheets.currentonly). Appka mu posílá svůj stav, motor ho sloučí
 * s uloženým a vrátí výsledek. Každý požadavek musí nést klíč.
 *
 * @OnlyCurrentDoc
 */
var PUBLIC_URL = 'https://larsfriis-kbz.github.io/asistent/';
var NAMES = ['items', 'notes', 'projects', 'recs'];
var CHUNK = 40000;
var BACKUPS = 14;

/* Sloučení dvou stavů. Stejný kód běží v appce i v motoru.
   Záznam vyhrává podle novějšího času úpravy `u`; smazání je značka v `tomb`. */
function mergeState(a, b, now) {
  var NAMES = ['items', 'notes', 'projects', 'recs'];
  var KEEP = 180 * 24 * 3600 * 1000;
  var out = { cols: {}, tomb: {}, meta: null };
  var both = [a || {}, b || {}];
  NAMES.forEach(function (name) {
    var t = {}, m = {}, list = [], id;
    both.forEach(function (s) {
      var st = (s.tomb && s.tomb[name]) || {};
      for (var k in st) if (!(t[k] >= st[k])) t[k] = Number(st[k]) || 0;
      ((s.cols && s.cols[name]) || []).forEach(function (r) {
        if (!r || !r.id) return;
        var cur = m[r.id];
        if (!cur || (Number(r.u) || 0) > (Number(cur.u) || 0)) m[r.id] = r;
      });
    });
    for (id in m) { if (t[id] && t[id] >= (Number(m[id].u) || 0)) continue; list.push(m[id]); }
    for (id in t) if (now - t[id] > KEEP) delete t[id];
    out.cols[name] = list; out.tomb[name] = t;
  });
  var ma = both[0].meta, mb = both[1].meta;
  out.meta = !ma ? (mb || null) : !mb ? ma : ((Number(mb.u) || 0) > (Number(ma.u) || 0) ? mb : ma);
  return out;
}


function onOpen() {
  SpreadsheetApp.getUi().createMenu('Asistent').addItem('Propojit zařízení', 'showConnect').addItem('Klíč pro zkratky', 'showDrop').addToUi();
}

function key_() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('KEY');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); p.setProperty('KEY', k); }
  return k;
}

/* Druhý klíč jen pro zápis: zkratky v iPhonu jím umí přidat věc do Schránky a denní čísla zdraví. Data jím přečíst nejde. */
function dropKey_() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('DROP_KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); p.setProperty('DROP_KEY', k); }
  return k;
}
function showDrop() {
  var url = PropertiesService.getScriptProperties().getProperty('URL') || 'adresa webové aplikace končící na /exec';
  var k = dropKey_();
  var html = '<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:4px 2px}pre{background:#f1f1f1;padding:10px;border-radius:6px;white-space:pre-wrap;word-break:break-all}</style>' +
    '<p>Ve Zkratkách použij akci Získat obsah URL, metoda POST, tělo požadavku JSON.</p><p><b>Adresa</b></p><pre>' + url + '</pre>' +
    '<p><b>Věc do Schránky</b> (prostredi: prace nebo osobni)</p><pre>{"op":"drop","key":"' + k + '","text":"Vstup zkratky","prostredi":"prace"}</pre>' +
    '<p><b>Zdraví za dnešek</b> (pošli jen čísla, která máš)</p><pre>{"op":"health","key":"' + k + '","kroky":8421,"spanek":7.5,"pripravenost":82,"vaha":80.4}</pre>' +
    '<p>Tenhle klíč umí jen zapisovat. Tvoje data jím nikdo nepřečte.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(470), 'Klíč pro zkratky v iPhonu');
}

function showConnect() {
  var url = PropertiesService.getScriptProperties().getProperty('URL') || '';
  if (!url) { try { var u = ScriptApp.getService().getUrl(); if (u && /\/exec$/.test(u)) url = u; } catch (e) {} }
  var t = HtmlService.createTemplate(
    '<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:4px 2px}label{display:block;margin:10px 0 4px;color:#555}' +
    'input,textarea{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #bbb;border-radius:6px}' +
    'textarea{height:110px}button{font:inherit;font-weight:700;padding:9px 14px;border-radius:6px;border:0;background:#131C2E;color:#fff;margin-top:10px}</style>' +
    '<label for="u">Adresa webové aplikace (končí na /exec)</label><input id="u" value="<?= url ?>">' +
    '<label for="l">Propojovací odkaz. Otevři ho na zařízení, které chceš připojit.</label><textarea id="l" readonly></textarea>' +
    '<button id="c">Zkopírovat odkaz</button> <span id="s"></span>' +
    '<p style="color:#555">Odkaz obsahuje klíč k tvým datům. Neposílej ho nikomu dalšímu.</p>' +
    '<script>var k=<?!= JSON.stringify(key) ?>,base=<?!= JSON.stringify(base) ?>;function mk(){var u=document.getElementById("u").value.trim();' +
    'var p=btoa(unescape(encodeURIComponent(JSON.stringify({u:u,k:k})))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");' +
    'document.getElementById("l").value=u?base+"#pripojit="+p:"Nejdřív vlož adresu webové aplikace.";}' +
    'document.getElementById("u").addEventListener("input",mk);mk();' +
    'document.getElementById("c").addEventListener("click",function(){var l=document.getElementById("l");l.select();document.execCommand("copy");document.getElementById("s").textContent="Zkopírováno.";});</script>');
  t.url = url; t.key = key_(); t.base = PUBLIC_URL;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(520).setHeight(360), 'Propojit zařízení s Asistentem');
}

function doGet() {
  try { var u = ScriptApp.getService().getUrl(); if (u && /\/exec$/.test(u)) PropertiesService.getScriptProperties().setProperty('URL', u); } catch (e) {}
  key_();
  return ContentService.createTextOutput('Asistent: motor běží. Propojovací odkaz najdeš v Tabulce v nabídce Asistent.');
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.op === 'ping' && !req.key) out = { ok: true, app: 'asistent', v: 2 };
    else if (req.op === 'drop' || req.op === 'health') {
      var k = String(req.key || '').replace(/\s/g, '');
      out = same_(k, dropKey_()) || same_(k, key_()) ? write_(req) : { ok: false, error: 'auth' };
    }
    else if (!same_(String(req.key || ''), key_())) out = { ok: false, error: 'auth' };
    else out = handle_(req);
  } catch (err) {
    out = { ok: false, error: 'server', detail: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* zápis ze zkratky: jeden záznam do kolekce recs, zbytek stavu se nemění */
function write_(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var st = load_(), now = Date.now(), rec;
    if (req.op === 'drop') {
      var text = String(req.text || '').trim().slice(0, 5000);
      if (!text) return { ok: false, error: 'empty', zprava: 'Chybí text.' };
      var m = /https?:\/\/\S+/.exec(String(req.url || '') || text);
      rec = { id: 'x' + Utilities.getUuid().replace(/-/g, '').slice(0, 12), mod: 'schranka', env: req.prostredi === 'osobni' ? 'osobni' : 'prace', text: text, url: m ? m[0] : '', stav: 'Nové', created: now, u: now };
      st.cols.recs.push(rec);
    } else {
      var d = /^\d{4}-\d{2}-\d{2}$/.test(String(req.date || '')) ? String(req.date) : Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd');
      var id = 'den-' + d, n = 0;
      rec = null;
      st.cols.recs.forEach(function (r) { if (r.id === id) rec = r; });
      if (!rec) { rec = { id: id, mod: 'den', env: 'osobni', date: d, created: now }; st.cols.recs.push(rec); }
      ['kroky', 'spanek', 'pripravenost', 'vaha'].forEach(function (f) {
        var v = Number(String(req[f] == null ? '' : req[f]).replace(',', '.'));
        if (req[f] !== '' && req[f] != null && isFinite(v) && v > 0) { rec[f] = v; n++; }
      });
      if (!n) return { ok: false, error: 'empty', zprava: 'Nepřišlo žádné číslo.' };
      rec.u = now;
      delete st.tomb.recs[id];
    }
    store_(st);
    return { ok: true, id: rec.id };
  } finally {
    lock.releaseLock();
  }
}

function same_(a, b) {
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function handle_(req) {
  switch (req.op) {
    case 'ping': return { ok: true, app: 'asistent', v: 2, auth: true };
    case 'sync': return sync_(req);
    case 'thoughts': return thoughts_(req);
    case 'putThoughts': return putThoughts_(req);
    case 'archive': return archive_(req);
    case 'tr-put': return trPut_(req);
    case 'tr-get': return trGet_(req);
  }
  return { ok: false, error: 'op' };
}

/* ---------- listy ---------- */
function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
function readRows_(name) {
  var sh = sheet_(name), r = sh.getLastRow(), c = sh.getLastColumn();
  return r && c ? sh.getRange(1, 1, r, c).getValues() : [];
}
function writeRows_(name, rows) {
  var sh = sheet_(name);
  sh.clearContents();
  if (!rows.length) return;
  var w = 1;
  rows.forEach(function (r) { if (r.length > w) w = r.length; });
  rows = rows.map(function (r) { r = r.slice(); while (r.length < w) r.push(''); return r; });
  if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
  if (sh.getMaxRows() < rows.length) sh.insertRowsAfter(sh.getMaxRows(), rows.length - sh.getMaxRows());
  sh.getRange(1, 1, rows.length, w).setValues(rows);
}
/* text se ukládá po kusech s vlnovkou na začátku, aby ho Tabulka nečetla jako vzorec nebo číslo */
function chunks_(s) {
  var out = [];
  for (var i = 0; i < s.length; i += CHUNK) out.push('~' + s.substr(i, CHUNK));
  return out.length ? out : ['~'];
}
function join_(cells) {
  return cells.map(function (c) { c = String(c == null ? '' : c); return c.charAt(0) === '~' ? c.substr(1) : c; }).join('');
}

function load_() {
  var st = { cols: {}, tomb: {}, meta: null };
  NAMES.forEach(function (n) {
    st.cols[n] = readRows_(n).filter(function (r) { return r[0] !== ''; }).map(function (r) {
      var rec = JSON.parse(join_(r.slice(2)));
      rec.id = String(r[0]).replace(/^~/, ''); rec.u = Number(r[1]) || 0;
      return rec;
    });
    st.tomb[n] = {};
  });
  readRows_('tomb').forEach(function (r) { if (st.tomb[r[0]]) st.tomb[r[0]][String(r[1]).replace(/^~/, '')] = Number(r[2]) || 0; });
  var m = readRows_('meta');
  if (m.length && m[0][0] !== '') { st.meta = JSON.parse(join_(m[0].slice(1))); st.meta.u = Number(m[0][0]) || 0; }
  return st;
}
function store_(st) {
  NAMES.forEach(function (n) {
    writeRows_(n, st.cols[n].map(function (rec) { return ['~' + rec.id, Number(rec.u) || 0].concat(chunks_(JSON.stringify(rec))); }));
  });
  var t = [];
  NAMES.forEach(function (n) { for (var id in st.tomb[n]) t.push([n, '~' + id, st.tomb[n][id]]); });
  writeRows_('tomb', t);
  writeRows_('meta', st.meta ? [[Number(st.meta.u) || 0].concat(chunks_(JSON.stringify(st.meta)))] : []);
}
function backup_(st) {
  var p = PropertiesService.getScriptProperties();
  var day = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd');
  if (p.getProperty('BACKUP_DAY') === day) return;
  var rows = readRows_('zalohy').filter(function (r) { return r[0] !== '' && String(r[0]) !== day; });
  rows.push([day].concat(chunks_(JSON.stringify(st))));
  writeRows_('zalohy', rows.slice(-BACKUPS));
  p.setProperty('BACKUP_DAY', day);
}

function sync_(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var stored = load_();
    backup_(stored);
    var merged = mergeState(stored, { cols: req.cols || {}, tomb: req.tomb || {}, meta: req.meta || null }, Date.now());
    if (JSON.stringify(merged) !== JSON.stringify(stored)) store_(merged);
    return { ok: true, cols: merged.cols, tomb: merged.tomb, meta: merged.meta, time: Date.now() };
  } finally {
    lock.releaseLock();
  }
}

function thoughts_(req) {
  var rows = readRows_('myslenky');
  var n = Number(PropertiesService.getScriptProperties().getProperty('THOUGHTS_N')) || 0;
  if (req.head) return { ok: true, n: rows.length ? n : 0 };
  if (!rows.length) return { ok: true, n: 0, thoughts: null };
  return { ok: true, n: n, thoughts: JSON.parse(join_(rows.map(function (r) { return r[0]; }))) };
}
function putThoughts_(req) {
  if (!Array.isArray(req.thoughts)) return { ok: false, error: 'data' };
  writeRows_('myslenky', chunks_(JSON.stringify(req.thoughts)).map(function (c) { return [c]; }));
  PropertiesService.getScriptProperties().setProperty('THOUGHTS_N', String(req.thoughts.length));
  return { ok: true, n: req.thoughts.length };
}

/* ---------- archiv vysílání ----------
   List `archiv`: id | u | rev | záznam (JSON). Řádek na díl, mění se jen dotčené řádky.
   `rev` je pořadové číslo změny; appka si řekne o všechno novější než to, co už má. */
var ARCH_MAX = 45000;
function ensureRows_(sh, n) { if (sh.getMaxRows() < n) sh.insertRowsAfter(sh.getMaxRows(), n - sh.getMaxRows() + 200); }

function archive_(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = sheet_('archiv');
    var last = sh.getLastRow();
    var rows = last ? sh.getRange(1, 1, last, 4).getValues() : [];
    var at = {};
    rows.forEach(function (r, i) { at[String(r[0]).replace(/^~/, '')] = i; });
    var p = PropertiesService.getScriptProperties();
    var rev0 = Number(p.getProperty('ARCH_REV')) || 0, rev = rev0;
    var changed = {}, orig = rows.length, rejected = [];
    (Array.isArray(req.changes) ? req.changes : []).forEach(function (c) {
      if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 120) return;
      var u = Number(c.u) || 0;
      var json = JSON.stringify(c);
      if (json.length > ARCH_MAX) { rejected.push(c.id); return; }
      var i = at[c.id];
      if (i !== undefined && Number(rows[i][1]) > u) return;
      if (i !== undefined && Number(rows[i][1]) === u && join_([rows[i][3]]) === json) return;
      rev += 1;
      var row = ['~' + c.id, u, rev, '~' + json];
      if (i === undefined) { at[c.id] = rows.length; rows.push(row); } else { rows[i] = row; changed[i] = true; }
    });
    var idx = Object.keys(changed).map(Number);
    if (idx.length > 40) sh.getRange(1, 1, orig, 4).setValues(rows.slice(0, orig));
    else idx.forEach(function (i) { sh.getRange(i + 1, 1, 1, 4).setValues([rows[i]]); });
    if (rows.length > orig) { ensureRows_(sh, rows.length); sh.getRange(orig + 1, 1, rows.length - orig, 4).setValues(rows.slice(orig)); }
    if (rev !== rev0) p.setProperty('ARCH_REV', String(rev));
    var since = Number(req.since) || 0, out = [];
    rows.forEach(function (r) { if (Number(r[2]) > since) out.push(JSON.parse(join_([r[3]]))); });
    return { ok: true, rev: rev, records: out, rejected: rejected };
  } finally {
    lock.releaseLock();
  }
}

/* List `prepisy`: id | text po kusech. Přepis se stahuje, až když se díl otevře. */
function trRow_(sh, id) {
  var last = sh.getLastRow();
  if (!last) return -1;
  var ids = sh.getRange(1, 1, last, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).replace(/^~/, '') === id) return i + 1;
  return -1;
}
function trPut_(req) {
  if (typeof req.id !== 'string' || !req.id || typeof req.text !== 'string') return { ok: false, error: 'data' };
  if (req.text.length > 2000000) return { ok: false, error: 'velky' };
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = sheet_('prepisy');
    var r = trRow_(sh, req.id);
    var cells = ['~' + req.id].concat(req.text ? chunks_(req.text) : []);
    if (r < 0) { r = sh.getLastRow() + 1; ensureRows_(sh, r); }
    var w = Math.max(cells.length, sh.getLastColumn() || 1);
    if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
    while (cells.length < w) cells.push('');
    sh.getRange(r, 1, 1, w).setValues([cells]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
function trGet_(req) {
  var sh = sheet_('prepisy');
  var r = trRow_(sh, String(req.id || ''));
  if (r < 0) return { ok: true, text: '' };
  var w = sh.getLastColumn();
  return { ok: true, text: w > 1 ? join_(sh.getRange(r, 2, 1, w - 1).getValues()[0]) : '' };
}
