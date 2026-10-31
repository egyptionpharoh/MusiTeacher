"""لقطة شاشة لصفحة داخل لعبة عبر المسار المحمي: python3 tests/shot_dev.py <id> "<path?query>" out.png [w h] [wait_ms]"""
import sys
from playwright.sync_api import sync_playwright
gid, path, out = sys.argv[1], sys.argv[2], sys.argv[3]
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1280; Hh = int(sys.argv[5]) if len(sys.argv) > 5 else 800; wait = int(sys.argv[6]) if len(sys.argv) > 6 else 3500
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': W, 'height': Hh}); ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text[:200]) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERR: ' + str(e)[:300]))
    pg.on('response', lambda r: logs.append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
    from urllib.parse import quote
    pg.goto(f'http://localhost:5300/embed.html?id={gid}&p={quote(path, safe="")}'); pg.wait_for_timeout(wait)
    pg.screenshot(path=out)
    print('\n'.join(logs[:12]) or 'no errors')
    b.close()
