"""اختبار اختراق الأصابع: يضغط كل مفتاح (34) وكل زر باص (48) عبر المؤدّي ويقيس أعمق اختراق لجلد اليد في جسم المفتاح/الزر بالمليمتر،
وأقصى عجز في وصول الذراع (reach). python3 tests/acc_contact.py"""
import sys, json
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import audio_check as A
JS = r"""
async () => {
  const v = accordionViewer, P = v.perf, A = v.acc, s = ms => new Promise(r => setTimeout(r, ms));
  const out = { R: [], L: [], reachR: 0, reachL: 0 };
  const keys = Object.keys(A.keys).sort((a, b) => A.keys[a].midi - A.keys[b].midi);
  for (const id of keys) { P.press('R', id, 0.7); await s(330); const p = v.pen().R, q = v.qa(); out.R.push([id, p.maxMm, p.at && p.at[0]]); out.reachR = Math.max(out.reachR, q.reachR || 0); P.release(id); await s(120); }
  for (const id of Object.keys(A.buttons)) { P.press('L', id, 0.7); await s(300); const p = v.pen().L, q = v.qa(); out.L.push([id, p.maxMm, p.at && p.at[0]]); out.reachL = Math.max(out.reachL, q.reachL || 0); P.release(id); await s(80); }
  return out;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1000, 'height': 700}); ctx.add_init_script(A.TAP); ctx.add_init_script('window.__noRender=true')
    ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); pg.goto(A.B + '/embed.html?id=accordion-3d&p=' + quote('index.html' + __import__('os').environ.get('ACCQ',''), safe='')); pg.wait_for_timeout(7000)
    fr = [f for f in pg.frames if '/play/' in f.url][0]
    fr.wait_for_function('window.accordionViewer && accordionViewer.ready', timeout=60000)
    fr.evaluate('setInterval(()=>accordionViewer.tick(0.033,false),33)')
    r = fr.evaluate(JS)
    for side in 'RL':
        vals = [x[1] for x in r[side]]; worst = max(r[side], key=lambda x: x[1])
        print(f"{side}: {len(vals)} عنصرًا — أقصى اختراق {worst[1]} مم عند {worst[0]}؛ عناصر باختراق > 1.5 مم: {[x for x in r[side] if x[1] > 1.5]}")
    print('أقصى عجز وصول ذراع (مم) R/L:', r['reachR'], r['reachL']); b.close()
