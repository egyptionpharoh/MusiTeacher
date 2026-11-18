# اختبار متصفح للتقويم المدرسي في منبّه الحصص (Playwright):
#   bun tests/lesson-plans/build-ui.cjs && node tests/lesson-plans/make-redesign-fixtures.mjs && node tests/lesson-plans/serve.cjs
#   python3 tests/class-alarm/e2e-calendar.py
import asyncio, os, re
from playwright.async_api import async_playwright
OUT='/tmp/calshots'; os.makedirs(OUT, exist_ok=True)
BASE='http://127.0.0.1:5340'
STORE=open('/tmp/lpfx/alarm-store.json').read()   # مخزن منبّه قديم بلا تقويم: يُختبر الترقية والاستيراد الأولي
NOW='2026-10-25T02:55:00Z'                         # الأحد 25 أكتوبر 2026 الساعة 06:55 بتوقيت مسقط
R=[]
def ok(name, cond, extra=''):
    R.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name+(' | '+str(extra)[:400] if extra and not cond else ''))

async def seed(page, uid):
    await page.evaluate("""([uid, store]) => new Promise((res, rej) => { const r = indexedDB.open('musiteacher-class-alarm:'+uid, 1);
      r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('kv'); db.createObjectStore('tones', { keyPath: 'id' }); };
      r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.parse(store), 'store'); t.oncomplete = () => { r.result.close(); res(1); }; t.onerror = () => rej(t.error); }; })""", [uid, STORE])

async def newctx(b, mobile=False):
    ctx=await b.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':900}, timezone_id='Asia/Muscat', permissions=['notifications'], accept_downloads=True)
    await ctx.clock.install(time=NOW)
    page=await ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    page.on('console', lambda m: errs.append(m.text) if m.type=='error' and '404' not in m.text and 'Failed to load resource' not in m.text else None)
    page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return ctx, page, errs

async def open_cal(page):
    await page.get_by_role('tab', name='التقويم المدرسي').click(); await page.wait_for_selector('.ca-cal', timeout=6000); await page.wait_for_timeout(300)

async def rows(page): return await page.locator('.ca-cal-list .ca-cal-ev').count()

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx, page, errs = await newctx(b)
        await page.goto(BASE+'/?uid=calT'); await page.wait_for_timeout(300); await seed(page, 'calT')
        await page.goto(BASE+'/?uid=calT&app=alarm'); await page.wait_for_selector('.ca-timeline', timeout=8000); await page.wait_for_timeout(700)
        tabs=await page.inner_text('.ca-tabs')
        ok('tab «التقويم المدرسي» added, old tabs kept', all(t in tabs for t in ['اليوم','التقويم المدرسي','الجدول','التنبيهات','الطباعة والتقويم','البيانات']), tabs)
        soon=await page.locator('.ca-cal-soon').inner_text() if await page.locator('.ca-cal-soon').count() else ''
        ok('today: «من التقويم المدرسي» card (soon items)', 'التقرير الوصفي الأول' in soon and 'غدًا' in soon, soon)
        ok('class timeline still works', await page.locator('.ca-timeline').count()==1)

        await open_cal(page)
        head=await page.inner_text('.ca-cal-head')
        ok('year 2026/2027 seeded with 120 items', '2026/2027' in await page.locator('.ca-cal-year select').inner_text() and re.search(r'120\s*\n?\s*كل مواعيد العام', head), head)
        up=await page.inner_text('.ca-cal-groups')
        ok('upcoming: week group has descriptive report + plan items', 'خلال الأيام السبعة القادمة' in up and 'إدخال التقرير الوصفي الأول' in up and 'يوم الشباب العماني' in up, up[:500])
        ok('ongoing periods shown with remaining days', 'جارٍ – ينتهي' in up and 'تقييم العرض الشفوي والأنشطة العملية' in up)
        await page.screenshot(path=f'{OUT}/01_upcoming.png', full_page=True)

        # الشهر
        await page.click('.ca-seg >> text=الشهر'); await page.wait_for_timeout(300)
        await page.click('[aria-label="الشهر التالي"]'); await page.wait_for_timeout(200)
        ok('month view: November 2026', 'نوفمبر 2026' in await page.inner_text('.ca-cal-mtitle'))
        cell=page.locator('.ca-cal-cell[aria-label^="الأربعاء 18 نوفمبر"]')
        ok('month cell 18 Nov: national day', 'اليوم الوطني المجيد' in await cell.inner_text())
        await page.locator('.ca-cal-cell[aria-label^="الأربعاء 25 نوفمبر"]').click(); await page.wait_for_timeout(200)
        ok('click day → its items (expected national-day holiday)', 'إجازة اليوم الوطني' in await page.inner_text('.ca-cal-month'))
        await page.screenshot(path=f'{OUT}/02_month.png', full_page=True)

        # كل المواعيد + البحث والتصفية
        await page.click('.ca-seg >> text=كل المواعيد'); await page.wait_for_timeout(300)
        ok('list: all 120', await rows(page)==120, await rows(page))
        await page.fill('.ca-cal-filters input[type=search]', 'الاختبار القصير'); await page.wait_for_timeout(300)
        ok('search by name', await rows(page)==2, await rows(page))
        await page.fill('.ca-cal-filters input[type=search]', '')
        await page.select_option('.ca-cal-filters select[aria-label="التصنيف"]', 'music'); await page.wait_for_timeout(200)
        ok('filter category music = 7', await rows(page)==7, await rows(page))
        await page.select_option('.ca-cal-filters select[aria-label="التصنيف"]', ''); await page.select_option('.ca-cal-filters select[aria-label="المصدر"]', 'guide'); await page.wait_for_timeout(200)
        ok('filter source guide = 82', await rows(page)==82, await rows(page))
        await page.select_option('.ca-cal-filters select[aria-label="المصدر"]', ''); await page.select_option('.ca-cal-filters select[aria-label="الفصل الدراسي"]', 's2'); await page.select_option('.ca-cal-filters select[aria-label="الحالة"]', 'upcoming'); await page.wait_for_timeout(200)
        s2=await rows(page); ok('filter semester s2 + upcoming', s2>20, s2)
        await page.select_option('.ca-cal-filters select[aria-label="الفصل الدراسي"]', ''); await page.select_option('.ca-cal-filters select[aria-label="الحالة"]', 'past'); await page.wait_for_timeout(200)
        past=await page.locator('.ca-cal-ev.is-past').count(); ok('past items marked as ended', past==await rows(page) and past>=4, past)
        await page.select_option('.ca-cal-filters select[aria-label="الحالة"]', '')

        # مراجعة + اعتماد تاريخ هجري مقترح
        await page.click('.ca-seg >> text=تحتاج مراجعة'); await page.wait_for_timeout(300)
        rv=await page.inner_text('.ca-cal-groups')
        ok('review list: conflicts + variable dates', all(x in rv for x in ['يوم الشجرة','اليوم العالمي للمعلمين','فترة امتحانات نهاية الفصل الدراسي','عيد الفطر المبارك','يوم المكتبة المدرسية']) and '31 أكتوبر 2026 يوم سبت' in rv, rv[:600])
        await page.locator('.ca-cal-ev', has_text='عيد الفطر المبارك').click(); await page.wait_for_timeout(300)
        dt=await page.inner_text('.ca-modal')
        ok('detail: source, hijri date, estimate + review note', 'دليل المناسبات' in dt and '1 شوال' in dt and 'التاريخ المقترح' in dt and 'يحتاج مراجعة' in dt, dt[:500])
        await page.click('.ca-modal >> text=اعتماد هذا التاريخ'); await page.wait_for_timeout(300)
        dt2=await page.inner_text('.ca-modal')
        ok('estimate approved → dated, review cleared', 'لم يُحدَّد لهذا العام' not in dt2 and 'يحتاج مراجعة:' not in dt2 and '2027' in dt2, dt2[:300])
        await page.screenshot(path=f'{OUT}/03_detail.png')
        await page.click('.ca-modal-x'); await page.wait_for_timeout(200)

        # إضافة → تعديل → حذف → استرجاع
        await page.click('.ca-cal-head >> text=موعد جديد'); await page.wait_for_timeout(300)
        await page.fill('.ca-modal input >> nth=0', 'اجتماع مجلس الآباء')
        await page.select_option('.ca-modal select >> nth=0', 'school')
        await page.fill('.ca-modal input[type=date] >> nth=0', '2026-10-28')
        await page.fill('.ca-modal input[placeholder="مثل: 5-11 أو 12"]', '5-10')
        await page.click('.ca-modal >> text=مخصص لهذا الموعد'); await page.click('.ca-modal button.ca-chip >> text=بيوم')
        await page.fill('.ca-modal textarea >> nth=-1', 'أحضر كشف الدرجات')
        await page.screenshot(path=f'{OUT}/04_edit.png')
        await page.click('.ca-modal-foot >> text=حفظ'); await page.wait_for_timeout(400)
        await page.click('.ca-seg >> text=القادمة'); await page.wait_for_timeout(200)
        ok('manual event added', 'اجتماع مجلس الآباء' in await page.inner_text('.ca-cal-groups'))
        await page.locator('.ca-cal-ev', has_text='اجتماع مجلس الآباء').click(); await page.wait_for_timeout(200)
        d=await page.inner_text('.ca-modal'); open('/tmp/d.txt','w').write(d)
        notes=await page.input_value('.ca-modal textarea')
        ok('manual event detail: grades, custom reminder, notes, source manual', 'الصفوف' in d and '5-10' in d and 'قبل يوم' in d and 'إدخال يدوي' in d and notes=='أحضر كشف الدرجات', d[:500])
        await page.click('.ca-modal-foot >> text=تعديل'); await page.wait_for_timeout(200)
        await page.fill('.ca-modal input >> nth=0', 'اجتماع مجلس الآباء والأمهات'); await page.click('.ca-modal-foot >> text=حفظ'); await page.wait_for_timeout(300)
        ok('edit saved (name changed)', 'اجتماع مجلس الآباء والأمهات' in await page.inner_text('.ca-cal-groups'))
        await page.locator('.ca-cal-ev', has_text='اجتماع مجلس الآباء والأمهات').click(); await page.wait_for_timeout(200)
        await page.click('.ca-modal >> text=سجل التعديلات'); h=await page.inner_text('.ca-cal-hist'); ok('change history kept', 'إنشاء' in h and 'الاسم' in h, h)
        await page.click('.ca-modal-foot >> text=حذف'); await page.wait_for_timeout(300)
        ok('deleted → moved to trash', 'اجتماع مجلس الآباء والأمهات' not in await page.inner_text('.ca-cal-groups') and await page.locator('.ca-cal-tools >> text=المحذوفات (1)').count()==1)
        await page.click('.ca-cal-tools >> text=المحذوفات'); await page.click('.ca-modal >> text=استرجاع'); await page.wait_for_timeout(300); await page.click('.ca-modal-x')
        ok('restored from trash', 'اجتماع مجلس الآباء والأمهات' in await page.inner_text('.ca-cal-groups'))

        # الأعوام: إنشاء 2027/2028 مع نسخ المناسبات، ثم تعديل وأرشفة
        await page.click('.ca-cal-tools >> text=الأعوام الدراسية'); await page.wait_for_timeout(200)
        await page.click('.ca-modal >> text=عام دراسي جديد'); await page.wait_for_timeout(200)
        ok('new year prefilled 2027/2028', await page.input_value('.ca-cal-yform input >> nth=0')=='2027/2028')
        await page.screenshot(path=f'{OUT}/05_newyear.png')
        await page.click('.ca-cal-yform >> text=حفظ العام'); await page.wait_for_timeout(600)
        yt=await page.locator('.ca-cal-year select').inner_text()
        ok('year 2027/2028 created and selected', '2027/2028' in yt and await page.locator('.ca-cal-year select').input_value()!='' , yt)
        await page.click('.ca-modal-x'); await page.wait_for_timeout(200)
        await page.click('.ca-seg >> text=كل المواعيد'); await page.wait_for_timeout(300)
        n2=await rows(page); ok('annual + variable occasions copied (82), no admin items', n2==82, n2)
        txt=await page.inner_text('.ca-cal-groups'); ok('annual dates recomputed for 2027/2028', 'سبتمبر 2027' in txt)
        await page.click('.ca-cal-tools >> text=الأعوام الدراسية'); await page.wait_for_timeout(200)
        await page.locator('.ca-cal-years li', has_text='2027/2028').locator('text=أرشفة').click(); await page.wait_for_timeout(200)
        ok('archive year', 'مؤرشف' in await page.locator('.ca-cal-years li', has_text='2027/2028').inner_text())
        # نسخ ثانٍ لا يكرر
        await page.select_option('.ca-modal select >> nth=0', label='2026/2027'); await page.select_option('.ca-modal select >> nth=1', label='2027/2028')
        await page.locator('.ca-modal fieldset').get_by_role('button', name='نسخ').click(); await page.wait_for_timeout(500)
        toast=await page.inner_text('.ca-toast') if await page.locator('.ca-toast').count() else ''
        ok('copy again → no duplicates', 'نُسخ 0' in toast and '82' in toast, toast)
        await page.locator('.ca-cal-years li', has_text='2026/2027').locator('text=تعديل').click(); await page.wait_for_timeout(200)
        await page.fill('.ca-cal-yform input[type=date] >> nth=1', '2027-07-15'); await page.click('.ca-cal-yform >> text=حفظ العام'); await page.wait_for_timeout(300)
        ok('edit current year end date', '15 يوليو 2027' in await page.locator('.ca-cal-years li', has_text='2026/2027').inner_text())
        await page.locator('.ca-cal-years li', has_text='2026/2027').locator('text=عرض').click(); await page.wait_for_timeout(300)

        # إعدادات التذكير
        await page.click('.ca-cal-tools >> text=إعدادات التذكير'); await page.wait_for_timeout(200)
        await page.locator('.ca-cal-catpick', has_text='عالمية ودولية').locator('input').check(); await page.wait_for_timeout(200)
        await page.screenshot(path=f'{OUT}/06_settings.png'); await page.click('.ca-modal-x')

        # التذكير الفعلي: 07:00 → «تذكير غدًا: إدخال التقرير الوصفي الأول»
        await page.clock.fast_forward('05:15'); await page.wait_for_selector('.ca-alarm', timeout=8000); await page.wait_for_timeout(300)
        al=await page.inner_text('.ca-alarm')
        fired=await page.evaluate("Object.keys(JSON.parse(localStorage.getItem('mt-class-alarm:fired')||'{}')).filter(k=>k.startsWith('cal|'))")
        ok('real alarm fired at 07:00 for calendar reminders (report + youth day, both «غدًا»)', 'تذكير غدًا' in al and len([k for k in fired if k.endswith('|b1|2026-10-25')])>=2, (al, fired))
        await page.screenshot(path=f'{OUT}/07_alarm.png')
        await page.click('.ca-alarm >> text=تم، شكرًا'); await page.wait_for_timeout(200)

        # تصدير .ics
        async with page.expect_download() as dl:
            await page.click('.ca-cal-tools >> text=تصدير إلى تقويم الهاتف')
        d=await dl.value; path=await d.path(); ics=open(path, encoding='utf-8').read()
        ok('.ics export with events + alarms', d.suggested_filename.endswith('.ics') and ics.count('BEGIN:VEVENT')>=100 and 'BEGIN:VALARM' in ics, d.suggested_filename)

        # الحفظ الدائم: إعادة التحميل
        await page.reload(); await page.wait_for_selector('.ca-tabs', timeout=8000); await page.wait_for_timeout(600); await open_cal(page)
        await page.click('.ca-seg >> text=كل المواعيد'); await page.wait_for_timeout(300)
        t=await page.inner_text('.ca-cal-groups')
        ok('after reload: manual event + approved hijri date + years persist', 'اجتماع مجلس الآباء والأمهات' in t and '2027/2028' in await page.locator('.ca-cal-year select').inner_text() and await rows(page)==121, await rows(page))
        ok('no runtime errors', not errs, errs)

        # «خروج ودخول»: حساب آخر على الجهاز نفسه له تقويمه المستقل، والعودة للحساب الأول تجد بياناته
        ctx2, p2, e2 = await newctx(b)
        await p2.goto(BASE+'/?uid=calU'); await p2.wait_for_timeout(300); await seed(p2, 'calU')
        await p2.goto(BASE+'/?uid=calU&app=alarm'); await p2.wait_for_selector('.ca-tabs', timeout=8000); await p2.wait_for_timeout(500); await open_cal(p2)
        await p2.click('.ca-seg >> text=كل المواعيد'); await p2.wait_for_timeout(300)
        ok('another account: own fresh calendar (120, no manual event)', await rows(p2)==120 and 'اجتماع مجلس الآباء' not in await p2.inner_text('.ca-cal-groups'))
        await p2.goto(BASE+'/?uid=calT&app=alarm'); await p2.wait_for_selector('.ca-tabs', timeout=8000); await p2.wait_for_timeout(500)
        # (سياق متصفح منفصل = جهاز آخر بلا مزامنة) — نعود للسياق الأول للتحقق من الحساب نفسه
        await page.goto(BASE+'/?uid=calT&app=alarm'); await page.wait_for_selector('.ca-tabs', timeout=8000); await page.wait_for_timeout(500); await open_cal(page)
        ok('back to first account: data still there', 'اجتماع مجلس الآباء والأمهات' in await page.inner_text('.ca-cal-groups'))

        # الجوال
        ctx3, m, e3 = await newctx(b, mobile=True)
        await m.goto(BASE+'/?uid=calM'); await m.wait_for_timeout(300); await seed(m, 'calM')
        await m.goto(BASE+'/?uid=calM&app=alarm'); await m.wait_for_selector('.ca-tabs', timeout=8000); await m.wait_for_timeout(500); await open_cal(m)
        for v in ['القادمة', 'الشهر', 'كل المواعيد']:
            await m.click(f'.ca-seg >> text={v}'); await m.wait_for_timeout(300)
            ov=await m.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
            ok(f'mobile no horizontal overflow: {v}', ov<=1, ov)
            await m.screenshot(path=f'{OUT}/m_{v}.png', full_page=False)
        await m.locator('.ca-cal-ev').first.click(); await m.wait_for_timeout(300); await m.screenshot(path=f'{OUT}/m_detail.png')
        ok('mobile no errors', not e3, e3)
        await b.close()
    print(f'SUMMARY {sum(R)} / {len(R)}')
asyncio.run(main())
