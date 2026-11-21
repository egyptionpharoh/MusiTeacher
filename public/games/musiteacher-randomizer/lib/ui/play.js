// =====================================================================
//  مسرح اللعب: عجلة الأسماء (أو أرقام الأسئلة) + إعلان كبير للاسم + بطاقة سؤال كبيرة بخياراته
//  + إظهار الإجابة / سؤال آخر / تخطي / التالي + قائمة الأسئلة المستخدمة. الجولة لا تكرر الأسئلة.
//  حالة الجولة تُحفظ في sessionStorage فلا تضيع عند إعادة التحميل (ولا تُحفظ الأسماء دائمًا).
// =====================================================================
import { Wheel, Sounds } from './wheel.js';
import { TYPES, LEVELS, answerText, scrambled, symSVG } from '../core/model.js';
import { rand, shuffle } from '../core/names.js';
import { h, esc, toast, modal } from './text.js';

const KEY = 'rz_play';
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; } };
const persist = (s) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };
export const clearPlay = () => sessionStorage.removeItem(KEY);

/**
 * @param {HTMLElement} root
 * @param {{act:object, names:string[], opts:{mode, noRepeat, allowRepeatQ, timer, sound}, onExit:Function, onOpts:Function}} p
 */
export function renderPlay(root, p) {
  const { act } = p;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sounds = new Sounds(); sounds.on = p.opts.sound !== false;
  let s = load();
  const sig = `${act.id}|${act.updatedAt}|${p.names.join('\u0001')}|${p.opts.mode}`;
  if (!s || s.sig !== sig) s = { sig, pool: [...p.names], usedQ: [], cur: null, revealed: false, tally: {}, round: 1, history: [] };
  const qById = (id) => act.questions.find((q) => q.id === id);
  const mode = p.opts.mode; // both | student | question
  const remainingQ = () => act.questions.filter((q) => p.opts.allowRepeatQ || !s.usedQ.includes(q.id));
  const wheelItems = () => (mode === 'question' ? remainingQ().map((q) => `سؤال ${act.questions.indexOf(q) + 1}`) : (p.opts.noRepeat ? s.pool : p.names));

  // ---------- العناصر
  root.innerHTML = '';
  const canvas = h('canvas', { 'aria-label': 'العجلة' });
  const hub = h('button', { class: 'hub', onclick: () => spin() }, 'أدر');
  const wheelbox = h('div', { class: 'wheelbox' }, h('div', { class: 'pointer' }), canvas, hub);
  const who = h('div', { class: 'who' });
  const qwrap = h('div');
  const timerEl = h('span', { class: 'timer' });
  const controls = h('div', { class: 'controls' });
  const info = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
  const soundBtn = h('button', { class: 'btn sm', title: 'الصوت', onclick: () => { sounds.on = !sounds.on; p.onOpts({ sound: sounds.on }); soundBtn.textContent = sounds.on ? '🔊 الصوت' : '🔇 صامت'; } }, sounds.on ? '🔊 الصوت' : '🔇 صامت');
  const top = h('div', { class: 'bar' },
    h('button', { class: 'btn sm', onclick: () => { cleanup(); p.onExit(); } }, '→ رجوع للإعداد'),
    h('b', { class: 'grow' }, act.title), soundBtn,
    h('button', { class: 'btn sm', onclick: () => usedList() }, '📋 الأسئلة المستخدمة'),
    h('button', { class: 'btn sm', onclick: () => summary() }, '🏁 ملخص الجولة'),
    h('button', { class: 'btn sm', title: 'ملء الشاشة', onclick: () => { const d = document; if (d.fullscreenElement) d.exitFullscreen().catch(() => {}); else (d.documentElement.requestFullscreen ? d.documentElement.requestFullscreen() : Promise.resolve()).catch(() => {}); } }, '⛶'));
  root.append(top, h('div', { class: 'stage' }, h('div', {}, wheelbox, info), h('div', { class: 'panel' }, who, qwrap, h('div', { class: 'row', style: { justifyContent: 'center' } }, timerEl), controls)));
  const wheel = new Wheel(canvas, { onTick: (sp) => sounds.tick(sp) });

  // ---------- المؤقت
  let tId = 0, tLeft = 0;
  const stopTimer = () => { clearInterval(tId); tId = 0; timerEl.textContent = ''; };
  const startTimer = () => {
    stopTimer(); if (!p.opts.timer) return; tLeft = p.opts.timer;
    const paint = () => { timerEl.textContent = `⏱ ${tLeft}`; timerEl.classList.toggle('low', tLeft <= 5); };
    paint(); tId = setInterval(() => { tLeft--; paint(); if (tLeft <= 0) { stopTimer(); timerEl.textContent = '⏱ انتهى الوقت'; sounds.play('wrong.ogg', 0.5); } }, 1000);
  };

  // ---------- الرسم
  const paintInfo = () => {
    info.innerHTML = '';
    const left = remainingQ().length;
    if (mode !== 'question') info.append(h('span', { class: 'chip' }, p.opts.noRepeat ? `على العجلة: ${s.pool.length} من ${p.names.length}` : `الطلاب: ${p.names.length}`));
    if (mode !== 'student') info.append(h('span', { class: 'chip' }, `أسئلة متبقية: ${left} من ${act.questions.length}`));
    info.append(h('span', { class: 'chip' }, `الجولة ${s.round}`));
  };
  const paintWho = () => {
    who.innerHTML = '';
    if (mode === 'question') { who.classList.add('hidden'); return; }
    who.classList.remove('hidden');
    who.append(h('div', { class: 'lbl' }, s.cur && s.cur.name ? 'دور:' : 'اضغط «أدر» لاختيار طالب'), h('div', { class: 'name' }, (s.cur && s.cur.name) || '—'));
  };
  const optionLetter = (i) => 'أبجدهوز'[i] || i + 1;
  const paintQ = () => {
    qwrap.innerHTML = '';
    const q = s.cur && s.cur.qid && qById(s.cur.qid);
    if (!q) {
      if (mode === 'student' && s.cur && s.cur.name) qwrap.append(h('div', { class: 'qcard' }, h('div', { class: 'qt' }, 'اطرح سؤالك شفهيًا، أو اسحب سؤالًا من النشاط.')));
      else if (!remainingQ().length && mode !== 'student') qwrap.append(h('div', { class: 'qcard' }, h('div', { class: 'qt' }, '🎉 انتهت أسئلة هذه الجولة!'), h('p', {}, 'ابدأ جولة جديدة لإعادة الأسئلة، أو اعرض ملخص الجولة.')));
      else qwrap.append(h('div', { class: 'qcard' }, h('div', { class: 'qt', style: { color: '#6b7a99' } }, mode === 'question' ? 'أدر العجلة لاختيار سؤال' : 'سيظهر السؤال هنا بعد اختيار الطالب')));
      paintControls(); return;
    }
    const n = act.questions.indexOf(q) + 1;
    const card = h('div', { class: 'qcard', 'aria-live': 'polite' },
      h('div', { class: 'meta' }, h('span', { class: 'chip' }, `سؤال ${n}`), h('span', { class: 'chip' }, `${TYPES[q.type].icon} ${TYPES[q.type].label}`), h('span', { class: 'chip' }, LEVELS[q.level])),
      h('div', { class: 'qt', html: esc(q.text).replace(/…{2,}|\.{4,}|_{3,}/g, '<span class="blank"></span>') }));
    if (q.sym) card.append(h('div', { class: 'symbox', html: symSVG(q.sym, 26, '#0b1830') }));
    if (q.image) card.append(h('img', { class: 'qimg', src: q.image, alt: '' }));
    if (q.audio) card.append(h('audio', { controls: true, src: q.audio, style: { marginTop: '10px', width: '100%' } }));
    if (q.type === 'MC') card.append(h('div', { class: 'opts' }, q.options.map((o, i) => h('div', { class: `o${s.revealed && i === q.answer ? ' right' : ''}` }, h('b', {}, optionLetter(i)), o))));
    if (q.type === 'TF') card.append(h('div', { class: 'opts' }, ['صح', 'خطأ'].map((o, i) => h('div', { class: `o${s.revealed && (i === 0) === q.answer ? ' right' : ''}` }, h('b', {}, i ? '✗' : '✓'), o))));
    if (q.type === 'ORDER') card.append(h('div', { class: 'opts' }, scrambled(q).map((o, i) => h('div', { class: 'o' }, h('b', {}, i + 1), o))));
    if (s.revealed && !['MC', 'TF'].includes(q.type)) card.append(h('div', { class: 'ans' }, `✔ ${answerText(q) || 'يقيّمه المعلم'}`));
    if (s.revealed && q.src) card.append(h('div', { class: 'src', style: { color: '#4a5a7a', marginTop: '8px' } }, `📖 ${q.src}`));
    qwrap.append(card);
    paintControls();
  };
  const paintControls = () => {
    controls.innerHTML = '';
    const q = s.cur && s.cur.qid && qById(s.cur.qid);
    const busy = wheel.spinning;
    controls.append(h('button', { class: 'btn pri big', disabled: busy || !wheelItems().length, onclick: () => spin() }, s.cur ? '🎡 أدر مرة أخرى' : '🎡 أدر العجلة'));
    if (q && !s.revealed) controls.append(h('button', { class: 'btn gold big', onclick: () => reveal() }, '👁 أظهر الإجابة'));
    if (q && s.cur.name && mode !== 'question') controls.append(
      h('button', { class: 'btn ok', onclick: () => mark('ok') }, '✓ أجاب'), h('button', { class: 'btn', onclick: () => mark('no') }, '✗ لم يُجب'));
    if (q) controls.append(h('button', { class: 'btn', disabled: !remainingQ().filter((x) => x.id !== q.id).length, onclick: () => anotherQ() }, '🔁 سؤال آخر'), h('button', { class: 'btn', onclick: () => skip() }, '⏭ تخطي'));
    if (mode === 'student' && s.cur && s.cur.name && !q && act.questions.length) controls.append(h('button', { class: 'btn', onclick: () => { drawQ(); paintQ(); } }, '❓ اسحب سؤالًا'));
    const roundOver = (mode !== 'question' && p.opts.noRepeat && !s.pool.length) || (mode !== 'student' && !remainingQ().length);
    if (roundOver) controls.append(h('button', { class: 'btn gold', onclick: () => newRound() }, '🔄 جولة جديدة'));
    hub.disabled = busy || !wheelItems().length;
  };
  const paintAll = () => { wheel.setItems(wheelItems()); paintInfo(); paintWho(); paintQ(); persist(s); };

  // ---------- الأفعال
  function drawQ(exclude) {
    let pool = remainingQ(); if (exclude) pool = pool.filter((q) => q.id !== exclude);
    if (!pool.length) { s.cur.qid = null; return; }
    const q = pool[Math.floor(rand() * pool.length)];
    s.cur.qid = q.id; s.revealed = false;
    if (!s.usedQ.includes(q.id)) s.usedQ.push(q.id);
    startTimer();
  }
  async function spin() {
    if (wheel.spinning) return;
    const items = wheelItems();
    if (!items.length) { toast(mode === 'question' ? 'انتهت الأسئلة. ابدأ جولة جديدة.' : 'لا توجد أسماء على العجلة. ابدأ جولة جديدة.'); return; }
    stopTimer(); s.revealed = false;
    sounds.ac(); // تفعيل الصوت بلمسة المستخدم
    clearTimeout(refreshT);
    wheel.setItems(items);                                // العجلة تعرض بالضبط ما يُختار منه
    paintControls();
    const i = await wheel.spin({ reduced });
    if (i < 0 || i >= items.length) { paintControls(); return; }
    sounds.play('victory.ogg', 0.55);
    if (mode === 'question') {
      const q = remainingQ()[i];
      s.cur = { name: null, qid: q.id }; if (!s.usedQ.includes(q.id)) s.usedQ.push(q.id); startTimer();
      flash(`سؤال ${act.questions.indexOf(q) + 1}`);
    } else {
      const name = items[i];
      s.cur = { name, qid: null };
      if (p.opts.noRepeat) s.pool = s.pool.filter((n) => n !== name);
      s.history.push({ name, at: Date.now() });
      flash(name);
      if (mode === 'both') drawQ();
    }
    paintInfo(); paintWho(); paintQ(); persist(s);
    if (window.innerWidth < 860) setTimeout(() => (mode === 'question' ? qwrap : who).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), reduced ? 900 : 1500);
    // العجلة تُحدَّث بعد الإعلان حتى يرى الجميع موضع التوقف
    refreshT = setTimeout(() => { if (!wheel.spinning) wheel.setItems(wheelItems()); }, 1600);
  }
  let refreshT = 0;
  function reveal() { s.revealed = true; stopTimer(); sounds.play('correct.ogg', 0.5); paintQ(); persist(s); }
  // السؤال المستبدل يبقى «مستخدمًا» لأن الصف رآه، فلا يعود في هذه الجولة
  function anotherQ() { drawQ(s.cur.qid); paintInfo(); paintQ(); persist(s); }
  function skip() { stopTimer(); s.cur = mode === 'question' ? null : { name: s.cur.name, qid: null }; if (mode === 'both') drawQ(); paintAll(); }
  function mark(r) {
    const n = s.cur.name; const t = s.tally[n] || { ok: 0, no: 0 }; t[r]++; s.tally[n] = t;
    if (r === 'ok') sounds.play('correct.ogg', 0.4); else sounds.play('wrong.ogg', 0.35);
    toast(r === 'ok' ? `أحسنت يا ${n}! 👏` : `لا بأس يا ${n}، نحاول مرة أخرى`);
    if (!s.revealed) reveal(); persist(s);
  }
  function newRound() { s.pool = [...p.names]; s.usedQ = []; s.cur = null; s.revealed = false; s.round++; stopTimer(); paintAll(); toast('بدأت جولة جديدة'); }
  function flash(text) {
    const f = h('div', { class: 'flash' }, h('div', { class: 'box' }, h('div', { class: 'mute' }, mode === 'question' ? 'السؤال المختار' : 'الطالب المختار'), h('div', { class: 'name' }, text)));
    document.body.append(f); setTimeout(() => f.remove(), reduced ? 900 : 1500);
  }
  function usedList() {
    const used = s.usedQ.map(qById).filter(Boolean);
    modal(h('div', {}, h('h3', {}, `الأسئلة المستخدمة في هذه الجولة (${used.length})`),
      used.length ? h('ol', { class: 'used' }, used.map((q) => h('li', {}, q.text, h('span', { class: 'mute small' }, `  — ${answerText(q)}`)))) : h('p', { class: 'mute' }, 'لم يُستخدم أي سؤال بعد.')));
  }
  function summary() {
    const rows = Object.entries(s.tally);
    modal(h('div', {}, h('h3', {}, `ملخص الجولة ${s.round}`),
      h('p', {}, `اختير ${s.history.length} مرة · أسئلة مستخدمة: ${s.usedQ.length} من ${act.questions.length}`),
      rows.length ? h('table', { style: { width: '100%', borderCollapse: 'collapse' } }, h('tr', {}, h('th', {}, 'الطالب'), h('th', {}, '✓'), h('th', {}, '✗')), rows.map(([n, t]) => h('tr', {}, h('td', {}, n), h('td', { style: { textAlign: 'center' } }, t.ok), h('td', { style: { textAlign: 'center' } }, t.no))))
        : h('p', { class: 'mute' }, 'لم تُسجَّل إجابات بعد (استخدم «✓ أجاب» و«✗ لم يُجب»).'),
      h('p', { class: 'mute small' }, 'هذا الملخص مؤقت لهذه الحصة فقط ولا يُحفظ.')));
  }
  const key = (e) => {
    if (e.target.closest('input,textarea,select') || document.querySelector('.modal')) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); spin(); }
    else if (e.key === 'r' || e.key === 'ر') reveal();
  };
  document.addEventListener('keydown', key);
  function cleanup() { stopTimer(); wheel.destroy(); sounds.stopAll(); document.removeEventListener('keydown', key); }
  if (s.cur && s.cur.qid && !s.revealed) startTimer();
  paintAll();
  if (mode !== 'question' && !p.names.length) toast('لا توجد أسماء. ارجع لخطوة الأسماء.');
  return { cleanup, _state: () => s };
}
export { shuffle };
