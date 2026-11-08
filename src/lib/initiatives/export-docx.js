// ملف المبادرة بصيغة Word (DOCX) قابل للتعديل: غلاف (مع شعار المدرسة إن رُفع) + أقسام التعريف والتنفيذ والمتابعة
// والاستدامة + ملاحق (قائمة المتابعة، نموذج قياس الأثر، سجل التوثيق). مستند متدفق RTL بلا مكتبات.
import { zip } from '../cover-studio/zip.js';
import { factsOf, outline, PARTS, ORIGIN_NOTE, BRAND } from './export-html.js';
import { surveyOf } from './schema.js';

const FONT = 'Segoe UI';
const BROWN = '7A3E00', INK = '1F2433', MUTE = '6B7280', LINE = 'E3CFAE', SOFT = 'FFF4E0', ACCENT = 'E08A00';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const x = (s) => String(s == null ? '' : s)
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
  .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// المقاطع اللاتينية والأرقام بلا <w:rtl/> حتى لا ينقلب ترتيبها
const LATIN = /[A-Za-z0-9][A-Za-z0-9 .,:;'’&/+%_\-–]*[A-Za-z0-9]|[A-Za-z0-9]/g;
function splitDir(t) {
  const out = []; let last = 0, m; LATIN.lastIndex = 0;
  while ((m = LATIN.exec(t))) { if (m.index > last) out.push([t.slice(last, m.index), true]); out.push([m[0], false]); last = m.index + m[0].length; }
  if (last < t.length) out.push([t.slice(last), true]);
  return out;
}
function r(t, o = {}) {
  const sz = Math.round((o.size || 12) * 2);
  const pr = (rtl) => `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>${o.bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="${o.color || INK}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${rtl ? '<w:rtl/>' : ''}</w:rPr>`;
  return splitDir(String(t == null ? '' : t)).map(([s, rtl]) => `<w:r>${pr(rtl)}<w:t xml:space="preserve">${x(s)}</w:t></w:r>`).join('');
}
function p(t, o = {}) {
  const pPr = [
    o.style ? `<w:pStyle w:val="${o.style}"/>` : '', o.keepNext ? '<w:keepNext/>' : '', o.pageBreak ? '<w:pageBreakBefore/>' : '',
    o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : '',
    '<w:bidi/>',
    `<w:spacing w:before="${Math.round((o.before || 0) * 20)}" w:after="${Math.round((o.after != null ? o.after : 6) * 20)}"/>`,
    o.indent ? `<w:ind w:start="${Math.round(o.indent * 20)}" w:hanging="${Math.round((o.hanging || 0) * 20)}"/>` : '',
    o.align === 'center' ? '<w:jc w:val="center"/>' : '',
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${o.runs ? o.runs.join('') : (t ? r(t, o) : '')}</w:p>`;
}
const h1 = (t, o = {}) => p(t, { style: 'Heading1', keepNext: true, ...o });
const h2 = (t) => p(t, { style: 'Heading2', keepNext: true });
const bullets = (items, ordered) => items.map((t, i) => p('', { indent: 20, hanging: 15, after: 3, runs: [r(ordered ? `${i + 1}. ` : '•  ', { color: BROWN, bold: true }), r(t)] })).join('');
const TOTAL = 9638;
const borders = (c = LINE) => ['top', 'start', 'bottom', 'end', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="6" w:space="0" w:color="${c}"/>`).join('');
function table(head, rows, widths, { minH, headFill = BROWN } = {}) {
  const ws = (widths || head.map(() => 100 / head.length)).map((w) => Math.round((TOTAL * w) / 100));
  const cell = (txt, i, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${ws[i]}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}</w:tcPr>${p(txt == null ? '' : String(txt), { bold: o.bold, color: o.color, after: 0, align: o.align })}</w:tc>`;
  const tr = (cells, o = {}) => `<w:tr>${o.header || minH ? `<w:trPr>${minH && !o.header ? `<w:trHeight w:val="${minH * 20}" w:hRule="atLeast"/>` : ''}${o.header ? '<w:tblHeader/>' : ''}</w:trPr>` : ''}${cells.join('')}</w:tr>`;
  const headRow = head ? tr(head.map((h, i) => cell(h, i, { bold: true, color: 'FFFFFF', fill: headFill })), { header: true }) : '';
  const body = rows.map((row) => tr(row.map((c, i) => (typeof c === 'object' && c ? cell(c.t, i, c) : cell(c, i))))).join('');
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${TOTAL}" w:type="dxa"/><w:tblBorders>${borders()}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:start w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:end w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${headRow}${body}</w:tbl>${p('', { after: 4 })}`;
}

// ------------------------------------------------------------------ الصور (شعار المدرسة)
function dataUrlBytes(u) {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(u || '');
  if (!m) return null;
  const bin = typeof atob === 'function' ? atob(m[2]) : Buffer.from(m[2], 'base64').toString('binary');
  const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return { ext: m[1] === 'jpeg' ? 'jpeg' : 'png', bytes: b };
}
/** أبعاد PNG/JPEG من رأس الملف. */
export function imageSize(b, ext) {
  if (ext === 'png' && b.length > 24) return { w: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, h: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 };
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xFF) { i++; continue; }
    const mk = b[i + 1]; const len = (b[i + 2] << 8) | b[i + 3];
    if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return { w: 300, h: 300 };
}
function inlineImage(rid, wPx, hPx, maxWcm, maxHcm) {
  const EMU_CM = 360000; let w = maxWcm * EMU_CM, h = (w * hPx) / Math.max(1, wPx);
  if (h > maxHcm * EMU_CM) { h = maxHcm * EMU_CM; w = (h * wPx) / Math.max(1, hPx); }
  w = Math.round(w); h = Math.round(h);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${h}"/><wp:docPr id="1" name="شعار المدرسة"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// ------------------------------------------------------------------ المحتوى
export function fileBody(proj, logo) {
  const pl = proj.plan, m = proj.meta;
  const out = [];
  // أ. الغلاف
  out.push(p('', { shade: 'F59E0B', after: 0, runs: [r(' ', { size: 6 })] }));
  out.push(p('', { shade: 'EA580C', after: 30, runs: [r(' ', { size: 3 })] }));
  if (logo) out.push(p('', { align: 'center', after: 12, runs: [inlineImage('rIdLogo', logo.w, logo.h, 5, 3.2)] }));
  out.push(p(`ملف مبادرة${m.school ? ` — ${m.school}` : ''}`, { align: 'center', bold: true, color: 'B45309', size: 13, after: 8 }));
  out.push(p(pl.title, { align: 'center', bold: true, color: BROWN, size: 28, after: 8 }));
  if (pl.slogan) out.push(p(pl.slogan, { align: 'center', color: '5B4630', size: 14, after: 30 }));
  const coverFacts = factsOf(proj).filter(([k]) => ['المدرسة', 'مقدم المبادرة / الفريق', 'العام الدراسي', 'المجال', 'مدة التنفيذ', 'الفئة المستهدفة'].includes(k));
  out.push(table(null, coverFacts.map(([k, v]) => [{ t: k, bold: true, color: BROWN, fill: SOFT }, v]), [32, 68]));
  out.push(p('', { after: 60 }));
  out.push(p(BRAND, { align: 'center', size: 9, color: MUTE, after: 0 }));

  // بيانات المبادرة ثم الأجزاء ب–هـ
  out.push(h1('بيانات المبادرة', { pageBreak: true }));
  out.push(table(null, factsOf(proj).map(([k, v]) => [{ t: k, bold: true, color: BROWN, fill: SOFT }, v]), [32, 68]));
  let part = '';
  for (const s of outline(proj)) {
    if (s.part !== part) { part = s.part; out.push(h1(`${part}. ${PARTS[part]}`)); }
    out.push(h2(s.title));
    for (const b of s.blocks) {
      if (b.text) out.push(b.lead ? p('', { runs: [r(`${b.lead}: `, { bold: true, color: BROWN }), r(b.text)] }) : p(b.text));
      else if (b.rows) out.push(table(b.head, b.rows, b.widths));
      else { if (b.lead) out.push(p(b.lead, { bold: true, color: '3D2A12', keepNext: true, after: 2 })); out.push(bullets(b.items, b.ordered)); }
    }
  }

  // الملاحق
  if (proj.tasks.length) {
    out.push(h1('ملحق (1): قائمة متابعة التنفيذ', { pageBreak: true }));
    out.push(table(['✓', 'المهمة', 'المرحلة'], proj.tasks.map((t) => [{ t: t.done ? '☑' : '☐', align: 'center' }, t.text, (pl.phases[t.phase] || {}).t || 'مهام إضافية']), [8, 64, 28]));
  }
  const sv = surveyOf(pl);
  out.push(h1('ملحق (2): نموذج قياس الأثر', { pageBreak: true }));
  out.push(p(sv.title, { bold: true, color: BROWN })); out.push(p(sv.intro, { color: MUTE }));
  const sw = Math.round(44 / sv.scale.length);
  out.push(table(['البند', ...sv.scale], sv.items.map((i) => [i, ...sv.scale.map(() => ({ t: '◯', align: 'center' }))]), [100 - sw * sv.scale.length, ...sv.scale.map(() => sw)]));
  for (const q of sv.open) { out.push(p(q, { bold: true, keepNext: true })); out.push(table(null, [[''], ['']], [100], { minH: 22 })); }
  out.push(h1('ملحق (3): سجل التوثيق'));
  out.push(table(['التاريخ', 'النشاط', 'الملاحظات والنتائج'], Array.from({ length: 8 }, () => ['', '', '']), [16, 30, 54], { minH: 28 }));
  out.push(p(ORIGIN_NOTE[proj.origin] || '', { size: 9.5, color: MUTE, before: 10 }));
  return out.join('');
}

function stylesXML() {
  const rpr = (sz, color, bold) => `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr>`;
  return `${HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:bidi="ar-OM"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="290" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:bidi/></w:pPr>${rpr(24, INK)}</w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="2" w:color="${ACCENT}"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="${SOFT}"/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>${rpr(31, BROWN, true)}</w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${LINE}"/></w:pBdr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>${rpr(26, '3D2A12', true)}</w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
}

/** @returns {Promise<Uint8Array>} */
export async function buildProjectDocx(proj) {
  const img = dataUrlBytes(proj.meta.logo);
  const logo = img ? { ...img, ...imageSize(img.bytes, img.ext) } : null;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const fld = (instr) => `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
  const footer = `${HEAD}<w:ftr ${NS}>${p('', { align: 'center', after: 0, runs: [r(`${proj.plan.title} — `, { size: 9, color: MUTE }), fld('PAGE')] })}</w:ftr>`;
  const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:titlePg/><w:bidi/></w:sectPr>';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>', '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>', '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'];
  if (logo) rels.push(`<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${logo.ext === 'jpeg' ? 'jpg' : 'png'}"/>`);
  const files = [
    { name: '[Content_Types].xml', data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(`ملف مبادرة — ${proj.plan.title}`)}</dc:title><dc:creator>${x(proj.meta.presenter || 'MusiTeacher')}</dc:creator><dc:language>ar-OM</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
    { name: 'word/_rels/document.xml.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>` },
    { name: 'word/document.xml', data: `${HEAD}<w:document ${NS}><w:body>${fileBody(proj, logo)}${sect}</w:body></w:document>` },
    { name: 'word/styles.xml', data: stylesXML() },
    { name: 'word/settings.xml', data: `${HEAD}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` },
    { name: 'word/footer1.xml', data: footer },
  ];
  if (logo) files.push({ name: `word/media/logo.${logo.ext === 'jpeg' ? 'jpg' : 'png'}`, data: logo.bytes });
  return zip(files);
}
