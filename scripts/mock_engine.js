/* Místní náhrada Google motoru pro testy: spustí skutečný motor/Code.gs nad napodobenou Tabulkou. */
const fs = require('fs'), http = require('http'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const PORT = Number(process.argv[2] || 8787), KEY = process.argv[3] || 'k'.repeat(64);
const sheets = {}, props = { KEY };
class Sheet {
  constructor() { this.rows = []; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxColumns() { return 26; } getMaxRows() { return 1000; } insertColumnsAfter() {} insertRowsAfter() {}
  clearContents() { this.rows = []; }
  getRange(r, c, nr, nc) {
    const self = this;
    return {
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((self.rows[r - 1 + i] || [])[c - 1 + j] ?? ''); out.push(row); } return out; },
      setValues(v) {
        v.forEach((row, i) => {
          self.rows[r - 1 + i] = row.map(x => {
            if (typeof x === 'string' && x.length > 50000) throw new Error('Buňka nesmí mít přes 50 000 znaků');
            if (typeof x === 'string' && /^=/.test(x)) throw new Error('Tabulka by to vzala jako vzorec: ' + x.slice(0, 20));
            return typeof x === 'string' && /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x; // Tabulka si čísla v textu převádí sama
          });
        });
      }
    };
  }
}
const sandbox = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet()) }), getUi: () => ({}) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  Utilities: { getUuid: () => crypto.randomUUID(), formatDate: d => d.toISOString().slice(0, 10) },
  ScriptApp: { getService: () => ({ getUrl: () => `http://localhost:${PORT}/exec` }) },
  HtmlService: {}, JSON, Date, Math, String, Number, Array, Object, console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'motor', 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'GET' && req.url === '/__state') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ sheets: Object.fromEntries(Object.entries(sheets).map(([k, s]) => [k, s.rows])), props })); }
  if (req.method === 'GET') { res.writeHead(200, cors); return res.end(sandbox.doGet().s); }
  if (req.method !== 'POST') { res.writeHead(405, cors); return res.end(); }
  if ((req.headers['content-type'] || '').indexOf('text/plain') !== 0) { res.writeHead(415, cors); return res.end('appka musí posílat text/plain, jinak prohlížeč pošle preflight, který Apps Script neumí'); }
  let body = '';
  req.on('data', d => { body += d; });
  req.on('end', () => { const out = sandbox.doPost({ postData: { contents: body } }); res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(out.s); });
}).listen(PORT, () => console.log('mock motor na', PORT));
