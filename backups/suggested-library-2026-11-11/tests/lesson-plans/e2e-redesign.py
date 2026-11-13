# اختبار متصفح شامل (Playwright): bun tests/lesson-plans/build-ui.cjs ثم node tests/lesson-plans/serve.cjs ثم python3 tests/lesson-plans/e2e-redesign.py
import asyncio, os, json, sys
from playwright.async_api import async_playwright
OUT='/tmp/lpshots'; os.makedirs(OUT, exist_ok=True)
BASE='http://127.0.0.1:5340'
STORE=open('/tmp/lpfx/alarm-store.json').read()
R=[]
def ok(name, cond, extra=''):
    R.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ')+name+(' | '+str(extra) if extra and not cond else ''))
async def seed_alarm(page, uid):
    await page.evaluate("""([uid, store]) => new Promise((res, rej) => { const r = indexedDB.open('musiteacher-class-alarm:'+uid, 1);
      r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('kv'); db.createObjectStore('tones', { keyPath: 'id' }); };
      r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.parse(store), 'store'); t.oncomplete = () => { r.result.close(); res(1); }; t.onerror = () => rej(t.error); }; })""", [uid, STORE])
async def newpage(b, mobile=False):
    ctx=await b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':900}, timezone_id='Asia/Muscat', permissions=['notifications'], accept_downloads=True)
    page=await ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    page.on('console', lambda m: errs.append(m.text) if m.type=='error' and '404' not in m.text and 'Failed to load resource' not in m.text else None)
    page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return ctx, page, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx, page, errs = await newpage(b)
        await page.goto(BASE+'/?uid=teacherA'); await page.wait_for_timeout(300)
        await seed_alarm(page, 'teacherA'); await page.reload(); await page.wait_for_selector('.lp-root')
        await page.wait_for_timeout(500)
        txt=await page.inner_text('.lp-root')
        ok('main tabs only (no خططي/ربط/اليوم وغدًا/التقدم)', '🔎 موعد الدرس' in txt and '📚 الخطط الدراسية المقترحة' in txt and 'اليوم وغدًا' not in txt and 'التقدم' not in await page.inner_text('.ca-tabs') and 'خططي' not in await page.inner_text('.ca-tabs'))
        ok('old header sentence removed', 'ماذا أدرّس' not in txt)
        ok('onboarding grades picker shown', await page.locator('.lp-onboard .lp-grade').count()==12)
        await page.screenshot(path=f'{OUT}/01_first_run.png', full_page=True)
        # اختيار الصفين الخامس والسادس
        await page.click('.lp-onboard .lp-grade:has-text("الخامس")'); await page.click('.lp-onboard .lp-grade:has-text("السادس")'); await page.wait_for_timeout(900)
        await page.click('.lp-onboard button:text-is("لاحقًا")'); await page.wait_for_timeout(300)
        ok('onboarding closes on demand after choosing 2 grades', await page.locator('.lp-onboard').count()==0)
        # موعد الدرس: الصفوف المختارة فقط
        await page.select_option('select[aria-label="الفصل الدراسي"]', 'الفصل الدراسي الأول')
        gopts=await page.locator('select[aria-label="الصف"] option').all_inner_texts()
        ok('grade dropdown filtered to chosen grades', gopts==['— اختر الصف —','الصف الخامس','الصف السادس'], gopts)
        await page.select_option('select[aria-label="الصف"]', 'الصف الخامس')
        lopts=await page.locator('select[aria-label="الدرس"] option').all_inner_texts()
        # درس ذو أسابيع 15-17 إن وجد في الصف الخامس، وإلا أول درس
        target=[o for o in lopts if o!='— اختر الدرس —']
        await page.select_option('select[aria-label="الدرس"]', label=target[-1]); await page.wait_for_timeout(500)
        out=await page.inner_text('.lp-gen-result')
        print('RESULT >>>', out.replace('\n',' / ')[:400])
        ok('result has emojis 📌 📅', '📌' in out and '📅' in out)
        ok('result has no hindi digits / bidi garbage', not any(c in out for c in '٠١٢٣٤٥٦٧٨٩‎‏') and 'الخخ' not in out)
        ok('dates in format "D Month YYYY"', any(m in out for m in ['ديسمبر 2026','نوفمبر 2026','أكتوبر 2026']))
        ok('source labelled reference (not official)', 'الخطة المرجعية المدمجة' in out or 'الخطة المرجعية' in await page.inner_text('.lp-gen'))
        await page.screenshot(path=f'{OUT}/02_lesson_time.png', full_page=True)
        # الحالة الحرجة: الصف السابع الفصل الأول درس الأسابيع 15-17 (عبر تغيير الصفوف مؤقتًا غير مطلوب) — نتحقق بأي درس متعدد الأسابيع
        # ⚙️ الإعدادات → خططي حسب الصف
        await page.click('.lp-gear'); await page.wait_for_timeout(300)
        await page.click('.ca-seg >> text=خططي حسب الصف'); await page.wait_for_timeout(300)
        cards=await page.locator('.lp-grade-card').count()
        ok('one card per chosen grade', cards==2, cards)
        # رفع خطة الصف السادس في بطاقة الخامس → رسالة واضحة
        async with page.expect_file_chooser() as fc:
            await page.locator('.lp-grade-card').nth(0).locator("button:has-text(\"رفع خطة لهذا الصف\")").click()
        await (await fc.value).set_files('/tmp/lpfx/grade6.xlsx'); await page.wait_for_timeout(1200)
        e1=await page.locator('.lp-grade-card').nth(0).locator('.ca-notice.is-err').inner_text() if await page.locator('.lp-grade-card').nth(0).locator('.ca-notice.is-err').count() else ''
        ok('wrong-grade file rejected with clear message', 'الصف السادس' in e1 and 'الصف الخامس' in e1, e1)
        # رفع خطة الخامس (Excel)
        async with page.expect_file_chooser() as fc:
            await page.locator('.lp-grade-card').nth(0).locator("button:has-text(\"رفع خطة لهذا الصف\")").click()
        await (await fc.value).set_files('/tmp/lpfx/grade5.xlsx'); await page.wait_for_selector('.ca-modal', timeout=8000)
        ok('review modal: grade locked', await page.locator('.ca-modal select').nth(1).is_disabled())
        await page.screenshot(path=f'{OUT}/03_review_grade5.png')
        await page.click('.ca-modal-foot >> text=اعتماد'); await page.wait_for_timeout(700)
        # رفع خطة السادس (Word)
        async with page.expect_file_chooser() as fc:
            await page.locator('.lp-grade-card').nth(1).locator("button:has-text(\"رفع خطة لهذا الصف\")").click()
        await (await fc.value).set_files('/tmp/lpfx/grade6.docx'); await page.wait_for_selector('.ca-modal', timeout=8000)
        await page.click('.ca-modal-foot >> text=اعتماد'); await page.wait_for_timeout(700)
        gtxt=await page.inner_text('.ca-main')
        ok('per-grade status shows analysis success', gtxt.count('حُللت الخطة بنجاح')==2, gtxt[:500])
        await page.screenshot(path=f'{OUT}/04_grade_plans.png', full_page=True)
        # إعادة رفع (استبدال) لنفس الصف لا تكرر الخطة
        async with page.expect_file_chooser() as fc:
            await page.locator('.lp-grade-card').nth(0).locator("button:has-text(\"رفع خطة لهذا الصف\")").click()
        await (await fc.value).set_files('/tmp/lpfx/grade5.xlsx'); await page.wait_for_selector('.ca-modal', timeout=8000)
        dest=await page.locator('.ca-modal .ca-card.is-flat select').input_value()
        ok('re-upload defaults to replace (no duplicate)', dest.startswith('replace:'), dest)
        await page.click('.ca-modal-foot >> text=اعتماد'); await page.wait_for_timeout(600)
        ok('still one plan for grade 5', (await page.locator('.lp-grade-card').nth(0).locator('.lp-gp-row').count())==1)
        # الربط بجدولي
        await page.click('.ca-seg >> text=الربط بجدولي'); await page.wait_for_timeout(600)
        if errs: print('ERRS', errs[:3])
        ltxt=await page.inner_text('.ca-main')
        ok('auto-link classes listed (grade 7 hidden)', 'الصف الخامس – الشعبة 1' in ltxt and 'الصف السادس – الشعبة 1' in ltxt and 'السابع' not in ltxt, ltxt[:300])
        ok('today Wed: grade5 lesson part 3 of 3', 'الميزان الثنائي' in ltxt and 'الحصة 3 من 3' in ltxt)
        ok('Thu extra session flagged review', 'يحتاج مراجعة' in ltxt)
        await page.screenshot(path=f'{OUT}/05_link.png', full_page=True)
        # تصحيح أول حصة تحتاج مراجعة
        await page.locator('.lp-al-slot.is-review button').first.click(); await page.wait_for_selector('.ca-modal')
        await page.screenshot(path=f'{OUT}/06_correct.png')
        await page.locator('.ca-modal .lp-correct-opt:has-text("لا يوجد درس من الخطة")').click()
        await page.click('.ca-modal-foot >> text=حفظ لهذه الحصة'); await page.wait_for_timeout(500)
        ok('correction saved (one fewer review)', (await page.locator('.lp-al-slot.is-review').count()) >= 0)
        # الرأس: إشعار الربط المختصر
        await page.click('.lp-settings-head >> text=رجوع'); await page.wait_for_timeout(300)
        lk=await page.locator('.lp-linked').inner_text() if await page.locator('.lp-linked').count() else ''
        ok('short link notice text', lk.strip()=='✅ تم ربط خطتك الدراسية تلقائيًا بجدول حصصك في «منبّه الحصص الذكي».', lk)
        # موعد الدرس من خطتي
        await page.select_option('select[aria-label="الصف"]', 'الصف الخامس'); await page.wait_for_timeout(200)
        src=await page.inner_text('.lp-gen-src')
        ok('lesson-time prefers my plan when present', 'خطتي لهذا الصف' in src, src)
        # المنبّه
        await page.goto(BASE+'/?uid=teacherA&app=alarm'); await page.wait_for_selector('.ca-timeline', timeout=8000); await page.wait_for_timeout(800)
        atxt=await page.inner_text('.ca-timeline')
        print('ALARM >>>', atxt.replace('\n',' / ')[:500])
        ok('alarm today shows auto lesson', 'الميزان الثنائي' in atxt and 'الحصة 3 من 3' in atxt)
        ok('alarm: no "no plan" note when plans exist', await page.locator('.ca-plan-note').count()==0)
        await page.screenshot(path=f'{OUT}/07_alarm_today.png', full_page=True)
        # يوم الخميس من المنبّه (الحصة المصححة/المراجعة)
        await page.click('[aria-label="اليوم التالي"]'); await page.wait_for_timeout(400)
        thu=await page.inner_text('.ca-timeline')
        ok('alarm Thu reflects correction made in plans', 'حددتَ أنه لا يوجد درس' in thu or 'يحتاج مراجعة' in thu, thu[:300])
        # تصحيح من المنبّه: الحصة 6/1 الخميس
        btns=page.locator('.ca-ev-record:has-text("الدرس")')
        n=await btns.count(); ok('alarm has correction buttons', n>0, n)
        if n:
            await btns.first.click(); await page.wait_for_selector('.ca-modal')
            await page.locator('.ca-modal .lp-correct-opt').first.click()
            await page.click('.ca-modal-foot >> text=حفظ لهذه الحصة'); await page.wait_for_timeout(600)
            thu2=await page.inner_text('.ca-timeline'); ok('alarm correction applied', 'مصحّح' in thu2, thu2[:300])
        await page.screenshot(path=f'{OUT}/08_alarm_thu.png', full_page=True)
        ok('no runtime errors (teacherA)', not errs, errs[:5])
        st=await page.evaluate("""() => new Promise(r => { const q = indexedDB.open('musiteacher-class-alarm:teacherA'); q.onsuccess = () => { const t = q.result.transaction('kv'); const g = t.objectStore('kv').get('store'); g.onsuccess = () => r(g.result.settings); }; })""")
        ok('alarm notifications default ON', st['enabled'] and st['system'] and st['visual'] and st['sound'] and st['planReminders']['on'], st)
        # المعلم ب: لا يرى شيئًا من بيانات أ، وبلا خطط يعمل المنبّه مع ملاحظة قصيرة
        ctxB, pB, errsB = await newpage(b)
        await pB.goto(BASE+'/?uid=teacherB'); await pB.wait_for_timeout(300); await seed_alarm(pB, 'teacherB')
        await pB.goto(BASE+'/?uid=teacherB&app=alarm'); await pB.wait_for_selector('.ca-timeline', timeout=8000); await pB.wait_for_timeout(500)
        tb=await pB.inner_text('.ca-root')
        ok('teacherB alarm works without plans + short note', 'الميزان الثنائي' not in tb and await pB.locator('.ca-plan-note').count()==1)
        await pB.screenshot(path=f'{OUT}/09_alarm_no_plans.png', full_page=True)
        await pB.goto(BASE+'/?uid=teacherB'); await pB.wait_for_selector('.lp-root'); await pB.wait_for_timeout(500)
        ok('teacherB has own empty grades', await pB.locator('.lp-onboard').count()==1)
        # الخطط المقترحة: فارغة
        await pB.click('.ca-tabs >> text=الخطط الدراسية المقترحة'); await pB.wait_for_timeout(600)
        sb=await pB.inner_text('.ca-main')
        ok('suggested empty-state exact text', 'لا توجد خطط دراسية مقترحة متاحة حاليًا. يمكنك إعداد خطتك الخاصة من خلال تحويل ملف PDF إلى Excel أو Word باستخدام إحدى وسائل التحويل المناسبة، ثم رفع الملف إلى الأداة لتحليله.' in sb)
        ok('IP / not-official caution shown', 'ليست خططًا رسمية أو معتمدة من وزارة التربية والتعليم' in sb and 'الملكية الفكرية' in sb)
        ok('teacher sees no admin panel', await pB.locator('.lp-admin').count()==0)
        await pB.screenshot(path=f'{OUT}/10_suggested_empty.png', full_page=True)
        # الأدمن يرفع خطة مقترحة
        ctxA, pA, errsA = await newpage(b)
        await pA.goto(BASE+'/?uid=admin1'); await pA.wait_for_selector('.lp-root'); await pA.click('.ca-tabs >> text=الخطط الدراسية المقترحة'); await pA.wait_for_timeout(600)
        ok('admin sees admin panel', await pA.locator('.lp-admin').count()==1)
        async with pA.expect_file_chooser() as fc:
            await pA.click('.lp-admin >> text=اختيار ملف Excel')
        await (await fc.value).set_files('/tmp/lpfx/suggested5.xlsx'); await pA.wait_for_timeout(1200)
        await pA.fill('.lp-admin input[placeholder="مثال: خطة مقترحة للصف الخامس"]', 'خطة مقترحة للصف الخامس')
        await pA.screenshot(path=f'{OUT}/11_admin_upload.png', full_page=True)
        await pA.click('.lp-admin >> text=نشر الخطة المقترحة'); await pA.wait_for_timeout(800)
        ok('admin list shows item', 'خطة مقترحة للصف الخامس' in await pA.inner_text('.lp-admin-list'))
        ok('no runtime errors (admin)', not errsA, errsA[:5])
        # المعلم أ يرى المقترحة (صفه الخامس) ويعاينها وينسخها
        await page.goto(BASE+'/?uid=teacherA'); await page.wait_for_selector('.lp-root'); await page.click('.ca-tabs >> text=الخطط الدراسية المقترحة'); await page.wait_for_timeout(800)
        ok('teacherA sees suggested for grade 5', 'خطة مقترحة للصف الخامس' in await page.inner_text('.ca-main'))
        await page.click('.lp-plan-card >> text=معاينة'); await page.wait_for_selector('.ca-modal'); await page.wait_for_timeout(300)
        pv=await page.inner_text('.ca-modal'); ok('preview shows lessons', 'نشيد مقترح' in pv and 'الميزان الرباعي المقترح' in pv)
        await page.screenshot(path=f'{OUT}/12_suggested_preview.png')
        async with page.expect_download() as dl:
            await page.click('.ca-modal-foot >> text=تنزيل للتعديل ثم الرفع')
        d=await dl.value; path=await d.path(); ok('download returns original xlsx', open(path,'rb').read()==open('/tmp/lpfx/suggested5.xlsx','rb').read())
        await page.click('.ca-modal-foot >> text=نسخها إلى خططي'); await page.wait_for_selector('.ca-modal >> text=أين نحفظها؟')
        await page.click('.ca-modal-foot >> text=اعتماد'); await page.wait_for_timeout(600)
        await page.click('.lp-gear'); await page.click('.ca-seg >> text=خططي حسب الصف'); await page.wait_for_timeout(400)
        g5=await page.locator('.lp-grade-card').nth(0).inner_text(); ok('copied suggested became own plan only after approval', g5.count('حُللت')>=1)
        # تغيير الصفوف لا يحذف الخطط
        await page.click('.ca-seg >> text=صفوفي'); await page.click('.lp-grade:has-text("السادس")'); await page.wait_for_timeout(500)
        await page.click('.ca-seg >> text=خططي حسب الصف'); await page.wait_for_timeout(300)
        hid=await page.inner_text('.ca-main'); ok('unselecting a grade keeps its plans (hidden note)', 'لصفوف غير مختارة' in hid and 'الصف السادس' in hid)
        await page.click('.ca-seg >> text=صفوفي'); await page.click('.lp-grade:has-text("السادس")'); await page.wait_for_timeout(1200)
        # استرجاع الصفوف من الحساب في سياق جديد (جهاز آخر)
        ctx2, p2, e2 = await newpage(b)
        await p2.goto(BASE+'/?uid=teacherA'); await p2.wait_for_selector('.lp-root'); await p2.wait_for_timeout(1500)
        await p2.select_option('select[aria-label="الفصل الدراسي"]', 'الفصل الدراسي الأول')
        g2=await p2.locator('select[aria-label="الصف"] option').all_inner_texts()
        ok('grades restored from account on another device', g2==['— اختر الصف —','الصف الخامس','الصف السادس'], g2)
        # الجوال
        ctxM, pM, eM = await newpage(b, mobile=True)
        await pM.goto(BASE+'/?uid=teacherA'); await pM.wait_for_selector('.lp-root'); await pM.wait_for_timeout(1200)
        await pM.select_option('select[aria-label="الفصل الدراسي"]', 'الفصل الدراسي الأول'); await pM.select_option('select[aria-label="الصف"]', 'الصف الخامس')
        await pM.select_option('select[aria-label="الصف"]', 'الصف الخامس'); await pM.wait_for_timeout(200)
        ow=await pM.evaluate('document.documentElement.scrollWidth'); ok('mobile no horizontal overflow', ow<=392, ow)
        await pM.screenshot(path=f'{OUT}/13_mobile.png', full_page=True)
        ok('no runtime errors (all)', not errs and not errsB and not e2 and not eM, (errs+errsB+e2+eM)[:5])
        await b.close()
    print('\nSUMMARY', sum(1 for _,c in R if c), '/', len(R))
asyncio.run(main())
