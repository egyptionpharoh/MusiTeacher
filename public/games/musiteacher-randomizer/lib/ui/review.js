// =====================================================================
//  مراجعة الأسئلة قبل الاعتماد: تعديل النص والخيارات والإجابة، النوع والصعوبة، صورة/صوت/رمز إيقاعي،
//  حذف وإضافة وإعادة توليد سؤال واحد، وترتيب الأسئلة. لا يُعتمد نشاط فيه سؤال غير مكتمل.
// =====================================================================
import { TYPES, LEVELS, normalize, problems, uid, symSVG } from '../core/model.js';
import { FIG, SINGLE_NOTES, RESTS, GROUPS } from '../notation/figures.js';
import { h, modal, toast, ask } from './text.js';

const blank = (type = 'MC') => normalize({ id: uid(), type, text: '', options: ['', '', '', ''], answer: type === 'TF' ? true : type === 'ORDER' ? [] : type === 'MC' ? 0 : '', level: 'medium', origin: 'manual' });

/** يحوّل السؤال إلى نوع آخر مع الاحتفاظ بما يمكن الاحتفاظ به */
function retype(q, t) {
  const n = { ...q, type: t }; delete n.options;
  const asText = q.type === 'MC' ? q.options[q.answer] || '' : q.type === 'TF' ? (q.answer ? 'صح' : 'خطأ') : Array.isArray(q.answer) ? q.answer.join('، ') : q.answer;
  if (t === 'MC') {
    if (q.type === 'MC') { n.options = q.options; n.answer = q.answer; }
    else if (q.type === 'TF') { n.options = ['صح', 'خطأ']; n.answer = q.answer ? 0 : 1; }
    else { n.options = [asText, '', '', '']; n.answer = 0; }
  } else if (t === 'TF') n.answer = true;
  else if (t === 'ORDER') n.answer = Array.isArray(q.answer) ? q.answer : [];
  else n.answer = asText;
  return normalize(n);
}

function readImage(file, max = 900) {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return rej(new Error('اختر صورة PNG أو JPG أو WebP.'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('تعذرت قراءة الصورة.')); };
    img.src = url;
  });
}
function readAudio(file) {
  return new Promise((res, rej) => {
    if (!/^audio\//.test(file.type)) return rej(new Error('اختر ملفًا صوتيًا (MP3 أو OGG أو WAV).'));
    if (file.size > 900 * 1024) return rej(new Error('الملف الصوتي كبير؛ الحد 900 كيلوبايت (يُحفظ على جهازك).'));
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('تعذرت قراءة الملف.')); r.readAsDataURL(file);
  });
}

function symPicker(q, done) {
  let cur = [...(q.sym || [])];
  const prev = h('div', { class: 'symbox', style: { minHeight: '60px', minWidth: '120px' } });
  const paint = () => { prev.innerHTML = cur.length ? symSVG(cur, 18, '#111') : '<span style="color:#777;padding:10px">لا توجد رموز</span>'; };
  const btn = (id) => h('button', { class: 'btn sm', title: FIG[id].name, onclick: () => { cur.push(id); paint(); } }, h('span', { class: 'symbox', html: symSVG([id], 10, '#111') }), FIG[id].name);
  let close;
  const body = h('div', {}, h('h3', {}, 'رموز إيقاعية تظهر مع السؤال'), h('p', { class: 'mute small' }, 'اضغط على الرمز لإضافته. مفيد لأسئلة «تعرّف على الرمز» و«كم زمنًا؟».'), prev,
    h('h3', { style: { marginTop: '10px' } }, 'العلامات'), h('div', { class: 'row' }, SINGLE_NOTES.map(btn)),
    h('h3', {}, 'السكتات'), h('div', { class: 'row' }, RESTS.map(btn)),
    h('h3', {}, 'الأشكال الإيقاعية'), h('div', { class: 'row' }, GROUPS.filter((g) => FIG[g]).map(btn)),
    h('div', { class: 'row end', style: { marginTop: '12px' } },
      h('button', { class: 'btn', onclick: () => { cur.pop(); paint(); } }, '↩ حذف الأخير'),
      h('button', { class: 'btn danger', onclick: () => { cur = []; paint(); } }, 'مسح الكل'),
      h('button', { class: 'btn pri', onclick: () => { close(); done(cur); } }, 'تم')));
  paint(); close = modal(body);
}

/**
 * @param {HTMLElement} root
 * @param {{questions:object[]}} draft
 * @param {{onChange:Function, onRegenerate?:(q)=>Promise<object|null>, canRegenerate?:boolean}} o
 */
export function renderReview(root, draft, o) {
  root.innerHTML = '';
  const changed = () => { o.onChange(draft); };
  const list = h('div', { class: 'list' });
  const head = h('div', { class: 'row' });
  root.append(head, list);

  const paintHead = () => {
    const bad = draft.questions.filter((q) => problems(q).length).length;
    head.innerHTML = '';
    head.append(h('b', {}, `عدد الأسئلة: ${draft.questions.length}`), bad ? h('span', { class: 'chip setup' }, `${bad} يحتاج إكمالًا`) : h('span', { class: 'chip ready' }, 'كل الأسئلة مكتملة'));
  };

  const card = (q, i) => {
    const el = h('div', { class: 'qedit' });
    const rerender = () => { const n = card(draft.questions[i], i); el.replaceWith(n); paintHead(); };
    const set = (patch, re = false) => { draft.questions[i] = normalize({ ...draft.questions[i], ...patch }); changed(); if (re) rerender(); else { const p = problems(draft.questions[i]); el.classList.toggle('bad', !!p.length); probs.textContent = p.join(' · '); paintHead(); } };
    const probs = h('div', { class: 'qprob' }, problems(q).join(' · '));
    if (problems(q).length) el.classList.add('bad');
    const typeSel = h('select', { 'aria-label': 'نوع السؤال', onchange: (e) => { draft.questions[i] = retype(draft.questions[i], e.target.value); changed(); rerender(); } }, Object.entries(TYPES).map(([k, v]) => h('option', { value: k, selected: k === q.type }, `${v.icon} ${v.label}`)));
    const lvlSel = h('select', { 'aria-label': 'الصعوبة', onchange: (e) => set({ level: e.target.value }) }, Object.entries(LEVELS).map(([k, v]) => h('option', { value: k, selected: k === q.level }, v)));
    const move = (d) => { const j = i + d; if (j < 0 || j >= draft.questions.length) return; [draft.questions[i], draft.questions[j]] = [draft.questions[j], draft.questions[i]]; changed(); render(); };
    const regen = o.onRegenerate && h('button', { class: 'btn sm', title: 'استبدال هذا السؤال بسؤال آخر من محتوى الدرس نفسه', onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      const n = await o.onRegenerate(draft.questions[i]);
      if (n) { draft.questions[i] = normalize({ ...n, id: uid() }); changed(); rerender(); toast('تم استبدال السؤال.'); } else { b.disabled = false; b.textContent = '🔄 إعادة توليد'; }
    } }, '🔄 إعادة توليد');
    el.append(h('div', { class: 'qhead' }, h('span', { class: 'qn' }, `${i + 1}.`), typeSel, lvlSel, h('span', { style: { flex: 1 } }),
      h('button', { class: 'btn sm icon', title: 'تحريك لأعلى', onclick: () => move(-1) }, '▲'), h('button', { class: 'btn sm icon', title: 'تحريك لأسفل', onclick: () => move(1) }, '▼'),
      regen, h('button', { class: 'btn sm danger', onclick: async () => { if (await ask('حذف هذا السؤال؟', { ok: 'حذف', danger: true })) { draft.questions.splice(i, 1); changed(); render(); } } }, '🗑 حذف')));
    const txt = h('textarea', { rows: 2, placeholder: 'اكتب نص السؤال…', oninput: (e) => set({ text: e.target.value }) }); txt.value = q.text;
    el.append(txt);
    // الإجابة حسب النوع
    if (q.type === 'MC') {
      const box = h('div', { class: 'list' });
      q.options.forEach((op, k) => {
        const inp = h('input', { type: 'text', placeholder: `الخيار ${k + 1}`, oninput: (e) => { const opts = [...draft.questions[i].options]; opts[k] = e.target.value; set({ options: opts }); } }); inp.value = op;
        box.append(h('div', { class: 'opt' }, h('input', { type: 'radio', name: `ans_${q.id}`, checked: k === q.answer, title: 'الإجابة الصحيحة', onchange: () => set({ answer: k }) }), inp,
          q.options.length > 2 && h('button', { class: 'btn sm ghost', title: 'حذف الخيار', onclick: () => { const opts = draft.questions[i].options.filter((_, x) => x !== k); let a = draft.questions[i].answer; if (a === k) a = 0; else if (a > k) a--; set({ options: opts, answer: a }, true); } }, '✕')));
      });
      el.append(h('div', { class: 'small mute' }, 'اختر الدائرة بجانب الإجابة الصحيحة:'), box);
      if (q.options.length < 6) el.append(h('div', {}, h('button', { class: 'btn sm', onclick: () => set({ options: [...draft.questions[i].options, ''] }, true) }, '+ خيار')));
    } else if (q.type === 'TF') {
      el.append(h('div', { class: 'seg' }, ['صح', 'خطأ'].map((t, k) => h('button', { class: (k === 0) === q.answer ? 'on' : '', onclick: () => set({ answer: k === 0 }, true) }, t))));
    } else if (q.type === 'ORDER') {
      const ta = h('textarea', { rows: 3, placeholder: 'اكتب العناصر بالترتيب الصحيح، كل عنصر في سطر', oninput: (e) => set({ answer: e.target.value.split('\n') }) }); ta.value = q.answer.join('\n');
      el.append(h('div', { class: 'small mute' }, 'العناصر بالترتيب الصحيح (تُعرض على الطلاب مخلوطة):'), ta);
    } else {
      const inp = h(q.type === 'OPEN' ? 'textarea' : 'input', { type: 'text', rows: 2, placeholder: q.type === 'OPEN' ? 'نموذج الإجابة (اختياري) للمعلم' : 'الإجابة الصحيحة', oninput: (e) => set({ answer: e.target.value }) }); inp.value = q.answer;
      el.append(h('div', { class: 'small mute' }, q.type === 'FILL' ? 'استخدم «…………» في النص مكان الفراغ.' : 'سؤال تطبيقي أو تفكيري: يقيّمه المعلم.'), inp);
    }
    // المرفقات
    const fileImg = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { set({ image: await readImage(f) }, true); } catch (err) { toast(err.message); } } });
    const fileAud = h('input', { type: 'file', accept: 'audio/*', class: 'hidden', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { set({ audio: await readAudio(f) }, true); } catch (err) { toast(err.message); } } });
    const media = h('div', { class: 'media' },
      q.sym && h('span', { class: 'symbox', html: symSVG(q.sym, 12, '#111') }),
      q.image && h('img', { src: q.image, alt: 'صورة السؤال' }),
      q.audio && h('audio', { controls: true, src: q.audio, style: { height: '34px' } }),
      h('button', { class: 'btn sm', onclick: () => symPicker(draft.questions[i], (s) => set({ sym: s }, true)) }, '🎼 رمز إيقاعي'),
      h('button', { class: 'btn sm', onclick: () => fileImg.click() }, q.image ? '🖼 تغيير الصورة' : '🖼 صورة'),
      q.image && h('button', { class: 'btn sm ghost', onclick: () => { const n = { ...draft.questions[i] }; delete n.image; draft.questions[i] = normalize(n); changed(); rerender(); } }, '✕ الصورة'),
      h('button', { class: 'btn sm', onclick: () => fileAud.click() }, q.audio ? '🔊 تغيير الصوت' : '🔊 صوت'),
      q.audio && h('button', { class: 'btn sm ghost', onclick: () => { const n = { ...draft.questions[i] }; delete n.audio; draft.questions[i] = normalize(n); changed(); rerender(); } }, '✕ الصوت'),
      fileImg, fileAud);
    el.append(media, probs);
    if (q.src) el.append(h('div', { class: 'src' }, `📖 من محتوى الدرس: «${q.src}»`));
    else if (q.origin === 'manual') el.append(h('div', { class: 'src' }, '✍️ سؤال أضافه المعلم'));
    return el;
  };

  const render = () => {
    list.innerHTML = '';
    if (!draft.questions.length) list.append(h('div', { class: 'empty' }, 'لا توجد أسئلة بعد. أضف سؤالًا يدويًا أو أنشئ أسئلة من محتوى الدرس.'));
    draft.questions.forEach((q, i) => list.append(card(q, i)));
    list.append(h('div', { class: 'row' }, h('span', { class: 'mute small' }, 'إضافة سؤال:'), Object.entries(TYPES).map(([k, v]) => h('button', { class: 'btn sm', onclick: () => { draft.questions.push(blank(k)); changed(); render(); list.lastElementChild.previousElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, `${v.icon} ${v.label}`))));
    paintHead();
  };
  render();
  return { render };
}
