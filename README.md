# Asistent

Osobní appka na telefon i počítač: plán dne, týden s časy, úkoly s opakováním, barevné lístky a pětiminutový start pro věci, do kterých se nechce.

V tomhle repozitáři je jen kód. Žádná data tu nejsou.

## Jak to funguje

- **Appka** je jedna stránka (`index.html`). Běží z GitHub Pages, jde přidat na plochu a funguje i bez sítě.
- **Motor** je skript v Google Tabulce (`motor/Code.gs`). Smí sahat jen na tu jednu Tabulku. Appka mu posílá svůj stav, motor ho sloučí s uloženým a vrátí výsledek.
- **Propojení** je odkaz s klíčem, který si v Tabulce vygeneruje majitel. Bez klíče motor nic nevydá.

## Složky

| Co | Kde |
|---|---|
| Hotová appka pro Pages | `index.html`, `sw.js`, `manifest.webmanifest`, ikony |
| Zdroj appky | `src/` |
| Motor pro Google Tabulku | `motor/` |
| Sestavení a testy | `scripts/` |

## Sestavení

```
npm install
python3 scripts/build.py
python3 scripts/test_sync.py
```

`build.py` čeká dva soukromé vstupy, které v repozitáři nejsou: `build/thoughts.json` a `private/seed.json`.
