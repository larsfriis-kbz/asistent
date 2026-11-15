"""Archiv vysílání: import CSV z Notionu, filtry, detail dílu, přepis, synchronizace mezi dvěma zařízeními.
Data jsou vymyšlená, žádný skutečný export."""
import base64, csv, io, json, pathlib, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
KEY = "f00dcafe" * 8
ENGINE = "http://localhost:8797/exec"
payload = base64.urlsafe_b64encode(json.dumps({"u": ENGINE, "k": KEY}).encode()).decode().rstrip("=")
LINK = "https://larsfriis-kbz.github.io/asistent/#pripojit=" + payload

# --- vymyšlený export z Notionu
buf = io.StringIO()
w = csv.writer(buf)
w.writerow(["Name", "Tags", "Channel", "Publish Date", "URL", "Účastníci", "Episode", "Season", "Media Type", "Duration", "Status", "Archive"])
TAGS = [("KUDY BĚŽÍ ZAJÍC", "KUDY BĚŽÍ ZAJÍC"), ("Zajíc ve druhé lize", "KUDY BĚŽÍ ZAJÍC"), ("MISTŘI SVĚTA", "MISTŘI SVĚTA"), ("Zrádci", "YESS TV"), ("Testovací formát", "MMA LETEM SVĚTEM")]
n_ok = 0
for i in range(240):
    tag, ch = TAGS[i % len(TAGS)]
    day = 1 + i % 28
    date = f"October {day}, 2025" if i % 2 else f"{day:02d}/03/2026"
    vid = f"vid{i:08d}"
    people = "Host Jedna, Host Dva" if i % 3 == 0 else ("Host Tři" if i % 3 == 1 else "")
    w.writerow([f"Díl {i}, s čárkou" if i == 7 else f"Díl {i}", tag, f"{ch} (https://www.notion.so/{ch.replace(' ', '-')}-abc123)", date, f"https://www.youtube.com/watch?v={vid}", people, str(i), "7", "YT FREE" if i % 2 else "Herohero", "1:02:00", "Completed", "No"])
    n_ok += 1
w.writerow(["Nápad bez videa", "KUDY BĚŽÍ ZAJÍC", "", "", "", "", "", "", "", "", "Idea", "No"])
w.writerow(["", "", "", "", "", "", "", "", "", "", "", ""])
CSV = buf.getvalue()
csv_path = root / "build/test-content.csv"
csv_path.write_text("﻿" + CSV, encoding="utf-8")
TRANSCRIPT = "0:00 Úvod a pozdrav\n0:42 Rozhodčí v prvním poločase\n12:05 Penalta, která rozhodla\n1:02:03 Závěr a otázka pod čarou\n"

eng = subprocess.Popen(["node", "scripts/mock_engine.js", "8797", KEY], cwd=root, stdout=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, "-m", "http.server", "8798", "--directory", str(root / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
state = lambda: json.load(urllib.request.urlopen("http://localhost:8797/__state"))
errors = []
def watch(pg, name):
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text else None)
def nav(pg, v): pg.click(f'#nav [data-view="{v}"]')
def sync_now(pg):
    nav(pg, "nastaveni"); pg.click('[data-action="sync-now"]'); pg.wait_for_timeout(1200)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ca = b.new_context(viewport={"width": 1300, "height": 900}, locale="cs-CZ", timezone_id="Europe/Prague")
        A = ca.new_page(); watch(A, "A")
        A.goto((root / "private/asistent.html").as_uri())
        nav(A, "nastaveni"); A.fill('[data-form="connect"] input', LINK); A.click('[data-form="connect"] button'); A.wait_for_timeout(1500)
        nav(A, "archiv")
        assert A.locator("text=Nahraj archiv z Notionu").count() == 1
        A.set_input_files('input[data-change="ar-import"]', str(csv_path))
        A.wait_for_selector("#eplist")
        t = A.locator("#toast").inner_text()
        assert f"{n_ok} nových" in t and "1 přeskočeno" in t and "Nové typy pořadů: 1" in t, t
        assert A.locator("#eplist li").count() == 100
        A.click('[data-action="ar-more"]'); assert A.locator("#eplist li").count() == 200
        # filtr projektu a typu
        A.click('.fchip[data-k="p"]:has-text("MISTŘI SVĚTA")')
        assert A.locator("#eplist li").count() == 48, A.locator("#eplist li").count()
        A.click('.fchip[data-k="p"]:has-text("KUDY BĚŽÍ ZAJÍC")')
        A.select_option('select[data-k="t"]', label="Zajíc ve druhé lize")
        assert A.locator("#eplist li").count() == 48
        A.click('.fchip[data-k="p"][data-v=""]')
        A.fill('input[data-input="ar-q"]', "s čárkou"); A.wait_for_timeout(400)
        assert A.locator("#eplist li").count() == 1
        A.fill('input[data-input="ar-q"]', "host tři"); A.wait_for_timeout(400)
        assert A.locator("#eplist li").count() == 80
        A.fill('input[data-input="ar-q"]', ""); A.wait_for_timeout(400)
        A.select_option('select[data-k="y"]', "2025")
        assert "filtru odpovídá 120" in A.locator(".head p").first.inner_text()
        A.select_option('select[data-k="y"]', "")
        # detail dílu
        A.fill('input[data-input="ar-q"]', "Díl 12"); A.wait_for_timeout(400)
        A.locator("#eplist .ep b").get_by_text("Díl 12", exact=True).click()
        assert A.locator("h1#eptitle").inner_text() == "Díl 12"
        assert A.locator('.pchip[aria-pressed="true"]').count() == 2
        A.locator('.pchip[data-name="Host Dva"]').click()
        A.fill('[data-form="ar-person-add"] input', "Nový Host"); A.click('[data-form="ar-person-add"] button')
        A.fill('textarea[data-f="notes"]', "Tady se řešil penaltový zákrok."); A.locator("h1#eptitle").click()
        A.fill("#trpaste", TRANSCRIPT); A.click('[data-action="ar-tr-paste"]')
        A.wait_for_selector("#trbox a.ts")
        hrefs = A.locator("#trbox a.ts").evaluate_all("els => els.map(e => e.getAttribute('href'))")
        assert hrefs[2].endswith("v=vid00000012&t=725s") and hrefs[3].endswith("&t=3723s"), hrefs
        A.fill("#trsearch", "penalta"); A.wait_for_timeout(200)
        assert A.locator("#trbox p").count() == 1
        A.screenshot(path=str(root / "shots/archiv-dil.png"), full_page=True)
        A.wait_for_timeout(2500)
        st = state()
        assert len(st["sheets"]["archiv"]) == n_ok, len(st["sheets"]["archiv"])
        assert len(st["sheets"]["prepisy"]) == 1
        rec = next(json.loads(r[3][1:]) for r in st["sheets"]["archiv"] if r[0] == "~yt-vid00000012")
        assert rec["people"] == ["Host Jedna", "Nový Host"] and rec["notes"].startswith("Tady") and rec["hasTr"], rec
        nav(A, "archiv"); A.click('.fchip[data-k="p"][data-v=""]'); A.fill('input[data-input="ar-q"]', ""); A.wait_for_timeout(300)
        A.screenshot(path=str(root / "shots/archiv.png"), full_page=False)

        # --- B: telefon, veřejná verze
        cb = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="cs-CZ", timezone_id="Europe/Prague")
        B = cb.new_page(); watch(B, "B")
        B.goto("http://localhost:8798/#pripojit=" + payload)
        B.wait_for_timeout(2500)
        B.click('#tabbar [data-view="vice"]'); B.click('.menu [data-view="archiv"]')
        B.wait_for_selector("#eplist")
        assert f"{n_ok} dílů" in B.locator(".head p").first.inner_text()
        B.fill('input[data-input="ar-q"]', "Díl 12"); B.wait_for_timeout(400)
        B.locator("#eplist .ep b").get_by_text("Díl 12", exact=True).click()
        assert B.input_value('textarea[data-f="notes"]').startswith("Tady se řešil")
        B.wait_for_selector("#trbox a.ts")          # přepis stažený z motoru
        B.screenshot(path=str(root / "shots/archiv-dil-mobil.png"), full_page=True)
        # B smaže jiný díl, A ho přestane vidět
        B.click('main [data-action="nav"][data-view="archiv"]')
        B.fill('input[data-input="ar-q"]', "Díl 13"); B.wait_for_timeout(400)
        B.locator("#eplist .ep b").get_by_text("Díl 13", exact=True).click()
        B.click('[data-action="ar-delete"]'); B.wait_for_timeout(2500)
        sync_now(A); nav(A, "archiv")
        A.fill('input[data-input="ar-q"]', "Díl 13"); A.wait_for_timeout(400)
        assert A.locator("#eplist .ep b").get_by_text("Díl 13", exact=True).count() == 0, "smazání z B"
        # opětovný import: nic nového, poznámky zůstanou
        A.set_input_files('input[data-change="ar-import"]', str(csv_path)); A.wait_for_timeout(500)
        t = A.locator("#toast").inner_text()
        assert "0 nových" in t and f"{n_ok - 1} doplněných" in t or f"1 nových, {n_ok - 1} doplněných" in t, t
        A.fill('input[data-input="ar-q"]', "Díl 12"); A.wait_for_timeout(400)
        A.locator("#eplist .ep b").get_by_text("Díl 12", exact=True).click()
        assert A.input_value('textarea[data-f="notes"]').startswith("Tady se řešil")
        assert A.locator('.pchip[aria-pressed="true"]').count() == 2, "ručně upravení účastníci přežijí import"
        # odškrtnuté vysílání se zapíše do archivu
        nav(A, "tyden"); A.locator(".day.today .add").click()
        A.fill('#dlg input[name=title]', "Vysílání z plánu"); A.select_option('#dlg select[name=kind]', "vysilani"); A.click('#dlg button.primary')
        nav(A, "dnes"); A.locator(".row", has_text="Vysílání z plánu").locator(".check").click()
        assert "Zapsáno do archivu" in A.locator("#toast").inner_text()
        nav(A, "archiv"); A.fill('input[data-input="ar-q"]', "z plánu"); A.wait_for_timeout(400)
        assert A.locator("#eplist .ep").count() == 1
        # osobní prostředí archiv nemá
        A.click('[data-action="env"][data-env="osobni"]')
        assert A.locator('#nav [data-view="archiv"]').count() == 0
        b.close()
    print("chyby v konzoli:", errors or "žádné")
    assert not errors
    print("ARCHIV OK")
finally:
    eng.terminate(); web.terminate()
