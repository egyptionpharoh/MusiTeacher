"""لقطات وضع التركيز: بعد الضغط على زر التركيز لعدة ألعاب (المسار المحمي)."""
import sys
from playwright.sync_api import sync_playwright
B = 'http://localhost:5300'; OUT = sys.argv[1]; GAMES = sys.argv[2:]
CLICK_START = """() => { const els=[...document.querySelectorAll('button,[role=button]')].filter(b=>/ابدأ|ابدا|start/i.test(b.textContent||'')&&b.offsetParent!==null); if(els[0]) els[0].click(); }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    for g in GAMES:
        ctx = b.new_context(viewport={'width': 1366, 'height': 768}); ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
        pg.goto(f'{B}/embed.html?id={g}'); pg.wait_for_timeout(7000)
        fr = [f for f in pg.frames if '/play/' in f.url][0]; fr.evaluate(CLICK_START); pg.wait_for_timeout(1500)
        sel = '#mtFocus' if fr.query_selector('#mtFocus') else '#mtFocusBtn'
        has = bool(fr.query_selector(sel)); print(g, 'focus button:', has, 'errors:', errs[:2], flush=True)
        if has:
            fr.evaluate("(s)=>document.querySelector(s).click()", sel); pg.wait_for_timeout(1800)
            pg.screenshot(path=f'{OUT}/{g}-focus.png')
        ctx.close()
    b.close()
