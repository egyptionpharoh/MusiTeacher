// 📡 عميل الشبكة لمصنع الألحان: كل الطلبات تمر عبر خادم المنصة (المفاتيح لا تصل للمتصفح أبدًا).
export class ApiError extends Error {
  constructor(message, status = 0, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}

function decodeMeta(h) {
  if (!h) return {};
  try {
    const b64 = h.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch { return {}; }
}

export function createApi({ base = '/api/music-factory', getToken }) {
  async function request(action, { method = 'POST', body, signal } = {}) {
    const token = getToken ? await getToken() : null;
    if (!token) throw new ApiError('سجّل الدخول أولًا (أو حدّث الصفحة) لاستخدام هذه الخدمة.', 401);
    let res;
    try {
      res = await fetch(`${base}/${action}`, {
        method, signal,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new ApiError('تم إلغاء الطلب.', 0, { aborted: true });
      throw new ApiError('تعذر الاتصال بالخادم. تأكد من الإنترنت ثم حاول مرة أخرى.', 0);
    }
    return res;
  }

  async function json(action, opts) {
    const res = await request(action, opts);
    const data = await res.json().catch(() => null);
    if (!data) throw new ApiError(res.status === 504 ? 'انتهت مهلة الخادم.' : `رد غير متوقع من الخادم (${res.status}).`, res.status);
    if (!res.ok && !data.fallback) throw new ApiError(data.error || 'حدث خطأ.', res.status, data);
    return data;
  }

  return {
    status: (signal) => json('status', { method: 'GET', signal }),
    analyze: (project) => json('analyze', { body: { project } }),
    prompt: (project, analysis, variants = 3) => json('prompt', { body: { project, analysis, variants } }),
    refine: (project, current, instruction) => json('refine', { body: { project, current, instruction } }),
    /** يعيد { kind:'audio', blob, meta } أو { kind:'urls', tracks, meta } */
    async generate(payload, signal) {
      const res = await request('generate', { body: payload, signal });
      const type = res.headers.get('content-type') || '';
      if (res.ok && /^audio\//.test(type)) {
        const blob = await res.blob();
        if (blob.size < 1000) throw new ApiError('وصل ملف صوتي فارغ أو تالف من المحرك.', 502);
        return { kind: 'audio', blob, meta: decodeMeta(res.headers.get('x-mf-meta')) };
      }
      const data = await res.json().catch(() => null);
      if (!data) throw new ApiError(res.status === 504 ? 'انتهت مهلة الخادم قبل اكتمال التوليد. جرّب «معاينة 30 ثانية» أو مدة أقصر.' : `رد غير متوقع من الخادم (${res.status}).`, res.status);
      if (!res.ok || !data.ok) throw new ApiError(data.error || 'تعذر التوليد.', res.status, data);
      return { kind: 'urls', tracks: data.tracks || [], meta: data };
    },
  };
}
