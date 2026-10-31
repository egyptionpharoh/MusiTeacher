"""سلوك المنفاخ أثناء عرض نموذج «نشيد الفرح بيدين»: تتبّع عرض المنفاخ والسرعة والاتجاه وتزامن الصوت (كل نغمة مسموعة مقابل أحداث التمرين)."""
import sys, json, statistics
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import audio_check as A
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1000, 'height': 700}); ctx.add_init_script(A.TAP); ctx.add_init_script('window.__noRender=true')
    ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(A.B + '/embed.html?id=accordion-3d&p=index.html'); pg.wait_for_timeout(8000)
    fr = [f for f in pg.frames if '/play/' in f.url][0]
    fr.wait_for_function('window.accordionViewer && accordionViewer.audio.state==="ready"', timeout=120000)
    fr.evaluate('setInterval(()=>accordionViewer.tick(0.033,false),33)')
    fr.evaluate("""()=>{const L=accordionViewer.ui.lesson,ex=window.__ex=null; const e=accordionViewer; e.ui.setMode('lesson'); }""")
    pg.wait_for_timeout(500)
    fr.evaluate("(()=>{const s=document.getElementById('exsel');s.value='ode-2h';s.dispatchEvent(new Event('change'));const t=document.querySelector('#t-sec input[type=range]');t.value=132;t.dispatchEvent(new Event('input'));})()")
    n0 = fr.evaluate('accordionViewer.audio.log.length'); nev = fr.evaluate('accordionViewer.ui.lesson.ex.events.length')
    fr.evaluate('window.__tr=[];window.__iv=setInterval(()=>{const s=accordionViewer.perf.snapshot();window.__tr.push([performance.now(),s.w,s.v,s.dir,s.air,s.held.length])},100)')
    fr.evaluate('accordionViewer.ui.lesson.demo()')
    pg.wait_for_timeout(62 * 60 / 132 * 1000 + 4000)   # 16 موازين × 4 نبضات
    tr = fr.evaluate('window.__tr'); n1 = fr.evaluate('accordionViewer.audio.log.length')
    ws = [t[1] for t in tr]; vs = [t[2] for t in tr]; dirs = [t[3] for t in tr]
    flips = [i for i in range(1, len(dirs)) if dirs[i] != dirs[i - 1]]
    gaps = [round((tr[flips[i + 1]][0] - tr[flips[i]][0]) / 1000, 1) for i in range(len(flips) - 1)]
    played_notes = n1 - n0
    print('أحداث التمرين:', nev, '| نغمات صدرت فعليًا:', played_notes)
    print('عرض المنفاخ: من', round(min(ws), 3), 'إلى', round(max(ws), 3), 'م | أقصى سرعة', round(max(map(abs, vs)), 3), 'م/ث')
    print('تبديلات الاتجاه:', len(flips), '| الفواصل بينها (ث):', gaps)
    print('أخطاء:', errs[:2]); b.close()
