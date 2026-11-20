// =====================================================================
//  تقوية النسخ الطلابية (تُطبَّق على النسخة داخل musiteacher-games/games فقط — الأصل لا يُمس أبدًا):
//  تصغير وإخفاء أسماء المتغيرات الداخلية في ملفات JavaScript وفي السكربتات المضمّنة داخل HTML.
//
//  حدود هذه الطبقة (بصدق): هي ليست تشفيرًا ولا حماية مطلقة. تجعل قراءة الكود وتعديله وإعادة استخدامه
//  أصعب وأبطأ بكثير، لكنها لا تمنع من يملك جلسة صالحة ومهارة من نسخ الملفات كما تُرسل للمتصفح.
//  تستخدم Terser المرفقة مع Next.js داخل مشروع MusiTeacher (لا تثبيت لأي مكتبة جديدة).
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export function loadTerser(srcRoot) {
  const req = createRequire(path.join(srcRoot, 'package.json'));
  for (const id of ['next/dist/compiled/terser', 'terser']) {
    try { const t = req(id); if (t && typeof t.minify === 'function') return t; } catch { /* جرّب التالي */ }
  }
  return null;
}

const OPTIONS = (isModule) => ({
  module: isModule,
  ecma: 2020,
  compress: { passes: 1, drop_debugger: true, keep_infinity: true },
  mangle: { keep_classnames: true, keep_fnames: true },          // أسماء الدوال والأصناف تبقى (بعض الألعاب قد تعتمد عليها)
  keep_classnames: true, keep_fnames: true,
  format: { comments: /@license|@preserve|^!/, inline_script: true }, // تبقى إشعارات التراخيص (MIT وغيرها) كما تشترط
});
const looksModule = (code) => /(^|[\n;])\s*(import\s*[\w{*'"]|export\s|export\{)/.test(code) || /\bimport\.meta\b/.test(code);

/** يصغّر ملفًا واحدًا. أي خطأ → يبقى الملف كما هو (لا نكسر لعبة أبدًا). */
async function minifyJs(terser, code, isModule) {
  const r = await terser.minify(code, OPTIONS(isModule));
  if (!r || typeof r.code !== 'string' || (code.trim() && !r.code.trim())) throw new Error('empty-output');
  return r.code;
}

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
async function minifyHtml(terser, html) {
  let changed = 0, failed = 0; const parts = []; let last = 0;
  for (const m of html.matchAll(SCRIPT_RE)) {
    const attrs = m[1], body = m[2];
    const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1] || '';
    const isJs = !/\bsrc\s*=/i.test(attrs) && body.trim().length > 40 && (!type || /^(text\/javascript|application\/javascript|module)$/i.test(type));
    if (!isJs) continue;
    try {
      const out = await minifyJs(terser, body, type.toLowerCase() === 'module');
      parts.push(html.slice(last, m.index), `<script${attrs}>${out}</script>`); last = m.index + m[0].length; changed++;
    } catch { failed++; }
  }
  parts.push(html.slice(last));
  return { html: parts.join(''), changed, failed };
}

/** يقوّي مجلد نسخة لعبة. يعيد ملخصًا يُحفظ في السجل. */
export async function hardenTree(terser, dir, files) {
  const sum = { js: 0, html: 0, inline: 0, skipped: [], bytesBefore: 0, bytesAfter: 0 };
  for (const f of files) {
    const ext = path.extname(f).toLowerCase(), full = path.join(dir, f);
    if (ext !== '.js' && ext !== '.mjs' && ext !== '.html') continue;
    const src = fs.readFileSync(full, 'utf8'); sum.bytesBefore += src.length;
    try {
      if (ext === '.html') {
        const r = await minifyHtml(terser, src);
        if (r.changed) { fs.writeFileSync(full, r.html); sum.html++; sum.inline += r.changed; }
        if (r.failed) sum.skipped.push(`${f} (${r.failed} سكربت مضمّن بقي كما هو)`);
        sum.bytesAfter += (r.changed ? r.html : src).length;
      } else {
        if (/\.min\.m?js$/i.test(f)) { sum.bytesAfter += src.length; continue; }   // مصغّر أصلًا
        const out = await minifyJs(terser, src, ext === '.mjs' || looksModule(src));
        fs.writeFileSync(full, out); sum.js++; sum.bytesAfter += out.length;
      }
    } catch (e) { sum.skipped.push(`${f} (${String(e && e.message || e).slice(0, 60)})`); sum.bytesAfter += src.length; }
  }
  return sum;
}
