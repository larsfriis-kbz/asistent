"""Složí src/ do hotových souborů.
dist/            veřejná appka pro GitHub Pages: bez myšlenek a bez výchozích dat
private/asistent.html  soukromá verze s myšlenkami z destilátů a výchozím naplněním
motor/Code.gs    skript pro Google Tabulku
"""
import base64, hashlib, json, pathlib, shutil, subprocess

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"
fonts_dir = root / "node_modules/@fontsource/atkinson-hyperlegible-next/files"
RANGES = {
    "latin": "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
}
faces = []
for subset, rng in RANGES.items():
    for w in (400, 700):
        f = fonts_dir / f"atkinson-hyperlegible-next-{subset}-{w}-normal.woff2"
        b64 = base64.b64encode(f.read_bytes()).decode()
        faces.append(
            f'@font-face{{font-family:"Atkinson Hyperlegible Next";font-style:normal;font-weight:{w};font-display:swap;'
            f'src:url(data:font/woff2;base64,{b64}) format("woff2");unicode-range:{rng}}}'
        )

merge = (src / "merge.js").read_text(encoding="utf-8")
css = (src / "styles.css").read_text(encoding="utf-8").replace("/*__FONTS__*/", "\n".join(faces))
js = (src / "app.js").read_text(encoding="utf-8").replace("/*__MERGE__*/", merge).replace("/*__ARCHIVE__*/", (src / "archive.js").read_text(encoding="utf-8")).replace("/*__MODULES__*/", (src / "modules.js").read_text(encoding="utf-8") + (src / "numbers.js").read_text(encoding="utf-8"))
assert "/*__ARCHIVE__*/" not in js and "/*__MODULES__*/" not in js
html = (src / "index.html").read_text(encoding="utf-8")
qr = subprocess.run(["npx", "esbuild", "scripts/qr_entry.js", "--bundle", "--minify", "--format=iife", "--log-level=error"],
                    cwd=root, capture_output=True, text=True, check=True).stdout
for part in (js, qr):
    assert "</script" not in part.lower()

def make(thoughts_json: str, seed_json: str) -> str:
    esc = lambda t: t.replace("</", "<\\/")
    out = html.replace("/*__STYLES__*/", css).replace("/*__QR__*/", qr).replace("/*__APP__*/", js)
    return out.replace("__THOUGHTS__", esc(thoughts_json)).replace("__SEED__", esc(seed_json))

thoughts = (root / "build/thoughts.json").read_text(encoding="utf-8"); json.loads(thoughts)
seed = (root / "private/seed.json").read_text(encoding="utf-8"); json.loads(seed)

dist = root / "dist"
shutil.rmtree(dist, ignore_errors=True); dist.mkdir()
public = make("[]", "null")
for word in ("KUDY BĚŽÍ", "Převléknout", "Proč to funguje:_", "NESEŽEREŠ", "Kreatin", "Herohero KUDY"):
    assert word not in public, f"do veřejné verze proteklo: {word}"
(dist / "index.html").write_text(public, encoding="utf-8")
build_id = hashlib.sha256(public.encode()).hexdigest()[:10]
for f in (root / "pwa").iterdir():
    if f.name == "sw.js":
        (dist / f.name).write_text(f.read_text(encoding="utf-8").replace("__BUILD__", build_id), encoding="utf-8")
    else:
        shutil.copy(f, dist / f.name)
(dist / ".nojekyll").write_text("", encoding="utf-8")

(root / "private/asistent.html").write_text(make(thoughts, seed), encoding="utf-8")
code = (root / "motor/Code.src.gs").read_text(encoding="utf-8").replace("/*__MERGE__*/", merge)
(root / "motor/Code.gs").write_text(code, encoding="utf-8")

print("dist/index.html", round((dist / "index.html").stat().st_size / 1024), "kB, build", build_id)
print("private/asistent.html", round((root / "private/asistent.html").stat().st_size / 1024), "kB")
print("motor/Code.gs", round((root / "motor/Code.gs").stat().st_size / 1024, 1), "kB")
