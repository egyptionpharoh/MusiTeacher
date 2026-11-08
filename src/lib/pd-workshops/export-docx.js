// الحقيبة التدريبية بصيغة Word (DOCX) قابلة للتعديل: غلاف، بيانات البرنامج، الوصف والأهداف، الجدول الزمني،
// المحتوى العلمي، أوراق العمل، أدوات التقويم، المراجع، ومساحة للملاحظات. مستند متدفق RTL بلا مكتبات.
import { zip } from '../cover-studio/zip.js';
import { agendaOf, ordinal } from './schema.js';
import { DOMAIN } from './taxonomy.js';
import { BRAND, programFacts, sourceNote, minutesLabel as mins, bidiNums } from './export-text.js';

const FONT = 'Segoe UI';
const NAVY = '14365F', INK = '1F2433', MUTE = '6B7280', LINE = 'C9D6EA', SOFT = 'F1F5FB';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const x = (s) => bidiNums(s)
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ عناصر
// المقاطع اللاتينية والأرقام تُكتب في مقاطع بلا <w:rtl/> حتى لا يعاملها Word كنص عربي فينقلب ترتيبها.
const LATIN = /[A-Za-z0-9][A-Za-z0-9 .,:;'’&/+%_\-–]*[A-Za-z0-9]|[A-Za-z0-9]/g;   // يبدأ وينتهي بحرف/رقم: الأقواس والنقاط تبقى مع النص العربي
function splitDir(t) {
  const out = []; let last = 0, m;
  LATIN.lastIndex = 0;
  while ((m = LATIN.exec(t))) { if (m.index > last) out.push([t.slice(last, m.index), true]); out.push([m[0], false]); last = m.index + m[0].length; }
  if (last < t.length) out.push([t.slice(last), true]);
  return out;
}
function r(t, o = {}) {
  const sz = Math.round((o.size || 12) * 2);
  const pr = (rtl) => `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>${o.bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="${o.color || INK}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${rtl ? '<w:rtl/>' : ''}</w:rPr>`;
  const parts = o.ltr ? [[String(t), false]] : splitDir(String(t == null ? '' : t));
  return parts.map(([s, rtl]) => `<w:r>${pr(rtl)}<w:t xml:space="preserve">${x(s)}</w:t></w:r>`).join('');
}
/** فقرة. o: {style, align:'right'|'center'|'left', size, bold, color, after, before, indent, hanging, shade, keepNext, pageBreak, runs} */
function p(t, o = {}) {
  // المحاذاة الافتراضية لفقرة ثنائية الاتجاه هي البداية (اليمين)، فلا نكتب jc إلا للتوسيط؛ والفقرات اللاتينية (ltr) تبدأ من اليسار.
  const pPr = [
    o.style ? `<w:pStyle w:val="${o.style}"/>` : '',
    o.keepNext ? '<w:keepNext/>' : '',
    o.pageBreak ? '<w:pageBreakBefore/>' : '',
    o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : '',
    o.ltr ? '<w:bidi w:val="0"/>' : '<w:bidi/>',
    `<w:spacing w:before="${Math.round((o.before || 0) * 20)}" w:after="${Math.round((o.after != null ? o.after : 6) * 20)}"${o.line ? ` w:line="${o.line}" w:lineRule="auto"` : ''}/>`,
    o.indent || o.hanging ? `<w:ind w:start="${Math.round((o.indent || 0) * 20)}"${o.hanging ? ` w:hanging="${Math.round(o.hanging * 20)}"` : ''}/>` : '',
    o.align === 'center' ? '<w:jc w:val="center"/>' : '',
  ].join('');
  const runs = o.runs ? o.runs.join('') : (t ? r(t, o) : '');
  return `<w:p><w:pPr>${pPr}</w:pPr>${runs}</w:p>`;
}
const h1 = (t, o = {}) => p(t, { style: 'Heading1', keepNext: true, ...o });
const h2 = (t, o = {}) => p(t, { style: 'Heading2', keepNext: true, ...o });
const lead = (label, text) => p('', { runs: [r(`${label}: `, { bold: true, color: NAVY }), r(text)] });
const bullets = (items) => items.map((t) => p('', { indent: 18, hanging: 14, after: 3, runs: [r('•  ', { color: NAVY, bold: true }), r(t)] })).join('');
const numbered = (items) => items.map((t, i) => p('', { indent: 20, hanging: 16, after: 3, runs: [r(`${i + 1}. `, { color: NAVY, bold: true }), r(t)] })).join('');

const border = (c = LINE, sz = 6) => ['top', 'start', 'bottom', 'end', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/>`).join('');
/** جدول: rows = [[cell, ...]], cell = string | {t, bold, fill, color, align}. widths بالنسبة المئوية. */
function table(rows, { widths, header = false, borders = true, minH } = {}) {
  const total = 9638; // عرض النص بوحدة twip (A4 بهوامش 2 سم)
  const ws = (widths || rows[0].map(() => 100 / rows[0].length)).map((w) => Math.round((total * w) / 100));
  const grid = ws.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const body = rows.map((row, ri) => `<w:tr>${minH ? `<w:trPr><w:trHeight w:val="${minH * 20}" w:hRule="atLeast"/>${ri === 0 && header ? '<w:tblHeader/>' : ''}</w:trPr>` : (ri === 0 && header ? '<w:trPr><w:tblHeader/></w:trPr>' : '')}${row.map((c, ci) => {
    const cell = typeof c === 'object' && c ? c : { t: c };
    const isHead = header && ri === 0;
    const fill = cell.fill || (isHead ? NAVY : null);
    return `<w:tc><w:tcPr><w:tcW w:w="${ws[ci]}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${p(cell.t == null ? '' : String(cell.t), { bold: isHead || cell.bold, color: isHead ? 'FFFFFF' : cell.color, align: cell.align, after: 0 })}</w:tc>`;
  }).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${total}" w:type="dxa"/><w:tblBorders>${borders ? border() : ''}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:start w:w="110" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:end w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>${p('', { after: 4 })}`;
}
/** أسطر فارغة للكتابة اليدوية. */
function writingLines(n) {
  const row = `<w:tr><w:trPr><w:trHeight w:val="500" w:hRule="exact"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9638" w:type="dxa"/></w:tcPr>${p('', { after: 0 })}</w:tc></w:tr>`;
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9638" w:type="dxa"/><w:tblBorders><w:insideH w:val="single" w:sz="4" w:space="0" w:color="${LINE}"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="${LINE}"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9638"/></w:tblGrid>${row.repeat(n)}</w:tbl>${p('', { after: 4 })}`;
}
const box = (title, inner) => `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9638" w:type="dxa"/><w:tblBorders>${border(LINE, 8)}</w:tblBorders><w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:start w:w="160" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:end w:w="160" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="9638"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="9638" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${SOFT}"/></w:tcPr>${title ? p(title, { bold: true, color: NAVY, after: 4 }) : ''}${inner || p('')}</w:tc></w:tr></w:tbl>${p('', { after: 6 })}`;

// ------------------------------------------------------------------ المحتوى
export function kitBody(w) {
  const accent = ((DOMAIN[w.domain] || {}).color || '#1D4ED8').replace('#', '');
  const facts = programFacts(w);
  const out = [];

  // الغلاف
  out.push(p('حقيبة تدريبية — برنامج إنماء مهني', { shade: NAVY, color: 'FFFFFF', bold: true, size: 13, align: 'center', after: 0, before: 0, line: 420 }));
  out.push(p('', { shade: accent, after: 60, line: 120 }));
  out.push(p(w.title, { size: 28, bold: true, color: NAVY, align: 'center', after: 10, line: 320 }));
  if (w.tagline) out.push(p(w.tagline, { size: 14, color: MUTE, align: 'center', after: 40 }));
  else out.push(p('', { after: 40 }));
  const coverFacts = facts.filter(([k]) => ['المجال', 'الفئة المستهدفة', 'المدة', 'مقدّم المشغل', 'المدرسة', 'التاريخ', 'المكان'].includes(k));
  out.push(table(coverFacts.map(([k, v]) => [{ t: k, bold: true, color: NAVY, fill: SOFT }, v]), { widths: [32, 68] }));
  out.push(p('', { after: 120 }));
  out.push(p(BRAND, { size: 10, color: MUTE, align: 'center', after: 0 }));

  // بيانات البرنامج + الوصف والأهداف
  out.push(h1('بيانات البرنامج التدريبي', { pageBreak: true }));
  out.push(table(facts.map(([k, v]) => [{ t: k, bold: true, color: NAVY, fill: SOFT }, v]), { widths: [32, 68] }));
  out.push(h1('وصف البرنامج'));
  if (w.summary) out.push(p(w.summary));
  if (w.importance) out.push(lead('أهميته', w.importance));
  out.push(h2('الهدف العام')); out.push(p(w.goal));
  out.push(h2('الأهداف التفصيلية')); out.push(p('يُتوقع من المشارك في نهاية البرنامج أن:')); out.push(numbered(w.objectives));
  if (w.materials.length) { out.push(h2('المواد والأدوات اللازمة')); out.push(bullets(w.materials)); }
  if (w.strategies.length) { out.push(h2('أساليب واستراتيجيات التدريب')); out.push(bullets(w.strategies)); }

  // الجدول الزمني
  out.push(h1('الجدول الزمني', { pageBreak: true }));
  const ag = agendaOf(w);
  out.push(table([['م', 'الفقرة', 'الزمن', 'الدقيقة'], ...ag.map((a, i) => [{ t: String(i + 1), align: 'center' }, a.title, { t: mins(a.minutes), align: 'center' }, { t: `${a.from}–${a.to}`, align: 'center' }])],
    { widths: [7, 59, 17, 17], header: true }));

  // المحتوى العلمي
  out.push(h1('المحتوى التدريبي'));
  out.push(h2(`الافتتاح (${mins(w.opening.minutes)})`));
  if (w.opening.welcome) out.push(p(w.opening.welcome));
  if (w.opening.agreements.length) { out.push(p('اتفاقيات المشغل:', { bold: true, color: NAVY })); out.push(bullets(w.opening.agreements)); }
  if (w.hook.steps.length) {
    out.push(h2(`النشاط التمهيدي: ${w.hook.title || ''} (${mins(w.hook.minutes)})`));
    if (w.hook.purpose) out.push(lead('الغرض', w.hook.purpose));
    out.push(numbered(w.hook.steps));
  }
  w.axes.forEach((a, i) => {
    out.push(h2(`المحور ${ordinal(i + 1)}: ${a.title} (${mins(a.minutes)})`));
    if (a.explain) out.push(p(a.explain));
    if (a.points.length) out.push(bullets(a.points));
    if (a.example) out.push(box('مثال من الواقع المدرسي', p(a.example, { after: 0 })));
  });
  if (w.closing.takeaway || w.closing.recs.length) {
    out.push(h2(`الخاتمة والتوصيات (${mins(w.closing.minutes)})`));
    if (w.closing.takeaway) out.push(lead('الفكرة الرئيسة', w.closing.takeaway));
    out.push(bullets(w.closing.recs));
  }
  if (w.notes) { out.push(h2('ملاحظات للميسّر')); out.push(p(w.notes)); }

  // أوراق العمل
  out.push(h1('ورقة عمل (1): النشاط التطبيقي', { pageBreak: true }));
  out.push(table([[{ t: 'الاسم / المجموعة:', bold: true, fill: SOFT }, ''], [{ t: 'التخصص:', bold: true, fill: SOFT }, '']], { widths: [28, 72] }));
  out.push(h2(w.activity.title || 'النشاط التطبيقي'));
  if (w.activity.grouping) out.push(lead('التنظيم', w.activity.grouping));
  out.push(numbered(w.activity.steps));
  if (w.activity.output) out.push(box('المنتج المطلوب', p(w.activity.output, { after: 0 })));
  out.push(p('مساحة العمل:', { bold: true, color: NAVY }));
  out.push(writingLines(12));
  if (w.discussion.questions.length) {
    out.push(h1('ورقة عمل (2): النقاش وتبادل الخبرات', { pageBreak: true }));
    w.discussion.questions.forEach((q, i) => { out.push(p(`${i + 1}. ${q}`, { bold: true, keepNext: true })); out.push(writingLines(4)); });
  }

  // أدوات التقويم
  out.push(h1('أداة تقويم أثر المشغل', { pageBreak: true }));
  if (w.evaluation.method) out.push(lead('الطريقة', w.evaluation.method));
  if (w.evaluation.items.length) out.push(table([['البند', 'الاستجابة'], ...w.evaluation.items.map((i) => [i, ''])], { widths: [72, 28], header: true, minH: 24 }));
  if (w.evaluation.feedback.length) {
    out.push(h1('بطاقة التغذية الراجعة'));
    w.evaluation.feedback.forEach((q, i) => {
      out.push(p(`${i + 1}. ${q}`, { bold: true, keepNext: true }));
      if (/من 1 إلى 5/.test(q)) out.push(table([['1', '2', '3', '4', '5'].map((n) => ({ t: n, align: 'center' }))], { minH: 22 }));
      else out.push(writingLines(2));
    });
  }

  // النتائج والمراجع والملاحظات
  out.push(h1('النتائج المتوقعة', { pageBreak: true }));
  out.push(bullets(w.outcomes));
  if (w.refs.length) {
    out.push(h1('المراجع والمصادر'));
    out.push(p('مراجع منشورة للاستزادة حول موضوع المشغل:', { color: MUTE, size: 11 }));
    out.push(w.refs.map((t) => p(t, { ltr: true, size: 11, after: 4 })).join(''));
  }
  out.push(h1('ملاحظات وتوصيات'));
  out.push(writingLines(8));
  out.push(p(sourceNote(w), { size: 10, color: MUTE, before: 12 }));
  return out.join('');
}

function stylesXML() {
  const rpr = (sz, color, bold) => `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr>`;
  return `${HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:bidi="ar-OM"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:bidi/></w:pPr>${rpr(24, INK)}</w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="${LINE}"/></w:pBdr><w:spacing w:before="280" w:after="140"/><w:outlineLvl w:val="0"/></w:pPr>${rpr(32, NAVY, true)}</w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>${rpr(27, '24527F', true)}</w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
}

/** @returns {Promise<Uint8Array>} ملف DOCX للحقيبة التدريبية */
export async function buildKitDocx(w) {
  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const footer = `${HEAD}<w:ftr ${W_NS}>${p('', { align: 'center', after: 0, runs: [
    r(`${BRAND} — `, { size: 9, color: MUTE }),
    '<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>',
  ] })}</w:ftr>`;
  const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:titlePg/><w:bidi/></w:sectPr>';
  const document = `${HEAD}<w:document ${W_NS}><w:body>${kitBody(w)}${sect}</w:body></w:document>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const files = [
    { name: '[Content_Types].xml', data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(`حقيبة تدريبية — ${w.title}`)}</dc:title><dc:creator>${x(w.settings.presenter || 'MusiTeacher')}</dc:creator><dc:language>ar-OM</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { name: 'word/_rels/document.xml.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>` },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: stylesXML() },
    { name: 'word/settings.xml', data: `${HEAD}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` },
    { name: 'word/footer1.xml', data: footer },
  ];
  return zip(files);
}
