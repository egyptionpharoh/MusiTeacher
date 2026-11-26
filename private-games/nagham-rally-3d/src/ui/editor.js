// =====================================================================
//  محرّر سؤال واحد (للمعلم): النص، الخيارات، الإجابة الصحيحة، الشرح، والوسائط حسب نوع السؤال.
//  لا يُحفظ سؤال ناقص: تظهر المشكلات ويُعطَّل زر الحفظ حتى تُصلح.
// =====================================================================
import { el, AR, sheet, toast, shrinkImage, readFileAs } from './dom.js';
import { KINDS, normalize, problems, runtimeOf, clone, genQuestion } from '../data/contest.js';
import { DOMAIN, INSTRUMENTS, LEVELS } from '../data/content.js';
import { FIGURES } from '../data/figures.js';
import { noteName } from '../notation/staff.js';
import { signImage } from '../world/signs.js';

const N = (step, oct, acc = 0) => ({ step, oct, acc });
const NOTES = [N('C', 4), N('D', 4), N('E', 4), N('F', 4), N('F', 4, 1), N('G', 4), N('A', 4), N('B', 4, -1), N('B', 4), N('C', 5), N('C', 5, 1), N('D', 5), N('E', 5, -1), N('E', 5), N('F', 5), N('G', 5), N('A', 5)];
const nKey = (n) => `${n.step}${n.oct}${n.acc || 0}`;
const AUDIO_MAX = 1.6 * 1024 * 1024;

/** معاينة سؤال كما سيظهر في اللعبة (اللوحة + الخيارات، والإجابة الصحيحة بإطار أخضر) */
export async function previewNode(q) {
  const box = el('div', { class: 'pv' });
  const ch = runtimeOf(normalize(q));
  if (!ch) { box.append(el('div', { class: 'warn' }, '⚠ السؤال غير مكتمل بعد')); return box; }
  box.append(el('div', { class: 'pq' }, `${ch.domainIcon} ${ch.prompt}`));
  if (ch.cue) { const c = el('div', { class: 'pc' }); c.append(el('img', { src: await signImage(ch.cue, 360, 150, { bg: '#fbfaf6' }), alt: '' })); box.append(c); }
  const po = el('div', { class: 'po' });
  for (let i = 0; i < ch.options.length; i++) po.append(el('img', { src: await signImage(ch.options[i].sign, 240, 140, { bg: '#fbfaf6' }), class: i === ch.answer ? 'ans' : '', alt: ch.options[i].label, title: ch.options[i].label }));
  box.append(po);
  if (ch.audio) box.append(el('div', { class: 'pa' }, '🔊 يُسمع المقطع الصوتي مع ظهور السؤال (ويمكن إعادته)'));
  if (ch.explain) box.append(el('div', { class: 'pe' }, `💡 ${ch.explain}`));
  return box;
}

export function openEditor(q0, { onSave, title } = {}) {
  const q = clone(q0);
  const s = sheet({ title: title || `${q.kind === 'gen' ? '🎼 تحدٍّ من المكتبة' : (KINDS[q.kind] || KINDS.text).icon + ' ' + (KINDS[q.kind] || KINDS.text).label}`, width: 860, cls: 'editor' });
  const left = el('div', { class: 'ecol' }), right = el('div', { class: 'ecol pvcol' });
  s.body.classList.add('two'); s.body.append(left, right);
  const probs = el('div', { class: 'probs' });
  const save = el('button', { class: 'btn pri' }, '✔ حفظ السؤال');
  let pvTok = 0;
  const refresh = async () => {
    const n = normalize(q), p = problems(n);
    probs.innerHTML = ''; if (p.length) probs.append(el('b', {}, '⚠ يحتاج إلى: '), p.join('، ')); probs.classList.toggle('hidden', !p.length);
    save.disabled = p.length > 0;
    const my = ++pvTok; const node = await previewNode(q); if (my === pvTok) { right.innerHTML = ''; right.append(el('label', { class: 'lbl' }, 'المعاينة كما تظهر للطلاب'), node); }
  };
  const field = (label, node, hint) => { const f = el('div', { class: 'field' }, el('label', {}, label), hint ? el('span', { class: 'hint' }, hint) : null, node); left.append(f); return f; };
  const area = (val, ph, rows, on) => { const t = el('textarea', { rows: rows || 2, placeholder: ph || '' }); t.value = val || ''; t.addEventListener('input', () => { on(t.value); refresh(); }); return t; };

  // ---- نص السؤال (كل الأنواع) ----
  field('نص السؤال', area(q.prompt, 'اكتب السؤال كما يقرؤه الطالب', 2, (v) => { q.prompt = v; }));

  if (q.kind === 'gen') {
    const d = DOMAIN[q.gen.domain];
    left.append(el('p', { class: 'hint' }, `مولّد من مكتبة التحديات الموسيقية (${d ? d.name : ''} – ${LEVELS[q.gen.level - 1].name}). الخيارات والإجابة محسوبة من بيانات موثّقة، ويمكنك تعديل نص السؤال والشرح فقط، أو طلب تحدٍّ آخر من النوع نفسه.`));
    left.append(el('button', { class: 'btn sm', onclick: () => { const n = genQuestion(q.gen.domain, q.gen.level, (Math.random() * 1e9) >>> 0); q.gen = n.gen; q.prompt = n.prompt; q.explain = n.explain; q.preview = n.preview; s.close(true); openEditor(q, { onSave, title }); } }, '🔄 تحدٍّ آخر من النوع نفسه'));
  } else if (q.kind === 'staff') {
    const modeSeg = el('div', { class: 'seg' });
    [['name', 'ما اسم النغمة المكتوبة؟'], ['where', 'أين تُكتب النغمة؟']].forEach(([k, t]) => { const b = el('button', { type: 'button', class: q.mode === k ? 'on' : '' }, t); b.onclick = () => { q.mode = k; [...modeSeg.children].forEach((x) => x.classList.toggle('on', x === b)); if (!q.prompt || /النغمة/.test(q.prompt)) { q.prompt = k === 'name' ? 'ما اسم النغمة المكتوبة على المدرج الظاهر أمامك؟' : 'أين تُكتب النغمة المكتوبة أمامك؟ اختر المسار الذي يحمل موضعها الصحيح على المدرج'; left.querySelector('textarea').value = q.prompt; } refresh(); }; modeSeg.append(b); });
    field('نوع السؤال', modeSeg, 'في «الاسم» تظهر النوتة مع السؤال والخيارات أسماء؛ وفي «الموضع» يظهر الاسم والخيارات نوتات على المدرج');
    const list = el('div', { class: 'optlist' });
    const paint = () => {
      list.innerHTML = '';
      q.choices.forEach((n, i) => {
        const sel = el('select'); NOTES.forEach((m) => sel.append(el('option', { value: nKey(m), selected: nKey(m) === nKey(n) }, noteName(m))));
        sel.onchange = () => { q.choices[i] = NOTES.find((m) => nKey(m) === sel.value); refresh(); };
        const r = el('input', { type: 'radio', name: 'ans', checked: q.answer === i, title: 'الإجابة الصحيحة' }); r.onchange = () => { q.answer = i; refresh(); };
        list.append(el('div', { class: 'orow' }, el('label', { class: 'okmark' }, r, 'صحيح'), sel, q.choices.length > 2 ? el('button', { class: 'btn sm ghost', onclick: () => { q.choices.splice(i, 1); if (q.answer >= q.choices.length) q.answer = 0; paint(); refresh(); } }, '✕') : null));
      });
      if (q.choices.length < 4) list.append(el('button', { class: 'btn sm', onclick: () => { const used = new Set(q.choices.map(nKey)); q.choices.push(NOTES.find((m) => !used.has(nKey(m)))); paint(); refresh(); } }, '＋ خيار'));
    };
    paint(); field('النغمات (حدّد الصحيحة)', list);
    const lis = el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !!q.listen, onchange: (e) => { q.listen = e.target.checked; refresh(); } }), ' تُسمع النغمة الصحيحة مع السؤال (بيانو)');
    left.append(lis);
  } else {
    // ---- وسائط حسب النوع ----
    if (q.kind === 'image') {
      const inp = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden' });
      const info = el('span', { class: 'hint' }, q.cue && q.cue.t === 'image' ? '✓ صورة مرفقة' : 'لم تُرفق صورة بعد');
      inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { q.cue = { t: 'image', src: await shrinkImage(f, 720) }; info.textContent = `✓ ${f.name}`; refresh(); } catch (e) { toast(e.message); } };
      field('الصورة (تظهر مع السؤال)', el('div', { class: 'row' }, el('button', { class: 'btn sm', onclick: () => inp.click() }, '🖼️ اختر صورة'), info, inp), 'تُصغَّر الصورة تلقائيًا وتُحفظ مع المسابقة على هذا الجهاز');
    }
    if (q.kind === 'audio') {
      const inp = el('input', { type: 'file', accept: 'audio/*', class: 'hidden' });
      const info = el('span', { class: 'hint' }, q.audio ? '✓ تسجيل مرفق' : 'لم يُرفق تسجيل بعد');
      const test = el('button', { class: 'btn sm ghost', onclick: () => { if (q.audio) new Audio(q.audio).play().catch(() => {}); } }, '▶ استمع');
      inp.onchange = async () => { const f = inp.files[0]; if (!f) return; if (f.size > AUDIO_MAX) { toast('الملف كبير؛ اختر مقطعًا أقصر (أقل من 1.5 ميجابايت تقريبًا).'); return; } q.audio = await readFileAs(f); info.textContent = `✓ ${f.name}`; refresh(); };
      field('التسجيل الصوتي (يُسمع مع السؤال)', el('div', { class: 'row' }, el('button', { class: 'btn sm', onclick: () => inp.click() }, '🔊 اختر ملفًا صوتيًا'), info, test, inp), 'MP3 أو WAV أو M4A، مقطع قصير');
    }
    // ---- الخيارات ----
    const list = el('div', { class: 'optlist' });
    const paint = () => {
      list.innerHTML = '';
      q.options.forEach((o, i) => {
        let input;
        if (o.t === 'text') { input = el('input', { type: 'text', maxlength: '80', placeholder: `الخيار ${AR(i + 1)}` }); input.value = o.text; input.oninput = () => { o.text = input.value; refresh(); }; }
        else if (o.t === 'rhythm') { input = el('select'); FIGURES.forEach((f) => input.append(el('option', { value: f.id, selected: o.ids.length === 1 && o.ids[0] === f.id }, f.name))); input.onchange = () => { o.ids = [input.value]; refresh(); }; }
        else if (o.t === 'inst') { input = el('select'); Object.entries(INSTRUMENTS).forEach(([k, I]) => input.append(el('option', { value: k, selected: o.id === k }, I.name))); input.onchange = () => { o.id = input.value; refresh(); }; }
        const r = el('input', { type: 'radio', name: 'ans', checked: q.answer === i }); r.onchange = () => { q.answer = i; refresh(); };
        list.append(el('div', { class: 'orow' }, el('label', { class: 'okmark' }, r, 'صحيح'), input,
          el('button', { class: 'btn sm ghost', title: 'أعلى', disabled: i === 0, onclick: () => { [q.options[i - 1], q.options[i]] = [q.options[i], q.options[i - 1]]; if (q.answer === i) q.answer = i - 1; else if (q.answer === i - 1) q.answer = i; paint(); refresh(); } }, '↑'),
          q.options.length > 2 ? el('button', { class: 'btn sm ghost', onclick: () => { q.options.splice(i, 1); if (q.answer === i) q.answer = 0; else if (q.answer > i) q.answer--; paint(); refresh(); } }, '✕') : null));
      });
      if (q.options.length < 4) list.append(el('button', { class: 'btn sm', onclick: () => { const t = q.options[0] ? q.options[0].t : 'text'; q.options.push(t === 'rhythm' ? { t, ids: ['w'] } : t === 'inst' ? { t, id: 'triangle' } : { t: 'text', text: '' }); paint(); refresh(); } }, '＋ خيار'));
    };
    paint();
    field('الخيارات (٢ إلى ٤ — حدّد الصحيح)', list, 'كل خيار يصبح مسارًا على الطريق ولافتة فوق الجسر');
    if (q.kind === 'rhythm' || q.kind === 'instrument') left.append(el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: q.listen !== false, onchange: (e) => { q.listen = e.target.checked; refresh(); } }), q.kind === 'rhythm' ? ' يُسمع الشكل الصحيح مع السؤال (مكررًا في مازورة رباعية)' : ' يُسمع صوت الآلة الصحيحة مع السؤال'));
  }
  field('الشرح بعد الإجابة (اختياري)', area(q.explain, 'جملة قصيرة تظهر بعد العبور', 2, (v) => { q.explain = v; }));
  left.append(probs);
  save.onclick = () => { const n = normalize(q); if (problems(n).length) return; onSave(n); s.close(true); };
  s.foot.append(save, el('button', { class: 'btn ghost', onclick: () => s.close(true) }, 'إلغاء'));
  refresh();
  return s;
}
