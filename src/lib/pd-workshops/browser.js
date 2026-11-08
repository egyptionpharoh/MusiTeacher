// أدوات المتصفح: استدعاء الخادم، التخزين المحلي، التنزيل، الطباعة، والنسخ.

export const ls = {
  get(k, d) { try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

export class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

/** طلب للخادم مع رمز الدخول. getToken: async () => string|null */
export async function api(path, { body, getToken, signal, method } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (getToken) {
    const t = await getToken();
    if (!t) throw new ApiError('unauthenticated', 401);
    headers.Authorization = `Bearer ${t}`;
  }
  let res;
  try {
    res = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'same-origin', signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ApiError('aborted', 0);
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new ApiError(data.error || 'server-error', res.status);
  return data;
}

export function safeFileName(s, max = 70) {
  return String(s || 'مشغل').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || 'مشغل';
}

export function downloadBlob(data, name, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** طباعة وثيقة HTML كاملة في إطار معزول (لا تتأثر بأنماط المنصة). */
export function printHTML(html) {
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;inset-inline-start:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;';
    document.body.appendChild(f);
    const done = () => { setTimeout(() => { f.remove(); resolve(); }, 1500); };
    f.onload = () => {
      const w = f.contentWindow;
      const go = () => { try { w.focus(); w.print(); } catch { /* */ } done(); };
      if (w.document.fonts && w.document.fonts.ready) w.document.fonts.ready.then(() => setTimeout(go, 150)); else setTimeout(go, 300);
    };
    f.srcdoc = html;
  });
}

/** نسخ منسّق (HTML + نص) مع بدائل للمتصفحات الأقدم. */
export async function copyRich(text, html) {
  try {
    if (html && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([new window.ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([`<div dir="rtl">${html}</div>`], { type: 'text/html' }),
      })]);
      return true;
    }
  } catch { /* نجرب النص فقط */ }
  try { await navigator.clipboard.writeText(text); return true; } catch { /* */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
