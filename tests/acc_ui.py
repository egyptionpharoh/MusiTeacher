"""اختبار واجهة لعبة الأكورديون بالتفاعل الفعلي (ماوس + لمس): تعرّف، عزف حر، سحب، تمارين (عرض نموذج، تدريب بالانتظار، تعرّف مفاتيح)، كاميرا، إخفاء اللوحات.
python3 tests/acc_ui.py   — يطبع نتيجة كل فحص (✔/✘) مع القيم الفعلية."""
import sys, json
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import audio_check as A
res = []
def chk(name, ok, info=''):
    res.append(ok); print(('✔' if ok else '✘'), name, info)
PROJ = """(id)=>{const v=accordionViewer,T=v.THREE;const o=v.acc.keys[id]||v.acc.buttons[id];let p;
  if(v.acc.keys[id]){p=o.mesh.localToWorld(new T.Vector3(-o.thick/2,0,o.black?0:0.025));}else{p=o.mesh.localToWorld(new T.Vector3(0.00625,0,0));}
  p.project(v.camera);return [(p.x+1)/2*innerWidth,(1-p.y)/2*innerHeight];}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}, has_touch=True); ctx.add_init_script(A.TAP); ctx.add_init_script('window.__noRender=true')
    ctx.route(lambda u: not u.startswith('http://localhost'), lambda r: r.abort())
    pg = ctx.new_page(); errs = []; bad = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
    pg.on('response', lambda r: bad.append((r.status, r.url[-50:])) if r.status >= 400 else None)
    pg.goto(A.B + '/embed.html?id=accordion-3d&p=' + quote('index.html?th=-1.0&ph=1.2&d=1.0&t=-0.15,0.8,0.3', safe='')); pg.wait_for_timeout(7000)
    fr = [f for f in pg.frames if '/play/' in f.url][0]
    fr.wait_for_function('window.accordionViewer && accordionViewer.audio.state==="ready"', timeout=120000)
    fr.evaluate('setInterval(()=>accordionViewer.tick(0.033,false),33)'); pg.wait_for_timeout(2500)
    E = lambda js, *a: fr.evaluate(js, *a)
    chk('تحميل اللعبة وتجهيز الصوت (61 عينة) دون أخطاء', not errs and not bad, f'errors={errs[:2]} http>=400={bad[:2]}')
    # ---- عزف حر: ماوس ----
    n0 = E('accordionViewer.audio.log.length')
    x, y = E(PROJ, 'k62'); pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(350)
    st = E('accordionViewer.perf.snapshot()'); chk('ماوس: ضغط مفتاح يُمسَك ويتحرك المنفاخ', st['held'] == ['k62'] and abs(st['v']) > 0.01, json.dumps(st['held']) + ' v=' + str(st['v']))
    x2, y2 = E(PROJ, 'k65'); pg.mouse.move(x2, y2, steps=6); pg.wait_for_timeout(300)
    st = E('accordionViewer.perf.snapshot()'); chk('سحب متدرّج: الانتقال إلى المفتاح التالي (رفع الأول وضغط الثاني)', st['held'] == ['k65'], json.dumps(st['held']))
    pg.mouse.up(); pg.wait_for_timeout(300)
    lg = E('accordionViewer.audio.log.slice(-3)'); chk('الصوت: السحب من ري٤ إلى فا٤ يعزف ري ثم مي (مرّ بها) ثم فا بالترتيب', [l['notes'][0] for l in lg] == [62, 64, 65], str([l['notes'] for l in lg]))
    chk('رفع الإصبع يحرر المفتاح', E('accordionViewer.perf.snapshot().held.length') == 0)
    # ---- لمس ----
    x, y = E(PROJ, 'k67'); n1 = E('accordionViewer.audio.log.length'); pg.touchscreen.tap(x, y); pg.wait_for_timeout(400)
    lg = E('accordionViewer.audio.log.slice(-1)'); chk('لمس: نقرة على مفتاح تعزف نغمته (صول٤=67)', E('accordionViewer.audio.log.length') == n1 + 1 and lg[0]['notes'] == [67], str(lg[0]['notes']))
    E("accordionViewer.ui.setView('bass')"); pg.wait_for_timeout(2200)
    x, y = E(PROJ, 'b3_2'); n1 = E('accordionViewer.audio.log.length'); pg.touchscreen.tap(x, y); pg.wait_for_timeout(400)
    lg = E('accordionViewer.audio.log.slice(-1)'); chk('لمس: زر باص (وتر دو الكبير) يعزف ثلاث نغمات 48/52/55', lg[0]['side'] == 'L' and lg[0]['notes'] == [48, 52, 55], str(lg[0]))
    # ---- وضع التعرّف ----
    E("[...document.querySelectorAll('.tab')].find(b=>b.textContent.includes('تعرّف')).click()"); pg.wait_for_timeout(300)
    E("accordionViewer.ui.setView('front')"); pg.wait_for_timeout(1800)
    pt = E("""()=>{const v=accordionViewer,T=v.THREE,p=v.acc.bellows.localToWorld(new T.Vector3(0.1,0.18,0.0));p.project(v.camera);return [(p.x+1)/2*innerWidth,(1-p.y)/2*innerHeight];}""")
    m = E("(a)=>{const m=accordionViewer.ui.pickAt(a[0],a[1]);return m&&m.userData.part}", pt); pg.mouse.click(pt[0], pt[1]); pg.wait_for_timeout(400)
    h3 = E("document.querySelector('#info-card h3')&&document.querySelector('#info-card h3').textContent")
    chk('تعرّف: النقر على المنفاخ يعرض اسمه ووظيفته', m == 'bellows' and h3 == 'المنفاخ', f'picked={m} title={h3}')
    E("[...document.querySelectorAll('.plist button')].find(b=>b.textContent.includes('لوحة المفاتيح')).click()"); pg.wait_for_timeout(300)
    chk('تعرّف: اختيار «لوحة المفاتيح» من القائمة', E("document.querySelector('#info-card h3').textContent").startswith('لوحة المفاتيح'))
    n2 = E('accordionViewer.audio.log.length'); pg.mouse.click(600, 400); pg.wait_for_timeout(200)
    chk('تعرّف: النقر لا يعزف نغمات', E('accordionViewer.audio.log.length') == n2)
    # ---- تمارين ----
    E("[...document.querySelectorAll('.tab')].find(b=>b.textContent.trim()==='تمارين').click()"); pg.wait_for_timeout(400)
    E("(()=>{const s=document.getElementById('exsel');s.value='five';s.dispatchEvent(new Event('change'))})()"); pg.wait_for_timeout(600)
    E("(()=>{const t=document.querySelector('#t-sec input[type=range]');t.value=160;t.dispatchEvent(new Event('input'))})()")
    n3 = E('accordionViewer.audio.log.length'); E("accordionViewer.ui.lesson.demo()"); pg.wait_for_timeout(9 * 375 + 2500)
    lg = E(f'accordionViewer.audio.log.slice({n3})'); notes = [l['notes'][0] for l in lg]
    chk('عرض النموذج: يعزف الأنماط التسع بالترتيب (دو ري مي فا صول فا مي ري دو)', notes == [60, 62, 64, 65, 67, 65, 64, 62, 60], str(notes))
    ts = [l['t'] for l in lg]; gaps = [round(ts[i + 1] - ts[i], 3) for i in range(len(ts) - 1)]
    chk('عرض النموذج: فواصل زمنية قريبة من نبضة 160 (0.375 ث) مع تنويع بشري طفيف', all(0.30 < g < 0.45 for g in gaps) and len(set(gaps)) > 3, str(gaps))
    E("(()=>{const w=document.querySelector('#t-sec input[type=checkbox]');})()")
    E("accordionViewer.ui.lesson.opts.wait=true; accordionViewer.ui.lesson.practice()"); pg.wait_for_timeout(500)
    lit = E("Object.entries(accordionViewer.acc.keys).filter(([i,k])=>k.mesh.material!==k.base).map(([i])=>i)"); chk('تدريب: المفتاح المطلوب مُضاء (دو٤)', lit == ['k60'], str(lit))
    # ضغط خاطئ ثم صحيح
    x, y = E(PROJ, 'k72'); pg.mouse.click(x, y); pg.wait_for_timeout(250)
    bad_n = E('accordionViewer.ui.lesson.score.bad'); chk('تدريب: ضغط مفتاح خاطئ يُسجَّل خطأ', bad_n == 1, f'bad={bad_n}')
    for midi in [60, 62, 64, 65, 67, 65, 64, 62, 60]:
        x, y = E(PROJ, 'k%d' % midi); pg.mouse.click(x, y); pg.wait_for_timeout(450)
    msg = E("document.getElementById('lesson-msg').textContent"); chk('تدريب: إكمال التمرين بالضغط الفعلي وعرض النتيجة', 'انتهى التمرين' in msg and 'صحيح 9' in msg, msg)
    # تعرّف المفاتيح
    E("(()=>{const s=document.getElementById('exsel');s.value='rec-white';s.dispatchEvent(new Event('change'))})()"); pg.wait_for_timeout(500)
    E("accordionViewer.ui.lesson.practice()"); pg.wait_for_timeout(300)
    for i in range(10):
        tgt = E("accordionViewer.ui.lesson.questions[accordionViewer.ui.lesson.idx].id"); x, y = E(PROJ, tgt); pg.mouse.click(x, y); pg.wait_for_timeout(900)
    msg = E("document.getElementById('lesson-msg').textContent"); chk('تعرّف المفاتيح: 10 أسئلة صحيحة = دقة 100%', 'الدقة 100%' in msg, msg)
    # ---- باص ويدان ----
    E("(()=>{const s=document.getElementById('exsel');s.value='ode-2h';s.dispatchEvent(new Event('change'))})()"); pg.wait_for_timeout(400)
    ex = E("accordionViewer.ui.lesson.ex.events.length"); chk('تمرين نشيد الفرح بيدين محمّل (لحن + باص ووتر)', ex > 40, f'events={ex}')
    # ---- كاميرا وواجهة ----
    d0 = E('accordionViewer.cam.goal.d'); E("document.querySelector('[title=\"تكبير\"]').click()"); pg.wait_for_timeout(100)
    chk('كاميرا: زر التكبير يقرّب الكاميرا', E('accordionViewer.cam.goal.d') < d0, f'{d0}→{E("accordionViewer.cam.goal.d")}')
    E("document.querySelector('[title=\"إعادة ضبط الكاميرا\"]').click()"); pg.wait_for_timeout(100)
    chk('كاميرا: إعادة الضبط تعيد الزاوية الافتراضية', abs(E('accordionViewer.cam.goal.d') - 1.9) < 1e-6 and abs(E('accordionViewer.cam.goal.th') - 0.55) < 1e-6)
    E("document.getElementById('btn-hide').click()"); pg.wait_for_timeout(200)
    chk('إخفاء اللوحات: اللوحة الجانبية والتبويبات تختفي', E("getComputedStyle(document.getElementById('side')).display")=='none' or E("document.getElementById('ui').classList.contains('hide-all')"))
    pg.screenshot(path='_shots/acc/ui_hidden.png')
    print('\nالنتيجة:', sum(res), '/', len(res), 'نجحت؛ أخطاء الصفحة:', errs[:3]); b.close()
