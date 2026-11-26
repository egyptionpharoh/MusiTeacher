// أدوات واجهة صغيرة مشتركة (عناصر، أرقام عربية، نوافذ، رسائل)
export const $ = (s, r = document) => r.querySelector(s);
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
export const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const fmtT = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return AR(`${m}:${String(r).padStart(2, '0')}`); };
export const pctText = (ok, total) => `${AR(ok)}/${AR(total)} – ${AR(total ? Math.round((ok / total) * 100) : 0)}٪`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastT;
export function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), ms);
}
/** نافذة: يعيد { m, sheet, body, foot, close } */
export function sheet({ title, sub, width, cls = '', onClose, light = false } = {}) {
  const m = el('div', { class: 'modal' + (light ? ' light' : '') });
  const sh = el('div', { class: 'sheet ' + cls, role: 'dialog', 'aria-modal': 'true', style: width ? { width: `min(${width}px,100%)` } : null });
  const head = el('header', {}, el('h2', {}, title || ''), sub ? el('span', { class: 'hsub' }, sub) : null);
  const x = el('button', { class: 'x', 'aria-label': 'إغلاق', onclick: () => close() }, '✕'); head.append(x);
  const body = el('div', { class: 'body1' }), foot = el('footer');
  sh.append(head, body, foot); m.append(sh); document.body.append(m);
  const key = (e) => { if (e.key !== 'Escape') return; const all = document.querySelectorAll('.modal'); if (all[all.length - 1] !== m) return; e.stopImmediatePropagation(); close(); };
  document.addEventListener('keydown', key, true);
  let closed = false;
  function close(force) {
    if (closed) return;
    if (!force && onClose && onClose() === false) return;
    closed = true; m.remove(); document.removeEventListener('keydown', key, true);
  }
  return { m, sheet: sh, body, foot, close, head };
}
export function confirmBox(text, { yes = 'نعم', no = 'إلغاء', danger = false } = {}) {
  return new Promise((res) => {
    const s = sheet({ title: 'تأكيد', width: 440, onClose: () => { res(false); } });
    s.body.append(el('p', { style: { lineHeight: 1.8, whiteSpace: 'pre-line' } }, text));
    s.foot.append(el('button', { class: 'btn ' + (danger ? 'danger' : 'pri'), onclick: () => { s.close(true); res(true); } }, yes), el('button', { class: 'btn ghost', onclick: () => { s.close(true); res(false); } }, no));
  });
}
export function seg(items, cur, on) {
  const s = el('div', { class: 'seg' });
  for (const it of items) {
    const b = el('button', { type: 'button', class: String(it.id) === String(cur) ? 'on' : '', html: it.html });
    b.onclick = () => { for (const x of s.children) x.classList.remove('on'); b.classList.add('on'); on(it.id); };
    s.append(b);
  }
  return s;
}
export function toggle(label, on, cb) {
  const b = el('button', { type: 'button', class: 'tgl' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on) }, el('i'), label);
  b.onclick = () => { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); cb(on); };
  return b;
}
export function readFileAs(file, how = 'dataURL') {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('تعذّرت قراءة الملف.')); if (how === 'text') r.readAsText(file); else r.readAsDataURL(file); });
}
/** يصغّر صورة إلى عرض أقصى ويعيدها JPEG/PNG (dataURL) */
export async function shrinkImage(file, max = 720) {
  const url = await readFileAs(file);
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('صورة غير صالحة')); i.src = url; });
  const s = Math.min(1, max / Math.max(im.width, im.height));
  const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
