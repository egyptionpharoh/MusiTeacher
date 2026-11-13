// 📡 عميل الخادم: قراءة الجداول بالذكاء الاصطناعي + المزامنة الاختيارية مع حساب المعلم.
// الأداة تعمل بالكامل بدون الخادم؛ هذه الخدمات إضافات اختيارية.
export class ApiError extends Error {
  constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
}

export function createApi({ base = '/api/class-alarm', getToken }) {
  async function call(action, { method = 'POST', body, signal } = {}) {
    const token = getToken ? await getToken() : null;
    if (!token) throw new ApiError('سجّل الدخول أولًا (أو حدّث الصفحة) لاستخدام هذه الخدمة.', 401, 'unauthenticated');
    let res;
    try {
      res = await fetch(`${base}/${action}`, { method, signal, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new ApiError('تم الإلغاء.', 0, 'aborted');
      throw new ApiError('تعذر الاتصال بالخادم. تأكد من الإنترنت ثم حاول مرة أخرى.', 0, 'network');
    }
    let data = null;
    try { data = await res.json(); } catch { /* */ }
    if (!res.ok || !data || data.ok === false) {
      const msg = (data && data.error) || (res.status === 413 ? 'الملف كبير جدًا. صغّر الصورة أو قسّم الملف.' : `حدث خطأ في الخادم (${res.status}).`);
      throw new ApiError(msg, res.status, data && data.code);
    }
    return data;
  }
  return {
    status: () => call('status', { method: 'GET' }),
    extract: (payload, signal) => call('extract', { body: payload, signal }),
    pull: () => call('sync', { method: 'GET' }),
    push: (store, baseUpdatedAt) => call('sync', { body: { store, baseUpdatedAt } }),
    remove: () => call('sync', { method: 'DELETE' }),
  };
}
