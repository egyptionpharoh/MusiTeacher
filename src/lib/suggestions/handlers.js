// معالجات «صندوق الاقتراحات السرية» — تعتمد على deps قابلة للاستبدال (قاعدة حقيقية في الإنتاج، ذاكرة في الاختبار).
//
// المسار العام  /api/suggestions        GET: رمز نموذج مؤقت · POST: إرسال رسالة (بلا تسجيل دخول وبلا هوية)
// مسار الأدمن   /api/admin/suggestions  GET: القائمة · PATCH: الحالة/الأرشفة · DELETE: حذف
//
// الإرسال لا يقرأ ترويسة Authorization ولا الكوكيز إطلاقًا، ولا يكتب أي شيء في سجلات الخادم عن المحتوى أو المرسل.
// قراءة الرسائل: توكن Firebase موثّق + بريد الحساب ضمن قائمة المدير + role=admin في MongoDB — الثلاثة معًا.
import crypto from 'node:crypto';
import {
  LIMITS, STATUS_IDS, validateMessage, checkFormToken, makeFormToken, contentKey, dayStamp, coarseExpiry,
  getSecret, adminEmails, makeBurstLimiter, clientKeyOf, publicView,
} from './core.js';
import { bearerOf, sameOrigin } from '../virtual-games/guard.js';

const NO_STORE = { 'cache-control': 'no-store, max-age=0', 'x-robots-tag': 'noindex' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE } });
const fail = (status, code, error) => json({ ok: false, code, error }, status);

/**
 * deps: {
 *   store: { nextSeq(), bumpDaily(day, cap) -> number, claim(key, expireAt) -> bool,
 *            insert(doc), list({ archived, limit }), counts(), update(id, patch) -> bool, remove(id) -> bool },
 *   verifyIdToken(token) -> { uid, email }, findUser(uid) -> { role },
 *   env?, now?() -> Date, limiter?(key) -> bool, uuid?()
 * }
 */
export function makeSuggestionHandlers(deps) {
  const env = deps.env || process.env;
  const now = deps.now || (() => new Date());
  const limiter = deps.limiter || makeBurstLimiter();
  const uuid = deps.uuid || (() => crypto.randomUUID());

  /** GET /api/suggestions — رمز نموذج جديد (لا يتضمن أي هوية) */
  async function issueToken() {
    const secret = getSecret(env);
    if (!secret) return fail(503, 'not-configured', 'الخدمة غير مهيأة على الخادم بعد.');
    return json({ ok: true, token: makeFormToken(secret, now().getTime()) });
  }

  /** POST /api/suggestions — إرسال رسالة مجهولة */
  async function submit(request) {
    if (!sameOrigin(request)) return fail(403, 'forbidden', 'طلب من مصدر غير مسموح.');
    if (!deps.store) return fail(503, 'not-configured', 'تعذّر حفظ الرسالة الآن. حاول لاحقًا.');
    const secret = getSecret(env);
    if (!secret) return fail(503, 'not-configured', 'الخدمة غير مهيأة على الخادم بعد.');

    let raw;
    try { raw = await request.text(); } catch { return fail(400, 'bad-request', 'تعذّر قراءة الطلب.'); }
    if (raw.length > LIMITS.maxRequestBytes) return fail(413, 'too-large', 'الرسالة أكبر من الحد المسموح.');
    let input;
    try { input = JSON.parse(raw); } catch { return fail(400, 'bad-request', 'صيغة الطلب غير صحيحة.'); }
    if (!input || typeof input !== 'object') return fail(400, 'bad-request', 'صيغة الطلب غير صحيحة.');

    // حقل الفخ: يملؤه البرنامج الآلي وحده (مخفي عن البشر). نردّ بنجاح شكلي دون حفظ.
    if (typeof input.website === 'string' && input.website.trim()) return json({ ok: true }, 201);

    const tk = checkFormToken(input.token, secret, now().getTime());
    if (!tk.ok) {
      if (tk.code === 'too-fast') return fail(429, 'too-fast', 'تمهّل لحظة قبل الإرسال، ثم أعد المحاولة.');
      return fail(400, 'expired-form', 'انتهت صلاحية النموذج. حدّث الصفحة ثم أرسل رسالتك من جديد (انسخها أولًا حتى لا تضيع).');
    }
    const v = validateMessage(input);
    if (!v.ok) return fail(v.status, v.code, v.error);

    if (!limiter(clientKeyOf(request))) return fail(429, 'rate', 'أرسلت عدة رسائل خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.');

    const today = now(), day = dayStamp(today), expireAt = coarseExpiry(today);
    try {
      if (!(await deps.store.claim('nonce:' + tk.nonce, expireAt))) return fail(409, 'resubmit', 'أُرسلت رسالتك بالفعل. لإرسال رسالة جديدة حدّث الصفحة.');
      if (!(await deps.store.claim('dup:' + contentKey(v.body), expireAt))) return fail(409, 'duplicate', 'وصلتنا هذه الرسالة نفسها من قبل، شكرًا لك.');
      const n = await deps.store.bumpDaily(day, LIMITS.dailyCap);
      if (n > LIMITS.dailyCap) return fail(429, 'daily-cap', 'وصل الصندوق إلى الحد اليومي للرسائل. حاول غدًا من فضلك.');
      const seq = await deps.store.nextSeq();
      await deps.store.insert({ _id: uuid(), body: v.body, category: v.category, status: 'new', archived: false, day, seq });
    } catch {
      // لا نطبع المحتوى ولا تفاصيل الطلب في سجلات الخادم
      return fail(503, 'store', 'تعذّر حفظ الرسالة الآن. حاول بعد قليل.');
    }
    return json({ ok: true }, 201);
  }

  /** التحقق من صلاحية الأدمن على الخادم */
  async function authorizeAdmin(request) {
    if (!sameOrigin(request)) return { ok: false, res: fail(403, 'forbidden', 'طلب من مصدر غير مسموح.') };
    const token = bearerOf(request);
    if (!token) return { ok: false, res: fail(401, 'unauthenticated', 'سجّل الدخول بحساب المدير.') };
    let decoded;
    try { decoded = await deps.verifyIdToken(token); } catch { decoded = null; }
    if (!decoded || !decoded.uid) return { ok: false, res: fail(401, 'unauthenticated', 'انتهت جلسة الدخول. سجّل الدخول من جديد.') };
    const email = String(decoded.email || '').toLowerCase();
    if (!email || !adminEmails(env).includes(email)) return { ok: false, res: fail(403, 'forbidden', 'هذه الصفحة لمدير المنصة فقط.') };
    let user;
    try { user = await deps.findUser(decoded.uid); } catch { return { ok: false, res: fail(503, 'db', 'تعذّر الاتصال بقاعدة البيانات.') }; }
    if (!user || user.role !== 'admin') return { ok: false, res: fail(403, 'forbidden', 'هذه الصفحة لمدير المنصة فقط.') };
    if (!deps.store) return { ok: false, res: fail(503, 'not-configured', 'قاعدة البيانات غير مهيأة.') };
    return { ok: true };
  }

  async function adminList(request) {
    const a = await authorizeAdmin(request); if (!a.ok) return a.res;
    const url = new URL(request.url);
    const archived = url.searchParams.get('view') === 'archived';
    try {
      const [items, counts] = await Promise.all([deps.store.list({ archived, limit: LIMITS.listMax }), deps.store.counts()]);
      return json({ ok: true, items: items.map(publicView), counts });
    } catch { return fail(503, 'store', 'تعذّر تحميل الرسائل.'); }
  }

  async function readJson(request) { try { return await request.json(); } catch { return null; } }
  const validId = (id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);

  async function adminPatch(request) {
    const a = await authorizeAdmin(request); if (!a.ok) return a.res;
    const b = await readJson(request);
    if (!b || !validId(b.id)) return fail(400, 'bad-request', 'رسالة غير معروفة.');
    const patch = {};
    if (b.status !== undefined) { if (!STATUS_IDS.includes(b.status)) return fail(400, 'bad-status', 'حالة غير معروفة.'); patch.status = b.status; }
    if (b.archived !== undefined) patch.archived = !!b.archived;
    if (!Object.keys(patch).length) return fail(400, 'bad-request', 'لا يوجد تعديل.');
    try { return (await deps.store.update(b.id, patch)) ? json({ ok: true }) : fail(404, 'not-found', 'الرسالة غير موجودة.'); }
    catch { return fail(503, 'store', 'تعذّر الحفظ.'); }
  }

  async function adminDelete(request) {
    const a = await authorizeAdmin(request); if (!a.ok) return a.res;
    const b = await readJson(request);
    if (!b || !validId(b.id)) return fail(400, 'bad-request', 'رسالة غير معروفة.');
    try { return (await deps.store.remove(b.id)) ? json({ ok: true }) : fail(404, 'not-found', 'الرسالة غير موجودة.'); }
    catch { return fail(503, 'store', 'تعذّر الحذف.'); }
  }

  return { issueToken, submit, adminList, adminPatch, adminDelete, authorizeAdmin };
}
