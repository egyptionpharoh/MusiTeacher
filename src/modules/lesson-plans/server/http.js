// 🌐 خدمات «الخطط الفصلية» الاختيارية: القراءة الذكية للملفات + المزامنة مع حساب المعلم + الخطط المقترحة + «صفوفي».
//   GET status  • POST extract  • GET/POST/DELETE sync  • GET/POST prefs
//   GET suggested (للجميع) • GET suggested-file?id (للجميع) • POST/PATCH/DELETE suggested (للأدمن فقط)
// كل الطلبات تمر بالتحقق من الحساب، وكل معلم لا يصل إلا لمستنده (uid) فقط.
import { aiStatusOf, validateInput } from '../../shared/ai/structured.js';
import { extractPlan } from './extract.js';
import { validateUpload, normalizeMeta, publicItem } from './suggested.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const MAX_SYNC_BYTES = 3 * 1024 * 1024;
// Buffer عادي (ذاكرة) أو Binary من MongoDB (lean)
const binOf = (x) => (Buffer.isBuffer(x) ? x : x && x.buffer ? Buffer.from(x.buffer) : Buffer.alloc(0));
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
      if (action === 'status' && request.method === 'GET') return json({ ok: true, ai: aiStatusOf(env).enabled, sync: syncOn(), admin: !!a.admin, suggested: !!deps.suggested, prefs: !!deps.prefs });
      if (action === 'prefs') {
        if (!deps.prefs) return json({ ok: false, code: 'disabled', error: 'حفظ الإعدادات في الحساب غير متاح على الخادم.' }, 503);
        if (!syncLimit(a.userId)) return json({ ok: false, code: 'rate-limited', error: 'محاولات كثيرة. انتظر قليلًا.' }, 429);
        if (request.method === 'GET') { const d = await deps.prefs.get(a.userId); return json({ ok: true, grades: d ? d.grades || [] : null, updatedAt: d ? d.updatedAt || 0 : 0 }); }
        if (request.method === 'POST') {
          let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'طلب غير صالح.' }, 400); }
          if (!b || !Array.isArray(b.grades) || b.grades.length > 12) return json({ ok: false, error: 'بيانات غير صالحة.' }, 400);
          const grades = [...new Set(b.grades.map((g) => Math.round(+g)).filter((g) => g >= 1 && g <= 12))].sort((x, y) => x - y);
          const updatedAt = Date.now();
          await deps.prefs.put(a.userId, grades, updatedAt);
          return json({ ok: true, grades, updatedAt });
        }
      }
      if (action === 'suggested' || action === 'suggested-file') {
        if (!deps.suggested) return json({ ok: false, code: 'disabled', error: 'الخطط المقترحة غير متاحة حاليًا على الخادم.' }, 503);
        const id = new URL(request.url).searchParams.get('id') || '';
        if (request.method === 'GET' && action === 'suggested') {
          const all = await deps.suggested.list();
          // سجلات kind:'hide' = خطط من المكتبة المدمجة أخفاها الأدمن عن المعلمين (لا تُحذف الملفات المنشورة مع التطبيق)
          return json({ ok: true, items: all.filter((d) => d.kind !== 'hide').map(publicItem), hiddenLib: all.filter((d) => d.kind === 'hide').map((d) => d.libId) });
        }
        if (request.method === 'GET' && action === 'suggested-file') {
          const d = id && await deps.suggested.get(id);
          if (!d || d.kind === 'hide') return json({ ok: false, error: 'الخطة غير موجودة (ربما حذفها الأدمن).' }, 404);
          return json({ ok: true, fileName: d.fileName, mime: d.mime, b64: binOf(d.data).toString('base64') });
        }
        // الإضافة والتعديل والحذف: للأدمن فقط (التحقق على الخادم، لا يكفي إخفاء الأزرار)
        if (!a.admin) return json({ ok: false, code: 'forbidden', error: 'إدارة الخطط المقترحة متاحة للأدمن فقط.' }, 403);
        if (action !== 'suggested') return json({ ok: false, error: 'مسار غير معروف.' }, 404);
        // إخفاء/إظهار خطة من المكتبة المدمجة: DELETE ?id=lib-… يخفيها، و PATCH ?id=lib-… {restore:true} يعيدها
        if (/^lib-g\d{2}-s[12]$/.test(id)) {
          if (request.method === 'DELETE') { await deps.suggested.put({ _id: `hide:${id}`, kind: 'hide', libId: id, uploadedBy: a.userId, updatedAt: Date.now() }); return json({ ok: true, hidden: id }); }
          if (request.method === 'PATCH') { await deps.suggested.remove(`hide:${id}`); return json({ ok: true, restored: id }); }
        }
        if (request.method === 'DELETE') { if (!id || !(await deps.suggested.remove(id))) return json({ ok: false, error: 'الخطة غير موجودة.' }, 404); return json({ ok: true }); }
        if (request.method === 'POST' || request.method === 'PATCH') {
          const raw = await request.text();
          if (raw.length > MAX_SYNC_BYTES) return json({ ok: false, error: 'حجم الملف أكبر من 2 ميجابايت.' }, 413);
          let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: 'طلب غير صالح.' }, 400); }
          const now = Date.now();
          if (request.method === 'PATCH') {
            if (!id) return json({ ok: false, error: 'حدد الخطة.' }, 400);
            const cur = await deps.suggested.get(id);
            if (!cur) return json({ ok: false, error: 'الخطة غير موجودة.' }, 404);
            const v = validateUpload({ meta: { ...normalizeMeta(cur), ...(b && b.meta) }, file: b && b.file }, { requireFile: false });
            if (v.error) return json({ ok: false, error: v.error }, v.status || 400);
            const set = { ...v.meta, updatedAt: now, uploadedBy: a.userId };
            if (v.file) Object.assign(set, { fileName: v.file.name, mime: v.file.mime, size: v.file.size, data: v.file.data });
            await deps.suggested.patch(id, set);
            return json({ ok: true, item: publicItem({ ...cur, ...set, _id: id }) });
          }
          const v = validateUpload(b);
          if (v.error) return json({ ok: false, error: v.error }, v.status || 400);
          const doc = { _id: `s${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`, ...v.meta, fileName: v.file.name, mime: v.file.mime, size: v.file.size, data: v.file.data, uploadedBy: a.userId, createdAt: now, updatedAt: now };
          await deps.suggested.put(doc);
          return json({ ok: true, item: publicItem(doc) });
        }
      }
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
