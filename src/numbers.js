
/* ================= Čísla: YouTube kanály přes motor, ruční čísla (Herohero), čísla dílů =================
   Jedna metrika = jeden záznam v S.recs (mod cislo, id c-<klíč>), historie po dnech v `hist`: { den: [hlavní, zhlédnutí, videa] }. */
const D = () => S.dash;
const numRec = k => S.recs.find(r => r.id === 'c-' + k);
function numPut(k, vals, title) {
  let r = numRec(k);
  if (!r) { r = { id: 'c-' + k, mod: 'cislo', env: 'prace', k, hist: {}, created: Date.now() }; S.recs.push(r); }
  r.hist = { ...r.hist, [today()]: vals }; if (title) r.title = title;
}
const nf = n => Math.round(+n || 0).toLocaleString('cs-CZ');
function numAt(r, date, i) { const ds = Object.keys(r.hist).filter(d => d <= date).sort(); const d = ds[ds.length - 1]; return d ? r.hist[d][i] : null; }
function numDelta(r, days, i) {
  const now = numAt(r, today(), i), ds = Object.keys(r.hist).sort(), ref = addDays(today(), -days);
  if (now == null || !ds.length || ds[0] > ref) return '';
  const d = now - numAt(r, ref, i);
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${nf(Math.abs(d))} za ${days} dní`;
}
function numSpark(r) {
  const ds = Object.keys(r.hist).sort().slice(-60); if (ds.length < 3) return '';
  const v = ds.map(d => r.hist[d][0]), lo = Math.min(...v), sp = (Math.max(...v) - lo) || 1;
  return `<svg class="spark" viewBox="0 0 300 50" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${v.map((x, i) => `${(i / (v.length - 1) * 296 + 2).toFixed(1)},${(46 - (x - lo) / sp * 42).toFixed(1)}`).join(' ')}"/></svg>`;
}
const Num = {
  busy: false, error: '', last: 0,
  parse(s) { s = String(s).trim(); const m = /channel\/(UC[\w-]{22})/.exec(s) || /^(UC[\w-]{22})$/.exec(s) || /(@[\w.\-]{3,40})/.exec(s); return m ? m[1] : ''; },
  async refresh(force) {
    if (!Sync.cfg || this.busy || !D().channels.length || (!force && Date.now() - this.last < 3 * 3600e3)) return;
    this.busy = true; this.error = '';
    try {
      const res = await Sync.call({ op: 'yt', channels: D().channels.map(c => c.k) });
      if (!res || !res.ok) throw new Error((res && res.error) || 'net');
      for (const c of D().channels) { const x = res.channels[c.k]; if (x && !x.missing && !x.error) numPut(c.k, [x.subs, x.views, x.videos], x.title); else if (x) this.error = x.missing ? `Kanál ${c.k} YouTube nenašel.` : 'yt'; }
      this.last = Date.now(); save();
    } catch (e) { this.error = e.message === 'yt-off' ? 'yt-off' : e.message === 'op' ? 'old' : 'net'; }
    this.busy = false; if (ui.view === 'cisla') softRender();
  },
  async episodes() {
    const eps = Arch.list().filter(r => r.vid).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 50);
    if (!Sync.cfg || !eps.length) return toast(Sync.cfg ? 'V archivu není díl s odkazem na YouTube.' : 'Nejdřív propoj appku s motorem.');
    try {
      const res = await Sync.call({ op: 'yt', videos: eps.map(r => r.vid) });
      if (!res || !res.ok) throw new Error((res && res.error) || 'net');
      const ch = eps.filter(r => res.videos[r.vid]).map(r => ({ ...r, yt: { ...res.videos[r.vid], at: today() } }));
      if (ch.length) Arch.putMany(ch);
      toast(`Čísla načtená u ${ch.length} dílů.`);
    } catch (e) { this.error = e.message === 'yt-off' ? 'yt-off' : e.message === 'op' ? 'old' : 'net'; toast('Čísla dílů se nepodařilo načíst.'); }
    softRender();
  },
  note() {
    if (!Sync.cfg) return 'Čísla z YouTube načítá motor. Nejdřív ho propoj v Nastavení. Ruční čísla fungují hned.';
    if (this.error === 'yt-off') return 'Motor nemá zapnutou službu YouTube. V editoru skriptu: Služby, plus, YouTube Data API v3, Přidat. Pak Nasadit, Spravovat nasazení, Nová verze.';
    if (this.error === 'old') return 'V Tabulce běží starší motor. Vlož do něj nový kód z poznámky Motor pro Tabulku a nasaď novou verzi.';
    if (this.error === 'net') return 'Motor teď neodpověděl. Zkus to za chvíli.';
    return this.error && this.error !== 'yt' ? this.error : '';
  }
};
function ytLine(y) { return y ? `${nf(y.v)} zhlédnutí, ${nf(y.l)} lajků, ${nf(y.c)} komentářů (k ${fmtShort(y.at)})` : ''; }
function viewCisla() {
  if (S.env !== 'prace') return viewDnes();
  Num.refresh();
  const note = Num.note();
  const tile = (name, r, manual, k) => `<section class="panel tile"><h2>${esc(name)}</h2>
    ${r && numAt(r, today(), 0) != null ? `<p class="big">${nf(numAt(r, today(), 0))}</p><p class="sub">${manual ? 'předplatitelů' : 'odběratelů'}${[7, 30].map(d => numDelta(r, d, 0)).filter(Boolean).map(x => `, ${x}`).join('')}</p>
      ${manual ? '' : `<p class="sub">${nf(numAt(r, today(), 1))} zhlédnutí celkem${numDelta(r, 7, 1) ? `, ${numDelta(r, 7, 1)}` : ''}</p>`}${numSpark(r)}` : `<p class="empty">${manual ? 'Zatím bez čísla.' : (Num.busy ? 'Načítám…' : 'Čeká na první načtení.')}</p>`}
    ${manual ? `<form data-form="num-set" data-k="${k}" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px"><input type="number" min="0" name="v" placeholder="Dnešní číslo" aria-label="Dnešní číslo: ${esc(name)}" required><button class="btn">Zapsat</button></form>` : ''}</section>`;
  const eps = Arch.list().filter(r => r.vid).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
  return `<div class="head"><div><h1>Čísla</h1><p>Kanály na YouTube a předplatitelé na Herohero.${Num.last ? ` Načteno ${hm(Num.last)}.` : ''}</p></div><button class="btn" type="button" data-action="num-refresh">Načíst teď</button></div>
  ${note ? `<p class="notice" style="margin-bottom:18px">${esc(note)}</p>` : ''}
  ${D().channels.length || D().manual.length ? `<div class="tiles">${D().channels.map(c => tile((numRec(c.k) && numRec(c.k).title) || c.k, numRec(c.k), false, c.k)).join('')}${D().manual.map(m => tile(m.name, numRec(m.k), true, m.k)).join('')}</div>` : `<p class="empty" style="margin-bottom:22px">Zatím žádný kanál. Přidej první dole.</p>`}
  <div class="cols" style="margin-top:22px"><div class="stack">
    <section class="panel"><h2>Poslední díly</h2>
      ${eps.length ? `<ul class="rows">${eps.map(r => `<li class="rec"><button class="rec-main" type="button" data-action="ar-open" data-id="${r.id}"><span class="row-title">${esc(r.name)}</span><span class="rec-sub">${esc(ytLine(r.yt) || 'čísla zatím nenačtená')}</span></button></li>`).join('')}</ul>
      <p style="margin-top:12px"><button class="btn" type="button" data-action="num-episodes">Načíst čísla posledních 50 dílů</button></p>` : `<p class="empty">V archivu zatím není díl s odkazem na YouTube.</p>`}
    </section>
  </div><div class="stack">
    <section class="panel"><h2>Co sledovat</h2>
      <ul class="rows">${[...D().channels.map(c => [c.k, (numRec(c.k) && numRec(c.k).title) || c.k, 'YouTube']), ...D().manual.map(m => [m.k, m.name, 'ručně'])].map(([k, n, t]) => `<li class="rec"><span class="rec-main"><span class="row-title">${esc(n)}</span><span class="rec-sub">${t}</span></span><button class="row-go" type="button" data-action="num-del" data-k="${esc(k)}" aria-label="Přestat sledovat ${esc(n)}">Odebrat</button></li>`).join('')}</ul>
      <form data-form="num-channel" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px"><input type="text" name="url" placeholder="Adresa kanálu nebo @jmeno" aria-label="Kanál na YouTube" required><button class="btn">Přidat kanál</button></form>
      <form data-form="num-manual" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px"><input type="text" name="name" placeholder="Ruční číslo, třeba Herohero" aria-label="Název ručního čísla" required><button class="btn">Přidat číslo</button></form>
    </section>
  </div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action^="num-"]'); if (!b) return;
  switch (b.dataset.action) {
    case 'num-refresh': if (!Sync.cfg) { toast('Nejdřív propoj appku s motorem v Nastavení.'); break; } Num.refresh(true).then(() => softRender()); render(); break;
    case 'num-episodes': Num.episodes(); break;
    case 'num-del': { const snap = snapshot(), k = b.dataset.k; S.dash = { channels: D().channels.filter(c => c.k !== k), manual: D().manual.filter(m => m.k !== k) }; save(); render(); toast('Odebráno. Historie čísel zůstala.', snap); break; }
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form^="num-"]'); if (!f) return;
  e.preventDefault();
  const v = String(new FormData(f).get(f.dataset.form === 'num-set' ? 'v' : f.dataset.form === 'num-channel' ? 'url' : 'name') || '').trim();
  switch (f.dataset.form) {
    case 'num-set': if (v !== '') { numPut(f.dataset.k, [+v]); save(); render(); } break;
    case 'num-channel': { const k = Num.parse(v); if (!k) { toast('Tohle nevypadá jako kanál. Vlož adresu kanálu nebo @jmeno.'); break; } if (!D().channels.some(c => c.k === k)) S.dash = { ...D(), channels: [...D().channels, { k }] }; save(); render(); Num.refresh(true); break; }
    case 'num-manual': S.dash = { ...D(), manual: [...D().manual, { k: 'm' + uid(), name: v }] }; save(); render(); break;
  }
});
