// =====================================================================
//  اختيار الدرس من شاشة البداية (للمعلم): الصف ← الفصل الدراسي ← الدرس ← «ابدأ السباق».
//  اختيار الدرس يحمّل أسئلته فورًا ويجعلها المسابقة الحالية — بلا استيراد ولا أزرار إضافة ولا تأكيدات.
//  التخصيص (حذف/إضافة/تعديل/ترتيب) اختياري من زر «تخصيص الأسئلة»، ويُحفظ لهذا الدرس في حساب المعلم فقط.
// =====================================================================
import { el, AR, toast } from './dom.js';

const SEMS = [[1, 'الفصل الدراسي الأول'], [2, 'الفصل الدراسي الثاني']];

export function buildLessonPicker(app) {
  const C = app.CT;
  const box = el('div', { class: 'lpick hidden' });
  const g = el('select', { 'aria-label': 'الصف' });
  const s = el('select', { 'aria-label': 'الفصل الدراسي' });
  const l = el('select', { 'aria-label': 'الدرس' });
  const note = el('div', { class: 'lnote' });
  const custom = el('button', { class: 'btn sm ghost lcustom', onclick: () => app.openSettings({ tab: 'questions' }) }, '✏️ تخصيص الأسئلة (اختياري)');
  const lab = (t, x) => el('label', { class: 'lrow' }, el('span', {}, t), x);
  box.append(el('div', { class: 'lhead' }, '📚 اختر الدرس ثم ابدأ السباق'), lab('الصف', g), lab('الفصل', s), lab('الدرس', l), note, custom);

  const avail = { 1: null, 2: null };
  let grade = 0, sem = 1, tk = 0;
  const lessonsFor = (gr, sm) => (avail[sm] ? C.lessonsOf(gr).filter((x) => x.sem === sm && avail[sm].has(x.id)) : []);

  const fill = () => {
    g.innerHTML = ''; g.append(el('option', { value: 0 }, '— اختر الصف —'));
    for (let i = 1; i <= 12; i++) g.append(el('option', { value: i, selected: i === grade }, C.GRADE_NAME(i)));
    s.innerHTML = ''; SEMS.forEach(([v, t]) => s.append(el('option', { value: v, selected: v === sem }, t)));
    l.innerHTML = '';
    const ls = grade ? lessonsFor(grade, sem) : [];
    const cur = C.lessonById(app.contest && app.contest.lessonId);
    if (!grade) l.append(el('option', { value: '' }, '— اختر الصف أولًا —'));
    else if (!avail[sem]) l.append(el('option', { value: '' }, '… جارٍ التحميل'));
    else if (!ls.length) l.append(el('option', { value: '' }, sem === 2 ? 'لم تُسكَّن دروس الفصل الدراسي الثاني بعد' : 'لا توجد دروس متاحة لهذا الصف'));
    ls.forEach((x) => l.append(el('option', { value: x.id, selected: !!cur && x.id === cur.id }, x.title)));
    if (grade && ls.length && !(cur && ls.some((x) => x.id === cur.id))) l.prepend(el('option', { value: '', selected: true }, '— اختر الدرس —'));
    l.disabled = !ls.length;
  };
  const busy = (on) => { app.lessonLoading = on; app.ui.setStartBusy(on); };

  /** يحمّل درسًا ويجعله المسابقة الحالية */
  async function pick(id, { fresh = false, quiet = false } = {}) {
    const les = C.lessonById(id); if (!les) return;
    const my = ++tk; busy(true); note.className = 'lnote'; note.textContent = '⏳ جارٍ تجهيز أسئلة الدرس…';
    let r; try { r = await C.lessonContest(les, app.contest, { fresh }); } catch (e) { r = null; }
    if (my !== tk) return;
    busy(false);
    if (!r) { note.className = 'lnote warn'; note.textContent = 'تعذّر تحميل أسئلة الدرس. حاول مرة أخرى.'; return; }
    const saved = C.saveContest(r.c) || r.c;
    app.useContest(saved);
    if (!quiet) toast(r.custom ? `درس «${les.title}» بأسئلتك المعدّلة` : `جاهز: ${AR(app.playableCount(saved))} من أسئلة درس «${les.title}»`);
  }

  const paintNote = () => {
    const c = app.contest, les = C.lessonById(c && c.lessonId);
    note.innerHTML = ''; note.className = 'lnote';
    if (!les) { note.className = 'lnote hint'; note.textContent = 'اختر الصف والفصل والدرس، فتجهز أسئلة الدرس تلقائيًا.'; custom.disabled = false; return; }
    const n = app.playableCount(c);
    if (C.isCustomized(c)) {
      note.append(el('span', {}, `✏️ ${AR(n)} من أسئلتك المعدّلة لهذا الدرس `),
        el('button', { class: 'linkbtn', onclick: () => pick(les.id, { fresh: true }) }, '↺ استرجاع أسئلة الدرس الأصلية'));
    } else if (n) note.append(el('span', { class: 'ok' }, `✔ ${AR(n)} من أسئلة الدرس جاهزة — اضغط «ابدأ السباق»`));
    else { note.className = 'lnote warn'; note.textContent = 'لا توجد أسئلة مُسكَّنة لهذا الدرس بعد — أضف أسئلتك من «تخصيص الأسئلة».'; }
  };

  /** أول درس متاح في الاختيار الحالي (عند تغيير الصف أو الفصل) */
  const autoFirst = () => {
    const ls = grade ? lessonsFor(grade, sem) : [];
    if (ls.length) { pick(ls[0].id); return; }
    // لا درس متاح في هذا الاختيار: نوقف «ابدأ السباق» حتى لا يبدأ سباق الدرس السابق بالخطأ
    app.ui.setStartBlocked(true);
    note.className = 'lnote warn';
    note.textContent = !grade ? 'اختر الصف أولًا.' : sem === 2 ? 'لم يُسكَّن محتوى الفصل الدراسي الثاني بعد — سيظهر هنا تلقائيًا عند إضافته.' : 'لا توجد دروس متاحة لهذا الصف.';
  };

  g.onchange = () => { grade = +g.value; fill(); autoFirst(); };
  s.onchange = async () => { sem = +s.value; fill(); await ensure(sem); fill(); autoFirst(); };
  l.onchange = () => { if (l.value) pick(l.value); };

  async function ensure(sm) { if (!avail[sm]) avail[sm] = await C.curriculumLessonIds(sm); }

  /** يطابق القوائم مع المسابقة الحالية (عند فتح اللعبة أو بعد التخصيص أو اختيار مسابقة أخرى) */
  function sync(c) {
    app.ui.setStartBlocked(false);
    const les = C.lessonById(c && c.lessonId);
    if (les) { grade = les.grade; sem = les.sem || 1; }
    fill(); paintNote();
  }
  // عند فتح اللعبة: مسابقة درس غير معدّلة تُحدَّث بصمت بأحدث أسئلة البنك
  Promise.all([ensure(1), ensure(2)]).then(() => { const c = app.contest; sync(c); if (c && C.lessonById(c.lessonId) && !C.isCustomized(c)) pick(c.lessonId, { quiet: true }); });
  return { el: box, sync, show: (on) => box.classList.toggle('hidden', !on), pick };
}
