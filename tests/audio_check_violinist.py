"""فحص صوت عازفة الكمان ثلاثية الأبعاد (عينات VSCO) عبر المسار المحمي."""
import sys
from playwright.sync_api import sync_playwright
import audio_check as A
ADAPT = """() => { const s = window.violinViewer.teach.synth; window.__ad = { ctx: s.ctx, play: (m, t, d) => s.playNote({ hz: 440 * Math.pow(2, (m - 69) / 12), when: t, dur: d, dir: 'down' }), log: () => s.log.filter(x => x.src === 'sample'), clear: () => { s.log.length = 0; } }; }"""
def main():
    midis = [int(x) for x in sys.argv[1:]] or [55, 62, 69, 76, 88]
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1100, 'height': 700}); ctx.add_init_script(A.TAP)
        ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
        pg = ctx.new_page(); bad = []; errs = []
        pg.on('response', lambda r: bad.append((r.status, r.url)) if r.status >= 400 and '/play/' in r.url else None)
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(A.B + '/embed.html?id=violinist-3d'); pg.wait_for_timeout(8000)
        fr = [f for f in pg.frames if '/play/' in f.url][0]
        fr.evaluate("() => { document.querySelector('#restart').click(); }")
        for _ in range(180):
            st = fr.evaluate("() => window.violinViewer && violinViewer.teach.synth.samplesState")
            if st == 'ready': break
            pg.wait_for_timeout(500)
        print('samplesState:', st)
        fr.evaluate("() => violinViewer.teach.stop()"); pg.wait_for_timeout(800)
        fr.evaluate(ADAPT)
        res = fr.evaluate(A.MEASURE, {'midis': midis, 'dur': 1.0, 'via': 'play'})
        for r in res: print('  ', r)
        print('http errors:', bad[:6], '| page errors:', errs[:3]); b.close()
main()
