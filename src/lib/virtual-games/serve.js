// تقديم ملفات الألعاب المحمية من مجلد private-games (خارج public) بعد التحقق من الكوكي.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.fbx': 'application/octet-stream',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.hdr': 'application/octet-stream', '.ktx2': 'image/ktx2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

export function gamesRoot() { return path.join(process.cwd(), 'private-games'); }

/** يحوّل أجزاء المسار القادمة من الرابط إلى مسار آمن داخل مجلد اللعبة، أو null عند أي محاولة تسلّل. */
export function resolveGameFile(root, gameId, segments, entry = 'index.html') {
  let base = path.join(root, gameId);
  let segs = (segments && segments.length) ? segments : [entry];
  // مجلد الموارد المشتركة (محرك الصوت والعينات): /play/<لعبة>/_shared/...  ← private-games/_shared/...
  // الوصول إليه يتطلب نفس كوكي جلسة اللعبة، ولا يمكن لمعرّف لعبة أن يساوي «_shared» (انظر isValidGameId).
  if (segs[0] === '_shared') {
    base = path.join(root, '_shared');
    segs = segs.slice(1);
    if (!segs.length) return null;
  }
  for (const raw of segs) {
    let s;
    try { s = decodeURIComponent(raw); } catch { return null; }
    if (!s || s === '.' || s === '..' || s.startsWith('.') || /[\\/:\0*?"<>|]/.test(s)) return null;
  }
  const full = path.resolve(base, ...segs.map((s) => decodeURIComponent(s)));
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  let real;
  try { real = fs.realpathSync(full); } catch { return null; }
  let realBase;
  try { realBase = fs.realpathSync(base); } catch { return null; }
  if (!real.startsWith(realBase + path.sep)) return null;   // يمنع الروابط الرمزية الخارجة من المجلد
  const st = fs.statSync(real);
  if (!st.isFile()) return null;
  if (!MIME[path.extname(real).toLowerCase()]) return null;  // قائمة بيضاء بالامتدادات
  return { file: real, size: st.size, mtimeMs: st.mtimeMs, ext: path.extname(real).toLowerCase() };
}

const MARK = '© MusiTeacher – All Rights Reserved – 2026';
const CORNER = {
  'top-left': 'top:8px;left:8px', 'top-right': 'top:8px;right:8px',
  'bottom-left': 'bottom:6px;left:8px', 'bottom-right': 'bottom:6px;right:8px',
};

/** يحقن في صفحة اللعبة: علامة الملكية + ردع النسخ (قائمة الزر الأيمن/الحفظ/الطباعة/السحب). ردع فقط وليس حماية حقيقية. */
export function injectHtml(html, game) {
  const corner = game.settings && game.settings.markCorner;
  const markCss = corner && corner !== 'none'
    ? `#mt-ip-mark{position:fixed;${CORNER[corner] || CORNER['top-left']};z-index:2147483000;font:600 10px/1.2 Tajawal,Arial,sans-serif;color:#fff;background:rgba(0,0,0,.38);padding:3px 8px;border-radius:999px;pointer-events:none;user-select:none;direction:ltr;letter-spacing:.2px}`
    : '';
  const markHtml = markCss ? `<div id="mt-ip-mark" aria-hidden="true">${MARK}</div>` : '';
  // allowPrint: لألعاب الطباعة فيها وظيفة تعليمية (طباعة النوتة). الافتراضي منع الطباعة كما في بقية الألعاب.
  const allowPrint = !!(game.settings && game.settings.allowPrint);
  const printCss = allowPrint ? '' : '@media print{html{display:none!important}}';
  const blocked = allowPrint ? "k==='s'||k==='u'" : "k==='s'||k==='p'||k==='u'";
  const head = `<meta name="robots" content="noindex,nofollow,noarchive"><style>${markCss}${printCss}img{-webkit-user-drag:none}</style>` +
    `<script>(function(){var b=function(e){e.preventDefault()};addEventListener('contextmenu',b);addEventListener('dragstart',b);` +
    `addEventListener('keydown',function(e){var k=(e.key||'').toLowerCase();if((e.ctrlKey||e.metaKey)&&(${blocked}))e.preventDefault();});})();</script>`;
  let out = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : head + html;
  if (markHtml) out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, markHtml + '</body>') : out + markHtml;
  return out;
}

export const htmlCache = new Map();

export async function readHtml(info, game) {
  const key = info.file + ':' + info.mtimeMs + ':' + (game.settings && game.settings.markCorner) + ':' + !!(game.settings && game.settings.allowPrint);
  let v = htmlCache.get(key);
  if (!v) {
    const raw = await fs.promises.readFile(info.file, 'utf8');
    v = Buffer.from(injectHtml(raw, game), 'utf8');
    if (htmlCache.size > 40) htmlCache.clear();
    htmlCache.set(key, v);
  }
  return v;
}

export function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Content-Security-Policy': "frame-ancestors 'self'",
    'Referrer-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Disposition': 'inline',
    ...extra,
  };
}

/** استجابة ملف (مع دعم Range للصوت). */
export async function fileResponse(info, game, request) {
  if (info.ext === '.html') {
    const buf = await readHtml(info, game);
    return new Response(buf, { status: 200, headers: securityHeaders({
      'Content-Type': MIME['.html'], 'Content-Length': String(buf.length), 'Cache-Control': 'private, no-store',
    }) });
  }
  const type = MIME[info.ext];
  const base = securityHeaders({ 'Content-Type': type, 'Cache-Control': 'private, max-age=600', 'Accept-Ranges': 'bytes' });
  const range = request.headers.get('range');
  let start = 0, end = info.size - 1, status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && (m[1] || m[2])) {
      if (m[1]) { start = parseInt(m[1], 10); if (m[2]) end = Math.min(parseInt(m[2], 10), end); }
      else { start = Math.max(0, info.size - parseInt(m[2], 10)); }
      if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${info.size}` } });
      status = 206;
    }
  }
  const stream = Readable.toWeb(fs.createReadStream(info.file, { start, end }));
  const headers = { ...base, 'Content-Length': String(end - start + 1) };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  return new Response(stream, { status, headers });
}
