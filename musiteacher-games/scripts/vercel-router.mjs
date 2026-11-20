// محاكاة دقيقة لطريقة Vercel في توجيه الطلبات، مبنية على ملف vercel.json نفسه:
//   1) إعادة التوجيه التي تولّدها cleanUrls و trailingSlash (لو فُعّلت) — تُطبَّق على كل المسارات قبل أي شيء.
//   2) الملفات الثابتة داخل outputDirectory أولًا (مطابقة حساسة لحالة الأحرف مثل Linux).
//   3) ثم قواعد rewrites بالترتيب.
//   4) ثم ترويسات headers المطابقة.
// الهدف: أي إعداد في vercel.json يكسر مسارات الألعاب يظهر في التجربة المحلية قبل النشر.
import fs from 'node:fs';
import path from 'node:path';

/** يحوّل نمط مسار Vercel (/g/:id/:p*) إلى تعبير منتظم مع أسماء المتغيرات */
export function compileSource(src) {
  const names = [];
  let re = '';
  for (let i = 0; i < src.length;) {
    const m = /^:([A-Za-z_]\w*)([*+?])?/.exec(src.slice(i));
    if (m) {
      names.push(m[1]);
      const prevSlash = re.endsWith('/');
      if (m[2] === '*') re = (prevSlash ? re.slice(0, -1) + '(?:/' : '(?:') + '(.*))?';
      else if (m[2] === '+') re += '(.+)';
      else re += '([^/]+)';
      i += m[0].length;
    } else if (src[i] === '(') {            // مجموعة تعبير منتظم كما هي، مثل (.*) أو ((?!g/|api/).*)
      let depth = 0, j = i;
      for (; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')' && --depth === 0) break; }
      re += src.slice(i, j + 1); names.push(null); i = j + 1;
    } else { re += src[i].replace(/[.+?^${}|[\]\\]/g, '\\$&'); i++; }
  }
  return { re: new RegExp('^' + re + '$'), names };
}

function matchSource(src, pathname) {
  const { re, names } = compileSource(src);
  const m = re.exec(pathname);
  if (!m) return null;
  const params = {};
  names.forEach((n, k) => { if (n) params[n] = m[k + 1] === undefined ? '' : m[k + 1]; });
  return params;
}

/** هل الملف موجود بنفس حالة الأحرف بالضبط؟ (ويندوز يتسامح، Vercel/Linux لا) */
export function existsExactCase(root, rel) {
  let dir = root;
  for (const part of rel.split('/').filter(Boolean)) {
    let names; try { names = fs.readdirSync(dir); } catch { return false; }
    if (!names.includes(part)) return false;
    dir = path.join(dir, part);
  }
  try { return fs.statSync(dir).isFile(); } catch { return false; }
}

export function makeRouter(projectRoot) {
  const cfg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));
  const pub = path.join(projectRoot, cfg.outputDirectory || 'public');
  const redirects = [];
  // نفس القواعد التي تولّدها @vercel/routing-utils
  if (cfg.cleanUrls) {
    redirects.push({ re: /^\/(?:(.+)\/)?index(?:\.html)?\/?$/, to: (m) => '/' + (m[1] || '') });
    redirects.push({ re: /^\/(.*)\.html\/?$/, to: (m) => '/' + m[1] });
  }
  if (cfg.trailingSlash === false) redirects.push({ re: /^\/(.+)\/$/, to: (m) => '/' + m[1] });
  if (cfg.trailingSlash === true) redirects.push({ re: /^\/((?:[^/]+\/)*[^/.]+)$/, to: (m) => '/' + m[1] + '/' });

  function staticFile(pathname) {
    let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    if (existsExactCase(pub, rel)) return path.join(pub, rel);
    if (cfg.cleanUrls && !path.extname(rel) && existsExactCase(pub, rel + '.html')) return path.join(pub, rel + '.html');
    return null;
  }

  function headersFor(pathname) {
    const out = {};
    for (const h of cfg.headers || []) if (matchSource(h.source, pathname)) for (const x of h.headers) out[x.key] = x.value;
    return out;
  }

  /** يرجع: {redirect} أو {file} أو {fn, query} أو {notFound} + headers */
  function route(pathname, search = '') {
    for (const r of redirects) { const m = r.re.exec(pathname); if (m) return { redirect: r.to(m) + search, status: 308 }; }
    const headers = headersFor(pathname);
    const f = staticFile(pathname);
    if (f) return { file: f, headers };
    for (const rw of cfg.rewrites || []) {
      const params = matchSource(rw.source, pathname);
      if (!params) continue;
      const dest = rw.destination.replace(/:([A-Za-z_]\w*)\*?/g, (_, n) => params[n] ?? '');
      const [dp, dq = ''] = dest.split('?');
      const q = new URLSearchParams(dq);
      new URLSearchParams(search.replace(/^\?/, '')).forEach((v, k) => q.append(k, v));
      const fn = /^\/api\/([\w-]+)$/.exec(dp);
      if (fn) return { fn: fn[1], query: q, headers };
      const f2 = staticFile(dp);
      if (f2) return { file: f2, headers };
    }
    const fn = /^\/api\/([\w-]+)$/.exec(pathname);
    if (fn) return { fn: fn[1], query: new URLSearchParams(search.replace(/^\?/, '')), headers };
    return { notFound: true, headers };
  }
  return { route, cfg };
}
