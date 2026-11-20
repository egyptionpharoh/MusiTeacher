// فحص المراجع داخل كل لعبة منسوخة: كل ملف تطلبه اللعبة بمسار ثابت (HTML / CSS / JavaScript / importmap)
// يجب أن يكون موجودًا داخل نسختها، بنفس حالة الأحرف بالضبط (خوادم Vercel تفرّق بين A و a، وويندوز لا).
// المسارات التي تُبنى أثناء التشغيل (مثل base + اسم النغمة + '.mp3') لا يمكن فحصها هنا؛ يغطيها اختبار المتصفح.
import fs from 'node:fs';
import path from 'node:path';
import { existsExactCase } from './vercel-router.mjs';

const ASSET = /\.(m?js|css|json|html?|mp3|wav|ogg|m4a|png|jpe?g|gif|svg|webp|fbx|glb|gltf|bin|woff2?|ttf|otf|wasm)$/i;

export function refsOf(file, text) {
  const out = [];
  const add = (r, kind) => { if (r) out.push({ ref: r.trim(), kind }); };
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    // الصفحات المدمجة الضخمة (لعبة في ملف واحد) قد تحوي بيانات base64؛ نأخذ الوسوم فقط
    for (const m of text.matchAll(/<(?:script|img|audio|source|video|link|iframe)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)) add(m[1], 'html');
    for (const m of text.matchAll(/<script[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { for (const v of Object.values(JSON.parse(m[1]).imports || {})) add(v, 'importmap'); } catch { out.push({ ref: '(importmap غير صالح)', kind: 'error' }); }
    }
    for (const m of text.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*type\s*=\s*["']module["'][^>]*>([\s\S]*?)<\/script>/gi)) out.push(...jsRefs(m[1]));
  } else if (ext === '.css') {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(m[1], 'css');
    for (const m of text.matchAll(/@import\s+["']([^"']+)["']/gi)) add(m[1], 'css');
  } else if (ext === '.js' || ext === '.mjs') out.push(...jsRefs(text));
  return out;
}
function jsRefs(text) {
  const out = [];
  for (const m of text.matchAll(/(?:^|[;\s}])(?:import|export)\s[^'"`;]*?\sfrom\s*["']([^"']+)["']/g)) out.push({ ref: m[1], kind: 'import' });
  for (const m of text.matchAll(/(?:^|[;\s(])import\s*["']([^"']+)["']/g)) out.push({ ref: m[1], kind: 'import' });
  for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) out.push({ ref: m[1], kind: 'import' });
  // نصوص ثابتة تشير لملفات أصول (نماذج، أصوات، صور) بمسار نسبي صريح
  // (ملفات .js/.css داخل نصوص الكود هي استيرادات تُفحص أعلاه بالنسبة لملفها، فلا نكررها هنا)
  for (const m of text.matchAll(/["'`](\.{1,2}\/[^"'`\s${}]+?)["'`]/g)) if (ASSET.test(m[1]) && !/\.(m?js|css|html?)$/i.test(m[1])) out.push({ ref: m[1], kind: 'asset' });
  return out;
}

/**
 * يفحص نسخة لعبة واحدة. gameDir = games/<id>، sharedDir = games/_shared
 * يرجع قائمة مشاكل: [{file, ref, problem}]
 */
export function checkGame(gameDir, sharedDir, files) {
  const problems = [];
  let importMap = {};
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!['.html', '.htm', '.css', '.js', '.mjs'].includes(ext)) continue;
    const text = fs.readFileSync(path.join(gameDir, rel), 'utf8');
    if (ext === '.html' || ext === '.htm') {
      for (const m of text.matchAll(/<script[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try { Object.assign(importMap, JSON.parse(m[1]).imports || {}); } catch {}
      }
    }
    for (const { ref, kind } of refsOf(rel, text)) {
      if (kind === 'error') { problems.push({ file: rel, ref, problem: 'importmap غير صالح' }); continue; }
      if (/^(data:|blob:|#|mailto:|javascript:)/i.test(ref)) continue;
      if (/^(https?:)?\/\//i.test(ref)) {
        // مسموح فقط بخطوط Google؛ أي اعتماد خارجي آخر نسجله للعلم
        if (!/fonts\.(googleapis|gstatic)\.com/.test(ref)) problems.push({ file: rel, ref, problem: 'يعتمد على موقع خارجي' });
        continue;
      }
      if (ref.startsWith('/')) { problems.push({ file: rel, ref, problem: 'مسار مطلق من جذر الموقع (يجب أن يكون نسبيًا لمجلد اللعبة)' }); continue; }
      let r = ref.split(/[?#]/)[0];
      // استيراد «مجرد» مثل three أو three/addons/... يُحل من importmap
      if (kind === 'import' && !/^\.{0,2}\//.test(r)) {
        const key = Object.keys(importMap).sort((a, b) => b.length - a.length).find((k) => r === k || (k.endsWith('/') && r.startsWith(k)));
        if (!key) { problems.push({ file: rel, ref, problem: 'استيراد غير معرّف في importmap' }); continue; }
        r = importMap[key] + r.slice(key.length);
        if (!/^\.{0,2}\//.test(r)) continue;
        // مسارات importmap نسبية لصفحة الدخول (جذر اللعبة)
        if (!resolveExists(gameDir, sharedDir, '', r)) problems.push({ file: rel, ref: `${ref} ← ${r}`, problem: 'الملف غير موجود (أو اختلاف حالة الأحرف)' });
        continue;
      }
      if (kind === 'importmap') { if (!r.endsWith('/') && !resolveExists(gameDir, sharedDir, '', r)) problems.push({ file: rel, ref, problem: 'ملف importmap غير موجود' }); continue; }
      if (!ASSET.test(r) && kind !== 'import') continue;
      // الاستيراد يُحسب من مجلد ملف JavaScript نفسه؛ أما نص المسار داخل الكود (يُمرَّر لـ fetch أو محمّل نماذج) فيحسبه المتصفح من صفحة اللعبة
      const fromPage = kind === 'asset' && /\.m?js$/i.test(rel);
      const base = fromPage || path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel);
      if (!resolveExists(gameDir, sharedDir, base, r)) problems.push({ file: rel, ref, problem: 'الملف غير موجود (أو اختلاف حالة الأحرف)' });
    }
  }
  return problems;
}

// نفس ما يفعله المتصفح ثم الخادم: نحسب الرابط الكامل /g/<id>/<base>/<ref> ؛ لو خرج من /g/<id>/ فهو مكسور على الموقع
// (مثل ../_shared من جذر اللعبة ← /g/_shared). والمسار الذي يبدأ بـ _shared/ يُخدم من games/_shared
function resolveExists(gameDir, sharedDir, base, ref) {
  const root = '/g/' + path.basename(gameDir) + '/';
  const url = path.posix.normalize(path.posix.join(root, base, ref));
  if (!url.startsWith(root)) return false;
  const joined = url.slice(root.length);
  if (joined === '_shared' || joined.startsWith('_shared/')) return existsExactCase(sharedDir, joined.slice('_shared/'.length));
  return existsExactCase(gameDir, joined);
}
