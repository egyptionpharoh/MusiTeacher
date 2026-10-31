"""فحص الصوت الفعلي لكل لعبة: يحمّل اللعبة عبر المسار المحمي، يشغّل نغمات محددة عبر محرك العينات،
ويقيس من مخرج الصوت الحقيقي (AnalyserNode على destination): هل يوجد صوت؟ ما طبقته؟ هل فشل تحميل ملف؟
الاستعمال:  python3 tests/audio_check.py <game-id> [midi ...]     (الخادم التجريبي على 5300)"""
import sys, json
from playwright.sync_api import sync_playwright

B = 'http://localhost:5300'
TAP = r"""
(() => {
  window.requestAnimationFrame = () => 0;   // نوقف حلقة الرسم ثلاثي الأبعاد (برمجية) كي لا تجوّع خيط الصوت في بيئة الاختبار
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...r) {
    try {
      if (dest instanceof AudioDestinationNode) {
        const ctx = this.context;
        if (!ctx.__tap) { const an = ctx.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = 0; ctx.__tap = an; const z = ctx.createGain(); z.gain.value = 0; oc.call(an, z); oc.call(z, ctx.destination); }
        oc.call(this, ctx.__tap);
      }
    } catch (e) {}
    return oc.call(this, dest, ...r);
  };
})();
"""
ADAPT = """() => { const i = MTAudio.instances[0]; window.__ad = { ctx: i.ctx, play: (m, t, d) => i.play(m, t, d), log: () => i.sampler.log, clear: () => { i.sampler.log.length = 0; } }; }"""
MEASURE = r"""
async ({ midis, dur, via }) => {
  const ad = window.__ad; const ctx = ad.ctx; const an = ctx.__tap;
  const out = [];
  const buf = new Float32Array(an.fftSize);
  const pitch = (x, sr) => {            // مقدّر طبقة بسيط (ارتباط ذاتي مع إزاحة قمة)
    const n = x.length; let best = -1, bl = 0;
    const minL = Math.floor(sr / 2300), maxL = Math.floor(sr / 150);
    const c = new Float32Array(maxL + 2);
    for (let l = minL; l <= maxL; l++) { let s = 0; for (let i = 0; i < n - maxL; i++) s += x[i] * x[i + l]; c[l] = s; }
    let mx = 0; for (let l = minL; l <= maxL; l++) if (c[l] > mx) mx = c[l];
    for (let l = minL + 1; l < maxL; l++) if (c[l] > 0.85 * mx && c[l] >= c[l - 1] && c[l] >= c[l + 1]) { best = l; break; }
    if (best < 0) return 0;
    const a = c[best - 1], b = c[best], d = c[best + 1]; const sh = 0.5 * (a - d) / (a - 2 * b + d || 1);
    return sr / (best + sh);
  };
  for (const m of midis) {
    ad.clear();
    const t = ctx.currentTime + 0.05; const t0 = performance.now();
    ad.play(m, t, dur);
    let maxRms = 0, f = 0, grab = [];
    await new Promise(r => setTimeout(r, 120));
    for (let k = 0; k < 6; k++) {
      an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length); if (rms > maxRms) { maxRms = rms; if (rms > 0.003) f = pitch(buf.slice(0, 4096), ctx.sampleRate); }
      await new Promise(r => setTimeout(r, 40));
    }
    const exp = 440 * Math.pow(2, (m - 69) / 12);
    const cents = f ? 1200 * Math.log2(f / exp) : null;
    const lg = ad.log()[0] || null;
    out.push({ midi: m, expectHz: +exp.toFixed(1), gotHz: +f.toFixed(1), cents: cents == null ? null : +cents.toFixed(0), rms: +maxRms.toFixed(4), sample: lg && (lg.sample || lg.note), rate: lg && (lg.rate || null), usedSampler: !!lg });
    await new Promise(r => setTimeout(r, Math.max(300, dur * 1000 + 700)));
  }
  return out;
}
"""

def main():
    gid = sys.argv[1]
    midis = [int(x) for x in sys.argv[2:]] or [60, 64, 67, 72]
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1280, 'height': 800})
        ctx.add_init_script(TAP)
        ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())   # لا اتصال خارجي في بيئة الاختبار
        pg = ctx.new_page()
        bad = []; errs = []
        pg.on('response', lambda r: bad.append((r.status, r.url)) if r.status >= 400 and '/play/' in r.url else None)
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(f'{B}/embed.html?id={gid}')
        pg.wait_for_timeout(5000)
        fr = [f for f in pg.frames if '/play/' in f.url][0]
        sel = '#play' if fr.query_selector('#play') else '[id*=play]'
        btn = fr.query_selector(sel)
        CLICK = "(sel) => document.querySelector(sel).click()"
        if btn: fr.evaluate(CLICK, sel)
        for _ in range(180):
            ok = fr.evaluate("() => !!(window.MTAudio && MTAudio.instances[0] && MTAudio.instances[0].sampler && MTAudio.instances[0].sampler.ready)")
            if ok: break
            pg.wait_for_timeout(500)
        st = fr.evaluate("() => { const i = MTAudio.instances[0]; return i ? { state: i.sampler.S.state, loaded: i.sampler.S.loaded, total: i.sampler.S.total, err: i.sampler.S.error } : null }")
        print(gid, 'sampler:', st)
        if st and st['state'] == 'ready':
            if btn: fr.evaluate(CLICK, sel)   # إيقاف تشغيل السلم التلقائي كي لا يلوّث القياس
            try: fr.evaluate("() => { const i=MTAudio.instances[0]; i.stopAll && i.stopAll(0.01); }")
            except Exception: pass
            pg.wait_for_timeout(800)
            fr.evaluate(ADAPT)
            res = fr.evaluate(MEASURE, {'midis': midis, 'dur': 0.8, 'via': 'play'})
            for r in res: print('  ', r)
        print('http errors:', bad[:6], '| page errors:', errs[:3])
        b.close()

if __name__ == '__main__':
    main()
