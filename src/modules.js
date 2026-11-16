/* ================= moduly: Schránka, MEDIUM 360, Fitness a obecné seznamy =================
   Všechno leží v jedné kolekci S.recs, záznam nese `mod`. Pole: [klíč, popisek, typ, povinné]. */
const MODS = {
  schranka: { env: '*', name: 'Schránka', one: 'Nová věc', desc: 'Co si sem pošleš, než to roztřídíš', title: 'text', status: ['stav', ['Nové', 'Vyřízené']],
    fields: [['text', 'Co', 'area', 1], ['url', 'Odkaz', 'url']], sub: r => r.url || '' },
  knihy: { env: 'osobni', name: 'Books', one: 'Nová kniha', desc: 'Co chceš číst, čteš a co sis z toho vzal', title: 'nazev', status: ['stav', ['Chci číst', 'Čtu', 'Přečteno']],
    fields: [['nazev', 'Název', 'text', 1], ['autor', 'Autor', 'text'], ['hodnoceni', 'Hodnocení 1 až 5', 'num'], ['poznamka', 'Co si z ní beru', 'area']],
    sub: r => [r.autor, r.hodnoceni ? `${r.hodnoceni}/5` : ''].filter(Boolean).join(', ') },
  recepty: { env: 'osobni', name: 'Recipes', one: 'Nový recept', desc: 'Recepty a plán jídla na týden', title: 'nazev', status: ['stav', ['Vyzkoušet', 'Osvědčený']],
    fields: [['nazev', 'Název', 'text', 1], ['plan', 'Naplánovat na den', 'date'], ['suroviny', 'Suroviny, jedna na řádek', 'area'], ['postup', 'Postup', 'area'], ['url', 'Odkaz', 'url']],
    sub: r => r.plan ? `plán ${fmtShort(r.plan)}` : '' },
  bucket: { env: 'osobni', name: 'Ultimate BucketLIST', one: 'Nová položka', desc: 'Věci, které chceš v životě stihnout', title: 'nazev', status: ['stav', ['Čeká', 'Splněno']],
    fields: [['nazev', 'Co', 'text', 1], ['kdy', 'Do kdy', 'date'], ['poznamka', 'Poznámka', 'area']], sub: r => r.kdy ? `do ${fmtShort(r.kdy)} ${r.kdy.slice(0, 4)}` : '' },
  cesty: { env: 'osobni', name: 'Trip Planner', one: 'Nová cesta', desc: 'Kam, kdy, za kolik a co zabalit', title: 'nazev', status: ['stav', ['Nápad', 'Naplánováno', 'Za mnou']],
    fields: [['nazev', 'Kam', 'text', 1], ['od', 'Od', 'date'], ['do', 'Do', 'date'], ['rozpocet', 'Rozpočet v Kč', 'num'], ['plan', 'Plán a seznam věcí', 'area']],
    sub: r => [r.od ? fmtShort(r.od) + (r.do ? ` až ${fmtShort(r.do)}` : '') : '', r.rozpocet ? kc(r.rozpocet) : ''].filter(Boolean).join(', ') },
  finance: { env: 'osobni', name: 'Finance & Subscriptions', one: 'Nová platba', desc: 'Předplatná a pravidelné platby', title: 'nazev', status: ['stav', ['Platím', 'Zrušeno']],
    fields: [['nazev', 'Za co', 'text', 1], ['castka', 'Částka v Kč', 'num', 1], ['obdobi', 'Jak často', 'sel:Měsíčně|Ročně'], ['dalsi', 'Další platba', 'date'], ['poznamka', 'Poznámka', 'area']],
    sub: r => `${kc(r.castka)} ${r.obdobi === 'Ročně' ? 'ročně' : 'měsíčně'}${r.dalsi ? `, další ${fmtShort(r.dalsi)}` : ''}`,
    summary: l => { const a = l.filter(r => r.stav !== 'Zrušeno'); const m = a.reduce((s, r) => s + (+r.castka || 0) / (r.obdobi === 'Ročně' ? 12 : 1), 0); return a.length ? `Měsíčně ${kc(m)}, ročně ${kc(m * 12)}.` : ''; } },
  denik: { env: 'osobni', name: 'Journal', one: 'Nový zápis', desc: 'Pár vět za den', title: 'datum', sortDesc: 'datum',
    fields: [['datum', 'Den', 'date', 1], ['nalada', 'Nálada 1 až 5', 'num'], ['text', 'Co se dělo', 'area', 1]],
    titleFmt: r => cap(fmtShort(r.datum)) + ' ' + r.datum.slice(0, 4), sub: r => [r.nalada ? `nálada ${r.nalada}/5` : '', (r.text || '').split('\n')[0].slice(0, 90)].filter(Boolean).join(', ') },
  levelup: { env: 'osobni', name: 'LEVEL UP', one: 'Nová dovednost', desc: 'Co se učíš a jaký je další krok', title: 'nazev', sortDesc: 'uroven',
    fields: [['nazev', 'Dovednost', 'text', 1], ['uroven', 'Úroveň 1 až 10', 'num'], ['krok', 'Další krok', 'text'], ['poznamka', 'Poznámka', 'area']],
    sub: r => [r.uroven ? `úroveň ${r.uroven}/10` : '', r.krok ? `další: ${r.krok}` : ''].filter(Boolean).join(', ') },
  milnik: { env: 'osobni', name: 'Milníky', one: 'Nový milník', hidden: 1, title: 'nazev', status: ['stav', ['Čeká', 'Splněno']], fields: [['nazev', 'Milník', 'text', 1], ['kdy', 'Do kdy', 'date']], sub: r => r.kdy ? `do ${fmtShort(r.kdy)}` : '' },
  dohoda: { env: 'osobni', name: 'Dohody, odměny a tresty', one: 'Nová dohoda', hidden: 1, title: 'text', fields: [['typ', 'Druh', 'sel:Dohoda|Odměna|Trest'], ['text', 'Co platí', 'area', 1]], sub: r => r.typ || 'Dohoda' },
  mini: { env: 'osobni', name: 'Mini dobrodružství', one: 'Nové dobrodružství', hidden: 1, title: 'nazev', status: ['stav', ['Čeká', 'Splněno']], sortDesc: 'mesic', fields: [['nazev', 'Co', 'text', 1], ['mesic', 'Měsíc', 'month', 1]], sub: r => r.mesic || '' }
};
const kc = n => `${Math.round(+n || 0).toLocaleString('cs-CZ')} Kč`;
const modEnvOk = m => MODS[m].env === '*' || MODS[m].env === S.env;
const recsOf = mod => S.recs.filter(r => r.mod === mod && (MODS[mod].env !== '*' || r.env === S.env));
const recTitle = (m, r) => (MODS[m].titleFmt ? MODS[m].titleFmt(r) : String(r[MODS[m].title] || '').split('\n')[0]) || 'Bez názvu';
const inboxNew = () => recsOf('schranka').filter(r => r.stav !== 'Vyřízené').length;

function sortRecs(mod, list) {
  const d = MODS[mod], st = d.status;
  return list.slice().sort((a, b) => (st ? st[1].indexOf(a[st[0]] || st[1][0]) - st[1].indexOf(b[st[0]] || st[1][0]) : 0)
    || (d.sortDesc ? String(b[d.sortDesc] || '').localeCompare(String(a[d.sortDesc] || ''), 'cs', { numeric: true }) : 0) || (b.created || 0) - (a.created || 0));
}
function recRow(mod, r) {
  const d = MODS[mod], st = d.status, cur = st ? (r[st[0]] || st[1][0]) : '', last = st && cur === st[1][st[1].length - 1];
  const sub = d.sub ? d.sub(r) : '';
  return `<li class="rec${last ? ' is-done' : ''}" data-id="${r.id}">
    <button class="rec-main" type="button" data-action="mod-edit"><span class="row-title">${esc(recTitle(mod, r))}</span>${sub ? `<span class="rec-sub">${esc(sub)}</span>` : ''}</button>
    ${st ? `<button class="row-go" type="button" data-action="mod-cycle" aria-label="Stav ${esc(cur)}. Klepnutím změníš.">${esc(cur)}</button>` : ''}
  </li>`;
}
function modPanel(mod, limit) {
  const d = MODS[mod], list = sortRecs(mod, recsOf(mod));
  return `<section class="panel"><h2>${d.name}</h2>
    ${list.length ? `<ul class="rows">${(limit ? list.slice(0, limit) : list).map(r => recRow(mod, r)).join('')}</ul>` : `<p class="empty">Zatím nic.</p>`}
    <p style="margin-top:12px"><button class="btn" type="button" data-action="mod-new" data-mod="${mod}">${d.one}</button></p></section>`;
}
function viewMod(mod) {
  mod = mod || ui.mod; const d = MODS[mod];
  if (!d || !modEnvOk(mod)) return viewModuly();
  const all = recsOf(mod), st = d.status, f = ui.modF[mod] || '';
  const list = sortRecs(mod, f ? all.filter(r => (r[st[0]] || st[1][0]) === f) : all);
  const sum = d.summary ? d.summary(all) : '';
  return `<div class="head"><div><h1>${d.name}</h1><p>${d.desc || ''}${sum ? ` ${sum}` : ''}</p></div><button class="btn primary" type="button" data-action="mod-new" data-mod="${mod}">${d.one}</button></div>
  ${mod === 'schranka' ? `<form class="panel" data-form="drop-add" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:22px"><input type="text" name="text" placeholder="Myšlenka, odkaz, cokoliv na později" aria-label="Nová věc do schránky" required><button class="btn primary">Uložit</button></form>` : ''}
  ${st && all.length ? `<div class="seg" role="group" aria-label="Filtr" style="margin-bottom:14px"><button type="button" data-action="mod-filter" data-mod="${mod}" data-v="" aria-pressed="${!f}">Vše ${all.length}</button>${st[1].map(v => `<button type="button" data-action="mod-filter" data-mod="${mod}" data-v="${esc(v)}" aria-pressed="${f === v}">${esc(v)} ${all.filter(r => (r[st[0]] || st[1][0]) === v).length}</button>`).join('')}</div>` : ''}
  <section class="panel">${list.length ? `<ul class="rows">${list.map(r => recRow(mod, r)).join('')}</ul>` : `<p class="empty">${all.length ? 'V tomhle filtru nic není.' : `Zatím prázdno. Začni tlačítkem ${d.one}.`}</p>`}</section>
  ${mod === 'schranka' ? `<section class="panel" style="margin-top:22px"><h2>Posílání z iPhonu</h2><p class="sub">V Tabulce otevři nabídku Asistent a Klíč pro zkratky. Najdeš tam adresu a klíč, který umí jen zapisovat. Zkratka pak pošle text nebo odkaz ze sdílení rovnou sem.</p></section>` : ''}`;
}
function viewModuly() {
  const mods = Object.keys(MODS).filter(m => !MODS[m].hidden && MODS[m].env === 'osobni');
  return `<div class="head"><div><h1>Moduly</h1><p>More Life.</p></div></div>
  <ul class="menu"><li><button type="button" data-action="nav" data-view="m360"><b>MEDIUM 360</b><span>${m360Line()}</span></button></li>
  <li><button type="button" data-action="nav" data-view="fitness"><b>Fitness</b><span>Kroky, spánek, váha</span></button></li>
  ${mods.map(m => `<li><button type="button" data-action="mod-open" data-mod="${m}"><b>${MODS[m].name}</b><span>${recsOf(m).length ? `${recsOf(m).length}× ` : ''}${MODS[m].desc}</span></button></li>`).join('')}</ul>`;
}
function fieldHTML(f, r, first) {
  const [k, l, t, req] = f, v = r[k] ?? '', a = `name="${k}"${req ? ' required' : ''}${first ? ' autofocus' : ''}`;
  if (t === 'area') return `<label>${l}<textarea ${a} style="min-height:110px">${esc(v)}</textarea></label>`;
  if (t.startsWith('sel:')) return `<label>${l}<select ${a}>${t.slice(4).split('|').map(o => `<option${v === o ? ' selected' : ''}>${o}</option>`).join('')}</select></label>`;
  return `<label>${l}<input type="${t === 'num' ? 'number' : t}" ${t === 'num' ? 'step="any" min="0"' : ''} ${a} value="${esc(v)}"></label>`;
}
function modDialog(mod, r, isNew) {
  const d = MODS[mod];
  openDialog(`<form class="dlg" data-form="mod-save" data-mod="${mod}" data-id="${isNew ? '' : r.id}">
    <h2>${isNew ? d.one : d.name}</h2>
    ${d.fields.map((f, i) => fieldHTML(f, r, isNew && i === 0)).join('')}
    ${d.status ? `<label>Stav<select name="${d.status[0]}">${d.status[1].map(o => `<option${(r[d.status[0]] || d.status[1][0]) === o ? ' selected' : ''}>${o}</option>`).join('')}</select></label>` : ''}
    <div class="foot">${isNew ? '<span></span>' : `<div><button class="btn danger" type="button" data-action="mod-delete" data-id="${r.id}">Smazat</button>${mod === 'schranka' ? `<button class="btn" type="button" data-action="drop-task" data-id="${r.id}">Udělat úkol</button><button class="btn" type="button" data-action="drop-note" data-id="${r.id}">Udělat lístek</button>` : ''}</div>`}
      <div><button class="btn" type="button" data-action="dlg-close">Zavřít</button><button class="btn primary">Uložit</button></div></div>
  </form>`);
}

/* ---------- zdraví: jeden záznam na den, id den-RRRR-MM-DD (stejné id píše i motor ze zkratky v iPhonu) ---------- */
const dayRec = d => S.recs.find(r => r.id === 'den-' + d);
function dayPut(d, patch) {
  let r = dayRec(d);
  if (!r) { r = { id: 'den-' + d, mod: 'den', env: 'osobni', date: d, created: Date.now() }; S.recs.push(r); }
  for (const k of Object.keys(patch)) { if (patch[k] === '' || patch[k] == null) delete r[k]; else r[k] = patch[k]; }
}
const HEALTH = [['kroky', 'Kroky', v => Math.round(v).toLocaleString('cs-CZ')], ['spanek', 'Spánek', v => `${String(Math.round(v * 10) / 10).replace('.', ',')} h`], ['pripravenost', 'Oura', v => Math.round(v)], ['vaha', 'Váha', v => `${String(Math.round(v * 10) / 10).replace('.', ',')} kg`]];
function viewFitness() {
  const t = today(), days = Array.from({ length: 14 }, (_, i) => addDays(t, -i));
  const have = days.some(d => dayRec(d));
  const w = S.recs.filter(r => r.mod === 'den' && r.vaha).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  let chart = '';
  if (w.length > 1) { const lo = Math.min(...w.map(r => +r.vaha)), hi = Math.max(...w.map(r => +r.vaha)), sp = (hi - lo) || 1;
    chart = `<svg class="spark" viewBox="0 0 300 70" role="img" aria-label="Váha, posledních ${w.length} vážení, od ${lo} do ${hi} kg"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${w.map((r, i) => `${(i / (w.length - 1) * 296 + 2).toFixed(1)},${(66 - (r.vaha - lo) / sp * 62).toFixed(1)}`).join(' ')}"/></svg>`; }
  return `<div class="head"><div><h1>Fitness</h1><p>Kroky, spánek a skóre z Oury, váha. Tréninky zůstávají v GymRatu.</p></div></div>
  <div class="cols"><div class="stack">
    <section class="panel"><h2>Posledních 14 dní</h2>
      ${have ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Den</th>${HEALTH.map(h => `<th>${h[1]}</th>`).join('')}</tr></thead><tbody>${days.map(d => { const r = dayRec(d) || {}; return `<tr><th>${cap(fmtShort(d))}</th>${HEALTH.map(h => `<td>${r[h[0]] ? h[2](+r[h[0]]) : ''}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>` : `<p class="empty">Zatím žádná data. Zapiš den ručně, nebo zapni zkratku v iPhonu.</p>`}
    </section>
    ${chart ? `<section class="panel"><h2>Váha</h2>${chart}</section>` : ''}
  </div><div class="stack">
    <section class="panel"><h2>Zapsat den</h2>
      <form data-form="day-save" class="dlg" style="padding:0"><label>Den<input type="date" name="date" value="${t}" required></label>
      <div class="two"><label>Váha v kg<input type="number" step="any" min="0" name="vaha"></label><label>Kroky<input type="number" min="0" name="kroky"></label></div>
      <div class="two"><label>Spánek v hodinách<input type="number" step="any" min="0" name="spanek"></label><label>Skóre z Oury<input type="number" min="0" max="100" name="pripravenost"></label></div>
      <p><button class="btn primary">Zapsat</button></p></form>
    </section>
    <section class="panel"><h2>Automaticky z iPhonu</h2><p class="sub">Oura zapisuje do aplikace Zdraví. Zkratka v iPhonu z ní jednou denně přečte kroky, spánek a váhu a pošle je motoru. Adresu, klíč jen pro zápis a přesný tvar zprávy najdeš v Tabulce: nabídka Asistent, Klíč pro zkratky.</p></section>
  </div></div>`;
}

/* ---------- MEDIUM 360 ---------- */
const M = () => S.m360;
const m360Day = d => S.recs.find(r => r.id === 'd360-' + d);
function m360Auto(rule, d) {
  const h = dayRec(d); if (!h) return false;
  if (/krok/i.test(rule.name) && +h.kroky >= 8000) return true;
  if (/sp[aá]n/i.test(rule.name) && +h.spanek >= 7) return true;
  return false;
}
const m360Has = (rule, d) => { const r = m360Day(d); return !!(r && r.done && r.done[rule.id]) || m360Auto(rule, d); };
function m360Score(d) {
  const main = M().rules.filter(r => r.g !== 's'), sup = M().rules.filter(r => r.g === 's');
  const total = main.length + (sup.length ? 1 : 0); if (!total) return null;
  const got = main.filter(r => m360Has(r, d)).length + (sup.length && sup.every(r => m360Has(r, d)) ? 1 : 0);
  return { got, total, pct: got / total };
}
const m360N = d => M().start ? Math.round((parseYmd(d) - parseYmd(M().start)) / 864e5) + 1 : 0;
function m360Line() {
  if (!M().start) return 'Výzva na 360 dní. Zatím neběží.';
  const n = m360N(today()), s = m360Score(today());
  return n < 1 ? `Začíná ${fmtShort(M().start)}` : `Den ${Math.min(n, 360)} z 360${s ? `, dnes ${s.got} z ${s.total}` : ''}`;
}
function m360Card() {
  if (S.env !== 'osobni' || !M().start || !M().rules.length) return '';
  const t = today(), s = m360Score(t);
  return `<section class="panel"><h2>MEDIUM 360</h2><p class="sub">${m360Line()}.</p>
    <div class="checks">${M().rules.filter(r => r.g !== 's').map(r => ruleBtn(r, t)).join('')}</div>
    <p style="margin-top:12px"><button class="btn" type="button" data-action="nav" data-view="m360">Otevřít celou výzvu</button></p></section>`;
}
const ruleBtn = (r, d) => { const auto = m360Auto(r, d); return `<button type="button" class="tick" data-action="m360-tick" data-rule="${r.id}" data-date="${d}" aria-pressed="${m360Has(r, d)}"${auto ? ' disabled title="Splněno podle dat z hodinek"' : ''}>${esc(r.name)}</button>`; };
function view360() {
  if (S.env !== 'osobni') return viewDnes();
  const m = M(), t = today();
  if (!m.start) return `<div class="head"><div><h1>MEDIUM 360</h1><p>Výzva na 360 dní s denními pravidly.</p></div></div>
    <section class="panel"><h2>Kdy začínáš</h2><form data-form="m360-start" style="display:flex;gap:8px;flex-wrap:wrap"><input type="date" name="start" value="${t}" required aria-label="První den výzvy"><button class="btn primary">Spustit výzvu</button></form></section>`;
  const sel = ui.d360 && ui.d360 <= t ? ui.d360 : t, n = m360N(t), s = m360Score(sel);
  const wk = mondayOf(sel), main = m.rules.filter(r => r.g !== 's'), sup = m.rules.filter(r => r.g === 's');
  const dots = Array.from({ length: 360 }, (_, i) => { const d = addDays(m.start, i); if (d > t) return '<i></i>'; const sc = m360Score(d); const lv = !sc ? 0 : sc.pct >= 1 ? 4 : sc.pct >= .75 ? 3 : sc.pct >= .5 ? 2 : sc.pct > 0 ? 1 : 0; return `<i class="l${lv}${d === t ? ' now' : ''}"></i>`; }).join('');
  const past = Array.from({ length: Math.max(0, Math.min(n, 360)) }, (_, i) => m360Score(addDays(m.start, i))).filter(Boolean);
  const full = past.filter(x => x.pct >= 1).length;
  const food = recsOf('recepty').filter(r => r.plan && r.plan >= wk && r.plan <= addDays(wk, 6)).sort((a, b) => a.plan.localeCompare(b.plan));
  const month = t.slice(0, 7), adv = recsOf('mini').find(r => r.mesic === month);
  return `<div class="head"><div><h1>MEDIUM 360</h1><p>${n < 1 ? `Začíná ${fmtShort(m.start)}.` : `Den ${Math.min(n, 360)} z 360. Plných dní ${full}.`}</p></div></div>
  ${m.motto ? `<p class="motto">${esc(m.motto)}</p>` : ''}
  <div class="cols"><div class="stack">
    <section class="panel"><h2>${sel === t ? 'Dnes' : cap(fmtShort(sel))}${s ? `: ${s.got} z ${s.total}` : ''}</h2>
      <div class="weekstrip">${Array.from({ length: 7 }, (_, i) => { const d = addDays(wk, i), sc = d <= t ? m360Score(d) : null; return `<button type="button" data-action="m360-day" data-date="${d}" aria-pressed="${d === sel}"${d > t ? ' disabled' : ''}><span>${DAYS_SHORT[parseYmd(d).getDay()]}</span><b>${sc ? Math.round(sc.pct * 100) + ' %' : ''}</b></button>`; }).join('')}</div>
      ${main.length ? `<div class="checks">${main.map(r => ruleBtn(r, sel)).join('')}</div>` : `<p class="empty">Žádná pravidla. Přidej první vpravo.</p>`}
      ${sup.length ? `<h3 class="h3">Suplementy</h3><div class="checks small">${sup.map(r => ruleBtn(r, sel)).join('')}</div>` : ''}
    </section>
    <section class="panel"><h2>Celá výzva</h2><div class="dots" role="img" aria-label="${full} plných dní z ${past.length} uplynulých">${dots}</div><p class="sub" style="margin-top:10px">Jeden čtvereček je jeden den. Čím tmavší, tím víc pravidel splněno.</p></section>
    ${food.length ? `<section class="panel"><h2>Jídlo tento týden</h2><ul class="rows">${food.map(r => recRow('recepty', r)).join('')}</ul></section>` : ''}
  </div><div class="stack">
    <section class="panel"><h2>MISOGI ${t.slice(0, 4)}</h2><p class="sub">Jedna věc, která definuje celý rok.</p>
      <input type="text" value="${esc(m.misogi || '')}" data-change="m360-misogi" placeholder="Co to letos bude" aria-label="MISOGI"></section>
    <section class="panel"><h2>Mini dobrodružství na tenhle měsíc</h2>${adv ? `<ul class="rows">${recRow('mini', adv)}</ul>` : `<p class="empty">Na tenhle měsíc nic. Jedno malé každý měsíc.</p>`}<p style="margin-top:12px"><button class="btn" type="button" data-action="mod-new" data-mod="mini">Naplánovat</button> <button class="btn quiet" type="button" data-action="mod-open" data-mod="mini">Všechna</button></p></section>
    ${modPanel('milnik')}${modPanel('dohoda')}
    <section class="panel"><details class="fold"><summary><h2>Pravidla a nastavení výzvy</h2></summary>
      <ul class="rows">${m.rules.map(r => `<li class="rec"><span class="rec-main"><span class="row-title">${esc(r.name)}</span>${r.g === 's' ? '<span class="rec-sub">suplement</span>' : ''}</span><button class="row-go" type="button" data-action="m360-rule-del" data-rule="${r.id}" aria-label="Odebrat pravidlo ${esc(r.name)}">Odebrat</button></li>`).join('')}</ul>
      <form data-form="m360-rule" style="display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-top:10px"><input type="text" name="name" placeholder="Nové pravidlo" aria-label="Nové pravidlo" required><select name="g" aria-label="Druh"><option value="p">Pravidlo</option><option value="s">Suplement</option></select><button class="btn">Přidat</button></form>
      <label style="display:grid;gap:6px;margin-top:14px;color:var(--muted);font-size:15px">Heslo výzvy<input type="text" value="${esc(m.motto || '')}" data-change="m360-motto" style="color:var(--ink);font-size:17px"></label>
      <label style="display:grid;gap:6px;margin-top:10px;color:var(--muted);font-size:15px">První den<input type="date" value="${m.start}" data-change="m360-startdate" style="max-width:200px;color:var(--ink);font-size:17px"></label>
    </details></section>
  </div></div>`;
}

/* ---------- události modulů ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action^="mod-"],[data-action^="m360-"],[data-action^="drop-"]'); if (!b) return;
  const a = b.dataset.action, li = b.closest('[data-id]'), id = b.dataset.id || (li && li.dataset.id), r = id && S.recs.find(x => x.id === id);
  switch (a) {
    case 'mod-open': ui.view = 'mod'; ui.mod = b.dataset.mod; render(); window.scrollTo(0, 0); break;
    case 'mod-filter': ui.modF[b.dataset.mod] = b.dataset.v; render(); break;
    case 'mod-new': { const mod = b.dataset.mod, pre = {}; if (mod === 'denik') pre.datum = today(); if (mod === 'mini') pre.mesic = today().slice(0, 7); modDialog(mod, pre, true); break; }
    case 'mod-edit': if (r) modDialog(r.mod, r, false); break;
    case 'mod-cycle': { if (!r) break; const st = MODS[r.mod].status; r[st[0]] = st[1][(st[1].indexOf(r[st[0]] || st[1][0]) + 1) % st[1].length]; save(); render(); break; }
    case 'mod-delete': { const snap = snapshot(); S.recs = S.recs.filter(x => x.id !== id); save(); closeDialog(); render(); toast('Smazáno.', snap); break; }
    case 'drop-task': case 'drop-note': { if (!r) break; const snap = snapshot(), text = r.text + (r.url ? `\n${r.url}` : '');
      if (a === 'drop-task') S.items.push(blankItem({ env: r.env || S.env, kind: 'ukol', title: r.text.split('\n')[0].slice(0, 120), date: '' }));
      else S.notes.push({ id: uid(), env: r.env || S.env, text, color: 'zluta', projectId: '', typeId: '', created: Date.now() });
      r.stav = 'Vyřízené'; save(); closeDialog(); render(); toast(a === 'drop-task' ? 'Je z toho úkol.' : 'Je z toho lístek.', snap); break; }
    case 'm360-day': ui.d360 = b.dataset.date; render(); break;
    case 'm360-tick': { const d = b.dataset.date; let rec = m360Day(d);
      if (!rec) { rec = { id: 'd360-' + d, mod: 'd360', env: 'osobni', date: d, done: {}, created: Date.now() }; S.recs.push(rec); }
      rec.done = { ...rec.done }; if (rec.done[b.dataset.rule]) delete rec.done[b.dataset.rule]; else rec.done[b.dataset.rule] = 1;
      save(); render(); break; }
    case 'm360-rule-del': { const snap = snapshot(); S.m360 = { ...M(), rules: M().rules.filter(x => x.id !== b.dataset.rule) }; save(); render(); toast('Pravidlo odebráno. Odškrtnuté dny zůstaly.', snap); break; }
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form^="mod-"],[data-form^="m360-"],[data-form^="drop-"],[data-form^="day-"]'); if (!f) return;
  e.preventDefault();
  const fd = new FormData(f), g = k => String(fd.get(k) ?? '').trim();
  switch (f.dataset.form) {
    case 'mod-save': { const mod = f.dataset.mod, d = MODS[mod]; let r = f.dataset.id && S.recs.find(x => x.id === f.dataset.id);
      if (!r) { r = { id: uid(), mod, env: d.env === '*' ? S.env : d.env, created: Date.now() }; S.recs.push(r); }
      for (const [k, , t] of d.fields) r[k] = t === 'num' ? (g(k) === '' ? '' : +g(k)) : g(k);
      if (d.status) r[d.status[0]] = g(d.status[0]);
      save(); closeDialog(); render(); break; }
    case 'drop-add': { if (!g('text')) break; const u = /^https?:\/\/\S+$/.test(g('text')); S.recs.push({ id: uid(), mod: 'schranka', env: S.env, text: g('text'), url: u ? g('text') : '', stav: 'Nové', created: Date.now() }); save(); render(); break; }
    case 'day-save': { const p = {}; for (const [k] of HEALTH) if (g(k) !== '') p[k] = +g(k); if (!Object.keys(p).length) { toast('Vyplň aspoň jedno číslo.'); break; } dayPut(g('date'), p); save(); render(); toast('Zapsáno.'); break; }
    case 'm360-start': S.m360 = { ...M(), start: g('start') }; save(); render(); break;
    case 'm360-rule': if (g('name')) { S.m360 = { ...M(), rules: [...M().rules, { id: uid(), name: g('name'), g: g('g') === 's' ? 's' : 'p' }] }; save(); render(); } break;
  }
});
document.addEventListener('change', e => {
  const c = e.target.dataset && e.target.dataset.change; if (!c || !c.startsWith('m360-')) return;
  const v = e.target.value.trim();
  if (c === 'm360-misogi') S.m360 = { ...M(), misogi: v };
  if (c === 'm360-motto') S.m360 = { ...M(), motto: v };
  if (c === 'm360-startdate' && v) S.m360 = { ...M(), start: v };
  save(); if (c !== 'm360-misogi') render();
});
