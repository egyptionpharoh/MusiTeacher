"""لقطات شاشة لكل لعبة (سطح المكتب والموبايل) عبر المسار المحمي — لمراجعة ازدحام الواجهة."""
import sys, json
from playwright.sync_api import sync_playwright
B='http://localhost:5300'
GAMES=sys.argv[2:] or ['piano-scales','violin-scales','xylophone','accordion-scales','oriental-organ-piano','virtual-violin','virtual-oud','virtual-qanun','oud-maqamat','oud-3d','qanun-3d','guitar-3d','violinist-3d']
OUT=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
    for vp,tag in [({'width':1366,'height':768},'d'),({'width':390,'height':844},'m')]:
        for g in GAMES:
            ctx=b.new_context(viewport=vp); ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
            pg=ctx.new_page(); pg.goto(f'{B}/embed.html?id={g}'); pg.wait_for_timeout(8000)
            fr=[f for f in pg.frames if '/play/' in f.url][0]
            fr.evaluate("""() => { const els=[...document.querySelectorAll('button,[role=button]')].filter(b=>/ابدأ|ابدا|ابدء|start/i.test(b.textContent||'')&&b.offsetParent!==null); if(els[0]) els[0].click(); }""")
            pg.wait_for_timeout(2500)
            pg.screenshot(path=f'{OUT}/{g}-{tag}.png'); ctx.close(); print(g,tag,flush=True)
    b.close()
