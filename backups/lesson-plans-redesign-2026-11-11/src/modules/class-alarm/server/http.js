// 🌐 معالج HTTP واحد لخدمات «منبّه الحصص» الاختيارية (بمعايير Web Request/Response).
// لا يعرف شيئًا عن MusiTeacher: التحقق من المستخدم ومخزن المزامنة يُمرَّران من الخارج.
//   GET    status   → هل القراءة الذكية والمزامنة متاحتان؟
//   POST   extract  → قراءة جدول من صورة/PDF/نص
//   GET    sync     → نسخة جداول المستخدم المحفوظة في حسابه
//   POST   sync     → حفظ نسخة (الجداول والإعدادات فقط؛ النغمات لا تُرفع)
//   DELETE sync     → حذف النسخة من الحساب
import { aiStatus, extractSchedule } from './extract.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const MAX_EXTRACT_B64 = 4.4 * 1024 * 1024 * 1.34;
const MAX_SYNC_BYTES = 900 * 1024;

function makeLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const t = Date.now(), arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    arr.push(t); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > windowMs) hits.delete(k);
    return arr.length <= max;
  };
}

/** deps: { authorize(request), store?: { get(uid), put(uid, data, baseUpdatedAt), remove(uid) }, env?, fetchImpl? } */
export function createClassAlarmHandler(deps) {
  const env = deps.env || process.env;
  const extractLimit = makeLimiter(parseInt(env.CA_EXTRACT_RATE_LIMIT || '12', 10) || 12, 10 * 60 * 1000);
  const syncLimit = makeLimiter(60, 10 * 60 * 1000);
  const syncEnabled = () => !!deps.store && String(env.CA_SYNC_ENABLED || 'true').toLowerCase() !== 'false';

  return async function handle(request, action) {
    try {
      const a = await deps.authorize(request);
      if (!a || !a.ok) return json({ ok: false, error: (a && a.error) || 'غير مصرح.', code: (a && a.code) || 'unauthenticated' }, (a && a.status) || 401);

      if (action === 'status' && request.method === 'GET') {
        const ai = aiStatus(env);
        return json({ ok: true, ai: ai.enabled, sync: syncEnabled() });
      }

      if (action === 'extract' && request.method === 'POST') {
        if (!extractLimit(a.userId)) return json({ ok: false, code: 'rate-limited', error: 'طلبات قراءة كثيرة في وقت قصير. انتظر بضع دقائق.' }, 429);
        let b;
        try { b = await request.json(); } catch { return json({ ok: false, error: 'طلب غير صالح أو ملف كبير جدًا.' }, 400); }
        const kind = b && b.kind;
        let input;
        if (kind === 'text') {
          const text = typeof b.text === 'string' ? b.text.slice(0, 20000) : '';
          if (!text.trim()) return json({ ok: false, error: 'لا يوجد نص لقراءته.' }, 400);
          input = { kind, text };
        } else if (kind === 'image' || kind === 'pdf') {
          const mime = kind === 'pdf' ? 'application/pdf' : ['image/jpeg', 'image/png', 'image/webp'].includes(b.mime) ? b.mime : null;
          const data = typeof b.data === 'string' ? b.data : '';
          if (!mime || !data || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) return json({ ok: false, error: 'نوع الملف غير مدعوم.' }, 400);
          if (data.length > MAX_EXTRACT_B64) return json({ ok: false, error: 'الملف كبير جدًا.' }, 413);
          input = { kind, mime, data };
        } else return json({ ok: false, error: 'نوع الطلب غير معروف.' }, 400);
        const r = await extractSchedule(input, { env, fetchImpl: deps.fetchImpl || fetch });
        if (!r.ok) return json({ ok: false, code: r.code, error: r.error }, r.status || 500);
        return json(r);
      }

      if (action === 'sync') {
        if (!syncEnabled()) return json({ ok: false, code: 'disabled', error: 'المزامنة غير مفعّلة على الخادم.' }, 503);
        if (!syncLimit(a.userId)) return json({ ok: false, code: 'rate-limited', error: 'محاولات مزامنة كثيرة. انتظر قليلًا.' }, 429);
        if (request.method === 'GET') {
          const doc = await deps.store.get(a.userId);
          return json({ ok: true, store: doc ? doc.data : null, updatedAt: doc ? doc.updatedAt : 0 });
        }
        if (request.method === 'DELETE') { await deps.store.remove(a.userId); return json({ ok: true }); }
        if (request.method === 'POST') {
          const raw = await request.text();
          if (raw.length > MAX_SYNC_BYTES) return json({ ok: false, error: 'بيانات الجداول أكبر من المسموح للمزامنة (احذف شعار المدرسة أو جداول قديمة).' }, 413);
          let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: 'طلب غير صالح.' }, 400); }
          const s = b && b.store;
          if (!s || typeof s !== 'object' || !Array.isArray(s.profiles) || s.profiles.length > 20) return json({ ok: false, error: 'بيانات غير صالحة.' }, 400);
          const updatedAt = Date.now();
          await deps.store.put(a.userId, s, updatedAt);
          return json({ ok: true, updatedAt });
        }
      }
      return json({ ok: false, error: 'مسار غير معروف.' }, 404);
    } catch (e) {
      console.error('[class-alarm] handler:', e && e.message);
      return json({ ok: false, error: 'حدث خطأ غير متوقع في الخادم.' }, 500);
    }
  };
}
