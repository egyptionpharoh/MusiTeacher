// =====================================================================
//  محرّر «+ أنشئ تمرينًا خاصًا بي»: شبكة مرئية بالموازير والنبضات.
//  أدوات: دُم · تك · كا (إن كانت للآلة) · سكتة · نبر ‹>›. استماع أثناء التحرير، وتمديد بالتكرار، وحفظ باسم.
// =====================================================================
import { METERS, RES, emptyGrid, gridToPattern } from '../data/store.js';
import { unitsPerBeat, unitsPerBar, buildPiece } from '../data/rhythms.js';
import { renderNotation } from '../notation/notation.js';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]); } for (const c of kids.flat()) if (c != null) e.append(c); return e; };
const LBL = { D: 'دُم', T: 'تك', K: 'كا' };

/**
 * ctx: { root, ex (تمرين للتعديل أو null), hasKa, instName, onSave(ex) → {ok, msg}, play(def, onPos), stop(), playing() }
 */
export function openEditor(ctx) {
  const root = ctx.root;
  const ex = ctx.ex ? JSON.parse(JSON.stringify(ctx.ex)) : { id: null, name: '', meter: [4, 4], res: 2, bpm: 84, bars: emptyGrid([4, 4], 2, 1) };
  let tool = 'D', dirty = false, cellEls = [];
  const err = h('div', { class: 'err', role: 'alert' });
  const prev = h('div', { class: 'prev scorebox' });
  const grid = h('div', { class: 'grid' });

  const meterSel = h('select', { 'aria-label': 'الميزان', onchange: (e) => { const m = METERS[+e.target.value]; if (!confirmReset()) { meterSel.value = String(METERS.findIndex((q) => q[0] === ex.meter[0] && q[1] === ex.meter[1])); return; } ex.meter = m; if (m[1] === 8 && ex.res === 4) ex.res = 2; ex.bars = emptyGrid(m, ex.res, 1); syncRes(); draw(); } },
    METERS.map((m, i) => h('option', { value: String(i) }, `${m[0]}/${m[1]}`)));
  meterSel.value = String(METERS.findIndex((q) => q[0] === ex.meter[0] && q[1] === ex.meter[1]));
  const resSel = h('select', { 'aria-label': 'أصغر قيمة زمنية في الشبكة', onchange: (e) => { const r = +e.target.value; const nb = regrid(ex, r); if (!nb) { if (!confirm('بعض الضربات لا تقع على خانات القيمة الجديدة وستُمسح الشبكة. متابعة؟')) { resSel.value = String(ex.res); return; } ex.bars = emptyGrid(ex.meter, r, ex.bars.length); } else ex.bars = nb; ex.res = r; draw(); } });
  function syncRes() { resSel.replaceChildren(...[4, 2, 1].filter((r) => !(ex.meter[1] === 8 && r === 4)).map((r) => h('option', { value: String(r) }, RES[r]))); resSel.value = String(ex.res); }
  syncRes();
  const name = h('input', { type: 'text', value: ex.name, placeholder: 'اسم التمرين', 'aria-label': 'اسم التمرين', maxlength: '60', oninput: (e) => { ex.name = e.target.value; dirty = true; } });
  const bpm = h('input', { type: 'range', min: '40', max: '180', step: '2', value: String(ex.bpm), 'aria-label': 'السرعة', oninput: (e) => { ex.bpm = +e.target.value; bpmOut.textContent = e.target.value; } });
  const bpmOut = h('output', {}, String(ex.bpm));

  const tools = h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'أدوات الشبكة' });
  const TOOLS = [['D', '● دُم', 'dum'], ['T', '○ تك', 'tak'], ...(ctx.hasKa ? [['K', '◌ كا', 'ka']] : []), ['R', '𝄽 سكتة', ''], ['ACC', '> نبر', '']];
  function drawTools() { tools.replaceChildren(...TOOLS.map(([k, l, c]) => h('button', { class: c, 'aria-pressed': String(tool === k), title: k === 'ACC' ? 'انقر خانة فيها ضربة لإضافة النبر أو إزالته' : '', onclick: () => { tool = k; drawTools(); } }, l))); }
  drawTools();

  function confirmReset() { return !ex.bars.flat().some(Boolean) || confirm('تغيير الميزان يمسح الشبكة الحالية. متابعة؟'); }
  function apply(bi, ci) {
    const c = ex.bars[bi][ci];
    if (tool === 'ACC') { if (c && c.k) c.acc = !c.acc; }
    else if (tool === 'R') ex.bars[bi][ci] = null;
    else ex.bars[bi][ci] = { k: tool, acc: c && c.k ? c.acc : false };
    dirty = true; draw();
    const n = ex.bars[bi][ci]; if (n && n.k && ctx.audition) ctx.audition(n.k, n.acc);
  }
  function draw() {
    err.textContent = '';
    const per = unitsPerBeat(ex.meter) / ex.res;
    cellEls = [];
    grid.replaceChildren(...ex.bars.map((bar, bi) => {
      const beats = [];
      for (let b = 0; b < bar.length / per; b++) beats.push(h('div', { class: 'gbeat' }, bar.slice(b * per, b * per + per).map((c, k) => {
        const ci = b * per + k, el = h('button', { class: 'gcell' + (c && c.k ? ' ' + c.k : ''), 'aria-label': `مازورة ${bi + 1}، خانة ${ci + 1}: ${c && c.k ? LBL[c.k] + (c.acc ? ' منبورة' : '') : 'سكتة'}`, onclick: () => apply(bi, ci) },
          c && c.k ? LBL[c.k] : '·', c && c.acc ? h('span', { class: 'acc' }, '>') : null);
        cellEls.push({ el, u: bi * unitsPerBar(ex.meter) + ci * ex.res }); return el;
      })));
      return h('div', { class: 'gbar' }, h('span', { class: 'bn' }, `م${bi + 1}`), ...beats,
        h('div', { class: 'bctl' },
          h('button', { title: 'نسخ هذه المازورة بعدها', onclick: () => { ex.bars.splice(bi + 1, 0, JSON.parse(JSON.stringify(bar))); dirty = true; draw(); } }, 'نسخ ⇢'),
          h('button', { title: 'حذف المازورة', onclick: () => { if (ex.bars.length < 2) return; ex.bars.splice(bi, 1); dirty = true; draw(); } }, 'حذف')));
    }));
    try {
      if (ex.bars.flat().some((c) => c && c.k)) { const pc = buildPiece({ meter: ex.meter, p: gridToPattern(ex) }); renderNotation(prev, pc, { label: ctx.instName }); }
      else prev.innerHTML = '<p style="color:#5b4c39;margin:8px">اختر أداة ثم انقر الخانات لبناء التمرين؛ تظهر المدوّنة هنا مباشرة.</p>';
    } catch (e) { prev.textContent = ''; err.textContent = 'تعذّر تحويل الشبكة إلى مدوّنة: ' + e.message; }
  }
  const listenBtn = h('button', { class: 'btn primary', onclick: () => {
    if (ctx.playing()) { ctx.stop(); listenBtn.textContent = '▶ استمع'; return; }
    if (!ex.bars.flat().some((c) => c && c.k)) { err.textContent = 'أضف ضربة واحدة على الأقل.'; return; }
    listenBtn.textContent = '■ إيقاف';
    ctx.play({ id: '__draft', name: ex.name || 'مسودة', meter: ex.meter, bpm: ex.bpm, p: gridToPattern(ex) }, (pos) => {
      for (const c of cellEls) c.el.classList.toggle('play', pos != null && pos >= c.u && pos < c.u + ex.res);
      if (pos == null && !ctx.playing()) listenBtn.textContent = '▶ استمع';
    });
  } }, '▶ استمع');
  function close(force) {
    if (!force && dirty && !confirm('لم تحفظ التعديلات. إغلاق المحرّر دون حفظ؟')) return;
    ctx.stop(); root.classList.add('hidden'); root.replaceChildren(); removeEventListener('keydown', onKey); if (ctx.onClose) ctx.onClose();
  }
  function onKey(e) { if (e.key === 'Escape') close(false); }
  addEventListener('keydown', onKey);
  const save = () => {
    if (!ex.name.trim()) { err.textContent = 'اكتب اسمًا للتمرين قبل الحفظ.'; name.focus(); return; }
    if (!ex.bars.flat().some((c) => c && c.k)) { err.textContent = 'التمرين فارغ: أضف ضربة واحدة على الأقل.'; return; }
    const r = ctx.onSave(JSON.parse(JSON.stringify({ ...ex, name: ex.name.trim() })));
    if (!r.ok) { err.textContent = r.msg; return; }
    dirty = false; close(true);
  };
  const panel = h('div', { class: 'ed' },
    h('h2', { id: 'ed-title' }, ctx.ex ? 'تعديل تمريني' : '+ أنشئ تمرينًا خاصًا بي'),
    h('div', { class: 'fields' }, h('label', {}, 'الاسم', name), h('label', {}, 'الميزان', meterSel), h('label', {}, 'أصغر قيمة', resSel), h('label', {}, 'السرعة', bpm, bpmOut)),
    tools, grid,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { ex.bars.push(emptyGrid(ex.meter, ex.res, 1)[0]); dirty = true; draw(); } }, '+ مازورة فارغة'),
      h('button', { class: 'btn', onclick: () => { if (ex.bars.length * 2 > 16) { err.textContent = 'الحد الأقصى 16 مازورة.'; return; } ex.bars = ex.bars.concat(JSON.parse(JSON.stringify(ex.bars))); dirty = true; draw(); } }, '⟳ كرّر كل الموازير'),
      h('button', { class: 'btn danger', onclick: () => { if (confirm('مسح كل الخانات؟')) { ex.bars = emptyGrid(ex.meter, ex.res, ex.bars.length); dirty = true; draw(); } } }, 'مسح الشبكة')),
    prev, err,
    h('div', { class: 'actions' }, listenBtn, h('button', { class: 'btn', onclick: () => close(false) }, 'إلغاء'), h('button', { class: 'btn primary', onclick: save }, '💾 حفظ')));
  root.replaceChildren(panel); root.classList.remove('hidden'); draw(); name.focus();
  return { close };
}

/** تحويل الشبكة إلى دقة أخرى إن أمكن دون فقد */
function regrid(ex, r) {
  const upbar = unitsPerBar(ex.meter);
  const out = ex.bars.map(() => Array.from({ length: upbar / r }, () => null));
  for (let bi = 0; bi < ex.bars.length; bi++) for (let ci = 0; ci < ex.bars[bi].length; ci++) {
    const c = ex.bars[bi][ci]; if (!c || !c.k) continue; const u = ci * ex.res; if (u % r) return null; out[bi][u / r] = c;
  }
  return out;
}
