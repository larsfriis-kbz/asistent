(() => {
'use strict';

/* ================= pomůcky ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (s, n) => { const d = parseYmd(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return ymd(d); };
const mondayOf = s => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const DAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const DAYS_SHORT = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const MONTHS = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = s => { const d = parseYmd(s); return `${DAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`; };
const fmtShort = s => { const d = parseYmd(s); return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`; };
const fmtMin = m => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
const plural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);

/* ================= úložiště =================
   Zatím jen tento prohlížeč. Vrstva Store je jediné místo, které se
   v dalším řezu vymění za synchronizaci s motorem v Googlu. */
const KEY = 'asistent.v1';
const mem = {};
let persistOk = true;
const Store = {
  read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { persistOk = false; return mem.data || null; } },
  write(d) { mem.data = d; try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }
};

const PAPER = [
  { id: 'zluta', hex: '#FFE873', name: 'Žlutá' },
  { id: 'ruzova', hex: '#FFB3C7', name: 'Růžová' },
  { id: 'modra', hex: '#A9D4FF', name: 'Modrá' },
  { id: 'zelena', hex: '#B5E8A8', name: 'Zelená' },
  { id: 'oranzova', hex: '#FFC98A', name: 'Oranžová' },
  { id: 'fialova', hex: '#D6C2FF', name: 'Fialová' }
];
const ENVS = { prace: { name: 'YouTube Jedi Master', sub: 'práce', color: '#D3291C' }, osobni: { name: 'More Life', sub: 'osobní', color: '#1C7C54' } };

let SEED = null;
try { SEED = JSON.parse($('#seed-state').textContent || 'null'); } catch (e) { SEED = null; }
const COLS = ['items', 'notes', 'projects'];
const META = ['capacity', 'colorNames', 'activities', 'game', 'run', 'skip'];

function seed() {
  const t = today();
  const sat = addDays(mondayOf(t), 5) >= t ? addDays(mondayOf(t), 5) : addDays(mondayOf(t), 12);
  const base = { v: 2, env: 'prace', theme: 'auto', capacity: 480, colorNames: { prace: {}, osobni: {} }, projects: [], notes: [], items: [], activities: {}, game: { xp: 0, days: [] }, run: null, skip: { date: t, prace: 0, osobni: 0 }, tomb: { items: {}, notes: {}, projects: {} }, metaU: 0 };
  if (SEED) {
    base.projects = JSON.parse(JSON.stringify(SEED.projects || []));
    base.notes = (SEED.notes || []).map(n => ({ ...n, created: Date.now() }));
    base.items = (SEED.items || []).map(i => ({ ...i, date: i.date === '@sobota' ? sat : i.date }));
  }
  return base;
}

let S = Store.read() || seed();
(function migrate() {
  const d = seed();
  for (const k of Object.keys(d)) if (S[k] === undefined) S[k] = (k === 'v') ? 1 : d[k];
  if (!S.colorNames.prace) S.colorNames = { prace: {}, osobni: {} };
  if (S.v < 2) {
    if (SEED) { /* první verze měla náhodná id projektů; sjednotit je s pevnými */
      const map = {};
      for (const sp of SEED.projects || []) {
        const p = S.projects.find(x => x.env === sp.env && x.name === sp.name && x.id !== sp.id);
        if (!p) continue;
        map[p.id] = sp.id; p.id = sp.id;
        for (const st of sp.types || []) { const tt = p.types.find(x => x.name === st.name); if (tt) { map[tt.id] = st.id; tt.id = st.id; } }
      }
      for (const r of [...S.items, ...S.notes]) { if (map[r.projectId]) r.projectId = map[r.projectId]; if (map[r.typeId]) r.typeId = map[r.typeId]; }
    }
    const now = Date.now();
    for (const c of COLS) for (const r of S[c]) if (!r.u) r.u = now;
    S.metaU = S.metaU || now; S.v = 2;
  }
})();

/* Čas úpravy `u` a značky smazání se dopočítají při každém uložení porovnáním s posledním známým stavem. */
const bare = r => { const { u, ...x } = r; return JSON.stringify(x); };
const metaObj = () => { const m = {}; for (const k of META) m[k] = S[k]; return m; };
let shadow = {}, shadowMeta = '';
function reshadow() { shadow = {}; for (const c of COLS) { shadow[c] = {}; for (const r of S[c]) shadow[c][r.id] = bare(r); } shadowMeta = JSON.stringify(metaObj()); }
function stamp() {
  const now = Date.now(); let changed = false;
  for (const c of COLS) {
    const seen = {};
    for (const r of S[c]) { seen[r.id] = 1; const j = bare(r); if (shadow[c][r.id] !== j) { r.u = now; shadow[c][r.id] = j; changed = true; } }
    for (const id of Object.keys(shadow[c])) if (!seen[id]) { S.tomb[c][id] = now; delete shadow[c][id]; changed = true; }
  }
  const mj = JSON.stringify(metaObj());
  if (mj !== shadowMeta) { S.metaU = now; shadowMeta = mj; changed = true; }
  return changed;
}
reshadow();
const save = () => { const ch = stamp(); persistOk = Store.write(S); if (ch) Sync.touch(); };


const ui = { view: 'dnes', week: mondayOf(today()), weekFilter: 'vse', noteColor: 'zluta', fColor: '', fProject: '', showDone: false, why: false, target: null, toastTimer: 0 };

/* ================= myšlenky ================= */
let THOUGHTS = [], SEED_THOUGHTS = [];
try { SEED_THOUGHTS = JSON.parse($('#seed-thoughts').textContent || '[]'); } catch (e) { SEED_THOUGHTS = []; }
const TKEY = 'asistent.thoughts';
const WORK_RE = /Kariéra|byznys|obsah|Komunikace|Pozornost|ADHD|Produktiv|AI,|Dopamin|Motivace|Návyky|Mindset|Cíle/i;
const NOT_PERSONAL_RE = /Kariéra|byznys|AI,/i;
let POOL = { prace: [], osobni: [] };
function setThoughts(list) {
  THOUGHTS = Array.isArray(list) ? list : [];
  POOL = {
    prace: THOUGHTS.filter(t => WORK_RE.test(t.k) && t.t.length <= 320),
    osobni: THOUGHTS.filter(t => !NOT_PERSONAL_RE.test(t.k) && t.t.length <= 320)
  };
}
if (SEED_THOUGHTS.length) setThoughts(SEED_THOUGHTS);
else { try { setThoughts(JSON.parse(localStorage.getItem(TKEY) || '[]')); } catch (e) { setThoughts([]); } }
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function thought() {
  const pool = POOL[S.env];
  if (!pool || !pool.length) return null;
  if (S.skip.date !== today()) S.skip = { date: today(), prace: 0, osobni: 0 };
  return pool[(hash(today() + S.env) + S.skip[S.env] * 7919) % pool.length];
}

/* ================= data ================= */
const colorOf = id => PAPER.find(c => c.id === id) || PAPER[0];
const colorName = (id, env = S.env) => (S.colorNames[env] && S.colorNames[env][id]) || colorOf(id).name;
const project = id => S.projects.find(p => p.id === id);
const typeName = (pid, tid) => { const p = project(pid); const t = p && p.types.find(x => x.id === tid); return t ? t.name : ''; };
const itemLabel = it => { const p = project(it.projectId); if (!p) return null; const tn = typeName(it.projectId, it.typeId); return { text: tn && tn !== p.name ? `${p.name} / ${tn}` : p.name, color: p.color }; };
const itemColor = it => { const p = project(it.projectId); return p ? p.color : ENVS[it.env].color; };
const bySlot = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.title.localeCompare(b.title, 'cs');
const itemsOn = (date, env) => S.items.filter(i => i.date === date && (!env || i.env === env)).sort(bySlot);
const overdue = env => S.items.filter(i => !i.done && i.date && i.date < today() && i.env === env).sort((a, b) => a.date.localeCompare(b.date));
const KIND = { vysilani: 'Vysílání', ukol: 'Úkol', blok: 'Blok času' };
const actKey = it => it.typeId ? `typ:${it.typeId}:${it.kind}` : `n:${it.title.trim().toLowerCase()}`;
const usual = it => S.activities[actKey(it)];
const recurText = r => !r ? '' : `každ${r.unit === 'd' ? (r.every === 1 ? 'ý den' : `é ${r.every} dny`) : r.unit === 'w' ? (r.every === 1 ? 'ý týden' : `é ${r.every} týdny`) : (r.every === 1 ? 'ý měsíc' : `é ${r.every} měsíce`)}`;
const nextDate = (base, r) => r.unit === 'd' ? addDays(base, r.every) : r.unit === 'w' ? addDays(base, 7 * r.every) : addMonths(base, r.every);

function streak() {
  const set = new Set(S.game.days);
  let d = today(), n = 0;
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const level = () => Math.floor(S.game.xp / 100) + 1;

function learn(it) {
  if (!it.actual || it.actual < 1) return;
  const k = actKey(it), a = S.activities[k] || { n: 0, avg: 0, label: it.typeId ? `${typeName(it.projectId, it.typeId)} (${KIND[it.kind].toLowerCase()})` : it.title.trim() };
  a.avg = (a.avg * a.n + it.actual) / (a.n + 1); a.n += 1;
  S.activities[k] = a;
}

function complete(it) {
  it.done = true; it.doneAt = Date.now();
  learn(it);
  let gain = 10 + (it.est ? Math.min(20, Math.round(it.est / 15)) : 0);
  let bonus = 0;
  if (Math.random() < 0.3) bonus = 5 * (1 + Math.floor(Math.random() * 5));
  S.game.xp += gain + bonus;
  if (!S.game.days.includes(today())) { S.game.days.push(today()); S.game.days = S.game.days.slice(-120); }
  if (it.recur) {
    const base = it.date && it.date > today() ? it.date : today();
    S.items.push({ ...it, id: uid(), done: false, doneAt: undefined, actual: 0, date: nextDate(base, it.recur) });
  }
  return `Hotovo: ${it.title}. +${gain} bodů${bonus ? ` a bonus ${bonus}` : ''}.${archiveFromItem(it)}`;
}

/* ================= synchronizace s motorem ================= */
/*__MERGE__*/
const CKEY = 'asistent.cfg';
const PUBLIC_URL = 'https://larsfriis-kbz.github.io/asistent/';
const b64u = { enc: o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: t => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/'))))) };
function parseLink(text) {
  const m = /pripojit=([A-Za-z0-9_-]+)/.exec(text || '') || /^([A-Za-z0-9_-]{40,})$/.exec((text || '').trim());
  if (!m) return null;
  try { const o = b64u.dec(m[1]); return o && /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)/.test(o.u || '') && o.k ? { url: o.u, key: o.k } : null; } catch (e) { return null; }
}
const toWire = () => ({ cols: { items: S.items, notes: S.notes, projects: S.projects }, tomb: S.tomb, meta: { ...metaObj(), u: S.metaU || 0 } });
function applyWire(w) {
  for (const c of COLS) { S[c] = w.cols[c] || []; S.tomb[c] = (w.tomb && w.tomb[c]) || {}; }
  if (w.meta && (Number(w.meta.u) || 0) > (S.metaU || 0)) { for (const k of META) if (w.meta[k] !== undefined) S[k] = w.meta[k]; S.metaU = Number(w.meta.u) || 0; }
}
const sig = () => JSON.stringify([S.items, S.notes, S.projects, metaObj()]);
const Sync = {
  cfg: null, busy: false, dirty: false, last: 0, error: '', timer: 0,
  init() { try { this.cfg = JSON.parse(localStorage.getItem(CKEY) || 'null'); } catch (e) { this.cfg = null; } },
  connect(cfg) { this.cfg = cfg; this.error = ''; try { localStorage.setItem(CKEY, JSON.stringify(cfg)); } catch (e) {} },
  disconnect() { this.cfg = null; this.last = 0; this.error = ''; try { localStorage.removeItem(CKEY); } catch (e) {} },
  touch() { this.dirty = true; this.plan(2000); },
  plan(ms) { if (!this.cfg) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.now(), ms); },
  async call(body) {
    const r = await fetch(this.cfg.url, { method: 'POST', body: JSON.stringify({ key: this.cfg.key, ...body }), redirect: 'follow' });
    if (!r.ok) throw new Error('net');
    return r.json();
  },
  async now() {
    if (!this.cfg || this.busy) return;
    this.busy = true; this.dirty = false; paintSync();
    try {
      const res = await this.call({ op: 'sync', ...toWire() });
      if (!res || !res.ok) throw new Error((res && res.error) || 'net');
      const before = sig();
      applyWire(mergeState(res, toWire(), Date.now()));
      reshadow(); persistOk = Store.write(S);
      this.last = Date.now(); this.error = '';
      if (sig() !== before) softRender();
      Arch.sync();
    } catch (e) { this.error = e && e.message === 'auth' ? 'auth' : 'net'; }
    this.busy = false; paintSync();
    if (this.dirty) this.plan(1500);
  },
  async thoughts() {
    if (!this.cfg) return;
    try {
      const head = await this.call({ op: 'thoughts', head: true });
      if (!head || !head.ok) return;
      if (SEED_THOUGHTS.length) { if (head.n !== SEED_THOUGHTS.length) await this.call({ op: 'putThoughts', thoughts: SEED_THOUGHTS }); return; }
      if (head.n && head.n !== THOUGHTS.length) {
        const r = await this.call({ op: 'thoughts' });
        if (r && r.ok && Array.isArray(r.thoughts)) { setThoughts(r.thoughts); try { localStorage.setItem(TKEY, JSON.stringify(r.thoughts)); } catch (e) {} softRender(); }
      }
    } catch (e) { /* zkusí se při dalším otevření */ }
  },
  text() {
    if (!this.cfg) return 'Data jen v tomto zařízení';
    if (this.error === 'auth') return 'Motor odmítl klíč. Propoj zařízení znovu.';
    if (this.busy && !this.last) return 'Synchronizuji…';
    if (this.error) return this.last ? `Bez spojení. Naposledy ${hm(this.last)}` : 'Bez spojení s motorem';
    return this.last ? `Synchronizováno ${hm(this.last)}` : 'Čeká na první synchronizaci';
  }
};
const hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function paintSync() { document.querySelectorAll('[data-sync]').forEach(el => { el.textContent = Sync.text(); }); }
let pendingRender = false;
function softRender() {
  const a = document.activeElement;
  const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'file';
  if (dlg().open || typing) { pendingRender = true; return; }
  pendingRender = false; render();
}
Sync.init();

/* ================= časovač ================= */
let tick = 0;
const elapsedSec = () => S.run ? Math.max(0, Math.floor((Date.now() - S.run.start) / 1000)) : 0;
function startRun(id) {
  if (S.run) stopRun(false);
  S.run = { id, start: Date.now() };
  ui.target = id;
  save(); render();
}
function stopRun(done) {
  if (!S.run) return '';
  const it = S.items.find(i => i.id === S.run.id);
  const mins = Math.max(1, Math.round(elapsedSec() / 60));
  S.run = null;
  let msg = '';
  if (it) {
    it.actual = (it.actual || 0) + mins;
    msg = done ? complete(it) : `Zapsáno ${fmtMin(mins)} u „${it.title}“.`;
  }
  document.title = 'Asistent';
  return msg;
}
function paintTimer() {
  const el = $('#clock'); if (!S.run) return;
  const s = elapsedSec();
  const txt = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  document.title = `${txt} · Asistent`;
  if (!el) return;
  el.textContent = txt;
  const it = S.items.find(i => i.id === S.run.id);
  const C = 339.3;
  const frac = s < 300 ? s / 300 : (it && it.est ? Math.min(1, s / (it.est * 60)) : 1);
  const prog = $('#ringprog'); if (prog) prog.style.strokeDashoffset = String(C * (1 - frac));
  const note = $('#runnote');
  if (note) note.textContent = s < 300 ? 'Stačí vydržet prvních pět minut.' : (it && it.est ? `Pět minut je za tebou. Odhad na celou věc: ${fmtMin(it.est)}.` : 'Pět minut je za tebou. Jedeš dál, nebo to pro teď stačí?');
}

/* ================= toast s možností vrátit ================= */
function toast(msg, snap, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${snap || undo ? '<button type="button" data-action="undo">Vrátit</button>' : ''}`;
  t.hidden = false; t._snap = snap || null; t._undo = undo || null;
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => { t.hidden = true; }, 7000);
}
const snapshot = () => JSON.stringify(S);

/*__ARCHIVE__*/

/* ================= vykreslení ================= */
function chip(it) { const l = itemLabel(it); return l ? `<span class="chip" style="--c:${l.color}"><i></i>${esc(l.text)}</span>` : ''; }

function rowHTML(it, showDate) {
  const live = S.run && S.run.id === it.id;
  const meta = [chip(it), it.kind !== 'ukol' ? `<span class="chip">${KIND[it.kind]}</span>` : '', it.recur ? `<span class="chip">Opakuje se ${recurText(it.recur)}</span>` : '', showDate && it.date ? `<span class="chip">${cap(fmtShort(it.date))}</span>` : ''].filter(Boolean).join('');
  const est = it.done && it.actual ? `${fmtMin(it.actual)} skutečně` : (it.est ? fmtMin(it.est) : 'bez odhadu');
  return `<li class="row${it.done ? ' is-done' : ''}${live ? ' is-live' : ''}" data-id="${it.id}">
    <button class="check" type="button" data-action="toggle" aria-pressed="${it.done ? 'true' : 'false'}" aria-label="${it.done ? 'Vrátit mezi nehotové' : 'Označit jako hotové'}: ${esc(it.title)}"></button>
    <span class="row-time${it.time ? '' : ' none'}">${it.time || '--:--'}</span>
    <button class="row-main" type="button" data-action="edit"><span class="row-title">${esc(it.title)}</span>${meta ? `<span class="row-meta">${meta}</span>` : ''}</button>
    <span class="row-est">${est}</span>
    <button class="row-go" type="button" data-action="start">${live ? 'Běží' : 'Start'}</button>
  </li>`;
}

function noteHTML(n) {
  const c = colorOf(n.color), p = project(n.projectId), tn = typeName(n.projectId, n.typeId);
  const where = p ? (tn && tn !== p.name ? tn : p.name) : '';
  const d = new Date(n.created);
  return `<button class="note" type="button" style="--paper:${c.hex}" data-action="note-edit" data-id="${n.id}">
    <span class="txt">${esc(n.text)}</span>
    <span class="foot"><span>${esc(where)}</span><span>${d.getDate()}. ${d.getMonth() + 1}.</span></span>
  </button>`;
}

function projectOptions(env, pid, tid) {
  const sel = `${pid || ''}|${tid || ''}`;
  let h = `<option value="|">Bez zařazení</option>`;
  for (const p of S.projects.filter(p => p.env === env)) {
    if (!p.types.length) { h += `<option value="${p.id}|"${sel === p.id + '|' ? ' selected' : ''}>${esc(p.name)}</option>`; continue; }
    h += `<optgroup label="${esc(p.name)}"><option value="${p.id}|"${sel === p.id + '|' ? ' selected' : ''}>${esc(p.name)} – celý projekt</option>`;
    for (const t of p.types) h += `<option value="${p.id}|${t.id}"${sel === `${p.id}|${t.id}` ? ' selected' : ''}>${esc(t.name)}</option>`;
    h += `</optgroup>`;
  }
  return h;
}

function viewDnes() {
  const t = today(), env = S.env;
  const list = itemsOn(t, env), late = overdue(env);
  const open = list.filter(i => !i.done), doneN = list.length - open.length;
  const planned = list.reduce((s, i) => s + (i.est || 0), 0);
  const th = thought();
  const cand = S.run ? S.items.find(i => i.id === S.run.id) : (S.items.find(i => i.id === ui.target && !i.done) || open[0] || late[0] || null);
  const notes = S.notes.filter(n => n.env === env).sort((a, b) => b.created - a.created).slice(0, 4);
  const sum = list.length
    ? `Na dnešek ${list.length} ${plural(list.length, 'věc', 'věci', 'věcí')}, dohromady ${fmtMin(planned)}. Hotovo ${doneN}.`
    : 'Na dnešek zatím nic naplánovaného.';

  const prompter = th ? `<section class="prompter" aria-label="Myšlenka dne">
      <blockquote>${esc(th.t)}</blockquote>
      ${ui.why && th.w ? `<p class="why">Proč to funguje: ${esc(th.w)}</p>` : ''}
      <p class="src">${esc(th.k)}, ${esc(th.s)}</p>
      <div class="acts">
        <button class="btn" type="button" data-action="thought-next">Jiná myšlenka</button>
        ${th.w ? `<button class="btn" type="button" data-action="thought-why" aria-expanded="${ui.why}">${ui.why ? 'Skrýt důvod' : 'Proč to funguje'}</button>` : ''}
        <button class="btn" type="button" data-action="thought-save">Uložit jako lístek</button>
      </div>
    </section>` : '';

  let sw;
  if (!cand) {
    sw = `<p class="empty">Přidej do plánu dne první věc. Spínač ti k ní nabídne pětiminutový start.</p>`;
  } else if (S.run) {
    sw = `<p class="what">${esc(cand.title)}</p>
      ${cand.firstStep ? `<p>První krok: ${esc(cand.firstStep)}</p>` : ''}
      <div class="go">
        <div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="54"/><circle class="prog" id="ringprog" cx="60" cy="60" r="54" stroke-dasharray="339.3" stroke-dashoffset="339.3"/></svg><div class="clock" id="clock" role="timer">00:00</div></div>
        <div class="side"><p id="runnote">Stačí vydržet prvních pět minut.</p>
          <div class="btns"><button class="btn primary" type="button" data-action="run-done">Hotovo</button><button class="btn" type="button" data-action="run-stop">Přerušit</button></div></div>
      </div>`;
  } else {
    const u = usual(cand);
    sw = `<p class="what">${esc(cand.title)}</p>
      <label>První krok na 5 minut
        <input type="text" id="firststep" data-id="${cand.id}" value="${esc(cand.firstStep || '')}" placeholder="Například: otevřít projekt a pojmenovat soubor" autocomplete="off">
      </label>
      <div class="go">
        <div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="54"/></svg><button type="button" data-action="run-start" data-id="${cand.id}"><span>Start<small>5 minut</small></span></button></div>
        <div class="side"><p>${cand.est ? `Odhad ${fmtMin(cand.est)}.` : 'Bez odhadu času.'}${u ? ` Obvykle ti to trvá ${fmtMin(u.avg)} (${u.n}×).` : ''} Po pěti minutách se rozhodneš, jestli jedeš dál.</p></div>
      </div>`;
  }

  const hello = !Sync.cfg && !SEED && !S.items.length && !S.notes.length && !S.projects.length
    ? `<section class="panel" style="margin-bottom:22px"><h2>Tohle zařízení ještě není propojené</h2><p class="sub" style="margin:0 0 12px">Otevři Tabulku s motorem, v nabídce Asistent zvol Propojit zařízení a odkaz vlož v Nastavení.</p><button class="btn primary" type="button" data-action="nav" data-view="nastaveni">Otevřít Nastavení</button></section>` : '';
  return `<div class="head"><div><h1>${cap(fmtDate(t))}</h1><p>${sum}</p></div></div>
  ${hello}${prompter}
  <div class="cols">
    <div class="stack">
      <section class="panel">
        <h2>Plán dne</h2>
        <form class="quick" data-form="quick-item" autocomplete="off">
          <input type="text" name="title" placeholder="Co chceš dnes udělat" aria-label="Co chceš dnes udělat" required>
          <input type="number" name="est" min="1" max="1440" placeholder="min" aria-label="Odhad v minutách">
          <button class="btn primary">Přidat</button>
        </form>
        ${list.length ? `<ul class="rows">${list.map(i => rowHTML(i)).join('')}</ul>
        <p class="rowsum"><span>Zbývá <b>${fmtMin(open.reduce((s, i) => s + (i.est || 0), 0))}</b></span><span>Plán celkem <b>${fmtMin(planned)}</b></span></p>` : `<p class="empty">Zatím prázdno. Vysílání s časem přidáš přes Týden, rychlou věc tady nahoře.</p>`}
      </section>
      ${late.length ? `<section class="panel"><h2>Zůstalo z dřívějška</h2><ul class="rows">${late.map(i => rowHTML(i, true)).join('')}</ul></section>` : ''}
    </div>
    <div class="stack">
      <section class="panel"><h2>Spínač</h2><div class="switch">${sw}</div></section>
      <section class="panel"><h2>Poslední lístky</h2>
        ${notes.length ? `<div class="board mini">${notes.map(noteHTML).join('')}</div>` : `<p class="empty">Žádný lístek. Napiš první.</p>`}
        <p style="margin-top:14px"><button class="btn" type="button" data-action="note-new">Nový lístek</button></p>
      </section>
    </div>
  </div>`;
}

function viewTyden() {
  const start = ui.week, t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const f = ui.weekFilter;
  const pick = d => S.items.filter(i => i.date === d && (f === 'vse' || i.env === f)).sort(bySlot);
  let tot = { prace: 0, osobni: 0 };
  const cols = days.map(d => {
    const list = pick(d);
    const mins = list.reduce((s, i) => s + (i.est || 0), 0);
    list.forEach(i => { tot[i.env] += i.est || 0; });
    const pct = Math.min(100, Math.round(mins / S.capacity * 100));
    return `<section class="day${d === t ? ' today' : ''}">
      <header><h2>${cap(fmtShort(d))}<span>${mins ? fmtMin(mins) : 'volno'}</span></h2>
        <div class="load${mins > S.capacity ? ' over' : ''}" role="img" aria-label="Zaplněno ${Math.round(mins / S.capacity * 100)} % dne"><i style="width:${pct}%"></i></div></header>
      ${list.length ? `<ul class="blks">${list.map(i => `<li><button type="button" class="blk${i.done ? ' done' : ''}" data-action="edit" data-id="${i.id}" style="--c:${itemColor(i)};--h:${Math.max(48, Math.min(200, Math.round((i.est || 0) * 0.75)))}px">
          <b>${i.time ? i.time + ' ' : ''}${esc(i.title)}</b><span>${i.est ? fmtMin(i.est) : 'bez odhadu'}${f === 'vse' ? ', ' + ENVS[i.env].sub : ''}</span></button></li>`).join('')}</ul>` : ''}
      <button type="button" class="add" data-action="item-new" data-date="${d}">Přidat</button>
    </section>`;
  }).join('');
  const a = parseYmd(days[0]), b = parseYmd(days[6]);
  const title = a.getMonth() === b.getMonth() ? `${a.getDate()}.–${b.getDate()}. ${MONTHS[b.getMonth()]}` : `${a.getDate()}. ${MONTHS[a.getMonth()]} – ${b.getDate()}. ${MONTHS[b.getMonth()]}`;
  const all = tot.prace + tot.osobni;
  return `<div class="head"><div><h1>Týden ${title}</h1><p>Plný den počítám jako ${fmtMin(S.capacity)}. Změníš v Nastavení.</p></div>
    <div class="weektools">
      <div class="seg" role="group" aria-label="Posun týdne"><button type="button" data-action="week" data-step="-1" aria-pressed="false">Předchozí</button><button type="button" data-action="week" data-step="0" aria-pressed="${start === mondayOf(t)}">Tento</button><button type="button" data-action="week" data-step="1" aria-pressed="false">Další</button></div>
      <div class="seg" role="group" aria-label="Co zobrazit">${[['vse', 'Vše'], ['prace', 'Práce'], ['osobni', 'Osobní']].map(([k, l]) => `<button type="button" data-action="weekfilter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
    </div></div>
  <div class="week">${cols}</div>
  <p class="weeksum">${all ? `Naplánováno ${fmtMin(all)}: práce ${fmtMin(tot.prace)}, osobní ${fmtMin(tot.osobni)}.` : 'Tenhle týden je prázdný. Začni vysíláními, pak přidej fitko.'}</p>`;
}

function viewUkoly() {
  const env = S.env, t = today(), weekEnd = addDays(t, 7);
  const mine = S.items.filter(i => i.env === env);
  const open = mine.filter(i => !i.done);
  const G = [
    ['Po termínu', open.filter(i => i.date && i.date < t), 'late'],
    ['Dnes', open.filter(i => i.date === t), ''],
    ['Dalších 7 dní', open.filter(i => i.date > t && i.date <= weekEnd), ''],
    ['Později', open.filter(i => i.date > weekEnd), ''],
    ['Bez data', open.filter(i => !i.date), '']
  ];
  const done = mine.filter(i => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 40);
  const groups = G.filter(g => g[1].length).map(([name, arr, cls]) => `<section class="group ${cls}"><h2>${name}<span>${arr.length}, ${fmtMin(arr.reduce((s, i) => s + (i.est || 0), 0))}</span></h2>
    <div class="panel"><ul class="rows">${arr.sort((a, b) => (a.date || '').localeCompare(b.date || '') || bySlot(a, b)).map(i => rowHTML(i, true)).join('')}</ul></div></section>`).join('');
  return `<div class="head"><div><h1>Úkoly</h1><p>${ENVS[env].name}. Otevřených ${open.length}.</p></div></div>
  <section class="panel">
    <form class="taskadd" data-form="task-add" autocomplete="off">
      <input type="text" name="title" placeholder="Nový úkol" aria-label="Nový úkol" required>
      <input type="date" name="date" aria-label="Datum" value="${t}">
      <input type="number" name="est" min="1" max="1440" placeholder="min" aria-label="Odhad v minutách">
      <select name="recur" aria-label="Opakování"><option value="">Neopakuje se</option><option value="1d">Každý den</option><option value="1w">Každý týden</option><option value="2w">Každé 2 týdny</option><option value="1m">Každý měsíc</option></select>
      <button class="btn primary">Přidat úkol</button>
    </form>
  </section>
  ${groups || `<p class="empty" style="margin-top:18px">Nic otevřeného. Přidej první úkol nahoře.</p>`}
  ${done.length ? `<section class="group"><h2>Hotovo<span>${done.length}</span> <button class="btn quiet" type="button" data-action="toggle-done">${ui.showDone ? 'Skrýt' : 'Zobrazit'}</button></h2>
    ${ui.showDone ? `<div class="panel"><ul class="rows">${done.map(i => rowHTML(i, true)).join('')}</ul></div>` : ''}</section>` : ''}`;
}

function viewListky() {
  const env = S.env;
  let notes = S.notes.filter(n => n.env === env);
  const total = notes.length;
  if (ui.fColor) notes = notes.filter(n => n.color === ui.fColor);
  if (ui.fProject) { const [pid, tid] = ui.fProject.split('|'); notes = notes.filter(n => n.projectId === pid && (!tid || n.typeId === tid)); }
  notes.sort((a, b) => b.created - a.created);
  return `<div class="head"><div><h1>Lístky</h1><p>${ENVS[env].name}. ${total} ${plural(total, 'lístek', 'lístky', 'lístků')}.</p></div></div>
  <section class="panel composer">
    <form data-form="note-add" class="composer" style="margin:0">
      <textarea name="text" placeholder="Nápad, rychlý manuál, moment z vysílání…" aria-label="Text lístku" required></textarea>
      <div class="line">
        <div class="swatches" role="group" aria-label="Barva lístku">${PAPER.map(c => `<button type="button" class="swatch" style="--paper:${c.hex}" data-action="pick-color" data-color="${c.id}" aria-pressed="${ui.noteColor === c.id}" aria-label="${esc(colorName(c.id))}" title="${esc(colorName(c.id))}"></button>`).join('')}</div>
        <select name="where" aria-label="Zařazení">${projectOptions(env, '', '')}</select>
        <button class="btn primary">Přilepit lístek</button>
      </div>
    </form>
  </section>
  <div class="filters">
    <button type="button" class="fchip" data-action="fcolor" data-color="" aria-pressed="${!ui.fColor}">Všechny barvy</button>
    ${PAPER.map(c => `<button type="button" class="fchip" data-action="fcolor" data-color="${c.id}" aria-pressed="${ui.fColor === c.id}"><i style="--paper:${c.hex}"></i>${esc(colorName(c.id))}</button>`).join('')}
    <select data-change="fproject" aria-label="Filtr podle zařazení">${projectOptions(env, ...(ui.fProject || '|').split('|')).replace('Bez zařazení', 'Všechna zařazení')}</select>
  </div>
  ${notes.length ? `<div class="board">${notes.map(noteHTML).join('')}</div>` : `<p class="empty">${total ? 'Tomuhle filtru nic neodpovídá.' : 'Tady zatím nic nevisí. Napiš první lístek nahoře.'}</p>`}`;
}

const SLICES = [
  ['Základ v prohlížeči', 'Dnes, přepínač prostředí, myšlenka dne, plán dne, spínač, týden s časy, úkoly s opakováním, barevné lístky.', true],
  ['Motor v Googlu a nasazení', 'Data v tvé Google Tabulce, stejný stav na telefonu i počítači, appka na ploše, práce i bez signálu.', false],
  ['Archiv vysílání', 'Import z Notionu, projekty a typy pořadů, účastníci, poznámky a přepisy s časovými značkami.', true],
  ['YouTube a Herohero čísla', 'Analytika u každého dílu a live dashboard za všechny kanály.', false],
  ['Schránka a Research', 'Jedno místo, kam si věci přepošleš; Claude je roztřídí.', false],
  ['More Life moduly', 'MEDIUM 360, Fitness s Ourou, Finance, Trip Planner, BucketLIST, Journal, Books, Recipes.', false]
];

function viewNastaveni() {
  const acts = Object.entries(S.activities).sort((a, b) => b[1].n - a[1].n);
  const env = S.env;
  return `<div class="head"><div><h1>Nastavení</h1><p>Úpravy platí hned.</p></div></div>
  <div class="settings">
    <div class="stack">
      <section class="panel"><h2>Propojení a data</h2>
        ${!persistOk ? `<p class="notice">Tenhle prohlížeč si data po zavření nepamatuje. Otevři appku z její adresy nebo ze souboru.</p>` : ''}
        ${Sync.cfg ? `<p class="sub" data-sync>${esc(Sync.text())}</p>
          <p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-action="sync-now">Synchronizovat teď</button><button class="btn" type="button" data-action="show-link">Připojit další zařízení</button></p>
          <div id="linkbox" hidden></div>
          <p style="margin-top:10px"><button class="btn quiet" type="button" data-action="sync-off">Odpojit toto zařízení</button></p>`
        : `<p class="sub">Data jsou zatím jen v tomhle prohlížeči. Po propojení s motorem v tvé Google Tabulce budou stejná na telefonu i počítači.</p>
          <form data-form="connect" style="display:grid;grid-template-columns:1fr auto;gap:8px" autocomplete="off"><input type="text" name="link" placeholder="Vlož propojovací odkaz z Tabulky" aria-label="Propojovací odkaz" required><button class="btn primary">Propojit</button></form>`}
        <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn" type="button" data-action="export">Stáhnout zálohu</button><label class="btn" style="display:inline-flex;align-items:center">Nahrát zálohu<input type="file" accept="application/json,.json" data-change="import" class="sr"></label></p>
      </section>
      <section class="panel"><h2>Vzhled a den</h2>
        <div class="seg" role="group" aria-label="Vzhled">${[['auto', 'Podle systému'], ['light', 'Světlý'], ['dark', 'Tmavý']].map(([k, l]) => `<button type="button" data-action="theme" data-t="${k}" aria-pressed="${S.theme === k}">${l}</button>`).join('')}</div>
        <label style="display:grid;gap:6px;margin-top:14px;color:var(--muted);font-size:15px">Kolik minut má plný den v týdenním přehledu
          <input type="number" min="60" max="1440" step="30" value="${S.capacity}" data-change="capacity" style="max-width:160px;color:var(--ink);font-size:17px"></label>
      </section>
      <section class="panel"><h2>Barvy lístků: ${ENVS[env].name}</h2><p class="sub">Pojmenuj si, co která barva znamená. Práce a osobní mají vlastní názvy.</p>
        ${PAPER.map(c => `<div class="fieldrow"><span class="swatch" style="--paper:${c.hex}"></span><input type="text" value="${esc(colorName(c.id))}" data-change="colorname" data-color="${c.id}" aria-label="Název barvy ${esc(c.name)}"></div>`).join('')}
      </section>
      <section class="panel"><h2>Kolik ti co trvá</h2>
        ${acts.length ? `<dl class="kv">${acts.map(([, a]) => `<dt>${esc(a.label)}</dt><dd>${fmtMin(a.avg)}, ${a.n}×</dd>`).join('')}</dl>` : `<p class="empty">Zatím žádná měření. Pusť věc přes Start a po dokončení se tu objeví průměr.</p>`}
      </section>
    </div>
    <div class="stack">
      <section class="panel"><h2>${env === 'prace' ? 'Projekty a typy pořadů' : 'Oblasti'}</h2>
        ${S.projects.filter(p => p.env === env).map(p => `<details class="proj"><summary><span class="chip" style="--c:${p.color}"><i></i></span>${esc(p.name)}${p.types.length ? ` (${p.types.length})` : ''}</summary>
          ${p.types.length ? `<ul>${p.types.map(t => `<li>${esc(t.name)}</li>`).join('')}</ul>` : ''}
          ${env === 'prace' ? `<form data-form="type-add" data-pid="${p.id}"><input type="text" name="name" placeholder="Nový typ pořadu" aria-label="Nový typ pořadu v ${esc(p.name)}" required><button class="btn">Přidat</button></form>` : ''}
        </details>`).join('')}
        <form data-form="project-add" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px"><input type="text" name="name" placeholder="${env === 'prace' ? 'Nový projekt' : 'Nová oblast'}" aria-label="${env === 'prace' ? 'Nový projekt' : 'Nová oblast'}" required><button class="btn">Přidat</button></form>
      </section>
      <section class="panel"><h2>Co je hotové a co přijde</h2>
        <ol class="steps">${SLICES.map(([n, d, ok]) => `<li class="${ok ? 'done' : ''}"><div><b>${n}</b><span>${d}</span></div></li>`).join('')}</ol>
      </section>
    </div>
  </div>`;
}

const VIEWS = { dnes: viewDnes, tyden: viewTyden, ukoly: viewUkoly, listky: viewListky, nastaveni: viewNastaveni, archiv: viewArchiv, dil: viewDil, vice: viewVice };
const navList = () => [['dnes', 'Dnes'], ['tyden', 'Týden'], ['ukoly', 'Úkoly'], ['listky', 'Lístky'], ...(S.env === 'prace' ? [['archiv', 'Archiv']] : []), ['nastaveni', 'Nastavení']];
const navOf = v => v === 'dil' ? 'archiv' : v;

function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.env = S.env;
  const m = $('meta[name=theme-color]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--band').trim();
}

function render() {
  applyTheme();
  const env = S.env, t = today();
  const openToday = S.items.filter(i => i.env === env && !i.done && i.date && i.date <= t).length;
  const noteN = S.notes.filter(n => n.env === env).length;
  const counts = { dnes: openToday || '', listky: noteN || '', ukoly: S.items.filter(i => i.env === env && !i.done).length || '', archiv: (env === 'prace' && Arch.list().length) || '' };
  if (env !== 'prace' && (ui.view === 'archiv' || ui.view === 'dil')) ui.view = 'dnes';
  const cur = navOf(ui.view);
  $('#envsw').innerHTML = Object.entries(ENVS).map(([k, e]) => `<button type="button" role="tab" data-action="env" data-env="${k}" aria-selected="${env === k}"><b>${e.name}</b><span>${e.sub}</span></button>`).join('');
  $('#nav').innerHTML = navList().map(([k, l]) => `<button type="button" data-action="nav" data-view="${k}"${cur === k ? ' aria-current="page"' : ''}>${l}${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</button>`).join('');
  $('#tabbar').innerHTML = [['dnes', 'Dnes'], ['tyden', 'Týden']].map(([k, l]) => `<button type="button" data-action="nav" data-view="${k}"${ui.view === k ? ' aria-current="page"' : ''}>${l}</button>`).join('')
    + `<button type="button" class="plus" data-action="note-new" aria-label="Nový lístek">+</button>`
    + [['ukoly', 'Úkoly'], ['vice', 'Další']].map(([k, l]) => `<button type="button" data-action="nav" data-view="${k}"${cur === k || (k === 'vice' && ['listky', 'archiv', 'nastaveni'].includes(cur)) ? ' aria-current="page"' : ''}>${l}</button>`).join('');
  const xp = S.game.xp, st = streak();
  $('#score').innerHTML = `<b>Úroveň ${level()}</b><div class="xpbar" role="img" aria-label="${xp % 100} ze 100 bodů do další úrovně"><i style="width:${xp % 100}%"></i></div>${xp} bodů celkem<br>${st ? `${st} ${plural(st, 'den', 'dny', 'dní')} v řadě` : 'Dnes ještě nic hotového'}<br><span data-sync>${esc(Sync.text())}</span>`;
  $('#tally').classList.toggle('on', !!S.run);
  $('#view').innerHTML = (VIEWS[ui.view] || viewDnes)();
  if (ui.view === 'dil') loadTranscript();
  clearInterval(tick);
  if (S.run) { paintTimer(); tick = setInterval(paintTimer, 1000); }
}

/* ================= dialogy ================= */
const dlg = () => $('#dlg');
function openDialog(html) { const d = dlg(); d.innerHTML = html; if (!d.open) d.showModal(); const f = d.querySelector('[autofocus]'); if (f) f.focus(); }
function closeDialog() { const d = dlg(); if (d.open) d.close(); d.innerHTML = ''; }

function itemDialog(it, isNew) {
  const u = usual(it);
  const r = it.recur ? `${it.recur.every}${it.recur.unit}` : '';
  const kinds = it.env === 'prace' ? ['vysilani', 'ukol', 'blok'] : ['ukol', 'blok'];
  openDialog(`<form class="dlg" data-form="item-save" data-id="${isNew ? '' : it.id}" autocomplete="off">
    <h2>${isNew ? 'Nová věc v plánu' : 'Upravit'}</h2>
    <label>Název<input type="text" name="title" value="${esc(it.title)}" required ${isNew ? 'autofocus' : ''}></label>
    <div class="two">
      <label>Prostředí<select name="env" data-change="dlg-env">${Object.entries(ENVS).map(([k, e]) => `<option value="${k}"${it.env === k ? ' selected' : ''}>${e.name}</option>`).join('')}</select></label>
      <label>Druh<select name="kind">${kinds.map(k => `<option value="${k}"${it.kind === k ? ' selected' : ''}>${KIND[k]}</option>`).join('')}</select></label>
    </div>
    <label>Zařazení<select name="where">${projectOptions(it.env, it.projectId, it.typeId)}</select></label>
    <div class="three">
      <label>Datum<input type="date" name="date" value="${it.date || ''}"></label>
      <label>Čas<input type="time" name="time" value="${it.time || ''}"></label>
      <label>Odhad (min)<input type="number" name="est" min="1" max="1440" value="${it.est || ''}"></label>
    </div>
    ${u ? `<p class="hint">Obvykle ti to trvá ${fmtMin(u.avg)} (měřeno ${u.n}×).</p>` : ''}
    <label>První krok na 5 minut<input type="text" name="firstStep" value="${esc(it.firstStep || '')}" placeholder="Co uděláš jako úplně první"></label>
    <div class="two">
      <label>Opakování<select name="recur">${[['', 'Neopakuje se'], ['1d', 'Každý den'], ['2d', 'Každé 2 dny'], ['1w', 'Každý týden'], ['2w', 'Každé 2 týdny'], ['1m', 'Každý měsíc'], ['3m', 'Každé 3 měsíce']].map(([k, l]) => `<option value="${k}"${r === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Skutečný čas (min)<input type="number" name="actual" min="0" max="2880" value="${it.actual || ''}"></label>
    </div>
    <div class="foot">
      ${isNew ? '<span></span>' : '<button class="btn danger" type="button" data-action="item-delete" data-id="' + it.id + '">Smazat</button>'}
      <div><button class="btn" type="button" data-action="dlg-close">Zavřít</button><button class="btn primary">Uložit</button></div>
    </div>
  </form>`);
}

function noteDialog(n, isNew) {
  openDialog(`<form class="dlg" data-form="note-save" data-id="${isNew ? '' : n.id}">
    <h2>${isNew ? 'Nový lístek' : 'Lístek'}</h2>
    <label>Text<textarea name="text" required ${isNew ? 'autofocus' : ''} style="min-height:150px">${esc(n.text)}</textarea></label>
    <div class="swatches" role="group" aria-label="Barva lístku">${PAPER.map(c => `<button type="button" class="swatch" style="--paper:${c.hex}" data-action="dlg-color" data-color="${c.id}" aria-pressed="${n.color === c.id}" aria-label="${esc(colorName(c.id, n.env))}" title="${esc(colorName(c.id, n.env))}"></button>`).join('')}</div>
    <input type="hidden" name="color" value="${n.color}">
    <div class="two">
      <label>Prostředí<select name="env" data-change="dlg-env">${Object.entries(ENVS).map(([k, e]) => `<option value="${k}"${n.env === k ? ' selected' : ''}>${e.name}</option>`).join('')}</select></label>
      <label>Zařazení<select name="where">${projectOptions(n.env, n.projectId, n.typeId)}</select></label>
    </div>
    <div class="foot">
      ${isNew ? '<span></span>' : `<div><button class="btn danger" type="button" data-action="note-delete" data-id="${n.id}">Smazat</button><button class="btn" type="button" data-action="note-to-task" data-id="${n.id}">Udělat z něj úkol</button></div>`}
      <div><button class="btn" type="button" data-action="dlg-close">Zavřít</button><button class="btn primary">Uložit</button></div>
    </div>
  </form>`);
}

const blankItem = (over = {}) => ({ id: uid(), env: S.env, kind: S.env === 'prace' && over.time ? 'vysilani' : 'ukol', title: '', date: today(), time: '', est: 0, done: false, actual: 0, projectId: '', typeId: '', firstStep: '', recur: null, ...over });
const parseRecur = v => { const m = /^(\d+)([dwm])$/.exec(v || ''); return m ? { every: +m[1], unit: m[2] } : null; };

/* ================= události ================= */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  const rowEl = b.closest('[data-id]');
  const id = b.dataset.id || (rowEl && rowEl.dataset.id);
  const item = () => S.items.find(i => i.id === id);
  switch (a) {
    case 'env': S.env = b.dataset.env; ui.fColor = ''; ui.fProject = ''; ui.target = null; ui.why = false; save(); render(); break;
    case 'nav': ui.view = b.dataset.view; render(); window.scrollTo(0, 0); break;
    case 'theme': S.theme = b.dataset.t; save(); render(); break;
    case 'thought-next': S.skip[S.env] += 1; ui.why = false; save(); render(); break;
    case 'thought-why': ui.why = !ui.why; render(); break;
    case 'thought-save': { const th = thought(); if (!th) break; const snap = snapshot(); S.notes.push({ id: uid(), env: S.env, text: `${th.t}\n\n${th.s}`, color: 'modra', projectId: '', typeId: '', created: Date.now() }); save(); render(); toast('Myšlenka je mezi lístky.', snap); break; }
    case 'toggle': { const it = item(); if (!it) break; const snap = snapshot(); let msg;
      if (it.done) { it.done = false; msg = 'Vráceno mezi nehotové.'; }
      else { if (S.run && S.run.id === it.id) msg = stopRun(true); else msg = complete(it); }
      save(); render(); toast(msg, snap); break; }
    case 'edit': { const it = item(); if (it) itemDialog(it, false); break; }
    case 'start': { const it = item(); if (!it || it.done) break; if (S.run && S.run.id === it.id) break; ui.target = it.id; if (ui.view !== 'dnes') ui.view = 'dnes'; render(); const el = $('#firststep'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); break; }
    case 'run-start': { const fs = $('#firststep'); const it = S.items.find(i => i.id === b.dataset.id); if (it && fs) it.firstStep = fs.value.trim(); startRun(b.dataset.id); break; }
    case 'run-done': { const snap = snapshot(); const msg = stopRun(true); save(); render(); toast(msg, snap); break; }
    case 'run-stop': { const snap = snapshot(); const msg = stopRun(false); save(); render(); toast(msg, snap); break; }
    case 'item-new': itemDialog(blankItem({ date: b.dataset.date || today() }), true); break;
    case 'item-delete': { const snap = snapshot(); if (S.run && S.run.id === id) S.run = null; S.items = S.items.filter(i => i.id !== id); save(); closeDialog(); render(); toast('Smazáno.', snap); break; }
    case 'note-new': noteDialog({ id: '', env: S.env, text: '', color: ui.noteColor, projectId: '', typeId: '' }, true); break;
    case 'note-edit': { const n = S.notes.find(x => x.id === id); if (n) noteDialog(n, false); break; }
    case 'note-delete': { const snap = snapshot(); S.notes = S.notes.filter(x => x.id !== id); save(); closeDialog(); render(); toast('Lístek smazán.', snap); break; }
    case 'note-to-task': { const n = S.notes.find(x => x.id === id); if (!n) break; const snap = snapshot(); S.items.push(blankItem({ env: n.env, title: n.text.split('\n')[0].slice(0, 120), projectId: n.projectId, typeId: n.typeId })); save(); closeDialog(); render(); toast('Z lístku je úkol na dnešek. Lístek zůstal.', snap); break; }
    case 'pick-color': ui.noteColor = b.dataset.color; document.querySelectorAll('.composer .swatch').forEach(s => s.setAttribute('aria-pressed', String(s.dataset.color === ui.noteColor))); break;
    case 'dlg-color': { const f = b.closest('form'); f.elements.color.value = b.dataset.color; f.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-pressed', String(s === b))); break; }
    case 'fcolor': ui.fColor = b.dataset.color; render(); break;
    case 'week': { const st = +b.dataset.step; ui.week = st === 0 ? mondayOf(today()) : addDays(ui.week, 7 * st); render(); break; }
    case 'weekfilter': ui.weekFilter = b.dataset.f; render(); break;
    case 'toggle-done': ui.showDone = !ui.showDone; render(); break;
    case 'dlg-close': closeDialog(); break;
    case 'undo': { const t = $('#toast'); if (t._snap) { S = JSON.parse(t._snap); save(); render(); } t.hidden = true; break; }
    case 'sync-now': Sync.now(); break;
    case 'sync-off': Sync.disconnect(); render(); toast('Zařízení odpojeno. Data v něm zůstala.'); break;
    case 'show-link': { const box = $('#linkbox'); if (!box) break;
      const base = location.protocol === 'https:' ? location.origin + location.pathname : PUBLIC_URL;
      const link = `${base}#pripojit=${b64u.enc({ u: Sync.cfg.url, k: Sync.cfg.key })}`;
      let svg = '';
      try { const q = window.__qr(0, 'M'); q.addData(link); q.make(); svg = q.createSvgTag({ cellSize: 4, margin: 3, scalable: true }); } catch (err) { svg = ''; }
      box.innerHTML = `<p class="sub" style="margin:12px 0 8px">Naskenuj foťákem telefonu, nebo si odkaz pošli. Obsahuje klíč k tvým datům, nikomu dalšímu ho nedávej.</p>${svg ? `<div class="qr">${svg}</div>` : ''}<textarea readonly id="linktext" aria-label="Propojovací odkaz" style="margin-top:10px;min-height:84px;font-size:14px">${esc(link)}</textarea><p style="margin-top:8px"><button class="btn" type="button" data-action="copy-link">Zkopírovat odkaz</button></p>`;
      box.hidden = false; break; }
    case 'copy-link': { const ta = $('#linktext'); if (!ta) break; ta.select(); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => toast('Odkaz je ve schránce.'), () => toast('Odkaz je označený. Zkopíruj ho ručně.')); break; }
    case 'export': { const blob = new Blob([JSON.stringify({ ...S, archive: Arch.recs }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `asistent-zaloha-${today()}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); break; }
  }
});

document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const fd = new FormData(f), g = k => String(fd.get(k) ?? '').trim();
  const where = () => { const [p, t] = (g('where') || '|').split('|'); return { projectId: p || '', typeId: t || '' }; };
  switch (f.dataset.form) {
    case 'quick-item': { if (!g('title')) break; const it = blankItem({ title: g('title'), est: +g('est') || 0 }); if (!it.est) { const u = usual(it); if (u) it.est = Math.round(u.avg); } S.items.push(it); ui.target = ui.target || it.id; save(); render(); const i = $('[data-form="quick-item"] input[name=title]'); if (i) i.focus(); break; }
    case 'task-add': { if (!g('title')) break; const it = blankItem({ title: g('title'), date: g('date'), est: +g('est') || 0, recur: parseRecur(g('recur')) }); if (it.recur && !it.date) it.date = today(); S.items.push(it); save(); render(); break; }
    case 'item-save': {
      const id = f.dataset.id; const it = id ? S.items.find(i => i.id === id) : blankItem();
      if (!it) break;
      const was = it.actual || 0;
      Object.assign(it, { title: g('title'), env: g('env'), kind: g('kind'), date: g('date'), time: g('time'), est: +g('est') || 0, firstStep: g('firstStep'), recur: parseRecur(g('recur')), actual: +g('actual') || 0 }, where());
      if (it.recur && !it.date) it.date = today();
      if (it.env === 'osobni' && it.kind === 'vysilani') it.kind = 'ukol';
      if (!id) S.items.push(it);
      if (it.done && it.actual && it.actual !== was) learn(it);
      save(); closeDialog(); render(); break;
    }
    case 'note-add': { if (!g('text')) break; S.notes.push({ id: uid(), env: S.env, text: g('text'), color: ui.noteColor, created: Date.now(), ...where() }); save(); render(); break; }
    case 'note-save': {
      const id = f.dataset.id;
      if (id) { const n = S.notes.find(x => x.id === id); if (n) Object.assign(n, { text: g('text'), color: g('color'), env: g('env') }, where()); }
      else S.notes.push({ id: uid(), text: g('text'), color: g('color'), env: g('env'), created: Date.now(), ...where() });
      ui.noteColor = g('color'); save(); closeDialog(); render(); break;
    }
    case 'connect': { const cfg = parseLink(g('link')); if (!cfg) { toast('Tohle není propojovací odkaz. Zkopíruj ho celý z Tabulky.'); break; } Sync.connect(cfg); render(); Sync.now().then(() => { toast(Sync.error ? Sync.text() : 'Propojeno. Data se synchronizují.'); Sync.thoughts(); }); break; }
    case 'type-add': { const p = project(f.dataset.pid); if (p && g('name')) { p.types.push({ id: uid(), name: g('name') }); save(); render(); } break; }
    case 'project-add': { if (g('name')) { S.projects.push({ id: uid(), env: S.env, name: g('name'), color: '#6B7A90', types: [] }); save(); render(); } break; }
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'firststep') { const it = S.items.find(i => i.id === el.dataset.id); if (it) { it.firstStep = el.value.trim(); save(); } return; }
  const c = el.dataset && el.dataset.change; if (!c) return;
  switch (c) {
    case 'fproject': ui.fProject = el.value === '|' ? '' : el.value; render(); break;
    case 'capacity': S.capacity = Math.max(60, Math.min(1440, +el.value || 480)); save(); break;
    case 'colorname': { const v = el.value.trim(); if (v) S.colorNames[S.env][el.dataset.color] = v; else delete S.colorNames[S.env][el.dataset.color]; save(); break; }
    case 'dlg-env': { const f = el.closest('form'); f.elements.where.innerHTML = projectOptions(el.value, '', ''); if (f.elements.kind) { const kinds = el.value === 'prace' ? ['vysilani', 'ukol', 'blok'] : ['ukol', 'blok']; const cur = f.elements.kind.value; f.elements.kind.innerHTML = kinds.map(k => `<option value="${k}"${cur === k ? ' selected' : ''}>${KIND[k]}</option>`).join(''); } break; }
    case 'import': { const file = el.files && el.files[0]; if (!file) break; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(String(r.result)); if (!d || !Array.isArray(d.items) || !Array.isArray(d.notes) || !Array.isArray(d.projects)) throw new Error('x'); const snap = snapshot(); const keep = { env: S.env, theme: S.theme }; const ar = d.archive; delete d.archive; S = { ...seed(), ...d, ...keep, v: 2 }; if (ar && typeof ar === 'object') Arch.putMany(Object.values(ar).filter(x => x && x.id)); if (!S.tomb || !S.tomb.items) S.tomb = { items: {}, notes: {}, projects: {} }; save(); render(); toast('Záloha nahraná.', snap); } catch (err) { toast('Tenhle soubor není záloha Asistenta. Nic se nezměnilo.'); } }; r.readAsText(file); break; }
  }
});

$('#dlg').addEventListener('click', e => { if (e.target === dlg()) closeDialog(); });
$('#dlg').addEventListener('close', () => { dlg().innerHTML = ''; if (pendingRender) softRender(); });
document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (pendingRender) softRender(); }, 200); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'auto') softRender(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) return; softRender(); Sync.now(); });
setInterval(() => { if (!document.hidden) Sync.now(); }, 60000);
window.addEventListener('online', () => Sync.now());

/* propojovací odkaz v adrese: uložit a z adresy hned odstranit */
function fromHash() {
  if (!/pripojit=/.test(location.hash)) return false;
  const cfg = parseLink(location.hash);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  if (!cfg) { setTimeout(() => toast('Propojovací odkaz je poškozený. Zkopíruj ho z Tabulky znovu.'), 400); return false; }
  Sync.connect(cfg); setTimeout(() => toast('Zařízení je propojené.'), 400);
  return true;
}
fromHash();
window.addEventListener('hashchange', () => { if (fromHash()) { render(); Sync.now().then(() => Sync.thoughts()); } });

/* první zápis zároveň ověří, jestli prohlížeč data drží */
persistOk = Store.write(S);
render();
Sync.now().then(() => Sync.thoughts());
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
