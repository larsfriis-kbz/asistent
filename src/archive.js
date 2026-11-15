/* ================= archiv vysílání =================
   Díly žijí mimo hlavní stav: je jich přes dva tisíce a posílat je celé při každé
   změně by synchronizaci zahltilo. Motor si s appkou vyměňuje jen změny (číslo revize).
   Přepisy jsou ještě zvlášť: stahují se, až když díl otevřeš. */
const AKEY = 'asistent.archive';
const TRK = id => 'asistent.tr.' + id;
const aslug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MEDIA = ['', 'YT FREE', 'Herohero'];

const Arch = {
  recs: {}, rev: 0, dirty: {}, trDirty: {}, tr: {}, busy: false,
  load() {
    try { const o = JSON.parse(localStorage.getItem(AKEY) || 'null'); if (o) { this.recs = o.recs || {}; this.rev = o.rev || 0; this.dirty = o.dirty || {}; this.trDirty = o.trDirty || {}; } } catch (e) { /* prázdný archiv */ }
  },
  store() { try { localStorage.setItem(AKEY, JSON.stringify({ recs: this.recs, rev: this.rev, dirty: this.dirty, trDirty: this.trDirty })); return true; } catch (e) { return false; } },
  list() { return Object.values(this.recs).filter(r => !r.del); },
  get(id) { const r = this.recs[id]; return r && !r.del ? r : null; },
  stamp(rec) { const prev = this.recs[rec.id]; rec.u = Math.max(Date.now(), prev ? (prev.u || 0) + 1 : 0); this.recs[rec.id] = rec; this.dirty[rec.id] = 1; },
  put(rec) { this.stamp(rec); const ok = this.store(); if (Sync.cfg) Sync.plan(1500); return ok; },
  putMany(list) { list.forEach(r => this.stamp(r)); const ok = this.store(); if (Sync.cfg) Sync.plan(500); return ok; },
  remove(id) { return this.put({ id, del: 1 }); },
  async sync() {
    if (!Sync.cfg || this.busy) return;
    this.busy = true;
    let changed = false;
    try {
      for (let round = 0; round < 30; round++) {
        const ids = Object.keys(this.dirty).filter(id => this.recs[id]).slice(0, 400);
        const sent = {};
        const changes = ids.map(id => { sent[id] = this.recs[id].u; return this.recs[id]; });
        const res = await Sync.call({ op: 'archive', since: this.rev, changes });
        if (!res || !res.ok) throw new Error((res && res.error) || 'net');
        for (const id of ids) if (this.recs[id] && this.recs[id].u === sent[id]) delete this.dirty[id];
        for (const id of res.rejected || []) delete this.dirty[id];
        for (const r of res.records || []) {
          const loc = this.recs[r.id];
          if (loc && this.dirty[r.id] && (loc.u || 0) >= (r.u || 0)) continue;
          if (!loc || JSON.stringify(loc) !== JSON.stringify(r)) { this.recs[r.id] = r; changed = true; }
        }
        this.rev = res.rev || this.rev;
        this.store();
        if (!Object.keys(this.dirty).some(id => this.recs[id])) break;
      }
      for (const id of Object.keys(this.trDirty)) {
        const text = trLocal(id);
        if (text === null) { delete this.trDirty[id]; continue; }
        const res = await Sync.call({ op: 'tr-put', id, text });
        if (res && res.ok) delete this.trDirty[id];
        this.store();
      }
    } catch (e) { if (!Sync.error) Sync.error = 'net'; }
    this.busy = false;
    if (changed) softRender();
  }
};
Arch.load();

/* ---------- přepisy ---------- */
function trLocal(id) {
  if (Arch.tr[id] !== undefined) return Arch.tr[id];
  try { const t = localStorage.getItem(TRK(id)); if (t !== null) return (Arch.tr[id] = t); } catch (e) { /* jen v paměti */ }
  return null;
}
function trSave(id, text) {
  Arch.tr[id] = text;
  let kept = true;
  try { if (text) localStorage.setItem(TRK(id), text); else localStorage.removeItem(TRK(id)); } catch (e) { kept = false; }
  if (Sync.cfg) { Arch.trDirty[id] = 1; Arch.store(); Sync.plan(600); }
  return kept || !!Sync.cfg;
}
async function trFetch(id) {
  const l = trLocal(id);
  if (l !== null) return l;
  if (!Sync.cfg) return null;
  const r = await Sync.call({ op: 'tr-get', id });
  if (!r || !r.ok) return null;
  Arch.tr[id] = r.text || '';
  try { localStorage.setItem(TRK(id), Arch.tr[id]); } catch (e) { /* zůstane v paměti */ }
  return Arch.tr[id];
}
const secs = t => t.split(':').reduce((a, x) => a * 60 + Number(x), 0);
const clock = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
function parseTranscript(raw) {
  const lines = String(raw || '').replace(/\r/g, '').replace(/^﻿/, '').split('\n');
  const srt = lines.some(l => l.includes('-->'));
  const TS = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[.,]\d{1,3})?\]?(?:\s*-->\s*[\d:.,]+)?(?:\s+|$)(.*)$/;
  const segs = [];
  let cur = null;
  for (const line of lines) {
    const s = line.trim();
    if (!s || /^WEBVTT/.test(s) || (srt && /^\d+$/.test(s))) continue;
    const m = TS.exec(s);
    if (m) { cur = { t: secs(m[1]), text: m[2].trim() }; segs.push(cur); continue; }
    if (cur) cur.text = cur.text ? `${cur.text} ${s}` : s;
    else { cur = { t: null, text: s }; segs.push(cur); }
  }
  return segs.filter(x => x.text);
}

/* ---------- import z Notionu (CSV) ---------- */
function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const ymd3 = (y, m, d) => { y = +y; m = +m; d = +d; return y > 1990 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : ''; };
function parseDate(s) {
  s = String(s || '').split('→')[0].trim();
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) return ymd3(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s))) { const a = +m[1], b = +m[2]; return b > 12 && a <= 12 ? ymd3(m[3], a, b) : ymd3(m[3], b, a); }
  if ((m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/.exec(s))) return ymd3(m[3], MON[m[1].toLowerCase()], m[2]);
  if ((m = /^(\d{1,2})\.? ([A-Za-z]{3})[a-z]*\.?,? (\d{4})/.exec(s))) return ymd3(m[3], MON[m[2].toLowerCase()], m[1]);
  return '';
}
const videoId = u => { const m = /(?:[?&]v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/.exec(u || ''); return m ? m[1] : ''; };
const relNames = s => String(s || '').replace(/\s*\(https?:\/\/[^)]*\)/g, '').split(/,\s*/).map(x => x.trim()).filter(Boolean);

function placeFor(tag, channel, created) {
  const work = S.projects.filter(p => p.env === 'prace');
  const ts = aslug(tag);
  if (ts) for (const p of work) for (const t of p.types) if (aslug(t.name) === ts) return { projectId: p.id, typeId: t.id };
  const p = work.find(x => aslug(x.name) === aslug(channel));
  if (!p) return { projectId: '', typeId: '' };
  if (!ts) return { projectId: p.id, typeId: '' };
  const t = { id: `t-${aslug(p.name)}-${ts}`, name: tag };
  p.types.push(t); created.push(`${p.name} / ${tag}`);
  return { projectId: p.id, typeId: t.id };
}

function importNotion(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('Soubor je prázdný.');
  const head = rows[0].map(h => h.trim());
  const col = (...names) => { for (const n of names) { const i = head.findIndex(h => aslug(h) === aslug(n)); if (i >= 0) return i; } return -1; };
  const C = { name: col('Name', 'Název'), tag: col('Tags'), ch: col('Channel'), date: col('Publish Date'), url: col('URL'), people: col('Účastníci'), ep: col('Episode'), season: col('Season'), media: col('Media Type'), dur: col('Duration'), status: col('Status'), arch: col('Archive') };
  if (C.name < 0 || (C.tag < 0 && C.url < 0)) throw new Error('Tohle není export databáze Content. Chybí sloupce Name a Tags nebo URL.');
  const v = (r, k) => (C[k] >= 0 ? String(r[C[k]] || '').trim() : '');
  const created = [], out = [];
  let fresh = 0, updated = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const name = v(r, 'name');
    const status = v(r, 'status');
    if (!name || (status && aslug(status) !== 'completed') || /^(yes|ano|true)$/i.test(v(r, 'arch'))) { skipped++; continue; }
    const url = v(r, 'url'), vid = videoId(url), date = parseDate(v(r, 'date'));
    const id = vid ? `yt-${vid}` : `n-${hash(name + '|' + date).toString(36)}`;
    const place = placeFor(v(r, 'tag'), relNames(v(r, 'ch'))[0] || '', created);
    const media = MEDIA.find(m => m && aslug(m) === aslug(v(r, 'media'))) || '';
    const rec = { id, name, ...place, date, url, vid, ep: v(r, 'ep'), season: v(r, 'season'), media, dur: v(r, 'dur'), people: relNames(v(r, 'people')), notes: '', hasTr: false, src: 'notion' };
    const old = Arch.get(id);
    if (old) {
      for (const k of Object.keys(rec)) if (rec[k] === '' || (Array.isArray(rec[k]) && !rec[k].length)) rec[k] = old[k];
      rec.notes = old.notes || ''; rec.hasTr = !!old.hasTr; rec.trLen = old.trLen || 0;
      if (old.people && old.people.length && old.peopleEdited) { rec.people = old.people; rec.peopleEdited = true; }
      updated++;
    } else fresh++;
    out.push(rec);
  }
  if (created.length) save();
  const ok = Arch.putMany(out);
  return { fresh, updated, skipped, created, ok };
}

/* ---------- pomocné pro pohledy ---------- */
const epDate = d => { if (!d) return 'bez data'; const x = parseYmd(d); return `${x.getDate()}. ${x.getMonth() + 1}. ${x.getFullYear()}`; };
const epPlace = r => { const p = project(r.projectId); if (!p) return null; const tn = typeName(r.projectId, r.typeId); return { text: tn || p.name, color: p.color }; };
function peopleIndex(projectId) {
  const n = {};
  for (const r of Arch.list()) if (!projectId || r.projectId === projectId) for (const x of r.people || []) n[x] = (n[x] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs')).map(([x]) => x);
}
function archFiltered(f) {
  const q = aslug(f.q);
  return Arch.list().filter(r => (!f.p || r.projectId === f.p || (f.p === '-' && !project(r.projectId))) && (!f.t || r.typeId === f.t) && (!f.y || (r.date || '').startsWith(f.y))
    && (!f.person || (r.people || []).includes(f.person))
    && (!q || aslug(r.name).includes(q) || (r.people || []).some(x => aslug(x).includes(q)) || aslug(r.notes).includes(q)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name, 'cs'));
}
const importBox = (cls = 'btn primary', label = 'Nahrát CSV z Notionu') => `<label class="${cls}" style="display:inline-flex;align-items:center">${label}<input type="file" accept=".csv,text/csv" data-change="ar-import" class="sr"></label>`;

function viewArchiv() {
  const f = ui.ar || (ui.ar = { q: '', p: '', t: '', y: '', person: '', limit: 100 });
  const all = Arch.list();
  if (!all.length) {
    return `<div class="head"><div><h1>Archiv vysílání</h1><p>Zatím prázdný.</p></div></div>
    <section class="panel"><h2>Nahraj archiv z Notionu</h2>
      <ol class="steps">
        <li><div><b>Otevři databázi Content</b><span>YouTube Jedi Master [UTE] → Databases &amp; Components → Content.</span></div></li>
        <li><div><b>Exportuj ji</b><span>Vpravo nahoře ••• → Export → Markdown &amp; CSV. Obsah podstránek nepotřebuješ.</span></div></li>
        <li><div><b>Nahraj soubor sem</b><span>Rozbal stažený zip a vyber soubor, který začíná „Content“ a končí .csv.</span></div></li>
      </ol>
      <p class="btnrow" style="margin-top:16px">${importBox()}<button class="btn" type="button" data-action="ar-new">Přidat díl ručně</button></p>
    </section>`;
  }
  const list = archFiltered(f);
  const work = S.projects.filter(p => p.env === 'prace');
  const proj = project(f.p);
  const years = [...new Set(all.map(r => (r.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const counts = {}; for (const r of all) counts[r.projectId || '-'] = (counts[r.projectId || '-'] || 0) + 1;
  const shown = list.slice(0, f.limit);
  const people = f.p ? peopleIndex(f.p).slice(0, 60) : peopleIndex('').slice(0, 60);
  return `<div class="head"><div><h1>Archiv vysílání</h1><p>${all.length} ${plural(all.length, 'díl', 'díly', 'dílů')}${list.length !== all.length ? `, filtru odpovídá ${list.length}` : ''}.</p></div>
    <div class="btnrow"><button class="btn primary" type="button" data-action="ar-new">Přidat díl</button>${importBox('btn', 'Doplnit z Notionu')}</div></div>
  <div class="filters" role="group" aria-label="Projekt">
    <button type="button" class="fchip" data-action="ar-filter" data-k="p" data-v="" aria-pressed="${!f.p}">Všechno</button>
    ${work.map(p => `<button type="button" class="fchip" data-action="ar-filter" data-k="p" data-v="${p.id}" aria-pressed="${f.p === p.id}"><i style="--paper:${p.color}"></i>${esc(p.name)} <span class="muted">${counts[p.id] || 0}</span></button>`).join('')}
    ${counts['-'] ? `<button type="button" class="fchip" data-action="ar-filter" data-k="p" data-v="-" aria-pressed="${f.p === '-'}">Bez projektu <span class="muted">${counts['-']}</span></button>` : ''}
  </div>
  <div class="arbar">
    <input type="search" value="${esc(f.q)}" placeholder="Hledat v názvu, lidech a poznámkách" aria-label="Hledat v archivu" data-input="ar-q">
    ${proj && proj.types.length ? `<select data-change="ar-filter" data-k="t" aria-label="Typ pořadu"><option value="">Všechny typy</option>${proj.types.map(t => `<option value="${t.id}"${f.t === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}
    <select data-change="ar-filter" data-k="y" aria-label="Rok"><option value="">Všechny roky</option>${years.map(y => `<option${f.y === y ? ' selected' : ''}>${y}</option>`).join('')}</select>
    <select data-change="ar-filter" data-k="person" aria-label="Účastník"><option value="">Všichni lidé</option>${people.map(x => `<option${f.person === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
  </div>
  ${shown.length ? `<ul class="eps" id="eplist">${shown.map(epRow).join('')}</ul>
  ${list.length > shown.length ? `<p style="margin-top:14px"><button class="btn" type="button" data-action="ar-more">Zobrazit dalších ${Math.min(100, list.length - shown.length)} z ${list.length - shown.length}</button></p>` : ''}`
  : `<p class="empty">Tomuhle filtru nic neodpovídá.</p>`}`;
}
function epRow(r) {
  const pl = epPlace(r);
  const meta = [pl ? `<span class="chip" style="--c:${pl.color}"><i></i>${esc(pl.text)}</span>` : '<span class="chip">Bez projektu</span>',
    r.people && r.people.length ? `<span class="chip">${r.people.length} ${plural(r.people.length, 'účastník', 'účastníci', 'účastníků')}</span>` : '',
    r.notes ? '<span class="chip">Poznámky</span>' : '', r.hasTr ? '<span class="chip">Přepis</span>' : '', r.media === 'Herohero' ? '<span class="chip">Herohero</span>' : ''].join('');
  return `<li><button type="button" class="ep" data-action="ar-open" data-id="${esc(r.id)}"><span class="ep-date">${epDate(r.date)}</span><span class="ep-main"><b>${esc(r.name)}</b><span class="row-meta">${meta}</span></span></button></li>`;
}

function viewDil() {
  const r = Arch.get(ui.epId);
  if (!r) return `<div class="head"><div><h1>Díl nenalezen</h1><p>Mohl být smazaný na jiném zařízení.</p></div></div><p><button class="btn" type="button" data-action="nav" data-view="archiv">Zpět do archivu</button></p>`;
  const known = peopleIndex(r.projectId).slice(0, 24);
  const chips = [...new Set([...(r.people || []), ...known])];
  const all = peopleIndex('');
  return `<p style="margin-bottom:10px"><button class="btn quiet" type="button" data-action="nav" data-view="archiv">Zpět do archivu</button></p>
  <div class="head"><div><h1 id="eptitle" style="font-size:clamp(24px,4vw,34px)">${esc(r.name)}</h1><p>${epDate(r.date)}${r.vid ? `&emsp;<a href="https://www.youtube.com/watch?v=${esc(r.vid)}" target="_blank" rel="noopener">Otevřít na YouTube</a>` : ''}</p></div><p class="hint" id="epsaved" role="status"></p></div>
  <div class="cols">
    <div class="stack">
      <section class="panel"><h2>Poznámky</h2>
        <textarea data-change="ar-field" data-f="notes" aria-label="Poznámky k dílu" placeholder="Co se v dílu řešilo, důležité momenty, co příště jinak">${esc(r.notes || '')}</textarea>
      </section>
      <section class="panel"><h2>Přepis</h2>
        ${r.hasTr ? `<p class="sub">${r.trLen >= 1000 ? `${Math.round(r.trLen / 1000)} tisíc znaků. ` : ''}Klikni na čas a video se otevře na tom místě.</p>
          <input type="search" id="trsearch" placeholder="Hledat v přepisu" aria-label="Hledat v přepisu" data-input="ar-trq">
          <div class="tr" id="trbox" aria-live="polite"><p class="empty">Načítám přepis…</p></div>
          <p class="btnrow" style="margin-top:12px"><label class="btn" style="display:inline-flex;align-items:center">Nahradit souborem<input type="file" accept=".txt,.srt,.vtt,text/plain" data-change="ar-tr-file" class="sr"></label><button class="btn quiet" type="button" data-action="ar-tr-del">Smazat přepis</button></p>`
        : `<p class="sub">Přepis z YouTube s časovými značkami: zkopíruj ho a vlož sem, nebo nahraj soubor .txt, .srt či .vtt.</p>
          <textarea id="trpaste" aria-label="Vložit přepis" placeholder="0:00 Úvod&#10;0:42 První téma…" style="min-height:140px"></textarea>
          <p class="btnrow" style="margin-top:10px"><button class="btn primary" type="button" data-action="ar-tr-paste">Uložit přepis</button><label class="btn" style="display:inline-flex;align-items:center">Nahrát soubor<input type="file" accept=".txt,.srt,.vtt,text/plain" data-change="ar-tr-file" class="sr"></label></p>`}
      </section>
    </div>
    <div class="stack">
      <section class="panel"><h2>Účastníci</h2>
        <div class="pchips" id="pchips">${chips.map(x => pchip(x, (r.people || []).includes(x))).join('')}</div>
        <form data-form="ar-person-add" class="motor" style="margin-top:12px" autocomplete="off"><input type="text" name="name" list="peoplelist" placeholder="Přidat dalšího člověka" aria-label="Přidat účastníka" required><button class="btn">Přidat</button></form>
        <datalist id="peoplelist">${all.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      </section>
      <section class="panel"><h2>Údaje</h2>
        <div class="dlg" style="padding:0;gap:12px">
          <label>Název<input type="text" value="${esc(r.name)}" data-change="ar-field" data-f="name"></label>
          <label>Pořad<select data-change="ar-where">${projectOptions('prace', r.projectId, r.typeId)}</select></label>
          <div class="two"><label>Datum<input type="date" value="${r.date || ''}" data-change="ar-field" data-f="date"></label>
            <label>Typ<select data-change="ar-field" data-f="media">${MEDIA.map(m => `<option value="${m}"${(r.media || '') === m ? ' selected' : ''}>${m || 'Neurčeno'}</option>`).join('')}</select></label></div>
          <div class="three"><label>Řada<input type="text" inputmode="numeric" value="${esc(r.season || '')}" data-change="ar-field" data-f="season"></label>
            <label>Díl<input type="text" inputmode="numeric" value="${esc(r.ep || '')}" data-change="ar-field" data-f="ep"></label>
            <label>Délka<input type="text" value="${esc(r.dur || '')}" data-change="ar-field" data-f="dur" placeholder="1:24:00"></label></div>
          <label>Odkaz na video<input type="url" value="${esc(r.url || '')}" data-change="ar-field" data-f="url" placeholder="https://www.youtube.com/watch?v=…"></label>
          <p class="hint">Analytika z YouTube k dílu přibude v dalším řezu.</p>
          <p><button class="btn danger" type="button" data-action="ar-delete">Smazat díl</button></p>
        </div>
      </section>
    </div>
  </div>`;
}
const pchip = (x, on) => `<button type="button" class="pchip" data-action="ar-person" data-name="${esc(x)}" aria-pressed="${on}">${esc(x)}</button>`;

function paintTranscript(text, q) {
  const box = $('#trbox'); if (!box) return;
  const r = Arch.get(ui.epId);
  const segs = parseTranscript(text);
  const qs = aslug(q || '');
  const hits = qs ? segs.filter(s => aslug(s.text).includes(qs)) : segs;
  if (!segs.length) { box.innerHTML = '<p class="empty">Přepis je prázdný.</p>'; return; }
  box.innerHTML = hits.length ? hits.map(s => `<p>${s.t === null ? '' : (r && r.vid ? `<a class="ts" href="https://www.youtube.com/watch?v=${esc(r.vid)}&amp;t=${s.t}s" target="_blank" rel="noopener">${clock(s.t)}</a>` : `<span class="ts">${clock(s.t)}</span>`)}<span>${esc(s.text)}</span></p>`).join('')
    : '<p class="empty">V přepisu nic takového není.</p>';
}
function loadTranscript() {
  const r = Arch.get(ui.epId);
  if (!r || !r.hasTr || !$('#trbox')) return;
  const id = r.id;
  trFetch(id).then(t => {
    if (ui.view !== 'dil' || ui.epId !== id) return;
    if (t === null) { const b = $('#trbox'); if (b) b.innerHTML = `<p class="empty">${Sync.cfg ? 'Přepis se nepodařilo stáhnout z motoru. Zkus to za chvíli.' : 'Přepis je uložený v jiném zařízení. Připoj motor a objeví se i tady.'}</p>`; return; }
    paintTranscript(t, ($('#trsearch') || {}).value);
  }).catch(() => { const b = $('#trbox'); if (b) b.innerHTML = '<p class="empty">Přepis se nepodařilo stáhnout z motoru. Zkus to za chvíli.</p>'; });
}
function saveTranscript(text) {
  const r = Arch.get(ui.epId); if (!r) return;
  text = String(text || '').trim();
  if (!text) { toast('Přepis je prázdný. Nic se neuložilo.'); return; }
  if (!parseTranscript(text).length) { toast('V textu není nic, co by šlo uložit jako přepis.'); return; }
  const kept = trSave(r.id, text);
  Arch.put({ ...r, hasTr: true, trLen: text.length });
  render();
  toast(kept ? 'Přepis uložen.' : 'Přepis se nevešel do prohlížeče. Připoj motor, ten ho uloží do Tabulky.');
}
function markSaved() { const el = $('#epsaved'); if (el) { el.textContent = 'Uloženo'; clearTimeout(markSaved.t); markSaved.t = setTimeout(() => { el.textContent = ''; }, 1600); } }

/* vysílání odškrtnuté v plánu se samo zapíše do archivu */
function archiveFromItem(it) {
  if (it.kind !== 'vysilani' || it.env !== 'prace') return '';
  const id = 'it-' + it.id;
  if (Arch.get(id)) return '';
  Arch.put({ id, name: it.title, projectId: it.projectId || '', typeId: it.typeId || '', date: it.date || today(), url: '', vid: '', ep: '', season: '', media: '', dur: it.actual ? fmtMin(it.actual) : '', people: [], notes: '', hasTr: false, src: 'plan' });
  return ' Zapsáno do archivu.';
}

function viewVice() {
  const items = [['listky', 'Lístky', 'Barevné poznámky'], ...(S.env === 'prace' ? [['archiv', 'Archiv vysílání', `${Arch.list().length} dílů`]] : []), ['nastaveni', 'Nastavení', 'Motor, vzhled, barvy, projekty']];
  return `<div class="head"><div><h1>Další</h1></div></div>
  <ul class="menu">${items.map(([k, l, d]) => `<li><button type="button" data-action="nav" data-view="${k}"><b>${l}</b><span>${d}</span></button></li>`).join('')}</ul>`;
}

/* ---------- události archivu ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action^="ar-"]'); if (!b) return;
  const a = b.dataset.action, r = Arch.get(ui.epId);
  switch (a) {
    case 'ar-open': ui.epId = b.dataset.id; ui.view = 'dil'; render(); window.scrollTo(0, 0); break;
    case 'ar-filter': ui.ar[b.dataset.k] = b.dataset.v; if (b.dataset.k === 'p') ui.ar.t = ''; ui.ar.limit = 100; render(); break;
    case 'ar-more': ui.ar.limit += 100; render(); break;
    case 'ar-new': { const id = 'm-' + uid(); Arch.put({ id, name: 'Nový díl', projectId: '', typeId: '', date: today(), url: '', vid: '', ep: '', season: '', media: '', dur: '', people: [], notes: '', hasTr: false, src: 'ruka' }); ui.epId = id; ui.view = 'dil'; render(); const n = $('[data-f="name"]'); if (n) { n.focus(); n.select(); } break; }
    case 'ar-person': {
      if (!r) break;
      const name = b.dataset.name, on = b.getAttribute('aria-pressed') !== 'true';
      const people = (r.people || []).filter(x => x !== name); if (on) people.push(name);
      Arch.put({ ...r, people, peopleEdited: true }); b.setAttribute('aria-pressed', String(on)); markSaved(); break;
    }
    case 'ar-tr-paste': saveTranscript(($('#trpaste') || {}).value); break;
    case 'ar-tr-del': { if (!r) break; const old = trLocal(r.id) || ''; trSave(r.id, ''); Arch.put({ ...r, hasTr: false, trLen: 0 }); render(); toast('Přepis smazán.', null, old ? () => { trSave(r.id, old); Arch.put({ ...Arch.get(r.id), hasTr: true, trLen: old.length }); render(); } : null); break; }
    case 'ar-delete': {
      if (!r) break;
      const copy = { ...r }; Arch.remove(r.id); ui.view = 'archiv'; render();
      toast('Díl smazán.', null, () => { Arch.put({ ...copy }); render(); });
      break;
    }
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('#toast [data-action="undo"]');
  const t = $('#toast');
  if (b && t._undo) { const f = t._undo; t._undo = null; f(); t.hidden = true; }
}, true);
document.addEventListener('change', e => {
  const el = e.target, c = el.dataset && el.dataset.change; if (!c || !c.startsWith('ar-')) return;
  const r = Arch.get(ui.epId);
  switch (c) {
    case 'ar-filter': ui.ar[el.dataset.k] = el.value; ui.ar.limit = 100; render(); break;
    case 'ar-field': {
      if (!r) break;
      const k = el.dataset.f; let v = el.value;
      if (k === 'name') { v = v.trim(); if (!v) { el.value = r.name; break; } const h = $('#eptitle'); if (h) h.textContent = v; }
      const next = { ...r, [k]: v };
      if (k === 'url') next.vid = videoId(v);
      Arch.put(next); markSaved(); break;
    }
    case 'ar-where': { if (!r) break; const [p, t] = (el.value || '|').split('|'); Arch.put({ ...r, projectId: p || '', typeId: t || '' }); markSaved(); break; }
    case 'ar-tr-file': { const file = el.files && el.files[0]; if (!file) break; const fr = new FileReader(); fr.onload = () => saveTranscript(String(fr.result)); fr.readAsText(file); break; }
    case 'ar-import': {
      const file = el.files && el.files[0]; if (!file) break;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const res = importNotion(String(fr.result));
          ui.ar = { q: '', p: '', t: '', y: '', person: '', limit: 100 };
          render();
          toast(`Nahráno: ${res.fresh} nových, ${res.updated} doplněných${res.skipped ? `, ${res.skipped} přeskočeno (nápady a plánované)` : ''}.${res.created.length ? ` Nové typy pořadů: ${res.created.length}.` : ''}${res.ok ? '' : ' Prohlížeč je plný, archiv drží jen do zavření. Připoj motor.'}`);
        } catch (err) { toast(err.message || 'Soubor se nepodařilo přečíst.'); }
      };
      fr.readAsText(file);
      break;
    }
  }
});
document.addEventListener('input', e => {
  const el = e.target, k = el.dataset && el.dataset.input; if (!k) return;
  if (k === 'ar-q') {
    ui.ar.q = el.value; ui.ar.limit = 100;
    clearTimeout(ui.arT);
    ui.arT = setTimeout(() => {
      const list = archFiltered(ui.ar), box = $('#eplist');
      const head = document.querySelector('.head p'); if (head) { const n = Arch.list().length; head.textContent = `${n} ${plural(n, 'díl', 'díly', 'dílů')}${list.length !== n ? `, filtru odpovídá ${list.length}` : ''}.`; }
      if (box) box.innerHTML = list.slice(0, ui.ar.limit).map(epRow).join('') || '';
      else render();
    }, 150);
  }
  if (k === 'ar-trq') { const r = Arch.get(ui.epId); const t = r && trLocal(r.id); if (t !== null) paintTranscript(t, el.value); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form="ar-person-add"]'); if (!f) return;
  e.preventDefault();
  const r = Arch.get(ui.epId); const name = String(new FormData(f).get('name') || '').trim();
  if (!r || !name) return;
  const people = [...new Set([...(r.people || []), name])];
  Arch.put({ ...r, people, peopleEdited: true });
  const box = $('#pchips');
  const ex = box && [...box.querySelectorAll('.pchip')].find(x => x.dataset.name === name);
  if (ex) ex.setAttribute('aria-pressed', 'true'); else if (box) box.insertAdjacentHTML('afterbegin', pchip(name, true));
  f.reset(); markSaved();
});
