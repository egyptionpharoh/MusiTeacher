// «مستشار اللجان والامتحانات» — الاستعانة بـ Gemini على الخادم فقط، عند الحاجة فقط.
// ───────────────────────────────────────────────────────────────────────────
// • لا يُستدعى النموذج إلا لسؤال يخص اللجان والامتحانات ولم تجد له قاعدة المعرفة إجابة.
// • يرسل للنموذج: السؤال + نوع الامتحان + طبيعة التكليف + أقرب مقاطع من قاعدة المعرفة (لا أي بيانات شخصية).
// • يمنع النموذج من اختراع عقوبات أو قرارات إدارية أو إجراءات تنظيمية، ويُلزمه بالإحالة.
// • حماية الحصة المجانية: نموذج خفيف، ردود قصيرة، ذاكرة مؤقتة للأسئلة المتكررة، وحدود لكل معلم ولكل يوم.
// • المفتاح يُقرأ من متغيرات الخادم ولا يصل للمتصفح. هذا الملف لا يعرف Next ولا قاعدة البيانات (اعتماديات محقونة).
import { createAdvisor, examLabel, roleLabel } from '../core/engine.js';
import { normalizeArabic } from '../core/normalize.js';
import { ENTRIES } from '../data/knowledge.js';
import { SYNONYMS } from '../data/synonyms.js';
import { DOCUMENTS } from '../data/sources.js';

export const AI_DISCLAIMER = 'هذه إجابة استرشادية مولدة بالذكاء الاصطناعي، يُرجى مراجعة مركزك أو مقر لجنتك أو مدرستك للتأكد من الإجراء الرسمي المعتمد.';
export const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
export const LIMITS = { perMinute: 3, perHour: 12, perDay: 25, globalPerDay: 300, cacheTtlMs: 24 * 3600 * 1000, cacheMax: 400, maxQuestion: 400 };

const advisor = createAdvisor({ entries: ENTRIES, synonyms: SYNONYMS });

export const SYSTEM = `أنت «مستشار المعلم في اللجان والامتحانات» داخل منصة تعليمية في سلطنة عُمان، وتجيب معلمين منتدبين لأعمال المراقبة والكنترول.
قواعد صارمة:
1. أجب بالعربية الفصحى المبسطة، باختصار شديد: جملة افتتاحية واحدة ثم من 2 إلى 5 نقاط عملية قصيرة.
2. اعتمد أولًا على «المقاطع الموثقة» المرفقة ولا تخالفها. ما يُوسم «خبرة ميدانية» استرشادي وليس لائحة.
3. ممنوع منعًا باتًا اختراع عقوبات، أو جزاءات، أو قرارات إدارية، أو مواعيد، أو مبالغ، أو أرقام مواد ولوائح، أو تسلسل إجراءات رسمية غير مذكور في المقاطع. إن تعلق السؤال بشيء من ذلك فقل إن تحديده من اختصاص رئيس اللجان (رئيس مركز الامتحانات) أو المراقب الأول، واكتفِ بنصيحة عامة آمنة.
4. لا تدّعِ أنك جهة رسمية أو أنك تمثل وزارة التربية والتعليم، ولا تقدم استشارة قانونية، ولا تذكر أنك نموذج ذكاء اصطناعي.
5. لا تطلب أي بيانات شخصية.
6. إذا كان السؤال خارج موضوع اللجان والامتحانات وأعمال المراقبة والكنترول، فاجعل inScope=false.
أعد JSON فقط بهذا الشكل: {"inScope": true, "intro": "جملة واحدة", "points": ["نقطة", "..."], "refer": "الجهة التي يُرجع إليها أو سلسلة فارغة"}`;

function partsText(e) {
  return e.parts.map((p) => {
    const tag = p.src === 'official' ? `وثيقة «${DOCUMENTS[p.ref.doc].title}» ${p.ref.part}` : p.src === 'field' ? 'خبرة ميدانية (امتحانات الدبلوم العام)' : p.src === 'general' ? 'إرشاد عام' : 'غير متوفر';
    return `[${tag}] ${[p.text || '', ...(p.list || [])].join(' — ')}`;
  }).join('\n');
}

export function buildPrompt({ question, exam, role }) {
  const ctx = advisor.contextFor(question, { exam }, 4);
  const snippets = ctx.length ? ctx.map((e, i) => `(${i + 1}) ${e.q}\n${partsText(e)}${e.gap ? `\n[ملاحظة] ${e.gap}` : ''}`).join('\n\n') : '(لا توجد مقاطع قريبة)';
  return [
    `نوع الامتحان: ${exam ? examLabel(exam) : 'غير محدد'}`,
    `طبيعة تكليف المعلم: ${role ? roleLabel(role) : 'غير محددة'}`,
    'المقاطع الموثقة الأقرب للسؤال:',
    snippets,
    '',
    `سؤال المعلم: ${question}`,
  ].join('\n');
}

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/** ينظّف رد النموذج ويحدّه — لا نثق بالشكل ولا بالطول */
export function cleanOutput(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.inScope === false) return { inScope: false };
  const intro = clip(d.intro, 400);
  const points = (Array.isArray(d.points) ? d.points : []).map((p) => clip(p, 300)).filter(Boolean).slice(0, 6);
  if (!intro && !points.length) return null;
  return { inScope: true, intro, points, refer: clip(d.refer, 160) };
}

export const cacheKey = (q, exam, role) => `${exam || '-'}|${role || '-'}|${normalizeArabic(q)}`;

function window(max, ms, now) {
  const hits = new Map();
  return (key) => {
    const t = now(); const arr = (hits.get(key) || []).filter((x) => t - x < ms);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(t); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > ms) hits.delete(k);
    return true;
  };
}

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
// ردود ودية فقط — لا رسائل تقنية للمعلم
const soft = (reason) => json({ ok: false, reason });

/**
 * deps: { ai: {configured(), generateJSON()}, verifyIdToken, findUser, enabled?, now?, log?, limits? }
 * POST { question, exam, role } + Authorization: Bearer <Firebase ID token>
 * يعيد { ok:true, answer:{intro, points, refer}, disclaimer, cached } | { ok:true, outOfScope:true } | { ok:false, reason }
 */
export function makeAdvisorAIHandler(deps) {
  const L = { ...LIMITS, ...(deps.limits || {}) };
  const now = deps.now || (() => Date.now());
  const log = deps.log || ((w, e) => console.warn('[committee-advisor]', w, e && (e.code || e.message)));
  const perMin = window(L.perMinute, 60e3, now);
  const perHour = window(L.perHour, 3600e3, now);
  const perDay = window(L.perDay, 86400e3, now);
  const global = window(L.globalPerDay, 86400e3, now);
  const cache = new Map();

  return async function POST(request) {
    try {
      if (deps.enabled === false || !deps.ai || !deps.ai.configured()) return soft('unavailable');
      const origin = request.headers.get('origin'); const host = request.headers.get('host');
      if (origin && host && new URL(origin).host !== host) return json({ ok: false, reason: 'forbidden' }, 403);
      const h = request.headers.get('authorization') || '';
      const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
      if (!token) return json({ ok: false, reason: 'login' }, 401);
      let uid;
      try { const d = await deps.verifyIdToken(token); uid = d && d.uid; } catch { uid = null; }
      if (!uid) return json({ ok: false, reason: 'login' }, 401);
      let user;
      try { user = await deps.findUser(uid); } catch (e) { log('db', e); return soft('unavailable'); }
      if (!user || user.status === 'suspended') return json({ ok: false, reason: 'forbidden' }, 403);

      const raw = await request.text();
      if (raw.length > 4000) return json({ ok: false, reason: 'bad-request' }, 400);
      let b; try { b = JSON.parse(raw || '{}'); } catch { return json({ ok: false, reason: 'bad-request' }, 400); }
      const question = clip(b.question, L.maxQuestion);
      const exam = ['transfer', 'certificate', 'diploma', 'general'].includes(b.exam) ? b.exam : null;
      const role = ['invigilator', 'control', 'monitoring', 'other', 'unknown'].includes(b.role) ? b.role : null;
      if (question.length < 4) return json({ ok: false, reason: 'bad-request' }, 400);
      if (/\d{8,}/.test(question.replace(/[\s-]/g, ''))) return soft('private');
      if (!advisor.inDomain(question)) return json({ ok: true, outOfScope: true });

      const key = cacheKey(question, exam, role);
      const hit = cache.get(key);
      if (hit && now() - hit.t < L.cacheTtlMs) return json({ ok: true, answer: hit.a, disclaimer: AI_DISCLAIMER, cached: true });

      if (!perMin(uid) || !perHour(uid) || !perDay(uid)) return soft('busy');
      if (!global('all')) return soft('quota');

      let out;
      try {
        const r = await deps.ai.generateJSON({ system: SYSTEM, prompt: buildPrompt({ question, exam, role }), temperature: 0.2, maxTokens: 700 });
        out = cleanOutput(r.data);
      } catch (e) {
        log('ai', e);
        return soft(e && e.code === 'rate-limited' ? 'quota' : 'unavailable');
      }
      if (!out) return soft('unavailable');
      if (!out.inScope) return json({ ok: true, outOfScope: true });
      const a = { intro: out.intro, points: out.points, refer: out.refer };
      cache.set(key, { t: now(), a });
      if (cache.size > L.cacheMax) cache.delete(cache.keys().next().value);
      return json({ ok: true, answer: a, disclaimer: AI_DISCLAIMER, cached: false });
    } catch (e) {
      log('handler', e);
      return soft('unavailable');
    }
  };
}
