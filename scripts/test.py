import sys, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
url = (root / "private/asistent.html").as_uri()
shots = root / "shots"; shots.mkdir(exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1360, "height": 900}, locale="cs-CZ", timezone_id="Europe/Prague")
    pg = ctx.new_page()
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
    pg.goto(url)
    assert pg.locator(".prompter blockquote").inner_text().strip(), "myšlenka chybí"
    # rychlé přidání do plánu dne
    pg.fill('[data-form="quick-item"] input[name=title]', "Připravit KBZ #310")
    pg.fill('[data-form="quick-item"] input[name=est]', "45")
    pg.click('[data-form="quick-item"] button')
    pg.fill('[data-form="quick-item"] input[name=title]', "Thumbnail MISTŘI SVĚTA")
    pg.click('[data-form="quick-item"] button')
    assert pg.locator(".rows .row").count() == 2
    # vysílání přes dialog
    pg.click('[data-action="nav"][data-view="tyden"] >> visible=true')
    pg.locator(".day.today .add").click()
    pg.fill('#dlg input[name=title]', "KUDY BĚŽÍ ZAJÍC #310")
    pg.select_option('#dlg select[name=kind]', "vysilani")
    pg.select_option('#dlg select[name=where]', index=2)
    pg.fill('#dlg input[name=time]', "13:30")
    pg.fill('#dlg input[name=est]', "120")
    pg.click('#dlg button.primary')
    assert pg.locator(".day.today .blk").count() == 3
    pg.screenshot(path=str(shots / "tyden-desktop.png"), full_page=True)
    # spínač
    pg.click('[data-action="nav"][data-view="dnes"] >> visible=true')
    pg.fill('#firststep', "Otevřít šablonu a napsat tři témata")
    pg.click('[data-action="run-start"]')
    pg.wait_for_timeout(2300)
    assert pg.locator("#clock").inner_text() in ("00:02", "00:03"), pg.locator("#clock").inner_text()
    pg.screenshot(path=str(shots / "dnes-desktop-bezi.png"), full_page=True)
    pg.click('[data-action="run-done"]')
    assert "Hotovo" in pg.locator("#toast").inner_text()
    assert pg.locator(".row.is-done").count() == 1
    pg.click('#toast [data-action="undo"]')
    assert pg.locator(".row.is-done").count() == 0 and pg.locator("#clock").count() == 1, "undo má vrátit běžící časovač"
    pg.click('[data-action="run-stop"]')
    # hotovo přes zaškrtnutí + opakovaný úkol v osobním
    pg.click('[data-action="env"][data-env="osobni"]')
    pg.click('[data-action="nav"][data-view="ukoly"] >> visible=true')
    n_before = pg.locator(".row").count()
    pg.locator(".row", has_text="Vysát").locator(".check").click()
    pg.click('[data-action="toggle-done"]')
    assert pg.locator(".row.is-done", has_text="Vysát").count() == 1
    assert pg.locator(".row:not(.is-done)", has_text="Vysát").count() == 1, "další výskyt opakovaného úkolu"
    pg.screenshot(path=str(shots / "ukoly-osobni.png"), full_page=True)
    # lístky
    pg.click('[data-action="env"][data-env="prace"]')
    pg.click('[data-action="nav"][data-view="listky"] >> visible=true')
    for i, (txt, col) in enumerate([("Hook: začít otázkou z chatu, ne pozdravem.", "ruzova"), ("StreamYard: před vysíláním zkontrolovat banner Herohero.", "modra"), ("Nápad: Zajíc v číslech, 10 minut jen statistiky kola.", "zelena"), ("Moment 41:20, host o rozhodčích, dát do shorts.", "oranzova")]):
        pg.fill('[data-form="note-add"] textarea', txt)
        pg.click(f'.composer .swatch[data-color="{col}"]')
        pg.select_option('[data-form="note-add"] select[name=where]', index=1 + i)
        pg.click('[data-form="note-add"] button.primary')
    assert pg.locator(".board .note").count() == 5
    pg.click('.fchip[data-color="modra"]')
    assert pg.locator(".board .note").count() == 1
    pg.click('.fchip[data-color=""]')
    pg.locator(".board .note").first.click()
    pg.click('#dlg .swatch[data-color="fialova"]')
    pg.click('#dlg button.primary')
    pg.screenshot(path=str(shots / "listky-desktop.png"), full_page=True)
    # nastavení: pojmenování barvy
    pg.click('[data-action="nav"][data-view="nastaveni"] >> visible=true')
    pg.fill('[data-change="colorname"][data-color="zluta"]', "Nápad")
    pg.locator('[data-change="colorname"][data-color="zluta"]').blur()
    pg.screenshot(path=str(shots / "nastaveni-desktop.png"), full_page=True)
    pg.click('[data-action="nav"][data-view="listky"] >> visible=true')
    assert "Nápad" in pg.locator(".filters").inner_text()
    # přetrvání po znovunačtení
    pg.reload()
    pg.click('[data-action="nav"][data-view="listky"] >> visible=true')
    assert pg.locator(".board .note").count() == 5, "data po reloadu"
    pg.click('[data-action="nav"][data-view="dnes"] >> visible=true')
    pg.screenshot(path=str(shots / "dnes-desktop.png"), full_page=True)
    # tmavý vzhled + telefon
    state = pg.evaluate("localStorage.getItem('asistent.v1')")
    m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="cs-CZ", timezone_id="Europe/Prague")
    mp = m.new_page()
    mp.on("pageerror", lambda e: errors.append("PAGEERROR mobile " + str(e)))
    mp.goto(url)
    mp.evaluate("s => localStorage.setItem('asistent.v1', s)", state)
    mp.reload()
    mp.screenshot(path=str(shots / "dnes-mobil.png"), full_page=True)
    mp.click('#tabbar [data-view="tyden"]')
    mp.screenshot(path=str(shots / "tyden-mobil.png"), full_page=False)
    mp.click('#tabbar .plus')
    mp.screenshot(path=str(shots / "listek-mobil.png"), full_page=False)
    mp.click('[data-action="dlg-close"]')
    mp.click('[data-action="env"][data-env="osobni"]')
    mp.click('.iconbtn')
    mp.click('[data-action="theme"][data-t="dark"]')
    mp.click('#tabbar [data-view="dnes"]')
    mp.screenshot(path=str(shots / "dnes-mobil-osobni-tmave.png"), full_page=True)
    w = mp.evaluate("document.documentElement.scrollWidth")
    assert w <= 390, f"vodorovné přetečení na telefonu: {w}"
    b.close()
print("chyby v konzoli:", errors or "žádné")
print("OK")
