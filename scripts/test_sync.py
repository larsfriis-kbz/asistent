import base64, json, pathlib, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
KEY = "a1b2c3d4" * 8
ENGINE = "http://localhost:8787/exec"
payload = base64.urlsafe_b64encode(json.dumps({"u": ENGINE, "k": KEY}).encode()).decode().rstrip("=")
LINK = "https://larsfriis-kbz.github.io/asistent/#pripojit=" + payload
eng = subprocess.Popen(["node", "scripts/mock_engine.js", "8787", KEY], cwd=root, stdout=subprocess.DEVNULL)
web = subprocess.Popen([sys.executable, "-m", "http.server", "8788", "--directory", str(root / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
state = lambda: json.load(urllib.request.urlopen("http://localhost:8787/__state"))
errors = []
def watch(pg, name):
    pg.on("pageerror", lambda e: errors.append(f"{name}: {e}"))
    pg.on("console", lambda m: errors.append(f"{name} console: {m.text}") if m.type == "error" and "Failed to load resource" not in m.text and "ERR_FAILED" not in m.text else None)
def synced(pg):
    pg.wait_for_function("document.querySelector('[data-sync]') && /Synchronizováno/.test(document.querySelector('[data-sync]').textContent)", timeout=8000)
def nav(pg, v): pg.click(f'[data-action="nav"][data-view="{v}"] >> visible=true')
def sync_now(pg):
    nav(pg, "nastaveni"); pg.click('[data-action="sync-now"]'); pg.wait_for_timeout(700)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # --- A: soukromý soubor s výchozími daty a myšlenkami
        ca = b.new_context(viewport={"width": 1300, "height": 900}, locale="cs-CZ", timezone_id="Europe/Prague")
        A = ca.new_page(); watch(A, "A")
        A.goto((root / "private/asistent.html").as_uri())
        assert A.locator(".prompter blockquote").count() == 1
        nav(A, "nastaveni")
        A.fill('[data-form="connect"] input', "nesmysl"); A.click('[data-form="connect"] button')
        assert "není propojovací odkaz" in A.locator("#toast").inner_text()
        A.fill('[data-form="connect"] input', LINK); A.click('[data-form="connect"] button')
        synced(A)
        A.wait_for_timeout(1500)   # nahrání myšlenek
        st = state()
        assert len(st["sheets"]["projects"]) == 14, len(st["sheets"]["projects"])
        assert len(st["sheets"]["items"]) == 5
        assert st["props"].get("THOUGHTS_N") == "1674", st["props"]
        assert all(len(r[0]) <= 40001 for r in st["sheets"]["myslenky"])
        # QR a odkaz pro další zařízení
        A.click('[data-action="show-link"]')
        assert A.locator("#linkbox svg").count() == 1
        link_a = A.locator("#linktext").input_value()
        pl = link_a.split("#pripojit=")[1]; dec = json.loads(base64.urlsafe_b64decode(pl + "=" * (-len(pl) % 4)))
        assert dec == {"u": ENGINE, "k": KEY} and link_a.startswith("https://larsfriis-kbz.github.io/asistent/#"), "odkaz pro další zařízení"
        A.screenshot(path=str(root / "shots/propojeni.png"), full_page=True)

        # --- B: veřejná verze, propojení odkazem v adrese
        cb = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="cs-CZ", timezone_id="Europe/Prague")
        B = cb.new_page(); watch(B, "B")
        B.goto("http://localhost:8788/")
        assert B.locator("text=Tohle zařízení ještě není propojené").count() == 1
        assert B.locator(".prompter").count() == 0, "veřejná verze nesmí mít myšlenky bez motoru"
        B.goto("http://localhost:8788/#pripojit=" + payload); B.reload()
        B.goto("http://localhost:8788/#pripojit=" + payload)
        B.wait_for_function("!location.hash")
        B.wait_for_selector(".prompter blockquote", timeout=8000)      # myšlenky dorazily z motoru
        assert "pripojit" not in B.url
        B.click('[data-action="env"][data-env="osobni"]'); B.click('#tabbar [data-view="ukoly"]')
        assert B.locator(".row", has_text="Vysát").count() == 1, "úkoly z A mají být na B"
        B.click('[data-action="env"][data-env="prace"]')

        # --- B píše lístek, A ho uvidí
        B.click('#tabbar .plus'); B.fill('#dlg textarea', "Lístek z telefonu"); B.click('#dlg button.primary')
        B.wait_for_timeout(3200)
        sync_now(A); nav(A, "listky")
        assert A.locator(".note", has_text="Lístek z telefonu").count() == 1
        # --- A ho smaže, na B zmizí
        A.locator(".note", has_text="Lístek z telefonu").click(); A.click('[data-action="note-delete"]')
        A.wait_for_timeout(3200)
        B.click('.iconbtn'); B.click('[data-action="sync-now"]'); B.wait_for_timeout(800); B.click('#tabbar [data-view="listky"]')
        assert B.locator(".note", has_text="Lístek z telefonu").count() == 0, "smazání se má přenést"
        # --- vrácení smazání na A přebije značku smazání
        A.click('#toast [data-action="undo"]'); A.wait_for_timeout(3200)
        B.click('.iconbtn'); B.click('[data-action="sync-now"]'); B.wait_for_timeout(800); B.click('#tabbar [data-view="listky"]')
        assert B.locator(".note", has_text="Lístek z telefonu").count() == 1, "vrácený lístek se má vrátit i na B"

        # --- B bez spojení: práce pokračuje, po obnovení se dožene
        B.route("**/exec", lambda r: r.abort())
        B.click('#tabbar [data-view="dnes"]')
        B.fill('[data-form="quick-item"] input[name=title]', "Offline úkol"); B.click('[data-form="quick-item"] button')
        B.wait_for_timeout(3000)
        B.click('.iconbtn'); assert "Bez spojení" in B.locator('main [data-sync]').inner_text()
        # mezitím A upraví stejný záznam (lístek) a B taky: vyhraje pozdější úprava
        nav(A, "listky"); A.locator(".note", has_text="Lístek z telefonu").click(); A.fill('#dlg textarea', "Lístek upravený na A"); A.click('#dlg button.primary'); A.wait_for_timeout(3000)
        B.click('#tabbar [data-view="listky"]'); B.locator(".note", has_text="Lístek z telefonu").click(); B.fill('#dlg textarea', "Lístek upravený na B později"); B.click('#dlg button.primary')
        B.unroute("**/exec"); B.wait_for_timeout(3500)
        sync_now(A); nav(A, "listky")
        assert A.locator(".note", has_text="Lístek upravený na B později").count() == 1 and A.locator(".note", has_text="upravený na A").count() == 0
        nav(A, "dnes"); assert A.locator(".row", has_text="Offline úkol").count() == 1

        # --- rozepsaný text na B přežije synchronizaci
        B.click('#tabbar [data-view="dnes"]')
        B.fill('[data-form="quick-item"] input[name=title]', "rozepsáno")
        A.fill('[data-form="quick-item"] input[name=title]', "Úkol z počítače"); A.click('[data-form="quick-item"] button'); A.wait_for_timeout(3000)
        B.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); B.wait_for_timeout(1500)
        assert B.input_value('[data-form="quick-item"] input[name=title]') == "rozepsáno", "sync nesmí smazat rozepsaný text"
        B.fill('[data-form="quick-item"] input[name=title]', ""); B.locator("h1").click(); B.wait_for_timeout(600)
        assert B.locator(".row", has_text="Úkol z počítače").count() == 1
        B.screenshot(path=str(root / "shots/mobil-synchronizovano.png"), full_page=True)

        # --- špatný klíč
        cc = b.new_context(); C = cc.new_page(); watch(C, "C")
        bad = base64.urlsafe_b64encode(json.dumps({"u": ENGINE, "k": "x" * 64}).encode()).decode().rstrip("=")
        C.goto("http://localhost:8788/#pripojit=" + bad); C.wait_for_timeout(1500)
        C.click('[data-action="nav"][data-view="nastaveni"] >> visible=true')
        assert "odmítl klíč" in C.locator('main [data-sync]').inner_text()
        assert C.locator(".row").count() == 0
        # --- záloha na motoru a žádný únik klíče do stavu
        st = state()
        assert len(st["sheets"]["zalohy"]) == 1
        assert KEY not in json.dumps(st["sheets"])
        b.close()
    print("chyby v konzoli:", errors or "žádné"); print("SYNC OK")
finally:
    eng.terminate(); web.terminate()
