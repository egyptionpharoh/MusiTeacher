// =====================================================================
//  «إعدادات اللعبة للمعلم»: المسابقة (الصف ← الدرس ← الاسم التلقائي)، الأسئلة (اقتراح من الدرس، أنشطة الدرس الجاهزة،
//  توليد من محتوى الدرس، مكتبة التحديات، سؤال يدوي + تعديل/حذف/ترتيب/مراجعة)، المتسابقون، وطريقة اللعب والمظهر.
//  كل التعديلات على نسخة المعلم وحدها (محفوظة على جهازه ضمن حسابه)، ولا يتغير أي محتوى أساسي على الخادم.
// =====================================================================
import { el, AR, sheet, toast, confirmBox, seg, toggle, readFileAs } from './dom.js';
import { openEditor, previewNode } from './editor.js';
import * as C from '../data/contest.js';
import { DOMAINS, DOMAIN, LEVELS, INSTRUMENTS } from '../data/content.js';
import { FIG } from '../data/figures.js';
import { noteName } from '../notation/staff.js';
import { THEMES } from '../world/world.js';

const TABS = [['contest', '📚 المسابقة'], ['questions', '❓ الأسئلة'], ['names', '👥 المتسابقون'], ['play', '🎮 طريقة اللعب والمظهر']];
const SPEED = ['هادئة', 'متوسطة', 'سريعة', 'سريعة جدًا'];
const srcTag = { gen: ['🎼', 'مكتبة التحديات'], bank: ['📘', 'نشاط الدرس'], ai: ['📄', 'من محتوى الدرس'], manual: ['✍️', 'سؤال المعلم'] };
const qLine = (q) => (q.kind === 'gen' ? (q.preview ? q.preview.options.map((o, i) => (i === q.preview.answer ? `✓ ${o}` : o)).join(' · ') : '') : q.kind === 'staff' ? q.choices.map((n, i) => (i === q.answer ? `✓ ${noteName(n)}` : noteName(n))).join(' · ') : q.options.map((o, i) => { const l = o.t === 'text' ? o.text : o.t === 'inst' ? (INSTRUMENTS[o.id] || {}).name : o.t === 'rhythm' ? o.ids.map((x) => (FIG[x] || {}).name).join(' + ') : '🖼️'; return i === q.answer ? `✓ ${l}` : l; }).join(' · '));

export function openSettings(app, { tab = 'contest' } = {}) {
  let cur = C.clone(app.contest || C.newContest());
  let dirty = false;
  const mark = () => { dirty = true; saveBtn.classList.add('pulse'); };
  const s = sheet({
    title: '⚙️ إعدادات اللعبة للمعلم', sub: 'تُحفظ مسابقاتك في حسابك على هذا الجهاز، ولا تؤثر في مسابقات غيرك', width: 1080, cls: 'settings',
    onClose: () => { if (!dirty) return true; confirmBox('لديك تعديلات غير محفوظة. هل تريد حفظها قبل الإغلاق؟', { yes: '💾 حفظ وإغلاق', no: 'إغلاق دون حفظ' }).then((y) => { if (y) doSave(); else app.useContest(app.contest); dirty = false; s.close(true); }); return false; },
  });
  const tabsBar = el('div', { class: 'tabs', role: 'tablist' });
  const pane = el('div', { class: 'pane' });
  s.body.append(tabsBar, pane); s.body.classList.add('col');
  let curTab = tab;
  const showTab = (t) => { curTab = t; [...tabsBar.children].forEach((b) => b.classList.toggle('on', b.dataset.t === t)); pane.innerHTML = ''; ({ contest: tContest, questions: tQuestions, names: tNames, play: tPlay })[t](); };
  TABS.forEach(([k, label]) => tabsBar.append(el('button', { 'data-t': k, role: 'tab', onclick: () => showTab(k) }, label)));

  // ---------------------------------------------------------------- الحفظ والمشاركة
  const doSave = () => {
    const saved = C.saveContest(cur);
    if (!saved) { toast('تعذّر الحفظ على هذا الجهاز (المساحة ممتلئة أو التصفح الخاص).'); return false; }
    cur = C.clone(saved); dirty = false; saveBtn.classList.remove('pulse');
    app.useContest(saved); toast('✔ حُفظت المسابقة'); return true;
  };
  const saveBtn = el('button', { class: 'btn pri', onclick: doSave }, '💾 حفظ');
  s.foot.append(saveBtn,
    el('button', { class: 'btn share', onclick: async () => { if (!doSave()) return; app.shareContest(cur); } }, '🔗 مشاركة اللعبة مع الطلاب'),
    el('button', { class: 'btn', onclick: () => { if (!doSave()) return; s.close(true); app.startContest(); } }, '🚦 حفظ وابدأ'),
    el('button', { class: 'btn ghost', onclick: () => s.close() }, 'إغلاق'));

  // ================================================================ تبويب المسابقة
  function tContest() {
    const all = C.loadAll().contests;
    const pick = el('select', { 'aria-label': 'مسابقاتي' });
    const list = all.some((c) => c.id === cur.id) ? all : [cur, ...all];
    list.forEach((c) => pick.append(el('option', { value: c.id, selected: c.id === cur.id }, `${c.title}${c.id === cur.id && dirty ? ' (غير محفوظة)' : ''}`)));
    pick.onchange = async () => {
      if (dirty && !(await confirmBox('تعديلات المسابقة الحالية غير محفوظة وستضيع. متابعة؟', { yes: 'متابعة' }))) { pick.value = cur.id; return; }
      cur = C.clone(all.find((c) => c.id === pick.value)); dirty = false; C.setActive(cur.id); app.useContest(cur); showTab('contest');
    };
    const mine = el('div', { class: 'field' }, el('label', {}, 'مسابقاتي'), el('div', { class: 'row' }, pick,
      el('button', { class: 'btn sm', onclick: async () => { if (dirty && !(await confirmBox('تعديلات المسابقة الحالية غير محفوظة وستضيع. متابعة؟', { yes: 'متابعة' }))) return; cur = C.newContest({ grade: cur.grade }); cur.settings = { ...cur.settings, ...pickKeep(app.contest) }; dirty = true; showTab('contest'); } }, '＋ مسابقة جديدة'),
      el('button', { class: 'btn sm', onclick: () => { const c = C.clone(cur); c.id = C.uid('race'); c.title = `${cur.title} (نسخة)`; c.titleCustom = true; c.createdAt = Date.now(); cur = c; mark(); showTab('contest'); toast('أُنشئت نسخة — احفظها لتظهر في القائمة'); } }, '📄 نسخة منها'),
      el('button', { class: 'btn sm danger', onclick: async () => { if (!(await confirmBox(`حذف «${cur.title}» نهائيًا من هذا الجهاز؟`, { yes: '🗑 حذف', danger: true }))) return; C.deleteContest(cur.id); const nx = C.activeContest() || C.demoContest(); cur = C.clone(nx); dirty = false; app.useContest(nx); showTab('contest'); } }, '🗑 حذف')),
    el('span', { class: 'hint' }, 'كل مسابقة لها أسئلتها وقائمة متسابقيها وإعداداتها. المسابقة المختارة هي التي تبدأ عند «ابدأ السباق».'));
    pane.append(mine);
    // الصف والدرس
    const g = el('select'); g.append(el('option', { value: 0 }, '— اختر الصف —'));
    for (let i = 1; i <= 12; i++) if (C.lessonsOf(i).length) g.append(el('option', { value: i, selected: cur.grade === i }, C.GRADE_NAME(i)));
    const l = el('select');
    const fillL = () => { l.innerHTML = ''; l.append(el('option', { value: '' }, cur.grade ? '— اختر الدرس —' : '—')); C.lessonsOf(cur.grade).forEach((x) => l.append(el('option', { value: x.id, selected: x.id === cur.lessonId }, `${x.sem === 2 ? 'ف٢' : 'ف١'} · ${x.title}`))); };
    fillL();
    const title = el('input', { type: 'text', maxlength: '80', placeholder: 'اسم المسابقة' }); title.value = cur.title;
    const auto = el('button', { class: 'btn sm ghost', title: 'إعادة الاسم التلقائي', onclick: () => { cur.titleCustom = false; cur.title = cur.lessonTitle ? `مسابقة درس ${cur.lessonTitle}` : cur.title; title.value = cur.title; mark(); } }, '↺ تلقائي');
    const info = el('div', { class: 'linfo' });
    const paintInfo = () => {
      const les = C.lessonById(cur.lessonId); info.innerHTML = '';
      if (!les) { info.append(el('p', { class: 'hint' }, 'اختر الصف ثم الدرس لتظهر الأسئلة المرتبطة به. يمكنك أيضًا إنشاء مسابقة حرة بأسئلتك دون درس.')); return; }
      const ds = C.domainsForLesson(les);
      info.append(el('p', {}, el('b', {}, 'الدرس: '), les.title, ` — ${C.GRADE_NAME(les.grade)}، ${les.sem === 2 ? 'الفصل الثاني' : 'الفصل الأول'}`));
      info.append(el('p', { class: ds.length ? 'ok' : 'hint' }, ds.length ? `🎼 تحديات موسيقية مناسبة لهذا الدرس في المكتبة: ${ds.map((d) => DOMAIN[d].name).join('، ')}` : 'لا توجد تحديات صوتية/مرئية جاهزة مرتبطة بعنوان هذا الدرس؛ استخدم «أنشطة الدرس الجاهزة» أو «التوليد من محتوى الدرس» أو أسئلتك.'));
      info.append(el('button', { class: 'btn sm', onclick: () => showTab('questions') }, '❓ إلى الأسئلة ←'));
    };
    g.onchange = () => { cur.grade = +g.value; cur.lessonId = ''; cur.lessonTitle = ''; fillL(); paintInfo(); mark(); };
    l.onchange = () => {
      const les = C.lessonById(l.value); cur.lessonId = les ? les.id : ''; cur.lessonTitle = les ? les.title : '';
      if (les && !cur.titleCustom) { cur.title = `مسابقة درس ${les.title}`; title.value = cur.title; }
      if (les) cur.settings.level = Math.min(cur.settings.level || 1, 4);
      paintInfo(); mark();
    };
    title.oninput = () => { cur.title = title.value.trim() || 'مسابقة'; cur.titleCustom = true; mark(); };
    pane.append(el('div', { class: 'grid2' },
      el('div', { class: 'field' }, el('label', {}, 'الصف'), g),
      el('div', { class: 'field' }, el('label', {}, 'الدرس'), l, el('span', { class: 'hint' }, 'من قائمة الدروس المعتمدة نفسها في «عجلة الاختيار»'))));
    pane.append(el('div', { class: 'field' }, el('label', {}, 'اسم المسابقة'), el('div', { class: 'row' }, title, auto), el('span', { class: 'hint' }, 'يُكتب تلقائيًا «مسابقة درس …» عند اختيار الدرس، ويمكنك تعديله')));
    pane.append(info); paintInfo();
  }
  const pickKeep = (c) => (c ? { vehicle: c.settings.vehicle, driver: c.settings.driver, theme: c.settings.theme, flag: c.settings.flag } : {});

  // ================================================================ تبويب الأسئلة
  function tQuestions() {
    const les = C.lessonById(cur.lessonId);
    const ds = C.domainsForLesson(les);
    const bar = el('div', { class: 'srcbar' });
    const add = (qs, msg) => { if (!qs.length) { toast(msg || 'لا شيء لإضافته'); return; } cur.questions.push(...qs); mark(); paintList(); toast(`أُضيف ${AR(qs.length)} ${qs.length > 2 && qs.length < 11 ? 'أسئلة' : 'سؤال'}`); };
    bar.append(
      el('button', { class: 'src', disabled: !ds.length, title: ds.length ? '' : 'اختر درسًا له تحديات موسيقية في المكتبة', onclick: () => pickCount('✨ اقتراح أسئلة من الدرس', `تحديات موسيقية من مجالات الدرس (${ds.map((d) => DOMAIN[d].name).join('، ')}) بمستوى يناسب الصف. ستراجعها وتعدّلها قبل الحفظ.`, (n, lv) => add(C.suggestFromLesson(les, { count: n, level: lv })), C.levelForGrade(les ? les.grade : 5)) }, el('b', {}, '✨ اقتراح من الدرس'), el('small', {}, ds.length ? ds.map((d) => DOMAIN[d].name).join('، ') : 'لا تحديات لهذا الدرس')),
      el('button', { class: 'src', disabled: !les, onclick: () => fromBankDlg(les, add) }, el('b', {}, '📘 أنشطة الدرس الجاهزة'), el('small', {}, 'أسئلة اختيار وصح/خطأ موثّقة من الدليل')),
      el('button', { class: 'src', disabled: !les, onclick: () => fromAIDlg(les, add) }, el('b', {}, '📄 توليد من محتوى الدرس'), el('small', {}, 'من نص الدرس فقط — بلا اختلاق')),
      el('button', { class: 'src', onclick: () => libraryDlg(add) }, el('b', {}, '🎼 مكتبة التحديات'), el('small', {}, 'سمعي وبصري ونوتة وآلات')),
      el('button', { class: 'src', onclick: () => manualDlg((q) => { cur.questions.push(q); mark(); paintList(); }) }, el('b', {}, '✍️ سؤال يدوي'), el('small', {}, 'نص، صورة، صوت، إيقاع، مدرج، آلة')),
    );
    pane.append(bar);
    const head = el('div', { class: 'qhead2' }); const list = el('div', { class: 'qlist' });
    pane.append(head, list);
    function paintList() {
      const qs = cur.questions;
      const bad = qs.filter((q) => !C.playable(C.normalize(q))).length;
      head.innerHTML = '';
      head.append(...[el('b', {}, `أسئلة المسابقة: ${AR(qs.length)}`), bad ? el('span', { class: 'warn' }, ` · ⚠ ${AR(bad)} غير مكتمل (لن يظهر في اللعب)`) : null,
        qs.length ? el('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmBox('حذف كل الأسئلة من هذه المسابقة؟', { yes: 'حذف الكل', danger: true })) { cur.questions = []; mark(); paintList(); } } }, '🗑 حذف الكل') : null].filter(Boolean));
      list.innerHTML = '';
      if (!qs.length) { list.append(el('div', { class: 'empty' }, 'لا توجد أسئلة بعد. اختر مصدرًا من الأزرار أعلاه.')); return; }
      qs.forEach((q, i) => {
        const n = C.normalize(q), pr = C.problems(n), [ic, sn] = srcTag[q.src] || srcTag.manual;
        const row = el('div', { class: 'qrow' + (pr.length ? ' bad' : '') });
        row.append(el('span', { class: 'qi' }, AR(i + 1)),
          el('div', { class: 'qm' }, el('div', { class: 'qp' }, q.prompt || '(بلا نص)'), el('div', { class: 'qo' }, `${ic} ${sn}${q.kind !== 'gen' && C.KINDS[q.kind] ? ' · ' + C.KINDS[q.kind].label : q.kind === 'gen' && DOMAIN[q.gen.domain] ? ' · ' + DOMAIN[q.gen.domain].name : ''} — ${qLine(q)}`), pr.length ? el('div', { class: 'warn' }, '⚠ ' + pr.join('، ')) : null, !pr.length && C.localMedia(n) ? el('div', { class: 'hint' }, '📵 يعمل على جهازك فقط — لا يُرسل في رابط الطلاب (ملف مرفوع من جهازك)') : null),
          el('div', { class: 'qa' },
            el('button', { class: 'btn sm ghost', title: 'أعلى', disabled: i === 0, onclick: () => { [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; mark(); paintList(); } }, '↑'),
            el('button', { class: 'btn sm ghost', title: 'أسفل', disabled: i === qs.length - 1, onclick: () => { [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; mark(); paintList(); } }, '↓'),
            el('button', { class: 'btn sm ghost', title: 'مراجعة', onclick: async () => { const p = sheet({ title: '👁 مراجعة السؤال', width: 560 }); p.body.append(await previewNode(q)); p.foot.append(el('button', { class: 'btn', onclick: () => p.close(true) }, 'إغلاق')); } }, '👁'),
            el('button', { class: 'btn sm', title: 'تعديل', onclick: () => openEditor(q, { onSave: (nq) => { qs[i] = nq; mark(); paintList(); } }) }, '✎ تعديل'),
            el('button', { class: 'btn sm ghost', title: 'حذف', onclick: () => { qs.splice(i, 1); mark(); paintList(); } }, '🗑')));
        list.append(row);
      });
    }
    paintList();
  }
  function pickCount(title, text, go, lv0) {
    const d = sheet({ title, width: 520 }); let n = 8, lv = lv0 || 1;
    d.body.append(el('p', { class: 'hint' }, text), el('div', { class: 'field' }, el('label', {}, 'عدد الأسئلة'), seg([5, 8, 10, 15].map((x) => ({ id: x, html: AR(x) })), n, (v) => { n = +v; })),
      el('div', { class: 'field' }, el('label', {}, 'المستوى'), seg(LEVELS.map((x) => ({ id: x.id, html: `${x.name}<small>${x.hint}</small>` })), lv, (v) => { lv = +v; })));
    d.foot.append(el('button', { class: 'btn pri', onclick: () => { d.close(true); go(n, lv); } }, '✔ إضافة'), el('button', { class: 'btn ghost', onclick: () => d.close(true) }, 'إلغاء'));
  }
  function libraryDlg(add) {
    const d = sheet({ title: '🎼 من مكتبة التحديات الموسيقية', width: 760 }); let dom = DOMAINS[0].id, lv = cur.settings.level || 1, n = 5;
    const doms = el('div', { class: 'doms' });
    for (const x of DOMAINS) { const b = el('button', { class: 'dom' + (x.id === dom ? ' on' : '') }, el('span', { class: 'di' }, x.icon), el('b', {}, x.name), el('small', {}, x.desc)); b.onclick = () => { dom = x.id; [...doms.children].forEach((c) => c.classList.toggle('on', c === b)); }; doms.append(b); }
    d.body.append(el('p', { class: 'hint' }, 'كل تحدٍّ يُبنى من بيانات موسيقية موثّقة داخل MusiTeacher (الأشكال الإيقاعية، الضروب، المقامات، الآلات وتسجيلاتها الحقيقية…). راجعها بعد الإضافة.'), doms,
      el('div', { class: 'grid2' }, el('div', { class: 'field' }, el('label', {}, 'المستوى'), seg(LEVELS.map((x) => ({ id: x.id, html: x.name })), lv, (v) => { lv = +v; })), el('div', { class: 'field' }, el('label', {}, 'العدد'), seg([3, 5, 8, 10].map((x) => ({ id: x, html: AR(x) })), n, (v) => { n = +v; }))));
    d.foot.append(el('button', { class: 'btn pri', onclick: () => { const seed = (Date.now() & 0xffffff); add(Array.from({ length: n }, (_, i) => C.genQuestion(dom, lv, seed + i * 131))); d.close(true); } }, '✔ إضافة'), el('button', { class: 'btn ghost', onclick: () => d.close(true) }, 'إلغاء'));
  }
  function manualDlg(done) {
    const d = sheet({ title: '✍️ سؤال يدوي — اختر النوع', width: 640 });
    const g = el('div', { class: 'kinds' });
    for (const [k, K] of Object.entries(C.KINDS)) g.append(el('button', { class: 'kind', onclick: () => { d.close(true); openEditor(C.blankQuestion(k), { onSave: done }); } }, el('span', {}, K.icon), el('b', {}, K.label), el('small', {}, K.hint)));
    d.body.append(g); d.foot.append(el('button', { class: 'btn ghost', onclick: () => d.close(true) }, 'إلغاء'));
  }
  function chooser(title, qs, note, add) {
    const d = sheet({ title, width: 820 });
    if (note) d.body.append(el('p', { class: 'hint' }, note));
    const have = new Set(cur.questions.map((q) => q.bankRef).filter(Boolean));
    const checks = [];
    const box = el('div', { class: 'qlist' });
    qs.forEach((q) => {
      const dup = q.bankRef && have.has(q.bankRef);
      const c = el('input', { type: 'checkbox', checked: !dup }); checks.push(c);
      box.append(el('label', { class: 'qrow pick' }, c, el('div', { class: 'qm' }, el('div', { class: 'qp' }, q.prompt, dup ? el('small', { class: 'warn' }, ' (موجود في المسابقة)') : null), el('div', { class: 'qo' }, qLine(q)), q.explain ? el('div', { class: 'hint' }, q.explain) : null)));
    });
    d.body.append(el('div', { class: 'row' }, el('button', { class: 'btn sm ghost', onclick: () => checks.forEach((c) => { c.checked = true; }) }, 'تحديد الكل'), el('button', { class: 'btn sm ghost', onclick: () => checks.forEach((c) => { c.checked = false; }) }, 'إلغاء التحديد')), box);
    d.foot.append(el('button', { class: 'btn pri', onclick: () => { add(qs.filter((_, i) => checks[i].checked)); d.close(true); } }, '✔ إضافة المحدد'), el('button', { class: 'btn ghost', onclick: () => d.close(true) }, 'إلغاء'));
  }
  async function fromBankDlg(les, add) {
    toast('جارٍ جلب أنشطة الدرس…');
    const r = await C.bankFor(les.id);
    if (r.error) { toast(r.error, 5000); return; }
    if (!r.bank) { toast('لا يوجد نشاط جاهز لهذا الدرس بعد. جرّب «التوليد من محتوى الدرس» أو أسئلتك.', 5000); return; }
    const qs = r.bank.questions.map((x) => C.fromBank(r.bank, x)).filter(Boolean);
    const skipped = r.bank.questions.length - qs.length;
    chooser(`📘 أنشطة الدرس الجاهزة — ${les.title}`, qs, `المصدر: ${r.bank.source || 'دليل المعلم'}.${skipped ? ` (${AR(skipped)} أسئلة من نوع الإكمال/الترتيب/المفتوح لا تناسب مسارات الطريق فلم تُعرض)` : ''} تُنسخ الأسئلة إلى مسابقتك ولا يتغير النشاط الأصلي.`, add);
  }
  async function fromAIDlg(les, add) {
    const d = sheet({ title: `📄 توليد أسئلة من محتوى درس «${les.title}»`, width: 760 });
    d.body.append(el('p', { class: 'hint' }, 'تُنشأ الأسئلة من محتوى الدرس الذي تختاره فقط، ويتحقق الخادم من وجود دليل لكل سؤال في النص؛ لا تُختلق معلومات. لا تُرسل أسماء الطلاب أبدًا. ستراجع النتائج قبل إضافتها.'));
    let src = 'platform', file = null; const paste = el('textarea', { rows: 7, placeholder: 'الصق نص الدرس هنا (فقرة واضحة على الأقل)…' });
    const fi = el('input', { type: 'file', accept: '.pdf,.txt,image/png,image/jpeg,image/webp', class: 'hidden' }); const finfo = el('span', { class: 'hint' });
    fi.onchange = async () => { const f = fi.files[0]; if (!f) return; const ext = (f.name.split('.').pop() || '').toLowerCase(); try { if (ext === 'txt') file = { kind: 'text', text: await readFileAs(f, 'text') }; else if (ext === 'pdf') file = { kind: 'pdf', mime: 'application/pdf', data: String(await readFileAs(f)).split(',')[1] }; else file = { kind: 'image', mime: f.type, data: String(await readFileAs(f)).split(',')[1] }; finfo.textContent = `✓ ${f.name}`; } catch (e) { finfo.textContent = '✗ ' + e.message; file = null; } };
    const body = el('div');
    const srcs = el('div', { class: 'seg' });
    const paint = () => { body.innerHTML = ''; if (src === 'paste') body.append(paste); if (src === 'file') body.append(el('div', { class: 'row' }, el('button', { class: 'btn sm', onclick: () => fi.click() }, '📄 اختر ملف الدرس (PDF / صورة / نص)'), finfo, fi)); if (src === 'platform') body.append(el('p', { class: 'hint' }, 'يُستخدم المحتوى الموثّق لهذا الدرس المحفوظ في المنصة (جمل منقولة من دليل المعلم).')); };
    [['platform', '📗 محتوى المنصة'], ['paste', '📋 لصق نص'], ['file', '📄 ملف/صورة']].forEach(([k, t]) => { const b = el('button', { type: 'button', class: k === src ? 'on' : '' }, t); b.onclick = () => { src = k; [...srcs.children].forEach((x) => x.classList.toggle('on', x === b)); paint(); }; srcs.append(b); });
    let n = 8; const status = el('div');
    d.body.append(el('div', { class: 'field' }, el('label', {}, 'مصدر المحتوى'), srcs), body, el('div', { class: 'field' }, el('label', {}, 'عدد الأسئلة'), seg([5, 8, 10, 15].map((x) => ({ id: x, html: AR(x) })), n, (v) => { n = +v; })), status);
    paint();
    const go = el('button', { class: 'btn pri' }, '✨ توليد');
    go.onclick = async () => {
      status.innerHTML = ''; let input = null;
      if (src === 'platform') {
        const r = await C.bankFor(les.id); if (r.error) { status.append(el('p', { class: 'warn' }, r.error)); return; }
        const txt = r.bank ? [...new Set(r.bank.questions.map((q) => q.src).filter(Boolean))].join('\n') : '';
        if (!txt) { status.append(el('p', { class: 'warn' }, 'لا يوجد محتوى موثّق لهذا الدرس في المنصة. الصق نص الدرس أو اختر ملفه.')); return; }
        input = { kind: 'text', text: txt };
      } else if (src === 'paste') { const t = paste.value.trim(); if (t.length < 80) { status.append(el('p', { class: 'warn' }, 'النص قصير جدًا لتوليد أسئلة موثوقة. الصق فقرة واضحة على الأقل.')); return; } input = { kind: 'text', text: t }; }
      else { if (!file) { status.append(el('p', { class: 'warn' }, 'اختر ملفًا أولًا.')); return; } input = file; }
      go.disabled = true; go.textContent = '… جارٍ التوليد من محتوى الدرس';
      const r = await C.aiGenerate({ grade: les.grade, lesson: les.title, count: n, types: ['MC', 'TF'], input });
      go.disabled = false; go.textContent = '✨ توليد';
      if (!r.ok) { status.append(el('p', { class: 'warn' }, `تعذّر التوليد: ${r.error || 'خطأ غير معروف'}`)); return; }
      const qs = (r.questions || []).map(C.fromAI).filter(Boolean);
      if (!qs.length) { status.append(el('p', { class: 'warn' }, r.message || 'المحتوى غير كافٍ لإنشاء أسئلة موثوقة دون اختلاق معلومات.')); return; }
      d.close(true);
      chooser('📄 راجع الأسئلة المولّدة', qs, `${r.verified === false ? '⚠ لم يتحقق الخادم من كل الأسئلة؛ راجعها بعناية. ' : ''}${qs.length < n ? (r.message || `أُنشئ ${AR(qs.length)} فقط لأن المحتوى لا يكفي لأكثر دون اختلاق.`) : ''} عدّل أي سؤال بعد الإضافة من زر «✎ تعديل».`, add);
    };
    d.foot.append(go, el('button', { class: 'btn ghost', onclick: () => d.close(true) }, 'إلغاء'));
  }

  // ================================================================ تبويب المتسابقين
  function tNames() {
    const names = cur.names;
    pane.append(el('p', { class: 'hint' }, 'تُلعب الأدوار بترتيب هذه القائمة تمامًا (ليس عشوائيًا). الأسماء تُحفظ على هذا الجهاز فقط مع المسابقة، ولا تُرسل إلى أي خادم ولا تُضمَّن في رابط الطلاب. اترك القائمة فارغة ليلعب متسابق واحد بلا اسم.'));
    const one = el('input', { type: 'text', maxlength: '40', placeholder: 'اسم متسابق أو فريق' });
    const addOne = () => { const v = one.value.trim(); if (!v) return; names.push(v); one.value = ''; mark(); paint(); one.focus(); };
    one.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addOne(); } });
    const bulk = el('textarea', { rows: 5, placeholder: 'أو الصق قائمة أسماء: اسم في كل سطر (أو مفصولة بفواصل)' });
    pane.append(el('div', { class: 'grid2' },
      el('div', { class: 'field' }, el('label', {}, 'إضافة اسم'), el('div', { class: 'row' }, one, el('button', { class: 'btn sm pri', onclick: addOne }, '＋ إضافة'))),
      el('div', { class: 'field' }, el('label', {}, 'لصق قائمة'), bulk, el('button', { class: 'btn sm', onclick: () => { const arr = bulk.value.split(/[\n,،;؛\t]+/).map((x) => x.replace(/^\s*[\d٠-٩]+\s*[.)\-–]?\s*/, '').trim()).filter(Boolean); if (!arr.length) return; names.push(...arr.map((x) => x.slice(0, 40))); bulk.value = ''; mark(); paint(); toast(`أُضيف ${AR(arr.length)} اسمًا`); } }, '📋 إضافة القائمة'))));
    const head = el('div', { class: 'qhead2' }), list = el('ol', { class: 'names' });
    pane.append(head, list);
    function paint() {
      head.innerHTML = '';
      const per = cur.settings.perTurn, pool = cur.questions.filter((q) => C.playable(C.normalize(q))).length;
      head.append(...[el('b', {}, `المتسابقون: ${AR(names.length)}`),
        names.length && pool ? el('span', { class: names.length * per > pool ? 'warn' : 'hint' }, names.length * per > pool ? ` · يحتاج ${AR(names.length)} × ${AR(per)} = ${AR(names.length * per)} سؤالًا ولديك ${AR(pool)}؛ ستتكرر بعض الأسئلة بين المتسابقين` : ` · ${AR(per)} أسئلة لكل متسابق، أسئلة مختلفة لكل واحد`) : null,
        names.length ? el('button', { class: 'btn sm ghost', onclick: async () => { if (await confirmBox('مسح كل الأسماء؟', { yes: 'مسح', danger: true })) { names.length = 0; mark(); paint(); } } }, '🗑 مسح الكل') : null].filter(Boolean));
      list.innerHTML = '';
      if (!names.length) { list.append(el('li', { class: 'empty' }, 'لا توجد أسماء بعد.')); return; }
      names.forEach((n, i) => {
        const inp = el('input', { type: 'text', maxlength: '40', value: n, 'aria-label': `الاسم ${i + 1}` });
        inp.onchange = () => { const v = inp.value.trim(); if (v) { names[i] = v; mark(); } else inp.value = names[i]; };
        list.append(el('li', {}, el('span', { class: 'qi' }, AR(i + 1)), inp,
          el('button', { class: 'btn sm ghost', disabled: i === 0, onclick: () => { [names[i - 1], names[i]] = [names[i], names[i - 1]]; mark(); paint(); } }, '↑'),
          el('button', { class: 'btn sm ghost', disabled: i === names.length - 1, onclick: () => { [names[i + 1], names[i]] = [names[i], names[i + 1]]; mark(); paint(); } }, '↓'),
          el('button', { class: 'btn sm ghost', onclick: () => { names.splice(i, 1); mark(); paint(); } }, '🗑')));
      });
    }
    paint();
  }

  // ================================================================ تبويب طريقة اللعب والمظهر
  function tPlay() {
    const S = cur.settings;
    const set = (k) => (v) => { S[k] = v; mark(); if (k === 'theme') app.world.setTheme(v); if (k === 'flag') app.world.setFlag(v); if (k === 'vehicle') app.setVehicle(v); if (k === 'driver') app.setDriver(v); };
    const f = (label, node, hint) => el('div', { class: 'field' }, el('label', {}, label), hint ? el('span', { class: 'hint' }, hint) : null, node);
    const L = el('div'), R = el('div');
    L.append(
      f('نمط اللعب', seg(Object.entries(C.MODES).map(([id, M]) => ({ id, html: `${M.name}<small>${M.desc}</small>` })), S.mode, set('mode'))),
      f('عدد الأسئلة لكل متسابق', seg([3, 5, 8, 10].map((n) => ({ id: n, html: AR(n) })), S.perTurn, (v) => set('perTurn')(+v)), 'عند عدم وجود أسماء يلعب متسابق واحد كل أسئلة المسابقة'),
      f('زمن الإجابة لكل مفترق', seg([10, 14, 18, 24].map((n) => ({ id: n, html: `${AR(n)} ث` })), S.answerTime, (v) => set('answerTime')(+v)), 'المسافة إلى البوابة تُحسب ليصل الطالب بعد هذا الزمن بالسرعة العادية'),
      f('مرات إعادة السماع', seg([{ id: 0, html: 'بلا إعادة' }, { id: 1, html: 'مرة' }, { id: 2, html: 'مرتان' }, { id: -1, html: 'بلا حدود' }], S.replays, (v) => set('replays')(+v))),
      f('سرعة المركبة', seg(SPEED.map((n, i) => ({ id: i + 1, html: n })), S.level, (v) => set('level')(+v))),
    );
    R.append(
      f('المركبة', seg([{ id: 'car', html: '🏎️ سيارة السباق' }, { id: 'moto', html: '🏍️ الموتوسيكل' }], S.vehicle, set('vehicle'))),
      f('الشخصية', seg([{ id: 'female', html: '👩🏻 السائقة' }, { id: 'male', html: '👨🏽 السائق' }], S.driver, set('driver'))),
      f('الكاميرا الافتراضية', seg([{ id: 'chase', html: '🎥 خلف المركبة' }, { id: 'pov', html: '👁️ منظور السائق' }], S.camera === 'pov' ? 'pov' : 'chase', set('camera')), 'منظور السائق: لوحة القيادة والمقود (أو المقود واليدين في الموتوسيكل) من عيني السائق'),
      el('div', { class: 'field' }, toggle('السماح للطالب بتبديل الكاميرا أثناء اللعب', S.allowCamera !== false, set('allowCamera'))),
      f('البيئة', seg(Object.entries(THEMES).map(([id, T]) => ({ id, html: T.name })), S.theme, set('theme'))),
      el('div', { class: 'field' }, toggle('علم سلطنة عُمان على جانبي الطريق', S.flag !== false, set('flag'))),
      el('div', { class: 'field' }, toggle('اسم المتسابق على لوحة خلف المركبة', S.plate !== false, set('plate'))),
      el('div', { class: 'field' }, toggle('مقاطع وطنية قصيرة عند المرور بجوار المحلات (مذياع الطريق)', S.radio !== false, set('radio')),
        el('span', { class: 'hint' }, 'إيقاعات فنون عُمانية من أدلة المعلم (وأغانٍ وطنية إن أُضيفت ملفاتها)، تُسمع ثوانيَ عند المرور فقط، وتصمت تلقائيًا في الأسئلة السمعية.')),
      f('مستوى صوت مذياع الطريق', seg([{ id: 0.4, html: 'منخفض' }, { id: 0.7, html: 'متوسط' }, { id: 1, html: 'مرتفع' }], S.radioVol ?? 0.7, (v) => set('radioVol')(+v))),
    );
    pane.append(el('div', { class: 'grid2' }, L, R));
  }

  showTab(curTab);
  return s;
}
