import base64, json, pathlib, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
KEY = "a1b2c3d4" * 8
ENGINE = "http://localhost:8797/exec"
payload = base64.urlsafe_b64encode(json.dumps({"u": ENGINE, "k": KEY}).encode()).decode().rstrip("=")
eng = subprocess.Popen(["node", "scripts/mock_engine.js", "8797", KEY], cwd=root, stdout=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, "-m", "http.server", "8798", "--directory", str(root / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
def post(body):
    r = urllib.request.Request(ENGINE, data=json.dumps(body).encode(), headers={"Content-Type": "text/plain"})
    return json.load(urllib.request.urlopen(r))
errors = []
def watch(pg, name):
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text and "ERR_FAILED" not in m.text else None)
def nav(pg, v): pg.click(f'[data-action="nav"][data-view="{v}"] >> visible=true')
def synced(pg): pg.wait_for_function("document.querySelector('[data-sync]') && /Synchronizováno/.test(document.querySelector('[data-sync]').textContent)", timeout=8000)
def sync_now(pg): nav(pg, "nastaveni"); pg.click('[data-action="sync-now"]'); pg.wait_for_timeout(900)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ca = b.new_context(viewport={"width": 1300, "height": 900}, locale="cs-CZ", timezone_id="Europe/Prague")
        A = ca.new_page(); watch(A, "A")
        A.goto((root / "private/asistent.html").as_uri())
        nav(A, "nastaveni"); A.fill('[data-form="connect"] input', "https://larsfriis-kbz.github.io/asistent/#pripojit=" + payload); A.click('[data-form="connect"] button'); synced(A)
        # Schránka v práci
        nav(A, "schranka"); A.fill('[data-form="drop-add"] input', "https://example.com/clanek"); A.click('[data-form="drop-add"] button')
        assert A.locator(".rec").count() == 1
        # zkratka z iPhonu: špatný klíč neprojde, správný zapíše
        assert post({"op": "drop", "key": "x" * 32, "text": "ne"})["error"] == "auth"
        assert post({"op": "drop", "key": KEY, "text": "Nápad na díl z telefonu", "prostredi": "prace"})["ok"]
        assert post({"op": "health", "key": " " + KEY + " ", "kroky": 9120, "spanek": "7,5", "vaha": 80.4})["ok"]
        assert post({"op": "health", "key": KEY})["error"] == "empty"
        sync_now(A); nav(A, "schranka")
        assert A.locator(".rec").count() == 2 and A.get_by_text("Nápad na díl z telefonu").count() == 1
        A.get_by_text("Nápad na díl z telefonu").click(); A.click('[data-action="drop-task"]')
        nav(A, "ukoly"); assert A.get_by_text("Nápad na díl z telefonu", exact=True).count() >= 1
        # Čísla: kanál přes motor, Herohero ručně a přes klíč pro zkratky
        nav(A, "cisla"); A.fill('[data-form="num-channel"] input', "https://www.youtube.com/@testkanal"); A.click('[data-form="num-channel"] button')
        A.wait_for_function("/12.345/.test(document.querySelector('.tiles').textContent)", timeout=8000)
        assert "Kanál @testkanal" in A.locator(".tiles").inner_text()
        A.fill('[data-form="num-set"][data-k="m-hh-kbz"] input', "250"); A.click('[data-form="num-set"][data-k="m-hh-kbz"] button')
        assert "250" in A.locator(".tile", has_text="Herohero KUDY").inner_text()
        v = post({"op": "yt", "key": KEY, "videos": ["abcdefghijk", "spatne"]}); assert v["ok"] and v["videos"]["abcdefghijk"]["v"] == 1500 and len(v["videos"]) == 1
        sync_now(A)
        assert post({"op": "number", "key": KEY, "nazev": "herohero yess tv", "hodnota": 77})["ok"]
        assert post({"op": "number", "key": KEY, "nazev": "neznámé", "hodnota": 1})["error"] == "empty"
        sync_now(A); nav(A, "cisla"); assert "77" in A.locator(".tile", has_text="YESS").inner_text()
        A.screenshot(path=str(root / "build/shot_cisla.png"), full_page=True)
        # osobní prostředí
        A.click('[data-action="env"][data-env="osobni"]')
        nav(A, "m360"); A.click('[data-form="m360-start"] button')
        assert A.locator(".motto").count() == 1 and A.locator(".dots i").count() == 360
        assert "Den 1 z 360" in A.locator(".head p").inner_text()
        kroky = A.locator('.tick', has_text="8 000 kroků").first
        assert kroky.get_attribute("aria-pressed") == "true" and kroky.is_disabled(), "kroky ze zdraví se mají splnit samy"
        A.locator('.tick', has_text="Gym").first.click()
        assert "3 z 8" in A.locator(".panel h2").first.inner_text(), A.locator(".panel h2").first.inner_text()
        A.screenshot(path=str(root / "build/shot_360.png"), full_page=True)
        nav(A, "dnes"); assert A.locator(".panel h2", has_text="MEDIUM 360").count() == 1
        nav(A, "moduly"); A.click('[data-action="mod-open"][data-mod="finance"]')
        A.click('.head [data-action="mod-new"]'); A.fill('.dlg [name=nazev]', "Hudba"); A.fill('.dlg [name=castka]', "1200"); A.select_option('.dlg [name=obdobi]', "Ročně"); A.click('.dlg .primary')
        assert "Měsíčně 100 Kč" in A.locator(".head p").inner_text(), A.locator(".head p").inner_text()
        nav(A, "moduly"); A.click('[data-action="mod-open"][data-mod="knihy"]'); A.click('.head [data-action="mod-new"]'); A.fill('.dlg [name=nazev]', "Testovací kniha"); A.click('.dlg .primary')
        A.click('[data-action="mod-cycle"]'); assert A.locator('[data-action="mod-cycle"]').inner_text() == "Čtu"
        nav(A, "moduly"); A.click('main [data-action="nav"][data-view="fitness"]'); assert "9" in A.locator(".tbl tbody tr").first.inner_text() and "80,4 kg" in A.locator(".tbl").inner_text()
        A.screenshot(path=str(root / "build/shot_fitness.png"), full_page=True)
        sync_now(A)
        # B: veřejná appka na telefonu dostane totéž
        cb = b.new_context(viewport={"width": 390, "height": 800}, locale="cs-CZ", timezone_id="Europe/Prague")
        B = cb.new_page(); watch(B, "B")
        B.goto("http://localhost:8798/#pripojit=" + payload); B.wait_for_timeout(1800)
        B.click('[data-action="env"][data-env="osobni"]'); nav(B, "vice"); B.click('main [data-action="nav"][data-view="m360"]')
        assert B.locator(".motto").count() == 1 and B.locator('.tick', has_text="Gym").first.get_attribute("aria-pressed") == "true"
        assert B.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "stránka na telefonu přetéká do šířky"
        B.screenshot(path=str(root / "build/shot_360_mobil.png"), full_page=True)
        nav(B, "vice"); B.click('main [data-action="nav"][data-view="moduly"]'); B.click('[data-action="mod-open"][data-mod="knihy"]')
        assert B.get_by_text("Testovací kniha").count() == 1
        b.close()
    assert not errors, errors
    print("MODULY OK")
finally:
    eng.terminate(); web.terminate()
