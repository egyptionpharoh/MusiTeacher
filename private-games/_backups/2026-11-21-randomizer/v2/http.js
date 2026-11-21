// 🌐 خدمة «عجلة الاختيار العشوائي — مكتبة الدروس التفاعلية» على الخادم.
//   GET status   → هل التوليد الذكي متاح؟
//   POST generate → أسئلة من محتوى الدرس (لا يُقبل أي حقل أسماء طلاب، ولا يُحفظ المحتوى لدينا)
// كل الطلبات تمر بالتحقق من حساب MusiTeacher (نفس الموقع + رمز Firebase + الاشتراك) مع حد للمحاولات.
import { aiStatusOf, validateInput } from '../../shared/ai/structured.js';
import { generateQuiz } from './generate.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function limiter(max, ms) { const h = new Map(); return (k) => { const t = Date.now(); const a = (h.get(k) || []).filter((x) => t - x < ms); a.push(t); h.set(k, a); return a.length <= max; }; }
const MAX_BODY = 6.5 * 1024 * 1024;

export function createRandomizerHandler(deps) {
  const env = deps.env || process.env;
  const genLimit = limiter(parseInt(env.RZ_GENERATE_RATE_LIMIT || '20', 10) || 20, 10 * 60 * 1000);
  return async function handle(request, action) {
    try {
      const a = await deps.authorize(request);
      if (!a || !a.ok) return json({ ok: false, error: (a && a.error) || 'غير مصرح.', code: (a && a.code) || 'unauthenticated' }, (a && a.status) || 401);
      if (action === 'status' && request.method === 'GET') return json({ ok: true, ai: aiStatusOf(env).enabled });
      if (action === 'generate' && request.method === 'POST') {
        if (!genLimit(a.userId)) return json({ ok: false, code: 'rate-limited', error: 'محاولات كثيرة خلال وقت قصير. انتظر بضع دقائق ثم حاول مرة أخرى.' }, 429);
        const raw = await request.text();
        if (raw.length > MAX_BODY) return json({ ok: false, error: 'محتوى الدرس كبير جدًا. أرسل صفحات الدرس فقط.' }, 413);
        let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: 'طلب غير صالح.' }, 400); }
        if (!b || typeof b !== 'object') return json({ ok: false, error: 'طلب غير صالح.' }, 400);
        const v = validateInput(b.input);
        if (v.error) return json({ ok: false, error: v.error === 'لا يوجد نص لقراءته.' ? 'لا يوجد محتوى للدرس. الصق نص الدرس أو ارفع صفحته، أو أنشئ الأسئلة يدويًا.' : v.error, code: 'no_content' }, v.status || 400);
        if (v.input.kind === 'text' && v.input.text.trim().length < 60) return json({ ok: true, questions: [], insufficient: true, message: 'محتوى الدرس قصير جدًا لإنشاء أسئلة موثوقة. أضف نصًا أكثر أو أنشئ الأسئلة يدويًا.', dropped: 0 });
        const r = await generateQuiz({ grade: b.grade, lesson: b.lesson, count: b.count, types: b.types, avoid: b.avoid, input: v.input }, { env, fetchImpl: deps.fetchImpl || fetch });
        return r.ok ? json(r) : json({ ok: false, code: r.code, error: r.error }, r.status || 500);
      }
      return json({ ok: false, error: 'مسار غير معروف.' }, 404);
    } catch (e) {
      console.error('[randomizer]', e);
      return json({ ok: false, error: 'خطأ غير متوقع في الخادم.' }, 500);
    }
  };
}
