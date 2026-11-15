import re, json, sys, glob, collections
out = []
for path in sys.argv[2:]:
    show = "Diary of a CEO" if "Diary" in path else "Huberman Lab"
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^- \*\*\[(.+?)\]\*\*\s*(.+)$", line.strip())
        if not m:
            continue
        cat, body = m.group(1).strip(), m.group(2).strip()
        src = ""
        ms = re.search(r"\(Zdroj:\s*(.+?)\)\s*$", body)
        if ms:
            src = ms.group(1).strip()
            body = body[:ms.start()].strip()
        body = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", body)
        body = re.sub(r"\[\[([^\]]*)\]\]", r"\1", body)
        why = ""
        mw = re.search(r"_Proč to funguje:_\s*", body)
        if mw:
            why = body[mw.end():].strip()
            body = body[:mw.start()].strip()
        body = body.replace("**", "").strip()
        why = why.replace("**", "").strip()
        out.append({"k": cat, "t": body, "w": why, "s": src or show})
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
c = collections.Counter(o["k"] for o in out)
print(len(out), "poznatků")
for k, n in c.most_common():
    print(n, k)
lens = sorted(len(o["t"]) for o in out)
print("délka textu medián", lens[len(lens)//2], "max", lens[-1], "do 220 znaků:", sum(1 for l in lens if l <= 220))
