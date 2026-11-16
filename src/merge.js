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
