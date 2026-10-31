"""اختبار تشغيل فعلي للعبة الأكورديون داخل الصفحة المحمية: أحداث ضغط حقيقية بالماوس (مع نقر على إحداثيات المفاتيح على الشاشة)،
قياس الصوت عند مخرج الصوت، حالة اليدين والمنفاخ. python3 tests/acc_play.py"""
import sys, json, math
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import audio_check as A
PITCH = r"""
async () => {
  const an = window.__taps && window.__taps[0]; if (!an) return {hz:0, rms:0};
  const sr = an.context.sampleRate, buf = new Float32Array(an.fftSize); let m = 0, best = null;
  for (let k = 0; k < 10; k++) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v*v; const r = Math.sqrt(s/buf.length); if (r > m) { m = r; best = buf.slice(0,4096); } await new Promise(r=>setTimeout(r,50)); }
  if (!best || m < 0.002) return {hz:0, rms:m};
  const n = best.length, minL = Math.floor(sr/2200), maxL = Math.floor(sr/150), c = new Float32Array(maxL+2);
  for (let l=minL;l<=maxL;l++){let s=0;for(let i=0;i<n-maxL;i++)s+=best[i]*best[i+l];c[l]=s;}
  let mx=0;for(let l=minL;l<=maxL;l++)if(c[l]>mx)mx=c[l];
  let bl=-1;for(let l=minL+1;l<maxL;l++)if(c[l]>0.85*mx&&c[l]>=c[l-1]&&c[l]>=c[l+1]){bl=l;break;}
  if(bl<0)return{hz:0,rms:m}; const a=c[bl-1],b=c[bl],d=c[bl+1],sh=0.5*(a-d)/(a-2*b+d||1); return {hz:sr/(bl+sh),rms:m};
}
"""
TAP2 = A.TAP.replace("if (!ctx.__tap) {", "if (!ctx.__tap) { (window.__taps = window.__taps || []);").replace("ctx.__tap = an;", "ctx.__tap = an; window.__taps.push(an);")
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}); ctx.add_init_script(TAP2); ctx.add_init_script('window.__noRender=true')
    ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
    pg.goto(A.B + '/embed.html?id=accordion-3d&p=' + quote('index.html?th=-1.2&ph=1.15&d=0.95&t=-0.17,0.78,0.3', safe='')); pg.wait_for_timeout(8000)
    fr = [f for f in pg.frames if '/play/' in f.url][0]
    fr.wait_for_function('window.accordionViewer && accordionViewer.audio.state==="ready"', timeout=120000)
    fr.evaluate('setInterval(()=>accordionViewer.tick(0.033,false),33)'); pg.wait_for_timeout(2500)
    iframe = pg.query_selector('iframe'); box = iframe.bounding_box()
    # إسقاط موضع مفتاح على الشاشة
    PROJ = """(id)=>{const v=accordionViewer,k=v.acc.keys[id],T=v.THREE;const p=k.mesh.localToWorld(new T.Vector3(-k.thick/2,0,k.black?0:0.025));p.project(v.camera);return [(p.x+1)/2*innerWidth,(1-p.y)/2*innerHeight];}"""
    res = []
    # لوحة المفاتيح تُغطّيها الأيدي أحيانًا، لذا نختار المفاتيح حسب الظهور
    for midi, name in [(60,'دو٤'),(64,'مي٤'),(67,'صول٤'),(72,'دو٥'),(69,'لا٤')]:
        id = 'k%d' % midi
        x, y = fr.evaluate(PROJ, id)
        pg.mouse.move(box['x']+x, box['y']+y); pg.mouse.down(); pg.wait_for_timeout(900)
        r = fr.evaluate(PITCH); st = fr.evaluate('accordionViewer.perf.snapshot()')
        exp = 440*2**((midi-69)/12); cents = round(1200*math.log2(r['hz']/exp)) if r['hz'] else None
        pg.mouse.up(); pg.wait_for_timeout(500)
        res.append(dict(note=name, midi=midi, expected=round(exp,1), heard=round(r['hz'],1), cents=cents, rms=round(r['rms'],3), pressed=st['held'], bellows=st['w'], air=st['air']))
        print(res[-1])
    print('log:', fr.evaluate('JSON.stringify(accordionViewer.audio.log.slice(-5))'))
    print('errors:', errs[:4]); b.close()
