// معالجات خادم MusiTeacher Games. تستقبل deps (الإعدادات + الجسر) كي تُختبر محليًا بلا إنترنت.
import {
  config, getGame, normalizeCode, signSession, verifySession, readCookie, cookieName, setCookieHeader,
  clearCookieHeader, makeLimiter, clientKey, registry, resolveGameFile, securityHeaders, injectHtml, traceOf, MIME, GAMES_DIR,
  SESSION_MAX_SEC, RECHECK_SEC, send, sendJson, readJson, queryOf, sameOrigin,
} from './core.mjs';
import { makeBridge, BRIDGE_DETAIL } from './bridge.mjs';
import fs from 'node:fs';

const now = () => Math.floor(Date.now() / 1000);
export const OFFLINE_MAX_SEC = 7 * 24 * 60 * 60;   // أقصى مدة للعب دون إنترنت قبل الحاجة لفتح اللعبة مع الإنترنت مرة أخرى

// رسائل لطيفة للطالب (بلا أي تفاصيل تقنية)
export const STUDENT_MSG = {
  invalid: 'الرمز غير صحيح. تأكّد من الأرقام ثم حاول مرة أخرى.',
  expired: 'انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا من معلمك.',
  'release-stopped': 'هذا الرابط لم يعد مستخدمًا. اطلب الرابط الجديد من معلمك.',
  'rate-limited': 'محاولات كثيرة متتالية. انتظر بضع دقائق ثم حاول مرة أخرى.',
  unavailable: 'اللعبة غير متاحة الآن. حاول لاحقًا.',
  format: 'اكتب الرمز المكوّن من 6 أرقام كما أرسله معلمك.',
};
const publicError = (e) => (STUDENT_MSG[e] ? e : 'unavailable');

function remaining(exp) { return Math.max(0, exp - now()); }

/**
 * رابط تشغيل اللعبة داخل الإطار: /g/<id>/<ملف الدخول> بالاسم الصريح (مثل /g/accordion-3d/index.html).
 * السبب: المتصفح يحسب المسارات النسبية (./src/ui/style.css) من «مجلد» الرابط. لو كان الرابط /g/accordion-3d
 * (بدون / في آخره) لصار المجلد /g/ وضاعت كل ملفات اللعبة (404 ثم خطأ MIME). الاسم الصريح يمنع ذلك مهما كانت إعدادات الاستضافة.
 */
export function playUrl(game) {
  return `/g/${encodeURIComponent(game.id)}/` + String(game.entry || 'index.html').split('/').map(encodeURIComponent).join('/');
}

export function makeHandlers(deps = {}) {
  const cfgOf = () => deps.config || config();
  const bridgeOf = (cfg) => deps.bridge || makeBridge(cfg);
  const enterLimit = makeLimiter(12, 10 * 60 * 1000);
  const fileLimit = makeLimiter(900, 60 * 1000);
  const root = deps.gamesDir || GAMES_DIR;
  const gameOf = deps.getGame || getGame;

  function sessionCookie(req, game, cfg) {
    return verifySession(readCookie(req.headers.cookie, cookieName(game.id)), game.id, cfg.release, cfg.sessionSecret);
  }
  function issue(res, game, cfg, sid, codeExp, extra = {}) {
    const exp = Math.min(codeExp, now() + SESSION_MAX_SEC);
    const value = signSession({ g: game.id, s: sid, r: cfg.release, exp, chk: now() }, cfg.sessionSecret);
    res.setHeader('Set-Cookie', setCookieHeader(game.id, value, { secure: cfg.secure, maxAge: remaining(exp) }));
    return { exp, ...extra };
  }

  /** POST /api/enter { game, code } — الخطوة الوحيدة المطلوبة من الطالب */
  async function enter(req, res) {
    try {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'unavailable' });
      if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'unavailable' });
      const cfg = cfgOf();
      const body = await readJson(req);
      const game = gameOf(body && body.game);
      if (!game) return sendJson(res, 404, { ok: false, error: 'unavailable', message: STUDENT_MSG.unavailable });
      if (!cfg.sessionSecret || !cfg.release) return sendJson(res, 503, { ok: false, error: 'unavailable', message: STUDENT_MSG.unavailable });
      const code = normalizeCode(body.code);
      if (!code) return sendJson(res, 400, { ok: false, error: 'format', message: STUDENT_MSG.format });
      const client = clientKey(req);
      if (!enterLimit(client)) return sendJson(res, 429, { ok: false, error: 'rate-limited', message: STUDENT_MSG['rate-limited'] });
      const r = await bridgeOf(cfg).verify(game.id, code, client);
      if (!r.ok) {
        const e = publicError(r.error);
        if (r.error && !STUDENT_MSG[r.error]) console.error('[mtg/enter] bridge:', r.error, r.detail || '', BRIDGE_DETAIL[r.detail] || '', r.status || '');
        return sendJson(res, e === 'rate-limited' ? 429 : e === 'unavailable' ? 503 : 401, { ok: false, error: e, message: STUDENT_MSG[e] });
      }
      const s = issue(res, game, cfg, String(r.sid), Number(r.exp) || now() + 3600);
      return sendJson(res, 200, { ok: true, play: playUrl(game), expiresIn: remaining(s.exp) });
    } catch (e) {
      console.error('[mtg/enter]', e && e.message);
      return sendJson(res, 500, { ok: false, error: 'unavailable', message: STUDENT_MSG.unavailable });
    }
  }

  /** GET /api/session?game=id — هل لدى الطالب جلسة صالحة؟ (يُستدعى عند فتح الصفحة وكل بضع دقائق) */
  async function session(req, res) {
    try {
      const cfg = cfgOf();
      const game = gameOf(queryOf(req).get('game'));
      if (!game) return sendJson(res, 404, { ok: false, error: 'unavailable' });
      const p = sessionCookie(req, game, cfg);
      if (!p) return sendJson(res, 200, { ok: false });
      // إعادة التحقق من MusiTeacher دوريًا: يسري إلغاء المعلم للرمز أو انتهاء اشتراكه
      if (now() - (p.chk || 0) >= RECHECK_SEC) {
        const r = await bridgeOf(cfg).check(game.id, p.s);
        // الجلسة تنتهي فقط بجواب قاطع من MusiTeacher (أُلغي الرمز / انتهى / توقف الإصدار)؛ أي عطل تقني مؤقت لا يقطع لعب الطالب
        if (!r.ok && ['invalid', 'expired', 'release-stopped'].includes(r.error)) {
          res.setHeader('Set-Cookie', clearCookieHeader(game.id, cfg.secure));
          const e = publicError(r.error === 'invalid' ? 'expired' : r.error);
          return sendJson(res, 200, { ok: false, ended: true, error: e, message: STUDENT_MSG[e] });
        }
        if (!r.ok && r.detail) console.error('[mtg/session] bridge:', r.error, r.detail, BRIDGE_DETAIL[r.detail] || '');
        if (r.ok) issue(res, game, cfg, p.s, Math.min(Number(r.exp) || p.exp, p.exp + RECHECK_SEC * 4));
        // إن تعذّر الوصول إلى MusiTeacher مؤقتًا لا نقطع لعب الطالب؛ تبقى الجلسة حتى انتهائها
      }
      return sendJson(res, 200, { ok: true, play: playUrl(game), expiresIn: remaining(p.exp) });
    } catch (e) {
      console.error('[mtg/session]', e && e.message);
      return sendJson(res, 200, { ok: false });
    }
  }

  /** GET /g/<id>/<path> — ملفات اللعبة. لا شيء بدون جلسة صالحة لنفس اللعبة ونفس الإصدار. */
  async function play(req, res) {
    const cfg = cfgOf();
    const q = queryOf(req);
    const game = gameOf(q.get('id'));
    const deny = (status, msg) => send(res, status, `<!doctype html><meta charset="utf-8"><title>MusiTeacher Games</title><body dir="rtl" style="font-family:sans-serif;padding:2rem;color:#113f67">${msg}</body>`,
      securityHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }));
    if (!game) return deny(404, 'اللعبة غير موجودة.');
    const rel = q.getAll('p').join('/');
    const p = sessionCookie(req, game, cfg);
    const isEntry = !rel || rel === (game.entry || 'index.html');
    const dest = req.headers['sec-fetch-dest'], site = req.headers['sec-fetch-site'];
    // فتح أي ملف من ملفات اللعبة مباشرة في تبويب (لعرض كوده أو حفظه) ← إلى صفحة اللعبة الرسمية
    // طلب اللعبة بلا اسم ملف (/g/<id> أو /g/<id>/) داخل الإطار ← إلى رابطها الصريح حتى تصح المسارات النسبية
    if (!rel && p && dest !== 'document') return send(res, 302, '', { Location: playUrl(game), 'Cache-Control': 'no-store' });
    if (dest === 'document' || (isEntry && !p)) {
      if (p && dest === 'document') console.warn('[mtg/abuse] direct-open', game.id, rel || 'entry', traceOf(p.s));
      return send(res, 302, '', { Location: `/games/${game.id}`, 'Cache-Control': 'no-store' });
    }
    // طلب قادم من موقع آخر (تضمين/سرقة روابط بجلسة طالب) ← مرفوض
    if (site && site !== 'same-origin') { console.warn('[mtg/abuse] cross-site', game.id, site); return deny(403, 'غير مسموح.'); }
    if (!p) return deny(401, 'افتح اللعبة من رابطها وأدخل الرمز أولًا.');
    if (!fileLimit(p.s + ':' + clientKey(req))) { console.warn('[mtg/abuse] rate', game.id, traceOf(p.s)); return deny(429, 'طلبات كثيرة جدًا، حاول بعد قليل.'); }
    const info = resolveGameFile(root, game.id, rel, game.entry || 'index.html');
    if (!info) return deny(404, 'الملف غير موجود.');
    if (info.ext === '.html') {
      const html = injectHtml(fs.readFileSync(info.file, 'utf8'), game, { host: req.headers['x-forwarded-host'] || req.headers.host, trace: traceOf(p.s) });
      const buf = Buffer.from(html, 'utf8');
      return send(res, 200, buf, securityHeaders({ 'Content-Type': MIME['.html'], 'Content-Length': String(buf.length), 'Cache-Control': 'private, no-store' }));
    }
    // ملفات الأصول: تخزين مؤقت خاص في متصفح الطالب فقط (يقلل الطلبات عند إعادة الفتح)
    const base = securityHeaders({ 'Content-Type': MIME[info.ext], 'Cache-Control': 'private, max-age=86400', 'Accept-Ranges': 'bytes' });
    let start = 0, end = info.size - 1, status = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], end); } else start = Math.max(0, info.size - +m[2]);
      if (start > end || start >= info.size) return send(res, 416, '', { ...base, 'Content-Range': `bytes */${info.size}` });
      status = 206; base['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    res.statusCode = status;
    for (const [k, v] of Object.entries({ ...base, 'Content-Length': String(end - start + 1) })) res.setHeader(k, v);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(info.file, { start, end }).pipe(res);
  }

  /**
   * GET /api/offline?game=<id> — قائمة ملفات «تجهيز اللعبة للعمل دون إنترنت».
   * تُعطى فقط: بجلسة رمز صالحة لنفس اللعبة + تأكيد فوري من MusiTeacher أن الرمز ما زال صالحًا الآن.
   * مدة الصلاحية دون إنترنت = الأقرب من (انتهاء الرمز / انتهاء اشتراك المعلم) و 7 أيام؛ تتجدد كلما فُتحت اللعبة مع الإنترنت.
   */
  const offLimit = makeLimiter(20, 10 * 60 * 1000);
  async function offline(req, res) {
    try {
      const cfg = cfgOf();
      const game = gameOf(queryOf(req).get('game'));
      if (!game) return sendJson(res, 404, { ok: false, error: 'unavailable' });
      const site = req.headers['sec-fetch-site'];
      if (site && site !== 'same-origin') return sendJson(res, 403, { ok: false, error: 'unavailable' });
      const p = sessionCookie(req, game, cfg);
      if (!p) return sendJson(res, 401, { ok: false, error: 'session', message: 'افتح اللعبة بالرمز أولًا ثم جهّزها للعمل دون إنترنت.' });
      if (!offLimit(p.s + ':' + clientKey(req))) return sendJson(res, 429, { ok: false, error: 'rate-limited', message: STUDENT_MSG['rate-limited'] });
      if (!game.offline) return sendJson(res, 404, { ok: false, error: 'unsupported', message: 'هذه اللعبة لا تدعم العمل دون إنترنت حاليًا.' });
      const r = await bridgeOf(cfg).check(game.id, p.s);
      if (!r.ok) {
        if (['invalid', 'expired', 'release-stopped'].includes(r.error)) {
          res.setHeader('Set-Cookie', clearCookieHeader(game.id, cfg.secure));
          const e = publicError(r.error === 'invalid' ? 'expired' : r.error);
          return sendJson(res, 401, { ok: false, ended: true, error: e, message: STUDENT_MSG[e] });
        }
        if (r.detail) console.error('[mtg/offline] bridge:', r.error, r.detail, BRIDGE_DETAIL[r.detail] || '');
        return sendJson(res, 503, { ok: false, error: 'unavailable', message: 'تعذّر التأكد من صلاحية الرمز الآن. حاول بعد قليل.' });
      }
      const until = Math.min(Number(r.exp) || 0, now() + OFFLINE_MAX_SEC);
      if (until <= now()) return sendJson(res, 401, { ok: false, ended: true, error: 'expired', message: STUDENT_MSG.expired });
      issue(res, game, cfg, p.s, Math.min(Number(r.exp) || p.exp, now() + SESSION_MAX_SEC));
      const root = `/g/${encodeURIComponent(game.id)}/`;
      const enc = (f) => f.split('/').map(encodeURIComponent).join('/');
      console.info('[mtg/offline] prepare', game.id, traceOf(p.s));
      return sendJson(res, 200, {
        ok: true, game: game.id, title: game.title, version: game.version, release: cfg.release, until, bytes: game.offline.bytes,
        level: game.offline.level, entry: playUrl(game),
        files: game.offline.files.map((f) => root + enc(f)),
        shared: game.offline.shared.map((f) => '_shared/' + enc(f)),
        external: game.offline.external || [],
        app: ['/', `/games/${encodeURIComponent(game.id)}`, '/assets/mtg.css', '/assets/shell.js', '/assets/library.js', '/assets/mtg-ui.js', '/assets/logo.png', '/catalog.json', game.cover].filter(Boolean),
      });
    } catch (e) {
      console.error('[mtg/offline]', e && e.message);
      return sendJson(res, 500, { ok: false, error: 'unavailable', message: STUDENT_MSG.unavailable });
    }
  }

  /**
   * GET /api/health — فحص جاهزية الربط بنقرة واحدة (لا يكشف أي سر):
   * إعدادات هذا المشروع + هل MusiTeacher المنشور يرد على مسار التحقق بالسر الصحيح + هل يقبل الإصدار الحالي.
   * يستخدم طلب «check» برقم مشاركة وهمي: لا يُحسب محاولة فاشلة ولا يكتب شيئًا في قاعدة البيانات.
   */
  const healthLimit = makeLimiter(20, 60 * 1000);
  async function health(req, res) {
    if (!healthLimit(clientKey(req))) return sendJson(res, 429, { ok: false });
    const cfg = cfgOf();
    const checks = {
      release: cfg.release ? 'ok' : 'GAMES_RELEASE فارغ',
      sessionSecret: cfg.sessionSecret ? 'ok' : 'GAMES_SESSION_SECRET غير موجود أو أقصر من 24 حرفًا',
      bridgeSecret: !cfg.bridgeSecretRaw ? 'STUDENT_GAMES_BRIDGE_SECRET غير موجود' : cfg.bridgeSecret ? 'ok' : BRIDGE_DETAIL['bridge-secret-short'],
      musiteacherUrl: cfg.musiteacherUrl ? 'ok' : 'MUSITEACHER_URL غير موجود',
    };
    const b = bridgeOf(cfg);
    let bridge = 'لم يُفحص';
    try {
      const r = await b.check('health-probe', 'health-probe');
      if (r.detail) bridge = BRIDGE_DETAIL[r.detail] || r.detail;
      else if (r.error === 'release-stopped') bridge = `MusiTeacher لا يقبل الإصدار «${cfg.release}» — أضفه واجعله «الحالي» من /dashboard/student-games`;
      else if (r.error === 'invalid' || r.ok === false) bridge = 'ok';
    } catch (e) { bridge = 'خطأ: ' + (e && e.message); }
    const ok = Object.values(checks).every((v) => v === 'ok') && bridge === 'ok';
    return sendJson(res, ok ? 200 : 503, { ok, release: cfg.release || null, musiteacher: b.host ? b.host() : '', checks, bridge, games: registry().games.filter((g) => g.status === 'published').length },
      { 'Cache-Control': 'no-store' });
  }

  return { enter, session, play, health, offline };
}
