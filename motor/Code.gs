/**
 * Asistent – motor.
 * Skript patří k jedné Google Tabulce a smí sahat jen na ni (oprávnění
 * spreadsheets.currentonly). Appka mu posílá svůj stav, motor ho sloučí
 * s uloženým a vrátí výsledek. Každý požadavek musí nést klíč.
 *
 * @OnlyCurrentDoc
 */
var PUBLIC_URL = 'https://larsfriis-kbz.github.io/asistent/';
var NAMES = ['items', 'notes', 'projects'];
var CHUNK = 40000;
var BACKUPS = 14;

/* Sloučení dvou stavů. Stejný kód běží v appce i v motoru.
   Záznam vyhrává podle novějšího času úpravy `u`; smazání je značka v `tomb`. */
function mergeState(a, b, now) {
  var NAMES = ['items', 'notes', 'projects'];
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
  SpreadsheetApp.getUi().createMenu('Asistent').addItem('Propojit zařízení', 'showConnect').addToUi();
}

function key_() {
  var p = PropertiesService.getScriptProperties();
  var k = p.getProperty('KEY');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); p.setProperty('KEY', k); }
  return k;
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
    if (req.op === 'ping' && !req.key) out = { ok: true, app: 'asistent', v: 1 };
    else if (!same_(String(req.key || ''), key_())) out = { ok: false, error: 'auth' };
    else out = handle_(req);
  } catch (err) {
    out = { ok: false, error: 'server', detail: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function same_(a, b) {
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function handle_(req) {
  switch (req.op) {
    case 'ping': return { ok: true, app: 'asistent', v: 1, auth: true };
    case 'sync': return sync_(req);
    case 'thoughts': return thoughts_(req);
    case 'putThoughts': return putThoughts_(req);
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
