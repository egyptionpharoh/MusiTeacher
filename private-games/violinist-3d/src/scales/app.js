// لعبة «سُلّم صول الكبير» — المرحلة الثانية: المدرج + الزند ثلاثي الأبعاد + مواضع الأصابع + التنقل نغمةً نغمة.
// الحالة كلها هنا في مكان واحد (state)، وكل عنصر يُرسم منها: المدرج، والزند، وبطاقة النغمة، وشريط التقدم.
import { G_MAJOR_1ST, STRINGS, STEP_AR, FINGER_AR, buildSequence } from './scale-data.js';
import { Staff } from './staff.js';
import { Fingerboard3D } from './fingerboard3d.js';

const $ = (s) => document.querySelector(s);
const scale = G_MAJOR_1ST;
const state = { direction: 'full', dOpenDown: false, index: 0, seq: [] };
const DIR_AR = { up: 'صعود', down: 'نزول' };

let staff, fb;

function hintFor(e) {
  const s = STRINGS[e.string];
  const pat = scale.pattern[e.string] || {};
  const lines = [];
  if (e.finger === 0) {
    lines.push(`وتر ${s.ar} مفتوح: لا تضغط أي إصبع على الوتر.`);
  } else {
    const prevSemis = e.finger === 1 ? 0 : pat[e.finger - 1];
    const diff = e.semis - prevSemis;
    const from = e.finger === 1 ? 'الوتر المفتوح' : `الإصبع ${e.finger - 1}`;
    if (diff === 1) lines.push(`الإصبع ${e.finger} ملاصق لـ${from}: بينهما نصف درجة.`);
    else if (diff === 2) lines.push(`بين ${from} والإصبع ${e.finger} درجة كاملة: اترك مسافة بينهما.`);
    if (e.finger === 4 && e.step === 'D') lines.push('«ري» بالإصبع الرابع على وتر صول تعطي صوت وتر ري المفتوح نفسه، ونستخدمها هنا لتدريب الإصبع الرابع.');
    if (e.held.length) lines.push(`أبقِ ${e.held.length > 1 ? 'الأصابع' : 'الإصبع'} ${e.held.map(h => h.finger).join(' و')} ${e.held.length > 1 ? 'موضوعة' : 'موضوعًا'} على الوتر.`);
  }
  return lines;
}

function renderCard(e, animate) {
  const card = $('#noteCard');
  const nm = $('#ncName'); nm.textContent = STEP_AR[e.step];
  if (e.alter) { const a = document.createElement('span'); a.className = 'acc'; a.textContent = e.alter === 1 ? 'دييز' : 'بيمول'; nm.appendChild(a); }
  $('#ncLatin').textContent = e.latin;
  $('#ncString').textContent = `وتر ${STRINGS[e.string].ar}`;
  $('#ncFinger').textContent = e.finger === 0 ? FINGER_AR[0] : `${FINGER_AR[e.finger]} (${e.finger})`;
  $('#ncFinger').classList.toggle('is-open', e.finger === 0);
  const hint = $('#ncHint'); hint.textContent = '';
  for (const l of hintFor(e)) { const p = document.createElement('p'); p.textContent = l; hint.appendChild(p); }
  $('#ncCount').textContent = `النغمة ${e.index + 1} من ${state.seq.length} · ${DIR_AR[e.dir]}`;
  if (animate) { card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump'); }
}

function renderProgress() {
  const box = $('#progress'); box.textContent = '';
  state.seq.forEach((e, i) => {
    const b = document.createElement('button');
    b.className = 'dot'; b.type = 'button';
    b.setAttribute('aria-label', `النغمة ${i + 1}: ${e.nameAr}`);
    b.title = `${e.nameAr} — ${e.finger === 0 ? 'مفتوح' : 'إصبع ' + e.finger}`;
    if (i > 0 && state.seq[i - 1].dir !== e.dir) b.classList.add('turn');
    b.addEventListener('click', () => go(i));
    box.appendChild(b);
  });
}

function go(i, animate = true) {
  const n = state.seq.length;
  i = Math.max(0, Math.min(n - 1, i));
  state.index = i;
  const e = state.seq[i], nx = state.seq[i + 1] || null;
  staff.setCurrent(i, animate);
  fb.setState({
    active: { string: e.string, semis: e.semis, finger: e.finger },
    held: e.held,
    next: nx ? { string: nx.string, semis: nx.semis, finger: nx.finger } : null,
  });
  renderCard(e, animate);
  [...$('#progress').children].forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
  $('#prev').disabled = i === 0;
  $('#next').disabled = i === n - 1;
}

function rebuild(keepIndex) {
  state.seq = buildSequence(scale, { direction: state.direction, dOpenDown: state.dOpenDown });
  staff.render(state.seq, scale);
  renderProgress();
  $('#dOpt').classList.toggle('muted', state.direction === 'up');
  go(keepIndex ? Math.min(state.index, state.seq.length - 1) : 0, false);
}

function bindSeg(id, onPick) {
  const box = $(id);
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-v]'); if (!b) return;
    box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    onPick(b.dataset.v);
  });
}

async function start() {
  try { await Promise.race([document.fonts.load("800 64px 'Tajawal'"), new Promise(r => setTimeout(r, 2500))]); } catch (_) { /* خط النظام */ }
  staff = new Staff($('#staffViewport'), { onSelect: (i) => go(i) });
  try {
    fb = new Fingerboard3D($('#fb'));
  } catch (err) {
    $('#loader').classList.add('error');
    $('#loaderText').textContent = 'تعذّر تشغيل العرض ثلاثي الأبعاد على هذا المتصفح (WebGL). جرّب Chrome أو Edge بإصدار حديث.';
    console.error(err); return;
  }
  $('#prev').addEventListener('click', () => go(state.index - 1));
  $('#next').addEventListener('click', () => go(state.index + 1));
  $('#resetView').addEventListener('click', () => fb.resetView());
  bindSeg('#dirSeg', (v) => { state.direction = v; rebuild(false); });
  bindSeg('#dSeg', (v) => { state.dOpenDown = v === 'open'; rebuild(true); });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(state.index + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(state.index - 1); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(state.seq.length - 1);
  });
  rebuild(false);
  requestAnimationFrame(() => $('#loader').classList.add('gone'));
  if (new URLSearchParams(location.search).has('debug')) window.__scales = { state, staff, fb, go, rebuild };
}

start();
