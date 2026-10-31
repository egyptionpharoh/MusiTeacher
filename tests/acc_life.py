"""اختبار حياة العازفة: رمش/نظر/تنفس/إغماض/رأس في الراحة والعزف، وعشوائية التوقيت. python3 tests/acc_life.py"""
import sys, json, os
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import audio_check as A
JS = r"""
async () => {
  const v = accordionViewer, P = v.perf, L = v.life, s = ms => new Promise(r => setTimeout(r, ms));
  if (!L) return { error: 'no life' };
  const out = {};
  // محاكاة زمن: نقدّم الزمن يدويًا بخطوات 1/30 ثانية (أسرع من الزمن الحقيقي)
  const run = (sec, fn) => { const n = Math.round(sec * 30), log = []; for (let i = 0; i < n; i++) { if (fn) fn(i / 30); v.tick(1 / 30, false); } };
  // 1) راحة 90 ثانية
  const rest = { gazes: new Set(), minC: 1, maxC: 0, closed: 0, t: 0, maxHead: 0, maxEye: 0 };
  let b0 = L.stats.blinks, c0 = L.stats.eyeClosures, g0 = L.stats.gazeShifts, sw = 0, lastK = null, minBr = 9, maxBr = -9;
  run(90, () => { const r = L.report(); rest.gazes.add(r.gaze); rest.minC = Math.min(rest.minC, r.closure); rest.maxC = Math.max(rest.maxC, r.closure); if (r.closure > 0.85) rest.closed++; minBr = Math.min(minBr, r.breath); maxBr = Math.max(maxBr, r.breath); rest.maxHead = Math.max(rest.maxHead, Math.abs(r.headDeg[0])); });
  out.rest = { mode: L.mode, blinks: L.stats.blinks - b0, closures: L.stats.eyeClosures - c0, shifts: L.stats.gazeShifts - g0, gazeKinds: [...rest.gazes], minClosure: +rest.minC.toFixed(2), maxClosure: +rest.maxC.toFixed(2), closedFrames: rest.closed, breathRange: [+minBr.toFixed(2), +maxBr.toFixed(2)], maxHeadYaw: +rest.maxHead.toFixed(1) };
  // 2) عزف 60 ثانية: ضغط نغمات متتالية
  const ids = ['k60','k62','k64','k65','k67','k69','k71','k72'];
  b0 = L.stats.blinks; c0 = L.stats.eyeClosures; g0 = L.stats.gazeShifts; const kinds = {};
  let playFrames = 0, atKeys = 0;
  const t0 = P.t; let i = 0, cur = null;
  run(60, (t) => { if (Math.floor(t * 2.5) !== i) { i = Math.floor(t * 2.5); if (cur) P.release(cur); cur = ids[i % ids.length]; P.press('R', cur, 0.7); } const r = L.report(); kinds[r.gaze] = (kinds[r.gaze] || 0) + 1; playFrames++; });
  if (cur) P.release(cur);
  out.play = { modeDuring: 'play', blinks: L.stats.blinks - b0, closures: L.stats.eyeClosures - c0, shifts: L.stats.gazeShifts - g0, gazeFrames: kinds, modeNow: L.mode };
  // 3) انتقال: بعد توقف يعود للراحة
  run(12);
  out.afterStop = { mode: L.mode };
  // 4) عودة العزف أثناء إغماض: نُجبر إغماضًا ثم نضغط
  L.closeEp = { on: true, t: 0, dur: 5, amt: 1 }; run(1.2); const closedBefore = L.report().closure;
  P.press('R', 'k64', 0.7); run(0.8); const afterPress = L.report(); P.release('k64'); run(1);
  out.resume = { closedBefore, closureAfter800ms: afterPress.closure, mode: afterPress.mode, gaze: afterPress.gaze };
  out.report = L.report();
  out.intervals = L.blinkLog.slice(-60);
  return out;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1000, 'height': 700}); ctx.add_init_script(A.TAP); ctx.add_init_script('window.__noRender=true')
    ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto(A.B + '/embed.html?id=accordion-3d&p=' + quote('index.html' + os.environ.get('ACCQ', ''), safe='')); pg.wait_for_timeout(7000)
    fr = [f for f in pg.frames if '/play/' in f.url][0]
    fr.wait_for_function('window.accordionViewer && accordionViewer.ready', timeout=60000)
    r = fr.evaluate(JS, )
    iv = r.pop('intervals', [])
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print('فواصل الرمش الأخيرة:', [round(iv[i] - iv[i - 1], 2) for i in range(1, len(iv))][:30])
    print('أخطاء:', errs[:5] or 'لا شيء'); b.close()
