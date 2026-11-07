// فحص حيّ واحد لنموذج الفصل الحقيقي على Replicate (يكلّف بضعة سنتات). شغّله مرة بعد إضافة المفتاح وقبل الإطلاق:
//   REPLICATE_API_TOKEN=r8_... node tests/audio-separator/live-check.mjs "D:\path\to\clip.mp3"
// يُفضَّل مقطع قصير (15–30 ثانية، أقل من 1MB) من أغنية تملك حق استخدامها.
// يتحقق من: قبول الإصدار المثبّت والمدخلات، شكل المخرجات (vocals / no_vocals)، نسبة التقدم من السجل،
// ويحفظ المسارين في مجلد live-check-output لتستمع إليهما وتحكم على الجودة بنفسك.
import fs from 'node:fs';
import path from 'node:path';
import { getPreset } from '../../src/lib/audio-separator/config.js';
import { makeReplicateProvider, pickStem, progressFromLogs } from '../../src/lib/audio-separator/provider-replicate.js';

const file = process.argv[2];
const token = (process.env.REPLICATE_API_TOKEN || '').trim();
if (!token) { console.error('❌ أضف REPLICATE_API_TOKEN في سطر الأمر.'); process.exit(1); }
if (!file || !fs.existsSync(file)) { console.error('❌ حدّد مسار ملف صوتي قصير.'); process.exit(1); }
const buf = fs.readFileSync(file);
if (buf.length > 3 * 1024 * 1024) { console.error('❌ الملف كبير لهذا الفحص؛ استخدم مقطعًا أقصر من 3MB.'); process.exit(1); }
const ext = path.extname(file).slice(1).toLowerCase();
const mime = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4' }[ext] || 'application/octet-stream';
const preset = getPreset(process.env);
const p = makeReplicateProvider({ token, preset });

console.log(`النموذج: ${preset.label} · ${preset.model}:${preset.version.slice(0, 12)}…`);
await p.check(); console.log('✅ المفتاح صالح');
const t0 = Date.now();
const { id } = await p.create({ audioUrl: `data:${mime};base64,${buf.toString('base64')}`, format: 'mp3', bitrate: 320 });
console.log('✅ بدأت المعالجة:', id);
let g, lastPct = null;
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  g = await p.get(id);
  const pct = progressFromLogs(g.logs, preset.progressPasses);
  if (pct !== lastPct || g.status !== 'processing') { console.log(`   ${g.rawStatus}${pct !== null ? ' · ' + pct + '%' : ''} · ${Math.round((Date.now() - t0) / 1000)}s`); lastPct = pct; }
  if (!['queued', 'processing'].includes(g.status)) break;
}
if (g.status !== 'succeeded') { console.error('❌ فشلت المعالجة:', g.error); process.exit(1); }
console.log('مفاتيح المخرجات:', JSON.stringify(Object.keys(g.output || {})));
const dir = path.resolve('live-check-output'); fs.mkdirSync(dir, { recursive: true });
for (const mode of ['vocals', 'instrumental']) {
  const url = pickStem(g.output, mode);
  if (!url) { console.error(`❌ لم نتعرّف على مسار ${mode} في المخرجات. أرسل السطر السابق للمطوّر.`); process.exit(1); }
  const res = await p.openOutput(url);
  const out = path.join(dir, `${path.basename(file, path.extname(file))}_${mode === 'vocals' ? 'Vocals' : 'Instrumental'}.mp3`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`✅ ${mode}: ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
}
console.log(`✅ اكتمل الفحص. زمن المعالجة المدفوع: ${g.predictTime ?? '?'} ثانية. استمع إلى الملفين قبل الإطلاق.`);
