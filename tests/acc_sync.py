"""اختبار المنفاخ المروحي والتزامن: سلامة الهندسة (لا تداخل طيّات ولا تمطّط)، شكل V، تبعية الذراعين، ثبات اليدين على أهدافهما، وزمن ضغط المفتاح مقابل النغمة.
python3 tests/acc_sync.py"""
import json, os
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import audio_check as A
JS = r"""
async () => {
  const v = accordionViewer, P = v.perf, A_ = v.acc, pl = v.player, T = v.THREE, out = {};
  const run = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) v.tick(1 / 60, false); };
  P.setManualBellows(0);
  const setW = (w) => { P.bel.w = w; P.bel.v = 0; run(0.35); };
  // ---------- 1) هندسة المنفاخ ----------
  const g = A_.bellows.geometry, p = g.attributes.position.array, SEGS = 36, ROWS = 4, NPAN = 30;
  const geo = [];
  for (const w of [0.125, 0.16, 0.2, 0.25, 0.305]) {
    setW(w);
    const fan = A_.getFan();
    // ارتفاع ثابت (j=0: منتصف الوجه الأمامي) و ارتفاع الأعلى/الأسفل: نأخذ رؤوس الوجه الأمامي j=0 للطيّات المتتالية
    let nan = 0; for (let i = 0; i < p.length; i++) if (!isFinite(p[i])) nan++;
    let mono = true, minGap = 1, maxPanelDev = 0, panels = [];
    for (const j of [0, SEGS / 4, SEGS / 2, SEGS * 3 / 4]) {            // أربعة أوجه (أمام/أعلى/خلف/أسفل)
      let prevX = -1;
      for (let k = 0; k < NPAN; k++) {
        const o0 = ((k * ROWS + 0) * SEGS + j) * 3, o3 = ((k * ROWS + 3) * SEGS + j) * 3;
        const a = [p[o0], p[o0 + 1], p[o0 + 2]], b = [p[o3], p[o3 + 1], p[o3 + 2]];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        panels.push(len);
        if (k > 0 && a[0] < prevX - 1e-6) mono = false;                       // الحلقات تتقدّم في x دائمًا
        if (k > 0) minGap = Math.min(minGap, a[0] - prevX);
        prevX = a[0];
      }
    }
    const mean = panels.reduce((s, x) => s + x, 0) / panels.length, dev = Math.max(...panels.map((x) => Math.abs(x - mean))) / mean;
    geo.push({ w, tanFan: +fan.tan.toFixed(3), bottomGap: +fan.bottom.toFixed(3), topGap: +fan.top.toFixed(3), ratioTopBottom: +(fan.top / fan.bottom).toFixed(2), nan, mono, minRingGap_mm: +(minGap * 1000).toFixed(2), panelLen_mm: +(mean * 1000).toFixed(1), panelDevPct: +(dev * 100).toFixed(1) });
  }
  out.geo = geo;
  // ---------- 2) الذراعان تتبعان المنفاخ واليدان تبقيان على هدفيهما ----------
  P.press('R', 'k64', 0.7); P.press('L', 'b2_2', 0.7); run(0.4);
  const base = {}, rows = [];
  for (const w of [0.125, 0.15, 0.18, 0.21, 0.24, 0.27, 0.305]) {
    setW(w); const q = pl.penetration(), qa = pl.qa;
    const wL = new T.Vector3(), wR = new T.Vector3(), eR = new T.Vector3(), eL = new T.Vector3();
    v.rig.wp('L', 'hand', wL); v.rig.wp('R', 'hand', wR); v.rig.wp('R', 'lowerArm', eR); v.rig.wp('L', 'lowerArm', eL);
    // مسافة سطح الإصبع المضغوط (الهدف) إلى سطح الزر الفعلي (يجب أن تكون ≈ سماكة اللحم)
    const bt = pl.buttonSurface(A_.buttons['b2_2']);
    const lt = pl.lTargets[2] || pl.lTargets[1] || pl.lTargets[0];
    rows.push({ w, boxX: +A_.leftBox.getWorldPosition(new T.Vector3()).x.toFixed(3), leftWristX: +wL.x.toFixed(3), rightWristX: +wR.x.toFixed(3), rightWristY: +wR.y.toFixed(3), rightElbow: [+eR.x.toFixed(3), +eR.y.toFixed(3), +eR.z.toFixed(3)], leftElbowX: +eL.x.toFixed(3), penR: q.R.maxMm, penL: q.L.maxMm, reachR: qa.reachR, reachL: qa.reachL });
  }
  out.sweep = rows;
  P.release('k64'); P.release('b2_2'); run(0.4);
  // ---------- 3) زمن الضغط مقابل النغمة (إطار = 1/60) ----------
  const lat = [];
  for (const id of ['k60', 'k67', 'k72']) {
    const key = A_.keys[id]; let tOn = null, t50 = null, tk = 0;
    const hook = P.onEvent; P.onEvent = (e) => { if (e.type === 'on' && tOn === null) tOn = tk; };
    P.press('R', id, 0.8);
    for (let i = 0; i < 40; i++) { v.tick(1 / 60, false); tk += 1 / 60; if (t50 === null && key.press >= 0.5) t50 = tk; }
    P.release(id); P.onEvent = hook; run(0.3);
    lat.push({ id, noteOn_ms: Math.round((tOn ?? 0) * 1000), key50_ms: t50 === null ? null : Math.round(t50 * 1000) });
  }
  out.latency = lat;
  // ---------- 4) الحياة: لا تتعارض مع اليدين (اليد على هدفها أثناء الرمش/التنفس) ----------
  P.press('R', 'k65', 0.7); run(0.3); let worst = 0;
  for (let i = 0; i < 360; i++) { v.tick(1 / 60, false); const m = pl.penetration().R.maxMm; if (m > worst) worst = m; }
  P.release('k65'); out.penDuringLife_mm = worst;
  // ---------- 5) الأداء: زمن إطار المنطق مع المنفاخ المتحرك ----------
  P.setManualBellows(null); P.press('R', 'k60', 0.8); P.press('L', 'b3_1', 0.8); run(1);
  const t0 = performance.now(); for (let i = 0; i < 120; i++) v.tick(1 / 60, false); out.msPerFrameLogic = +((performance.now() - t0) / 120).toFixed(2);
  P.releaseAll();
  return out;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1000, 'height': 700}); ctx.add_init_script(A.TAP); ctx.add_init_script('window.__noRender=true')
    ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type == 'error' else None)
    pg.goto(A.B + '/embed.html?id=accordion-3d&p=' + quote('index.html', safe='')); pg.wait_for_timeout(7000)
    fr = [f for f in pg.frames if '/play/' in f.url][0]
    fr.wait_for_function('window.accordionViewer && accordionViewer.ready', timeout=60000)
    r = fr.evaluate(JS)
    print('--- هندسة المنفاخ'); [print(x) for x in r['geo']]
    print('--- مسح الاتساع (اليد اليسرى/اليمنى/المرفق)'); [print(x) for x in r['sweep']]
    print('--- زمن الضغط'); [print(x) for x in r['latency']]
    print('اختراق أثناء الرمش والتنفس (مم):', r['penDuringLife_mm'], '| زمن المنطق للإطار (مللي):', r['msPerFrameLogic'])
    print('أخطاء:', errs[:5] or 'لا شيء'); b.close()
