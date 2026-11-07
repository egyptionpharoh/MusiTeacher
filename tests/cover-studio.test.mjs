// اختبارات بنك أغلفة السجلات:  node --test tests/cover-studio.test.mjs
// تتحقق من: نصوص الغلاف، سلامة التكوين لكل التصميمات (داخل الصفحة وبلا تداخل)، وصحة ملف Word (ZIP + XML + صفحة A4 واحدة لكل غلاف).
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { DESIGNS, variantCount } from '../src/lib/cover-studio/designs.js';
import { RECORDS, coverTexts, defaultData, defaultYear, schoolName } from '../src/lib/cover-studio/records.js';
import { buildCover } from '../src/lib/cover-studio/layout.js';
import { renderArt } from '../src/lib/cover-studio/art.js';
import { buildDocx } from '../src/lib/cover-studio/docx.js';
import { zip, crc32 } from '../src/lib/cover-studio/zip.js';

const data = { ...defaultData(new Date('2026-11-08')), school: 'مدرسة طلحة بن عبيدالله للتعليم الأساسي', teacher: 'أ. حسين محمد سيد', governorate: 'شمال الباطنة', grade: 'الخامس الأساسي' };
const imgs = { brand: { w: 504, h: 495 }, emblem: { w: 400, h: 420 }, school: { w: 300, h: 200 } };

// قارئ ZIP صغير للاختبار
function unzip(buf) {
  const out = {}; let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8), csize = buf.readUInt32LE(p + 18), crc = buf.readUInt32LE(p + 14);
    const nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
    const body = buf.subarray(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    const data2 = method === 8 ? zlib.inflateRawSync(body) : body;
    assert.equal(crc32(data2), crc, 'CRC ' + name);
    out[name] = data2; p += 30 + nlen + xlen + csize;
  }
  return out;
}

test('العام الدراسي الافتراضي يتبع بداية العام في أغسطس', () => {
  assert.equal(defaultYear(new Date('2026-11-08')), '2026-2027');
  assert.equal(defaultYear(new Date('2027-03-01')), '2026-2027');
  assert.equal(defaultYear(new Date('2027-08-20')), '2027-2028');
});
test('نصوص الغلاف: المحافظة والمدرسة والمادة والمعد', () => {
  const t = coverTexts({ ...data, role: 'female', semester: 'second', subject: 'both' });
  assert.equal(t.directorate, 'المديرية العامة للتعليم بمحافظة شمال الباطنة');
  assert.equal(t.school, 'مدرسة طلحة بن عبيدالله للتعليم الأساسي', '«مدرسة» لا تتكرر');
  assert.equal(t.subject, 'المهارات / الفنون الموسيقية');
  assert.equal(t.semester, 'الفصل الدراسي: الثاني');
  assert.equal(t.preparer, 'إعداد معلمة المادة: أ. حسين محمد سيد');
  assert.equal(t.year, 'للعام الدراسي ‪2026-2027‬', 'السنتان لا تنعكسان داخل النص العربي');
  assert.equal(schoolName('  مدرسة   النور '), 'النور');
  const c = coverTexts({ ...data, customTitle: 'سجل متابعة | الإنشاد المدرسي' });
  assert.deepEqual(c.title, ['سجل متابعة', 'الإنشاد المدرسي']);
  assert.equal(coverTexts({ ...data, recordId: 'band', showSubject: false }).subject, '');
});
test(`المكتبة: ${DESIGNS.length} تصميمًا بـ${variantCount} لونًا، وكل تصميم بخلفية مختلفة الفكرة`, () => {
  assert.ok(DESIGNS.length >= 25);
  assert.equal(new Set(DESIGNS.map((d) => d.id)).size, DESIGNS.length);
  assert.ok(new Set(DESIGNS.map((d) => d.art)).size >= 24, 'تنوع حقيقي في الخلفيات لا في الألوان فقط');
  assert.ok(RECORDS.length >= 16);
});

for (const d of DESIGNS) {
  test(`التكوين: ${d.name} — كل العناصر داخل الصفحة وبلا تداخل بين النصوص`, () => {
    for (let pi = 0; pi < d.palettes.length; pi++) {
      for (const rec of [RECORDS[0], RECORDS.find((r) => r.id === 'events'), RECORDS.find((r) => r.id === 'remedial')]) {
        for (const logoPos of ['right', 'left']) {
          const m = buildCover({ designId: d.id, paletteIdx: pi, data: { ...data, recordId: rec.id, showSubject: rec.subject, logoPos }, images: imgs });
          for (const it of m.items) {
            assert.ok(it.x >= -0.01 && it.y >= -0.01 && it.x + it.w <= 210.01 && it.y + it.h <= 297.01, `${it.id || it.key} خارج الصفحة`);
          }
          const texts = m.items.filter((it) => it.type === 'box' && !it.decorative);
          const imgItems = m.items.filter((it) => it.type === 'image');
          for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
            const a = texts[i], b = texts[j];
            const ov = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.6 && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.6;
            assert.ok(!ov, `${d.id}: ${a.id} يتداخل مع ${b.id}`);
          }
          for (const im of imgItems) for (const t of texts) {
            if (im.key === 'brand' && t.id === 'brand') continue;
            const ov = Math.min(im.y + im.h, t.y + t.h) - Math.max(im.y, t.y) > 0.6 && Math.min(im.x + im.w, t.x + t.w) - Math.max(im.x, t.x) > 2 && t.id === 'header';
            assert.ok(!ov || im.key === 'school', `${d.id}: ${im.key} يغطي الترويسة`);
          }
          const prep = texts.find((t) => t.id === 'preparer');
          const safe = d.layout.safeBottom || d.layout.brandTop - 4;
          assert.ok(prep.y + prep.h <= safe + 0.5, `${d.id}: المعد يتجاوز الحد الآمن`);
        }
      }
    }
  });
  test(`الخلفية: ${d.name} — SVG سليم بلا عناصر غير مدعومة`, () => {
    const svg = renderArt(d.art, d.palettes[0]);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 210 297"/);
    assert.doesNotMatch(svg, /<pattern|<filter|<mask|<image|<text|NaN|undefined/);
  });
}

test('ملف Word: ZIP سليم، XML صالح، صفحة A4، نصوص قابلة للتحرير، وصفحة لكل غلاف', async () => {
  const png = Buffer.from('89504E470D0A1A0A0000000D4948445200000001000000010806000000', 'hex');
  const pages = ['grades', 'attendance', 'band'].map((rid, i) => ({
    model: buildCover({ designId: DESIGNS[i].id, data: { ...data, recordId: rid }, images: imgs }),
    background: { key: 'bg' + i, bytes: png },
  }));
  const bytes = await buildDocx({ pages, assets: { brand: { key: 'brand', bytes: png }, emblem: { key: 'emblem', bytes: png }, school: { key: 'school', bytes: png } } });
  const files = unzip(Buffer.from(bytes));
  for (const n of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/settings.xml']) assert.ok(files[n], n);
  const doc = files['word/document.xml'].toString('utf8');
  assert.match(doc, /<w:pgSz w:w="11906" w:h="16838"\/>/, 'A4 رأسي');
  assert.equal((doc.match(/<w:pageBreakBefore\/>/g) || []).length, 2, 'ثلاثة أغلفة = ثلاث صفحات');
  assert.match(doc, /<w:t xml:space="preserve">سجل درجات<\/w:t>/, 'العنوان نص حقيقي لا صورة');
  assert.match(doc, /مدرسة طلحة بن عبيدالله للتعليم الأساسي/);
  assert.match(doc, /<w:bidi\/>/); assert.match(doc, /<w:rtl\/>/);
  assert.match(doc, /<wps:txbx><w:txbxContent>/); assert.match(doc, /<mc:Fallback><w:pict>/, 'بديل VML لنسخ Word القديمة');
  assert.match(doc, /<w14:shadow /, 'تأثير العنوان البارز');
  assert.match(doc, /behindDoc="1"/, 'الخلفية خلف النص');
  // كل الوسوم متوازنة (فحص بسيط لسلامة XML)
  const open = (doc.match(/<w:p>/g) || []).length + (doc.match(/<w:p /g) || []).length, close = (doc.match(/<\/w:p>/g) || []).length;
  assert.equal(open, close);
  assert.match(files['word/settings.xml'].toString(), /compatibilityMode" w:uri="http:\/\/schemas.microsoft.com\/office\/word" w:val="15"/);
  const rels = files['word/_rels/document.xml.rels'].toString();
  assert.equal((rels.match(/relationships\/image/g) || []).length, 6, 'الخلفيات تُضمَّن مرة لكل تصميم، والشعارات مرة واحدة');
});

test('ZIP: نص عربي يُضغط ويُستعاد كما هو', async () => {
  const txt = 'سجل الحضور والغياب '.repeat(200);
  const files = unzip(Buffer.from(await zip([{ name: 'a.xml', data: txt }, { name: 'b.png', data: new Uint8Array([1, 2, 3]) }])));
  assert.equal(files['a.xml'].toString('utf8'), txt);
  assert.deepEqual([...files['b.png']], [1, 2, 3]);
});
