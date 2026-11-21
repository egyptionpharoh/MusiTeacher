// أدوات واجهة صغيرة مشتركة: أسماء الصفوف، إنشاء العناصر، الرسائل، النوافذ.
const GN = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
export const GRADE_NAME = (g) => (g >= 1 && g <= 12 ? `الصف ${GN[g - 1]}` : 'بدون صف');
export const SEM_NAME = (s) => (s === 2 ? 'الفصل الدراسي الثاني' : 'الفصل الدراسي الأول');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** إزالة التشكيل لتسهيل البحث */
export const plain = (s) => String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
export const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'الآن'; if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} ساعة`;
  return new Date(t).toLocaleDateString('ar-OM', { day: 'numeric', month: 'long' });
};

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}

let toastT;
export function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), ms);
}

/** نافذة منبثقة؛ تعيد دالة الإغلاق */
export function modal(content, { small = false, onClose } = {}) {
  const box = h('div', { class: `box${small ? ' sm' : ''}`, role: 'dialog', 'aria-modal': 'true' }, content);
  const m = h('div', { class: 'modal' }, box);
  const close = () => { m.remove(); document.removeEventListener('keydown', key); onClose && onClose(); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
  document.addEventListener('keydown', key);
  document.body.append(m);
  const f = box.querySelector('input,textarea,select,button.pri'); if (f) setTimeout(() => f.focus(), 30);
  return close;
}

export function ask(message, { ok = 'نعم', cancel = 'إلغاء', danger = false } = {}) {
  return new Promise((res) => {
    let close;
    const done = (v) => { res(v); close(); };
    close = modal(h('div', {}, h('p', { style: { fontSize: '1.1rem' } }, message),
      h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => done(false) }, cancel), h('button', { class: `btn ${danger ? 'danger' : 'pri'}`, onclick: () => done(true) }, ok))), { small: true, onClose: () => res(false) });
  });
}

export function prompt(message, value = '') {
  return new Promise((res) => {
    let close; const inp = h('input', { type: 'text', value });
    const done = (v) => { res(v); close(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(inp.value.trim()); });
    close = modal(h('div', {}, h('h3', {}, message), inp,
      h('div', { class: 'row end', style: { marginTop: '12px' } }, h('button', { class: 'btn', onclick: () => done(null) }, 'إلغاء'), h('button', { class: 'btn pri', onclick: () => done(inp.value.trim()) }, 'حفظ'))), { small: true, onClose: () => res(null) });
  });
}
