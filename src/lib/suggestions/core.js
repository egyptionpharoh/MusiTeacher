// «صندوق الاقتراحات السرية» — المنطق النقي (بلا Next ولا قاعدة بيانات) لسهولة الاختبار والمراجعة.
//
// مبدأ الخصوصية: الرسالة لا تحمل أي شيء يدل على صاحبها.
//  • لا اسم ولا بريد ولا هاتف ولا معرّف حساب (uid) ولا عنوان IP ولا معلومات جهاز.
//  • لا وقت دقيق: نحفظ «يوم الاستلام» فقط (بتوقيت مسقط) + رقم ترتيب للعرض من الأحدث إلى الأقدم.
//  • المعرّف عشوائي (UUID) وليس ObjectId (لأن ObjectId في MongoDB يتضمن وقت الإنشاء بالثانية).
//  • حماية الإرسال الآلي بلا بيانات شخصية: نموذج موقّع مؤقت + حقل فخ + حدود عامة يومية + منع التكرار.
import crypto from 'node:crypto';

import { CATEGORIES, CATEGORY_IDS, categoryLabel, STATUSES, STATUS_IDS } from './categories.js';
export { CATEGORIES, CATEGORY_IDS, categoryLabel, STATUSES, STATUS_IDS };

export const LIMITS = {
  minChars: 5,
  maxChars: 4000,
  maxRequestBytes: 24 * 1024,
  minFillMs: 2500,                 // أقل من ذلك = إرسال آلي غالبًا
  tokenTtlMs: 12 * 60 * 60 * 1000, // صلاحية النموذج
  dailyCap: 400,                   // سقف عام لكل المنصة في اليوم (حماية من الإغراق، لا يميّز أحدًا)
  burstMax: 5,                     // لكل اتصال خلال نافذة قصيرة (في ذاكرة الخادم المؤقتة فقط)
  burstWindowMs: 10 * 60 * 1000,
  listMax: 500,
};

export const TZ = 'Asia/Muscat';

/** يوم الاستلام فقط «YYYY-MM-DD» بتوقيت مسقط — لا ساعة ولا دقيقة */
export function dayStamp(date = new Date(), tz = TZ) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const v = (t) => p.find((x) => x.type === t).value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}

/** تاريخ انتهاء «خشن» لسجلات الحماية المؤقتة: نهاية اليوم التالي (UTC) حتى لا يُستنتج منه وقت الإرسال */
export function coarseExpiry(now = new Date(), days = 2) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** تنظيف النص: إزالة محارف التحكم، توحيد الأسطر، وحذف الفراغات الزائدة — دون تغيير معنى الرسالة */
export function cleanBody(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​⁠﻿]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/** تحقق من محتوى الرسالة وتصنيفها */
export function validateMessage({ body, category } = {}) {
  const text = cleanBody(body);
  const chars = [...text].length;
  if (chars < LIMITS.minChars) return { ok: false, status: 400, code: 'too-short', error: 'الرسالة قصيرة جدًا. اكتب ما تريد قوله ببضع كلمات على الأقل.' };
  if (chars > LIMITS.maxChars) return { ok: false, status: 400, code: 'too-long', error: `الرسالة أطول من الحد المسموح (${LIMITS.maxChars} حرف). اختصرها أو قسّمها إلى رسالتين.` };
  const cat = CATEGORY_IDS.includes(category) ? category : 'other';
  return { ok: true, body: text, category: cat };
}

// ---------- نموذج موقّع مؤقت (بلا أي هوية) ----------
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const mac = (body, secret) => crypto.createHmac('sha256', secret).update('suggestions:' + body).digest('base64url');

/** رمز النموذج: وقت فتح النموذج + رقم عشوائي، موقّعان بسرّ الخادم. لا يُحفظ مع الرسالة. */
export function makeFormToken(secret, nowMs = Date.now(), nonce = b64u(crypto.randomBytes(12))) {
  const body = b64u(JSON.stringify({ t: nowMs, n: nonce }));
  return `${body}.${mac(body, secret)}`;
}

/** يعيد { ok, nonce } أو { ok:false, code } */
export function checkFormToken(token, secret, nowMs = Date.now()) {
  if (!secret) return { ok: false, code: 'no-secret' };
  if (typeof token !== 'string' || token.length > 400) return { ok: false, code: 'bad-token' };
  const i = token.indexOf('.');
  if (i < 1) return { ok: false, code: 'bad-token' };
  const body = token.slice(0, i), sig = token.slice(i + 1), good = mac(body, secret);
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, code: 'bad-token' };
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { ok: false, code: 'bad-token' }; }
  if (!p || typeof p.t !== 'number' || typeof p.n !== 'string') return { ok: false, code: 'bad-token' };
  const age = nowMs - p.t;
  if (age < LIMITS.minFillMs) return { ok: false, code: 'too-fast' };
  if (age > LIMITS.tokenTtlMs || age < -60000) return { ok: false, code: 'expired' };
  return { ok: true, nonce: p.n };
}

/** بصمة المحتوى لمنع تكرار الرسالة نفسها (تُحفظ مؤقتًا في سجل منفصل، لا مع الرسالة) */
export function contentKey(body) {
  const norm = cleanBody(body).replace(/\s+/g, ' ').toLowerCase();
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 40);
}

/** سرّ التوقيع: SUGGESTIONS_SECRET أو مشتق من مفتاح Firebase الخاص (لا يصل إلى المتصفح أبدًا) */
export function getSecret(env = process.env) {
  const s = env.SUGGESTIONS_SECRET;
  if (s && s.length >= 16) return s;
  const k = env.FIREBASE_PRIVATE_KEY;
  if (k && k.length > 32) return crypto.createHash('sha256').update('musiteacher-suggestions:' + k).digest('hex');
  return null;
}

/** بريد مدير المنصة المسموح له بقراءة الرسائل (يُضاف إلى شرط role=admin في قاعدة البيانات) */
export const DEFAULT_ADMIN_EMAILS = ['egyptionpharoh5@gmail.com', 'hussien.elmalek@gmail.com'];
export function adminEmails(env = process.env) {
  const raw = env.SUGGESTIONS_ADMIN_EMAILS || env.ADMIN_EMAILS;
  const list = raw ? raw.split(/[,;\s]+/) : DEFAULT_ADMIN_EMAILS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * محدّد معدل في ذاكرة الخادم المؤقتة فقط (لا يُكتب في قاعدة البيانات ولا يرتبط بالرسالة).
 * المفتاح بصمة HMAC لعنوان الاتصال بملح عشوائي يتجدد مع كل تشغيل للخادم، فلا يمكن عكسه إلى العنوان.
 */
export function makeBurstLimiter({ max = LIMITS.burstMax, windowMs = LIMITS.burstWindowMs, now = () => Date.now() } = {}) {
  const salt = crypto.randomBytes(16);
  const hits = new Map();
  return (rawKey) => {
    if (!rawKey) return true;
    const key = crypto.createHmac('sha256', salt).update(String(rawKey)).digest('base64url').slice(0, 22);
    const t = now(), arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    arr.push(t); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > windowMs) hits.delete(k);
    return arr.length <= max;
  };
}

/** عنوان الاتصال لمحدد المعدل فقط (لا يُحفظ) */
export function clientKeyOf(request) {
  const h = request.headers;
  const fwd = (h.get('x-forwarded-for') || '').split(',')[0].trim();
  return fwd || h.get('x-real-ip') || '';
}

/** ما يصل إلى لوحة الأدمن: الحقول المسموح بها فقط */
export function publicView(doc) {
  return { id: doc._id, body: doc.body, category: doc.category, status: doc.status, archived: !!doc.archived, day: doc.day, seq: doc.seq };
}
