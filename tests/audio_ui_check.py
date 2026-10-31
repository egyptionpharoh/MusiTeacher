"""اختبار التفاعل ← الصوت للألعاب المرسومة بـ SVG: نضغط مفاتيح الكمبيوتر فعلًا (كما يفعل الطالب)،
نقرأ التردد الذي تعرضه اللعبة في لوحة المعلومات (#ui-freq)، ونقيس الطبقة المسموعة عند مخرج الصوت، ونقارن.
الاستعمال: python3 tests/audio_ui_check.py <game-id> KeyZ KeyX KeyC ...  """
import sys, re
from playwright.sync_api import sync_playwright
import audio_check as A

PITCH_JS = r"""
async (exp) => {
  const taps = window.__taps || []; const out = [];
  const an = taps[0]; const sr = an.context.sampleRate; const buf = new Float32Array(an.fftSize);
  let m = 0, best = null;
  for (let k = 0; k < 8; k++) {
    an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; const rms = Math.sqrt(s / buf.length);
    if (rms > m) { m = rms; best = buf.slice(0, 4096); }
    await new Promise(r => setTimeout(r, 60));
  }
  const sp = (() => { const f = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(f); const bw = sr / an.fftSize;
    let mxv = -1e9, mxi = 0; for (let i = 3; i < f.length; i++) if (f[i] > mxv) { mxv = f[i]; mxi = i; }
    const lo = Math.floor(exp * 0.97 / bw), hi = Math.ceil(exp * 1.03 / bw); let pv = -1e9, pi = lo;
    for (let i = lo; i <= hi; i++) if (f[i] > pv) { pv = f[i]; pi = i; }
    return { peakHz: pi * bw, relDb: pv - mxv, strongestHz: mxi * bw }; })();
  if (!best || m < 0.003) return { rms: m, hz: 0, sp };
  const n = best.length, minL = Math.floor(sr / 2500), maxL = Math.floor(sr / 120); const c = new Float32Array(maxL + 2);
  for (let l = minL; l <= maxL; l++) { let s = 0; for (let i = 0; i < n - maxL; i++) s += best[i] * best[i + l]; c[l] = s; }
  let mx = 0; for (let l = minL; l <= maxL; l++) if (c[l] > mx) mx = c[l];
  let bl = -1; for (let l = minL + 1; l < maxL; l++) if (c[l] > 0.85 * mx && c[l] >= c[l - 1] && c[l] >= c[l + 1]) { bl = l; break; }
  if (bl < 0) return { rms: m, hz: 0, sp };
  const a = c[bl - 1], b = c[bl], d = c[bl + 1]; const sh = 0.5 * (a - d) / (a - 2 * b + d || 1);
  return { rms: m, hz: sr / (bl + sh), sp };
}
"""
TAP2 = A.TAP.replace("if (!ctx.__tap) {", "if (!ctx.__tap) { (window.__taps = window.__taps || []);").replace("ctx.__tap = an;", "ctx.__tap = an; window.__taps.push(an);")

def main():
    gid = sys.argv[1]; keys = sys.argv[2:] or ['KeyZ', 'KeyX', 'KeyC', 'KeyV']
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = b.new_context(viewport={'width': 1280, 'height': 800}); ctx.add_init_script(TAP2)
        ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
        pg.goto(A.B + f'/embed.html?id={gid}'); pg.wait_for_timeout(6000)
        fr = [f for f in pg.frames if '/play/' in f.url][0]
        fr.evaluate("() => { const o=document.getElementById('start-btn')||document.querySelector('#overlay button,.overlay button,button'); }")
        for k in keys:
            fr.evaluate("(c)=>document.dispatchEvent(new KeyboardEvent('keydown',{code:c,key:c,bubbles:true}))", k)
            pg.wait_for_timeout(700)
            shown = fr.evaluate("() => document.getElementById('ui-freq').textContent")
            note = fr.evaluate("() => document.getElementById('ui-note').textContent")
            m0 = re.search(r'([\d.]+)', shown or ''); r = fr.evaluate(PITCH_JS, float(m0.group(1)) if m0 else 440)
            fr.evaluate("(c)=>document.dispatchEvent(new KeyboardEvent('keyup',{code:c,key:c,bubbles:true}))", k)
            m = re.search(r'([\d.]+)', shown or ''); exp = float(m.group(1)) if m else None
            cents = round(1200 * __import__('math').log2(r['hz'] / exp)) if exp and r['hz'] else None
            print(f"  {k}: لعبة تعرض {note!r} = {shown!r} | مسموع {r['hz']:.1f} Hz (rms {r['rms']:.3f}) | فرق {cents} سنت | طيف: أقوى قمة قرب المتوقع {r['sp']['peakHz']:.1f} Hz، {r['sp']['relDb']:.1f} dB عن أقوى مكوّن ({r['sp']['strongestHz']:.0f} Hz)")
            pg.wait_for_timeout(500)
        print(gid, 'page errors:', errs[:3]); b.close()

main()
