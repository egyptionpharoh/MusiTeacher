// =====================================================================
//  مكتبة الدروس التفاعلية — وضع المعلم السهل (5 خطوات):
//   1 اختر الصف → 2 اختر الدرس → 3 اختر نشاطًا جاهزًا أو أنشئ وراجع → 4 أدخل الأسماء → 5 ابدأ اللعب
//  + «مكتبتي»: الدروس الجاهزة · قوالبي الخاصة · المستخدمة مؤخرًا · + العجلة الكلاسيكية كما هي (classic.html).
// =====================================================================
import { LESSONS } from './data/lessons.js';
import { BANKS, bankFor, loadBanks, banksState } from './data/banks.js';
import * as S from './core/store.js';
import { normalize, uid, clone, problems, TYPES, shuffleOptions } from './core/model.js';
import { parseNames, mergeNames, shuffle, SOURCES } from './core/names.js';
import { generate } from './core/ai.js';
import { renderReview } from './ui/review.js';
import { renderPlay, clearPlay } from './ui/play.js';
import { printActivity } from './ui/print.js';
import { h, toast, ask, prompt, modal, GRADE_NAME, SEM_NAME, plain, ago } from './ui/text.js';

const main = document.querySelector('main');
const stepsEl = document.querySelector('.steps');
const STEP_NAMES = ['الصف', 'الدرس', 'النشاط', 'الأسماء', 'ابدأ اللعب'];
const ST_KEY = 'rz_state';
let st = (() => { try { return { step: 1, sem: 1, ...JSON.parse(sessionStorage.getItem(ST_KEY)) }; } catch { return { step: 1, sem: 1 }; } })();
let view = st.view || 'flow';
let playCtl = null;
const saveSt = () => { try { sessionStorage.setItem(ST_KEY, JSON.stringify({ ...st, view })); } catch { /* ignore */ } };
S.onQuota(() => toast('⚠ مساحة التخزين في المتصفح ممتلئة. احذف أنشطة قديمة أو صورًا كبيرة ثم أعد المحاولة.', 5000));

// ------------------------------------------------ الدروس (من الخطط + دروس يضيفها المعلم)
const customLessons = () => { try { return JSON.parse(localStorage.getItem('rz_custom_lessons')) || []; } catch { return []; } };
const allLessons = () => [...LESSONS, ...customLessons()];
const lessonById = (id) => allLessons().find((l) => l.id === id) || null;
const lessonsOf = (g, sem) => allLessons().filter((l) => l.grade === g && l.sem === sem).sort((a, b) => a.n - b.n);

/** نشاط افتراضي من البنك الجاهز (للقراءة فقط) */
function bankActivity(lessonId) {
  const b = bankFor(lessonId); const l = lessonById(lessonId); if (!b || !l) return null;
  return { id: `bank:${lessonId}`, title: l.title, grade: l.grade, sem: l.sem, lessonId, lessonTitle: l.title, origin: 'bank', bankVersion: b.version, sourceNote: b.source, questions: b.questions.map((q) => shuffleOptions(normalize({ ...q, bankRef: q.id }))), updatedAt: b.version, readonly: true };
}
const getActivity = (id) => (id && id.startsWith('bank:') ? bankActivity(id.slice(5)) : S.activity(id));

/** حالة الدرس: ready جاهز · setup يحتاج إلى إعداد · updated تم تحديث محتواه (نشاطك مبني على نسخة أقدم) */
function lessonStatus(l) {
  const b = bankFor(l.id); const mine = S.activitiesFor(l.id);
  const outdated = b && mine.some((a) => a.origin === 'bank-edit' && (a.bankVersion || 0) < b.version);
  return { status: outdated ? 'updated' : b || mine.length ? 'ready' : 'setup', bank: !!b, mine: mine.length };
}
const STATUS_CHIP = { ready: ['ready', 'جاهز'], setup: ['setup', 'يحتاج إلى إعداد'], updated: ['upd', 'تم تحديث محتواه'] };
const statusChips = (l) => { const s = lessonStatus(l); const [c, t] = STATUS_CHIP[s.status]; return h('div', { class: 'chips' }, h('span', { class: `chip ${c}` }, t), s.mine ? h('span', { class: 'chip mine' }, `أنشطتي: ${s.mine}`) : null); };

// ------------------------------------------------ التنقل
function go(step, patch = {}) {
  Object.assign(st, patch, { step }); view = 'flow';
  // لا لعب بلا أسماء/أسئلة حتى لو ضُغط رقم الخطوة 5 مباشرة
  if (step === 5) {
    const a = getActivity(st.actId); const m = S.prefs().mode;
    if (!a || (m !== 'question' && !S.sessionNames().length) || (m !== 'student' && !a.questions.length)) { st.step = 4; render(); toast('أكمل خطوة الأسماء أولًا، ثم اضغط «ابدأ اللعب».', 3500); return; }
  }
  render();
}
function paintSteps() {
  stepsEl.innerHTML = '';
  const can = [true, !!st.grade, !!st.lessonId || !!st.actId, !!st.actId, !!st.actId];
  STEP_NAMES.forEach((n, i) => stepsEl.append(h('button', { class: `${view === 'flow' && st.step === i + 1 ? 'on' : ''} ${st.step > i + 1 ? 'done' : ''}`, disabled: !can[i], onclick: () => go(i + 1) }, h('b', {}, i + 1), h('span', {}, n))));
}
function render() {
  if (playCtl) { playCtl.cleanup(); playCtl = null; }
  saveSt(); paintSteps(); main.innerHTML = ''; window.scrollTo(0, 0);
  document.querySelector('#libBtn').classList.toggle('pri', view === 'library');
  if (view === 'library') return viewLibrary();
  if (view === 'review') return viewReview();
  [null, viewGrade, viewLesson, viewActivity, viewNames, viewPlay][st.step]();
}
const hint = (t) => h('p', { class: 'hint' }, `💡 ${t}`);
/** تنبيه عند تعذر تحميل الأنشطة الجاهزة (غير مسجل الدخول، أو انقطاع) — بقية الأداة تعمل */
const banksNotice = () => (banksState.status === 'error' ? h('div', { class: 'notice warn' }, `الأنشطة الجاهزة غير متاحة الآن: ${banksState.error} `, h('button', { class: 'btn sm', onclick: async (e) => { e.currentTarget.disabled = true; await loadBanks(); render(); } }, '🔄 إعادة المحاولة')) : null);
const back = (to, label = 'رجوع') => h('button', { class: 'btn sm', onclick: () => go(to) }, `→ ${label}`);

// ------------------------------------------------ الخطوة 1: الصف (+ بحث في كل الدروس)
function viewGrade() {
  const res = h('div', { class: 'list' });
  const q = h('input', { type: 'search', placeholder: '🔎 ابحث عن درس في كل الصفوف… (مثال: الكروش، الرزحة، الباند)', oninput: () => {
    res.innerHTML = ''; const t = plain(q.value.trim()); if (t.length < 2) return;
    const hits = allLessons().filter((l) => plain(l.title).includes(t)).slice(0, 30);
    if (!hits.length) res.append(h('div', { class: 'empty' }, 'لا توجد دروس مطابقة.'));
    hits.forEach((l) => res.append(lessonRow(l, true)));
  } });
  const grid = h('div', { class: 'grid' });
  for (let g = 1; g <= 12; g++) {
    const ls = allLessons().filter((l) => l.grade === g); const ready = ls.filter((l) => lessonStatus(l).status !== 'setup').length;
    grid.append(h('button', { class: 'card gcard', onclick: () => go(2, { grade: g, lessonId: null, actId: null }) }, h('span', { class: 'num' }, g), h('b', {}, GRADE_NAME(g)), h('span', { class: 'mute small' }, `${ls.length} درسًا`), ready ? h('span', { class: 'chip ready', style: { alignSelf: 'flex-start' } }, `${ready} جاهز`) : null));
  }
  const rec = S.recent().map((r) => ({ r, a: getActivity(r.id) })).filter((x) => x.a).slice(0, 4);
  main.append(h('h1', {}, 'مكتبة الدروس التفاعلية'), hint('اختر الصف، ثم الدرس، ثم النشاط… وأدخل أسماء الطلاب وابدأ اللعب.'), ...[banksNotice()].filter(Boolean), q, res);
  if (rec.length) main.append(h('h2', {}, '🕘 استخدمتها مؤخرًا'), h('div', { class: 'grid wide' }, rec.map(({ r, a }) => h('button', { class: 'card', onclick: () => useActivity(a) }, h('b', {}, a.title), h('div', { class: 'mute small' }, `${GRADE_NAME(a.grade)} · ${ago(r.at)}`)))));
  main.append(h('h2', {}, 'اختر الصف'), grid);
}
function lessonRow(l, withGrade) {
  return h('button', { class: 'card lesson', onclick: () => go(3, { grade: l.grade, sem: l.sem, lessonId: l.id, actId: null }) },
    h('span', { class: 'n' }, l.custom ? '✎' : l.n), h('span', { class: 't' }, l.title, withGrade ? h('div', { class: 'mute small' }, `${GRADE_NAME(l.grade)} · ${SEM_NAME(l.sem)}`) : null), statusChips(l));
}

// ------------------------------------------------ الخطوة 2: الدرس
function viewLesson() {
  const g = st.grade; const listEl = h('div', { class: 'list' });
  const q = h('input', { type: 'search', placeholder: '🔎 ابحث في دروس هذا الصف…', oninput: () => paint() });
  const seg = h('div', { class: 'seg' }, [1, 2].map((s) => h('button', { class: st.sem === s ? 'on' : '', onclick: () => { st.sem = s; saveSt(); render(); } }, SEM_NAME(s))));
  const paint = () => {
    listEl.innerHTML = ''; const t = plain(q.value.trim());
    const ls = (t ? allLessons().filter((l) => l.grade === g) : lessonsOf(g, st.sem)).filter((l) => !t || plain(l.title).includes(t));
    if (!ls.length) listEl.append(h('div', { class: 'empty' }, 'لا توجد دروس.'));
    ls.forEach((l) => listEl.append(lessonRow(l, !!t)));
  };
  main.append(h('div', { class: 'bar' }, back(1, 'الصفوف'), h('h1', { class: 'grow', style: { margin: 0 } }, GRADE_NAME(g))),
    hint('اختر الدرس. «جاهز» = له نشاط جاهز من محتوى المنصة أو أعددته سابقًا. «يحتاج إلى إعداد» = أنشئ له نشاطًا.'),
    h('div', { class: 'bar' }, seg, h('div', { class: 'grow' }, q)), listEl,
    h('div', { class: 'bar' }, h('button', { class: 'btn sm', onclick: async () => {
      const t = await prompt('اسم الدرس غير الموجود في القائمة'); if (!t) return;
      const l = { id: uid('cl'), grade: g, sem: st.sem, n: 99, title: t, custom: true };
      localStorage.setItem('rz_custom_lessons', JSON.stringify([...customLessons(), l])); toast('أُضيف الدرس'); go(3, { lessonId: l.id, actId: null });
    } }, '+ درس غير موجود في القائمة')));
  paint();
}

// ------------------------------------------------ الخطوة 3: النشاط
function activityCard(a, { compact = false } = {}) {
  const b = a.lessonId && bankFor(a.lessonId);
  const outdated = a.origin === 'bank-edit' && b && (a.bankVersion || 0) < b.version;
  const originTxt = { bank: '📗 جاهز من محتوى المنصة', 'bank-edit': '✏️ معدّل من نشاط جاهز', ai: '🤖 مولّد ومراجَع', manual: '✍️ يدوي', classic: '🎡 من قالب كلاسيكي' }[a.origin] || '';
  const actions = h('div', { class: 'row' },
    h('button', { class: 'btn pri sm', onclick: () => useActivity(a) }, '▶ استخدم'),
    a.readonly ? h('button', { class: 'btn sm', onclick: () => editActivity(a, true) }, '✏️ نسخة للتعديل') : h('button', { class: 'btn sm', onclick: () => editActivity(a) }, '✏️ تعديل'),
    h('button', { class: 'btn sm', onclick: () => printMenu(a) }, '🖨 طباعة'),
    !compact && !a.readonly ? h('button', { class: 'btn sm', onclick: () => manageMenu(a) }, '⋯ المزيد') : null);
  return h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h3', { class: 'grow', style: { margin: 0 } }, a.title), h('span', { class: 'chip' }, `${a.questions.length} سؤال`)),
    h('div', { class: 'mute small' }, originTxt, a.updatedAt > 1e6 ? ` · آخر تعديل ${ago(a.updatedAt)}` : ''),
    a.sourceNote ? h('div', { class: 'src' }, `المصدر: ${a.sourceNote}`) : null,
    outdated ? h('div', { class: 'notice warn' }, 'تم تحديث محتوى هذا الدرس في المنصة بعد إعدادك لهذا النشاط. ', h('button', { class: 'btn sm', onclick: () => mergeBank(a) }, '➕ أضف الأسئلة الجديدة إلى نشاطي')) : null,
    actions);
}
function mergeBank(a) {
  const b = bankFor(a.lessonId); const have = new Set(a.questions.map((q) => q.bankRef).filter(Boolean));
  const add = b.questions.filter((q) => !have.has(q.id)).map((q) => normalize({ ...shuffleOptions(normalize(q)), bankRef: q.id, id: uid() }));
  S.saveActivity({ ...a, questions: [...a.questions, ...add], bankVersion: b.version }, `دمج تحديث المحتوى (${add.length} سؤال)`);
  toast(add.length ? `أُضيف ${add.length} سؤال جديد. نسختك السابقة محفوظة في سجل النسخ.` : 'لا توجد أسئلة جديدة؛ تم تحديث رقم النسخة.'); render();
}

function viewActivity() {
  const l = lessonById(st.lessonId);
  if (!l) return go(2);
  const bankA = bankActivity(l.id); const mine = S.activitiesFor(l.id);
  main.append(h('div', { class: 'bar' }, back(2, 'الدروس'), h('div', { class: 'grow' }, h('h1', { style: { margin: 0 } }, l.title), h('div', { class: 'mute' }, `${GRADE_NAME(l.grade)} · ${SEM_NAME(l.sem)}`)), statusChips(l)),
    hint('اختر نشاطًا جاهزًا، أو اضغط «إنشاء نشاط تفاعلي» لتوليد أسئلة من محتوى الدرس ثم راجعها قبل الاعتماد.'), ...[banksNotice()].filter(Boolean));
  if (bankA || mine.length) main.append(h('h2', {}, 'الأنشطة المتاحة'), h('div', { class: 'grid wide' }, bankA ? activityCard(bankA) : null, mine.map((a) => activityCard(a))));
  main.append(generatorPanel(l, bankA));
}

/** محتوى الدرس الموثّق المتوفر في المنصة (جمل من أدلة المعلم في البنك الجاهز) */
function platformContent(lessonId) {
  const b = bankFor(lessonId); if (!b) return '';
  return [...new Set(b.questions.map((q) => q.src).filter(Boolean))].join('\n');
}

function generatorPanel(l, bankA) {
  const box = h('div', { class: 'card', style: { marginTop: '18px' } });
  const content = platformContent(l.id);
  let file = null; // {kind,text?|mime,data, name}
  const count = h('input', { type: 'number', min: 1, max: 30, value: 10, style: { width: '90px' } });
  const types = Object.entries(TYPES).map(([k, v]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', value: k, checked: true }), `${v.icon} ${v.label}`));
  const srcSel = h('div', { class: 'seg' });
  let src = content ? 'platform' : 'paste';
  const paste = h('textarea', { rows: 6, placeholder: 'الصق هنا نص الدرس من دليل المعلم أو الكتاب (التعريفات، الشرح، الأمثلة)…' });
  const fileInfo = h('span', { class: 'mute small' });
  const fileInp = h('input', { type: 'file', class: 'hidden', accept: '.pdf,.docx,.txt,image/png,image/jpeg,image/webp', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return; fileInfo.textContent = 'جارٍ قراءة الملف…';
    try { file = await readLessonFile(f); fileInfo.textContent = `✓ ${f.name}${file.kind === 'text' ? ` (${file.text.length} حرفًا)` : ' (سيقرؤه الخادم)'}`; }
    catch (err) { file = null; fileInfo.textContent = `✗ ${err.message}`; }
  } });
  const srcBody = h('div');
  const paintSrc = () => {
    srcSel.innerHTML = '';
    [['platform', '📗 محتوى المنصة', !!content], ['paste', '📋 لصق نص', true], ['file', '📄 ملف/صورة', true]].forEach(([k, t, ok]) => ok && srcSel.append(h('button', { class: src === k ? 'on' : '', onclick: () => { src = k; paintSrc(); } }, t)));
    srcBody.innerHTML = '';
    if (src === 'platform') srcBody.append(h('p', { class: 'mute small' }, 'سيُستخدم المحتوى الموثّق لهذا الدرس المتوفر في المنصة (منقول من دليل المعلم):'), h('pre', { style: { whiteSpace: 'pre-wrap', maxHeight: '140px', overflow: 'auto', background: 'var(--bg2)', padding: '8px', borderRadius: '10px', fontFamily: 'inherit', fontSize: '.85rem' } }, content));
    if (src === 'paste') srcBody.append(paste);
    if (src === 'file') srcBody.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => fileInp.click() }, '📄 اختر ملف الدرس (PDF / Word / صورة)'), fileInfo, fileInp));
  };
  paintSrc();
  const status = h('div');
  const go1 = h('button', { class: 'btn pri big', onclick: async () => {
    status.innerHTML = '';
    let input = null;
    if (src === 'platform') input = { kind: 'text', text: content };
    else if (src === 'paste') { const t = paste.value.trim(); if (t.length < 80) { status.append(h('div', { class: 'notice warn' }, 'النص قصير جدًا لتوليد أسئلة موثوقة. الصق نص الدرس كاملًا (فقرة واحدة على الأقل)، أو أنشئ الأسئلة يدويًا.')); return; } input = { kind: 'text', text: t }; }
    else if (file) input = file.kind === 'text' ? { kind: 'text', text: file.text } : { kind: file.kind, mime: file.mime, data: file.data };
    if (!input) { status.append(h('div', { class: 'notice warn' }, 'لا يوجد محتوى للدرس بعد. اختر مصدرًا للمحتوى أو أنشئ الأسئلة يدويًا.')); return; }
    const ty = types.map((x) => x.querySelector('input')).filter((x) => x.checked).map((x) => x.value);
    if (!ty.length) { status.append(h('div', { class: 'notice warn' }, 'اختر نوعًا واحدًا على الأقل من الأسئلة.')); return; }
    const n = Math.max(1, Math.min(30, parseInt(count.value, 10) || 10));
    go1.disabled = true; go1.innerHTML = '<span class="spinner"></span> جارٍ إنشاء الأسئلة من محتوى الدرس…';
    const r = await generate({ grade: l.grade, lesson: l.title, count: n, types: ty, input });
    go1.disabled = false; go1.textContent = '✨ إنشاء نشاط تفاعلي';
    if (!r.ok) {
      status.append(h('div', { class: 'notice err' }, h('b', {}, 'تعذر إنشاء الأسئلة: '), r.error || 'خطأ غير معروف.',
        h('div', { class: 'row', style: { marginTop: '8px' } }, bankA ? h('button', { class: 'btn sm', onclick: () => editActivity(bankA, true) }, 'استخدم النشاط الجاهز وعدّله') : null, h('button', { class: 'btn sm', onclick: () => manual(l) }, '✍️ أنشئ الأسئلة يدويًا'))));
      return;
    }
    const qs = (r.questions || []).map((q) => normalize({ ...q, origin: 'ai' }));
    if (!qs.length) {
      status.append(h('div', { class: 'notice warn' }, r.message || 'المحتوى غير كافٍ لإنشاء أسئلة موثوقة دون اختلاق معلومات.', ' أضف محتوى أكثر للدرس أو أنشئ الأسئلة يدويًا.', h('div', {}, h('button', { class: 'btn sm', onclick: () => manual(l) }, '✍️ إدخال يدوي'))));
      return;
    }
    startReview({ key: uid('d'), title: `${l.title} — نشاط`, grade: l.grade, sem: l.sem, lessonId: l.id, lessonTitle: l.title, origin: 'ai', sourceNote: src === 'platform' ? (bankFor(l.id) || {}).source : src === 'file' ? `ملف المعلم: ${file.name}` : 'نص الدرس الذي أدخله المعلم', questions: qs, ctx: input.kind === 'text' ? input.text.slice(0, 30000) : '', unverified: r.verified === false, notice: r.insufficient || qs.length < n ? (r.message || `أُنشئ ${qs.length} سؤال فقط من ${n} لأن المحتوى لا يكفي لأكثر من ذلك دون اختلاق معلومات.`) : '', dropped: r.dropped || 0 });
  } }, '✨ إنشاء نشاط تفاعلي');
  box.append(h('h2', { style: { marginTop: 0 } }, '✨ إنشاء نشاط تفاعلي جديد'),
    h('p', { class: 'mute small' }, 'تُنشأ الأسئلة من محتوى الدرس فقط ولا تُختلق معلومات. ستراجع كل سؤال وتعدّله قبل الاعتماد. لا تُرسَل أسماء الطلاب إلى أي خدمة.'),
    h('div', { class: 'bar' }, h('b', {}, 'مصدر المحتوى:'), srcSel), srcBody,
    h('div', { class: 'bar' }, h('b', {}, 'عدد الأسئلة:'), count),
    h('details', { class: 'adv' }, h('summary', {}, 'أنواع الأسئلة (كلها مختارة)'), h('div', { class: 'row' }, types)),
    h('div', { class: 'bar' }, go1, h('button', { class: 'btn', onclick: () => manual(l) }, '✍️ إنشاء يدوي')), status);
  return box;
}

async function readLessonFile(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  const b64 = () => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('تعذرت قراءة الملف.')); r.readAsDataURL(f); });
  if (f.size > 4 * 1024 * 1024) throw new Error('الملف أكبر من 4 ميجابايت. اختر صفحات الدرس فقط.');
  if (/^image\/(png|jpeg|webp)$/.test(f.type)) return { kind: 'image', mime: f.type, data: await b64(), name: f.name };
  if (ext === 'txt') { const t = (await f.text()).trim(); if (!t) throw new Error('الملف فارغ.'); return { kind: 'text', text: t, name: f.name }; }
  if (ext === 'docx' || ext === 'pdf') {
    try {
      const m = await import('../assets/readers-5YEYTTYF.js');
      const r = await m.readNamesFile(f); const t = (r.rawText || '').trim();
      if (t.length >= 80) return { kind: 'text', text: t, name: f.name };
    } catch { /* PDF ممسوح ضوئيًا: يُرسل كما هو */ }
    if (ext === 'pdf') return { kind: 'pdf', mime: 'application/pdf', data: await b64(), name: f.name };
    throw new Error('لم نجد نصًا في ملف Word.');
  }
  throw new Error('نوع غير مدعوم. استخدم PDF أو Word أو صورة أو ملف نصي.');
}

function manual(l) { startReview({ key: uid('d'), title: `${l.title} — نشاط`, grade: l.grade, sem: l.sem, lessonId: l.id, lessonTitle: l.title, origin: 'manual', questions: [], ctx: '' }); }
function editActivity(a, asCopy = false) {
  const d = { key: uid('d'), title: asCopy ? `${a.title} (نسختي)` : a.title, grade: a.grade, sem: a.sem, lessonId: a.lessonId, lessonTitle: a.lessonTitle, origin: a.readonly ? 'bank-edit' : a.origin, bankVersion: a.bankVersion, sourceNote: a.sourceNote, questions: clone(a.questions).map((q) => (asCopy ? { ...q, id: uid() } : q)), ctx: a.lessonId ? platformContent(a.lessonId) : '' };
  if (!asCopy) d.editId = a.id;
  startReview(d);
}
function startReview(d) { S.saveDraft(d.key, d); st.draftKey = d.key; view = 'review'; render(); }

// ------------------------------------------------ المراجعة
function viewReview() {
  const d = S.draft(st.draftKey);
  if (!d) { view = 'flow'; return render(); }
  const title = h('input', { type: 'text', value: d.title, 'aria-label': 'اسم النشاط', oninput: (e) => { d.title = e.target.value; S.saveDraft(d.key, d); } });
  const body = h('div');
  const approve = async () => {
    const bad = d.questions.map((q, i) => ({ i, p: problems(q) })).filter((x) => x.p.length);
    if (!d.questions.length) { toast('لا يمكن حفظ نشاط بلا أسئلة. أضف سؤالًا واحدًا على الأقل.'); return; }
    if (bad.length) { toast(`أكمل السؤال رقم ${bad[0].i + 1}: ${bad[0].p[0]}`, 4000); body.querySelectorAll('.qedit')[bad[0].i].scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!d.title.trim()) { toast('اكتب اسمًا للنشاط.'); title.focus(); return; }
    const base = d.editId ? S.activity(d.editId) : null;
    const act = { ...(base || {}), id: d.editId || uid('act'), title: d.title.trim(), grade: d.grade, sem: d.sem, lessonId: d.lessonId, lessonTitle: d.lessonTitle, origin: d.origin, bankVersion: d.bankVersion, sourceNote: d.sourceNote, questions: d.questions };
    const saved = S.saveActivity(act, d.editId ? 'تعديل' : 'إنشاء');
    if (!saved) return;
    if (saved.classicId) S.writeClassic(saved, [], { persistent: true });
    S.saveDraft(d.key, null); st.draftKey = null; toast('✓ تم اعتماد النشاط وحفظه في «قوالبي الخاصة».');
    go(4, { actId: saved.id, lessonId: d.lessonId || st.lessonId, grade: d.grade || st.grade });
  };
  const regen = async (q) => {
    const have = new Set(d.questions.map((x) => plain(x.text)));
    const b = d.lessonId && bankFor(d.lessonId);
    if (b) {
      const pool = b.questions.filter((x) => !have.has(plain(x.text)));
      const pick = pool.find((x) => x.type === q.type) || pool[0];
      if (pick) return { ...shuffleOptions(normalize(pick)), bankRef: pick.id };
    }
    if (!d.ctx) { toast('لا يوجد محتوى إضافي لإعادة التوليد. عدّل السؤال يدويًا.', 3500); return null; }
    const r = await generate({ grade: d.grade, lesson: d.lessonTitle || d.title, count: 1, types: [q.type], input: { kind: 'text', text: d.ctx }, avoid: d.questions.map((x) => x.text).slice(0, 40) });
    if (!r.ok || !r.questions || !r.questions.length) { toast(r.error || r.message || 'لم يُنشأ سؤال جديد من المحتوى المتوفر.', 3500); return null; }
    return { ...r.questions[0], origin: 'ai' };
  };
  main.append(...[
    h('div', { class: 'bar' }, h('button', { class: 'btn sm', onclick: async () => { if (await ask('الخروج من المراجعة؟ تبقى المسودة محفوظة إن أردت العودة لاحقًا.', { ok: 'خروج' })) { view = 'flow'; st.step = 3; render(); } } }, '→ رجوع'), h('h1', { class: 'grow', style: { margin: 0 } }, 'مراجعة الأسئلة قبل الاعتماد')),
    hint('راجع كل سؤال: عدّل النص والخيارات والإجابة الصحيحة، واحذف أو أضف ما تريد، ثم اضغط «اعتماد النشاط وحفظه».'),
    d.notice ? h('div', { class: 'notice warn' }, d.notice) : null,
    d.dropped ? h('div', { class: 'notice warn' }, `استُبعد ${d.dropped} سؤال لم نجد ما يثبته في نص الدرس.`) : null,
    d.unverified ? h('div', { class: 'notice warn' }, 'قُرئ الدرس من صورة أو ملف ممسوح، فلم يتمكن الخادم من مطابقة كل سؤال بالنص آليًا. راجع الجملة المكتوبة تحت كل سؤال مع صفحة الدرس.') : null,
    d.origin === 'ai' ? h('div', { class: 'notice ok' }, 'الأسئلة مولّدة من محتوى الدرس، وتحت كل سؤال الجملة التي بُني عليها. تأكد منها قبل الاعتماد.') : null,
    h('div', { class: 'bar' }, h('b', {}, 'اسم النشاط:'), h('div', { class: 'grow' }, title)), body,
    h('div', { class: 'bar', style: { position: 'sticky', bottom: '0', background: 'var(--bg)', padding: '10px 0', borderTop: '1px solid var(--line)' } },
      h('button', { class: 'btn ok big', onclick: approve }, '✅ اعتماد النشاط وحفظه'), h('span', { class: 'mute small' }, 'تُحفظ مسودتك تلقائيًا أثناء التعديل.'))].filter(Boolean));
  renderReview(body, d, { onChange: () => S.saveDraft(d.key, d), onRegenerate: regen });
}

// ------------------------------------------------ الخطوة 4: الأسماء وطريقة اللعب
function viewNames() {
  const a = getActivity(st.actId);
  if (!a) return go(3);
  let names = S.sessionNames();
  const opts = S.prefs();
  const one = h('input', { type: 'text', placeholder: 'اكتب اسم الطالب ثم Enter', onkeydown: (e) => { if (e.key === 'Enter') addOne(); } });
  const paste = h('textarea', { rows: 4, placeholder: 'أو الصق قائمة الأسماء هنا (اسم في كل سطر)' });
  const listEl = h('div', { class: 'names' }); const countEl = h('b');
  const commit = () => { S.setSessionNames(names); paint(); };
  const addList = (arr) => { const r = mergeNames(names, arr); names = r.names; commit(); toast(`أُضيف ${arr.length - r.dup} اسم${r.dup ? ` · تُجاهل ${r.dup} مكرر` : ''}`); };
  const addOne = () => { const p = parseNames(one.value); if (!p.length) return; addList(p.slice(0, 1)); one.value = ''; one.focus(); };
  const paint = () => {
    listEl.innerHTML = ''; countEl.textContent = `${names.length} طالب`;
    if (!names.length) listEl.append(h('div', { class: 'empty', style: { gridColumn: '1/-1' } }, 'لم تُضف أسماء بعد.'));
    names.forEach((n, i) => listEl.append(h('div', { class: 'nm' }, h('span', { class: 'i' }, i + 1), h('span', { title: n }, n),
      h('button', { title: 'لأعلى', onclick: () => { if (i) { [names[i - 1], names[i]] = [names[i], names[i - 1]]; commit(); } } }, '▲'),
      h('button', { title: 'تعديل', onclick: async () => { const v = await prompt('تعديل الاسم', n); if (v) { names[i] = parseNames(v)[0] || n; commit(); } } }, '✎'),
      h('button', { title: 'حذف', onclick: () => { names.splice(i, 1); commit(); } }, '✕'))));
  };
  const fileInp = h('input', { type: 'file', class: 'hidden', accept: '.txt,.csv,.docx,.xlsx,.xls,.pdf', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return; e.target.value = '';
    try { const arr = await SOURCES.find((s) => s.id === 'file').load(f); if (!arr.length) throw new Error('لم نجد أسماء في الملف.'); paste.value = arr.join('\n'); toast(`قرأنا ${arr.length} اسمًا. راجعها ثم اضغط «إضافة القائمة».`, 3500); }
    catch (err) { toast(`تعذرت قراءة الملف: ${err.message || err}`, 4000); }
  } });
  // طريقة المشاركة
  const modes = [['both', '🎯', 'طالب وسؤال معًا', 'تختار العجلة طالبًا ثم يظهر له سؤال عشوائي'], ['student', '🙋', 'طالب عشوائي', 'العجلة تختار الطالب فقط'], ['question', '❓', 'سؤال عشوائي', 'العجلة تختار السؤال (بلا أسماء)']];
  const modeBox = h('div', { class: 'modes' });
  const paintModes = () => { modeBox.innerHTML = ''; modes.forEach(([k, e, t, d]) => modeBox.append(h('button', { class: `mode${opts.mode === k ? ' on' : ''}`, onclick: () => { opts.mode = k; S.setPrefs({ mode: k }); paintModes(); } }, h('div', { class: 'e' }, e), h('b', {}, t), h('div', { class: 'mute small' }, d)))); };
  paintModes();
  const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!opts[k], onchange: (e) => { opts[k] = e.target.checked; S.setPrefs({ [k]: opts[k] }); } }), label);
  const timer = h('select', { style: { width: 'auto' }, onchange: (e) => { opts.timer = +e.target.value; S.setPrefs({ timer: opts.timer }); } }, [[0, 'بلا مؤقت'], [15, '15 ثانية'], [30, '30 ثانية'], [45, '45 ثانية'], [60, 'دقيقة']].map(([v, t]) => h('option', { value: v, selected: opts.timer === v }, t)));
  const errBox = h('div');
  const start = () => {
    errBox.innerHTML = '';
    if (opts.mode !== 'question' && !names.length) { errBox.append(h('div', { class: 'notice err' }, 'أضف اسم طالب واحد على الأقل، أو اختر «سؤال عشوائي».')); one.focus(); return; }
    if (opts.mode !== 'student' && !a.questions.length) { errBox.append(h('div', { class: 'notice err' }, 'هذا النشاط بلا أسئلة. ارجع وأضف أسئلة.')); return; }
    S.touchRecent(a.id); clearPlay(); go(5);
  };
  main.append(h('div', { class: 'bar' }, back(3, 'النشاط'), h('div', { class: 'grow' }, h('h1', { style: { margin: 0 } }, 'الطلاب المشاركون في اللعبة'), h('div', { class: 'mute' }, `النشاط: ${a.title} · ${a.questions.length} سؤال`))),
    hint('أضف الأسماء: اسمًا اسمًا، أو الصق القائمة كاملة (اسم في كل سطر). الأسماء تبقى لهذه الحصة فقط على جهازك.'),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, one), h('button', { class: 'btn pri', onclick: addOne }, '+ إضافة')),
      h('div', { style: { marginTop: '10px' } }, paste),
      h('div', { class: 'bar' }, h('button', { class: 'btn', onclick: () => { const arr = parseNames(paste.value); if (!arr.length) { toast('الصق الأسماء أولًا.'); return; } addList(arr); paste.value = ''; } }, '📋 إضافة القائمة'),
        h('button', { class: 'btn', onclick: () => fileInp.click() }, '📂 من ملف (Word/Excel/PDF)'), fileInp,
        h('span', { class: 'grow' }), countEl,
        h('button', { class: 'btn sm', disabled: names.length < 2, onclick: () => { names = shuffle(names); commit(); } }, '🔀 خلط'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (names.length && await ask('مسح كل الأسماء؟', { ok: 'مسح', danger: true })) { names = []; commit(); } } }, '🗑 مسح الكل')),
      listEl),
    h('h2', {}, 'طريقة المشاركة'), modeBox,
    h('details', { class: 'adv' }, h('summary', {}, '⚙ خيارات متقدمة'),
      h('div', { class: 'list', style: { marginTop: '8px' } }, chk('noRepeatStudents', 'عدم تكرار الطالب حتى يأخذ الجميع دورهم'), chk('allowRepeatQ', 'السماح بتكرار الأسئلة داخل الجولة'), chk('sound', 'أصوات العجلة'),
        h('div', { class: 'row' }, h('span', {}, 'مؤقت الإجابة:'), timer),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => classic(a, names) }, '🎡 افتح في العجلة الكلاسيكية'), h('span', { class: 'mute small' }, 'الثيمات، وسائل المساعدة، لوحة الصدارة، تقييم الطلاب.')))),
    errBox, h('div', { class: 'bar' }, h('button', { class: 'btn gold big', onclick: start }, '🚀 ابدأ اللعب')));
  paint();
}
function classic(a, names) {
  if (a.questions.length && a.questions.length < 3) toast('العجلة الكلاسيكية تحتاج 3 أسئلة على الأقل لتشغيل الأسئلة؛ ستعمل للأسماء فقط.', 3500);
  const id = S.writeClassic(a, names, { settings: { autoRemoveOnPass: S.prefs().noRepeatStudents } });
  if (!id) return;
  S.touchRecent(a.id); S.openClassic(`/dashboard?templateId=${id}`);
}

// ------------------------------------------------ الخطوة 5: اللعب
function viewPlay() {
  const a = getActivity(st.actId); if (!a) return go(3);
  const o = S.prefs();
  playCtl = renderPlay(main, { act: a, names: S.sessionNames(), opts: { mode: o.mode, noRepeat: o.noRepeatStudents, allowRepeatQ: o.allowRepeatQ, timer: o.timer, sound: o.sound }, onExit: () => go(4), onOpts: (x) => S.setPrefs(x) });
}

function useActivity(a) {
  st.grade = a.grade || st.grade; st.sem = a.sem || st.sem; st.lessonId = a.lessonId || null; st.actId = a.id; go(4);
}

// ------------------------------------------------ الطباعة والإدارة
function printMenu(a) {
  let close;
  const b = (mode, t, d) => h('button', { class: 'card', onclick: () => { close(); printActivity(a, mode); } }, h('b', {}, t), h('div', { class: 'mute small' }, d));
  close = modal(h('div', {}, h('h3', {}, `طباعة: ${a.title}`), h('div', { class: 'list' },
    b('student', '📝 ورقة عمل للطالب', 'الأسئلة بلا إجابات، مع مكان للاسم والتاريخ'),
    b('key', '🔑 مفتاح الإجابات للمعلم', 'الإجابات الصحيحة مختصرة ثم الأسئلة كاملة'),
    b('review', '📖 ورقة مراجعة', 'كل سؤال مع إجابته ومصدره في الدرس')),
  h('p', { class: 'mute small' }, 'لحفظ PDF: اختر «حفظ كـ PDF» في نافذة الطباعة.')), { small: true });
}
function manageMenu(a) {
  let close;
  const act = (t, f) => h('button', { class: 'btn', onclick: async () => { close(); await f(); } }, t);
  close = modal(h('div', {}, h('h3', {}, a.title), h('div', { class: 'list' },
    act('✏️ تغيير الاسم', async () => { const t = await prompt('الاسم الجديد', a.title); if (t) { S.renameActivity(a.id, t); toast('تم'); render(); } }),
    act('📄 تكرار (نسخة جديدة)', async () => { S.duplicateActivity(a.id); toast('تمت إضافة نسخة'); render(); }),
    act(`🕘 النسخ السابقة (${(a.versions || []).length})`, async () => versions(a)),
    act('🎡 حفظه أيضًا في قوالب العجلة الكلاسيكية', async () => { const id = S.writeClassic(a, [], { persistent: true }); if (id) { S.saveActivity({ ...S.activity(a.id), classicId: id }, 'ربط بالعجلة الكلاسيكية'); toast('يظهر الآن في «استرداد القوالب» بالعجلة الكلاسيكية.'); } }),
    act('🗑 حذف', async () => { if (await ask(`حذف «${a.title}» نهائيًا مع نسخه السابقة؟`, { ok: 'حذف', danger: true })) { S.deleteActivity(a.id); toast('حُذف'); render(); } }))), { small: true });
}
function versions(a) {
  let close;
  const vs = a.versions || [];
  close = modal(h('div', {}, h('h3', {}, 'النسخ السابقة'), vs.length ? h('div', { class: 'list' }, vs.map((v, i) => h('div', { class: 'card row' }, h('div', { class: 'grow' }, h('b', {}, v.title), h('div', { class: 'mute small' }, `${ago(v.at)} · ${v.questions.length} سؤال${v.note ? ` · ${v.note}` : ''}`)),
    h('button', { class: 'btn sm', onclick: async () => { if (await ask('استرجاع هذه النسخة؟ النسخة الحالية ستُحفظ في السجل.')) { S.restoreVersion(a.id, i); close(); toast('تم الاسترجاع'); render(); } } }, '↩ استرجاع'))))
    : h('p', { class: 'mute' }, 'لا توجد نسخ سابقة بعد. كل تعديل تعتمده يحفظ النسخة السابقة هنا.')));
}

// ------------------------------------------------ مكتبتي
function viewLibrary() {
  let tab = st.libTab || 'bank';
  const q = h('input', { type: 'search', placeholder: '🔎 ابحث باسم الدرس أو النشاط…', oninput: () => paint() });
  const gsel = h('select', { style: { width: 'auto' }, onchange: () => paint() }, h('option', { value: '' }, 'كل الصفوف'), Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1 }, GRADE_NAME(i + 1))), h('option', { value: '0' }, 'بدون صف'));
  const tabs = h('div', { class: 'seg' }); const body = h('div');
  const T = [['bank', '📗 مكتبة الدروس الجاهزة'], ['mine', '⭐ قوالبي الخاصة'], ['recent', '🕘 المستخدمة مؤخرًا']];
  const match = (a) => (!gsel.value || String(a.grade || 0) === gsel.value) && (!q.value.trim() || plain(`${a.title} ${a.lessonTitle || ''}`).includes(plain(q.value.trim())));
  const paint = () => {
    tabs.innerHTML = ''; T.forEach(([k, t]) => tabs.append(h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; st.libTab = k; saveSt(); paint(); } }, t)));
    body.innerHTML = '';
    if (tab === 'bank') {
      const list = BANKS.map((b) => bankActivity(b.lessonId)).filter(Boolean).filter(match).sort((x, y) => x.grade - y.grade || x.sem - y.sem);
      const bn = banksNotice(); if (bn) body.append(bn);
      body.append(h('p', { class: 'mute small' }, 'أنشطة من محتوى الدروس الموثّق في المنصة. هي للقراءة فقط؛ «نسخة للتعديل» تنشئ نشاطًا خاصًا بك دون المساس بالأصل.'));
      body.append(list.length ? h('div', { class: 'grid wide' }, list.map((a) => activityCard(a, { compact: true }))) : h('div', { class: 'empty' }, 'لا نتائج.'));
    } else if (tab === 'mine') {
      const list = S.activities().filter(match);
      body.append(list.length ? h('div', { class: 'grid wide' }, list.map((a) => activityCard(a))) : h('div', { class: 'empty' }, 'لا توجد أنشطة خاصة بعد. أنشئ نشاطًا من أي درس، أو انسخ نشاطًا جاهزًا وعدّله.'));
      const cl = S.classicTemplates().filter((t) => !t.id.startsWith('rz_')).filter((t) => !q.value.trim() || plain(t.name || '').includes(plain(q.value.trim())));
      if (cl.length && !gsel.value) {
        body.append(h('h2', {}, '🎡 قوالب العجلة الكلاسيكية (كما هي)'), h('p', { class: 'mute small' }, 'قوالبك القديمة محفوظة ولم تتغير. يمكنك فتحها في العجلة الكلاسيكية، أو نسخ أسئلتها إلى المكتبة الجديدة.'),
          h('div', { class: 'grid wide' }, cl.map((t) => h('div', { class: 'card' }, h('h3', {}, t.name || 'قالب بلا اسم'), h('div', { class: 'mute small' }, `${(t.participants || []).length} متسابق · ${(t.questionRefs || []).length} سؤال`),
            h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm pri', onclick: () => S.openClassic(`/dashboard?templateId=${encodeURIComponent(t.id)}`) }, '▶ تشغيل'), h('button', { class: 'btn sm', onclick: () => S.openClassic(`/?templateId=${encodeURIComponent(t.id)}`) }, '✏️ تعديل في المعالج'),
              h('button', { class: 'btn sm', onclick: () => { const qs = S.classicToQuestions(t); if (!qs.length) { toast('القالب بلا أسئلة.'); return; } const a = S.saveActivity({ id: uid('act'), title: t.name || 'قالب مستورد', grade: 0, sem: 0, lessonId: null, lessonTitle: t.classId || '', origin: 'classic', questions: qs }, 'استيراد من قالب كلاسيكي'); if (a) { toast(`نُسخ ${qs.length} سؤال إلى «قوالبي الخاصة».`); paint(); } } }, '⬇ نسخ إلى المكتبة'))))));
      }
    } else {
      const list = S.recent().map((r) => ({ r, a: getActivity(r.id) })).filter((x) => x.a && match(x.a));
      body.append(list.length ? h('div', { class: 'grid wide' }, list.map(({ a }) => activityCard(a, { compact: true }))) : h('div', { class: 'empty' }, 'لم تستخدم أي نشاط بعد.'));
    }
  };
  main.append(h('div', { class: 'bar' }, h('button', { class: 'btn sm', onclick: () => { view = 'flow'; render(); } }, '→ رجوع'), h('h1', { class: 'grow', style: { margin: 0 } }, '📚 مكتبتي')), h('div', { class: 'bar' }, tabs, h('div', { class: 'grow' }, q), gsel), body);
  paint();
}

// ------------------------------------------------ تشغيل
document.querySelector('#libBtn').addEventListener('click', () => { view = view === 'library' ? 'flow' : 'library'; render(); });
document.querySelector('#classicBtn').addEventListener('click', () => S.openClassic('/'));
document.querySelector('#homeBtn').addEventListener('click', () => go(1));
window.addEventListener('error', (e) => console.error('[rz]', e.error || e.message));
main.innerHTML = '<p class="hint"><span class="spinner"></span> جارٍ تحميل المكتبة…</p>';
loadBanks().finally(() => render());
