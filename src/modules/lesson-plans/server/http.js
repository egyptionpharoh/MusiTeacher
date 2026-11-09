// 🌐 خدمات «الخطط الفصلية» الاختيارية: القراءة الذكية للملفات + المزامنة مع حساب المعلم.
//   GET status  • POST extract  • GET/POST/DELETE sync
// كل الطلبات تمر بالتحقق من الحساب، وكل معلم لا يصل إلا لمستنده (uid) فقط.
import { aiStatusOf, validateInput } from '../../shared/ai/structured.js';
import { extractPlan } from './extract.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const MAX_SYNC_BYTES = 3 * 1024 * 1024;
function limiter(max, ms) { const h = new Map(); return (k) => { const t = Date.now(); const a = (h.get(k) || []).filter((x) => t - x < ms); a.push(t); h.set(k, a); return a.length <= max; }; }

export function createLessonPlansHandler(deps) {
  const env = deps.env || process.env;
  const exLimit = limiter(parseInt(env.LP_EXTRACT_RATE_LIMIT || '10', 10) || 10, 10 * 60 * 1000);
  const syncLimit = limiter(90, 10 * 60 * 1000);
  const syncOn = () => !!deps.store && String(env.LP_SYNC_ENABLED || 'true').toLowerCase() !== 'false';
  return async function handle(request, action) {
    try {
      const a = await deps.authorize(request);
      if (!a || !a.ok) return json({ ok: false, error: (a && a.error) || 'غير مصرح.', code: (a && a.code) || 'unauthenticated' }, (a && a.status) || 401);
      if (action === 'status' && request.method === 'GET') return json({ ok: true, ai: aiStatusOf(env).enabled, sync: syncOn() });
      if (action === 'extract' && request.method === 'POST') {
        if (!exLimit(a.userId)) return json({ ok: false, code: 'rate-limited', error: 'طلبات قراءة كثيرة في وقت قصير. انتظر بضع دقائق.' }, 429);
        let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'طلب غير صالح أو ملف كبير جدًا.' }, 400); }
        const v = validateInput(b);
        if (v.error) return json({ ok: false, error: v.error }, v.status || 400);
        const r = await extractPlan(v.input, { env, fetchImpl: deps.fetchImpl || fetch });
        return r.ok ? json(r) : json({ ok: false, code: r.code, error: r.error }, r.status || 500);
      }
      if (action === 'sync') {
        if (!syncOn()) return json({ ok: false, code: 'disabled', error: 'المزامنة غير مفعّلة على الخادم.' }, 503);
        if (!syncLimit(a.userId)) return json({ ok: false, code: 'rate-limited', error: 'محاولات مزامنة كثيرة. انتظر قليلًا.' }, 429);
        if (request.method === 'GET') { const d = await deps.store.get(a.userId); return json({ ok: true, ws: d ? d.data : null, updatedAt: d ? d.updatedAt : 0 }); }
        if (request.method === 'DELETE') { await deps.store.remove(a.userId); return json({ ok: true }); }
        if (request.method === 'POST') {
          const raw = await request.text();
          if (raw.length > MAX_SYNC_BYTES) return json({ ok: false, error: 'بيانات الخطط أكبر من المسموح للمزامنة.' }, 413);
          let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: 'طلب غير صالح.' }, 400); }
          const ws = b && b.ws;
          if (!ws || typeof ws !== 'object' || !Array.isArray(ws.plans) || !Array.isArray(ws.assignments) || !Array.isArray(ws.log)) return json({ ok: false, error: 'بيانات غير صالحة.' }, 400);
          // حماية من الكتابة فوق نسخة أحدث من جهاز آخر: يرسل المتصفح آخر نسخة رآها
          if (b.baseUpdatedAt != null) { const cur = await deps.store.get(a.userId); if (cur && cur.updatedAt > +b.baseUpdatedAt) return json({ ok: false, code: 'conflict', error: 'توجد نسخة أحدث في حسابك من جهاز آخر.', updatedAt: cur.updatedAt }, 409); }
          const updatedAt = Date.now();
          await deps.store.put(a.userId, ws, updatedAt);
          return json({ ok: true, updatedAt });
        }
      }
      return json({ ok: false, error: 'مسار غير معروف.' }, 404);
    } catch (e) {
      console.error('[lesson-plans] handler:', e && e.message);
      return json({ ok: false, error: 'حدث خطأ غير متوقع في الخادم.' }, 500);
    }
  };
}
