"""لقطات متعددة الزوايا لعازفة الأكورديون عبر المسار المحمي.
الاستعمال: python3 tests/acc_shots.py out_prefix "js قبل اللقطات" view1 view2 ...   حيث view = th,ph,d,tx,ty,tz"""
import sys
from playwright.sync_api import sync_playwright
from urllib.parse import quote
pre, js = sys.argv[1], sys.argv[2]; views = sys.argv[3:]
extra = ''
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 760}); ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(m.text[:300]) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERR: ' + str(e)[:300]))
    pg.goto('http://localhost:5300/embed.html?id=accordion-3d&p=' + quote(sys.argv[0] and 'index.html' + (__import__('os').environ.get('ACCQ', '')), safe='')); pg.wait_for_timeout(7000)
    fr = [f for f in pg.frames if '/play/' in f.url][0]
    fr.wait_for_function('window.accordionViewer && window.accordionViewer.ready', timeout=60000)
    if js: print(fr.evaluate(js))
    for i, v in enumerate(views):
        a = [float(x) for x in v.split(',')]
        fr.evaluate('(a)=>accordionViewer.look(a[0],a[1],a[2],[a[3],a[4],a[5]])', a); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{pre}_{i}.png')
    print('\n'.join(logs[:6]) or 'no errors'); b.close()
