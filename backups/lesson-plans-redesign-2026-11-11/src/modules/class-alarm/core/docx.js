// 📄 ملف Word حقيقي قابل للتحرير للجدول الأسبوعي (جدول Word من اليمين لليسار، A4 أفقي) — بلا مكتبات.
import { zip } from './zip.js';
import { DAY_NAMES, fmtTime } from './time.js';
import { shortClass } from './sheet.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = 'Arial';
const THEMES = {
  official: { head: '113F67', headInk: 'FFFFFF', day: 'EAF1F8', cell: 'F4F8FC', accent: 'B8913A' },
  modern: { head: '226597', headInk: 'FFFFFF', day: 'E3EFF8', cell: 'EEF6FB', accent: '3A8FB7' },
  print: { head: 'FFFFFF', headInk: '000000', day: 'FFFFFF', cell: 'FFFFFF', accent: '000000' },
  colorful: { head: '4C1D95', headInk: 'FFFFFF', day: 'FAF5FF', cell: 'FAF5FF', accent: '6D28D9' },
};

function run(text, { b, sz = 22, color } = {}) {
  const lines = String(text).split('\n');
  return lines.map((t, i) => `<w:r><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>${b ? '<w:b/><w:bCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('');
}
const para = (inner, { jc = 'center', after = 0 } = {}) => `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="${after}"/><w:jc w:val="${jc}"/></w:pPr>${inner}</w:p>`;

function cell(content, { w, fill, vMerge, bold, sz = 22, color, textDir } = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${vMerge ? `<w:vMerge${vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : ''}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}${textDir ? `<w:textDirection w:val="${textDir}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${para(content ? run(content, { b: bold, sz, color }) : '')}</w:tc>`;
}

export async function buildScheduleDocx(profile, { template = 'official', h24 = false } = {}) {
  const th = THEMES[template] || THEMES.official;
  const days = profile.days;
  const cols = profile.periods.filter((p) => p.start || p.kind === 'lesson');
  const usable = 16838 - 2 * 700;
  const dayW = 1300, brkW = 600;
  const nBrk = cols.filter((p) => p.kind === 'break').length, nLes = cols.length - nBrk;
  const lesW = Math.floor((usable - dayW - nBrk * brkW) / Math.max(1, nLes));
  const widths = [dayW, ...cols.map((p) => (p.kind === 'break' ? brkW : lesW))];
  const border = template === 'print' ? '000000' : 'B7C4D3';

  const header = `<w:tr><w:trPr><w:tblHeader/><w:trHeight w:val="700"/></w:trPr>${cell('اليوم', { w: dayW, fill: th.head, bold: true, color: th.headInk })}${cols.map((p, i) => p.kind === 'break'
    ? cell(p.name || 'استراحة', { w: widths[i + 1], fill: th.head, bold: true, color: th.headInk, sz: 18, textDir: 'tbRl' })
    : cell(`${p.label}${p.start ? `\n${fmtTime(p.start, h24)} – ${fmtTime(p.end, h24)}` : ''}`, { w: widths[i + 1], fill: th.head, bold: true, color: th.headInk, sz: 20 })).join('')}</w:tr>`;

  const body = days.map((d, ri) => `<w:tr><w:trPr><w:trHeight w:val="1050"/></w:trPr>${cell(DAY_NAMES[d], { w: dayW, fill: th.day, bold: true, sz: 26 })}${cols.map((p, i) => {
    if (p.kind === 'break') return cell(ri === 0 ? p.name || 'استراحة' : '', { w: widths[i + 1], fill: 'EEF2F6', vMerge: ri === 0 ? 'restart' : 'continue', sz: 20, textDir: 'tbRl', bold: true });
    const l = (profile.lessons[d] || {})[p.id];
    if (!l) return cell('', { w: widths[i + 1] });
    const own = profile.dayTimes && profile.dayTimes[d] && profile.dayTimes[d][p.id];
    const txt = [shortClass(l) || l.subject, l.subject && l.subject !== profile.subject && shortClass(l) ? l.subject : '', l.room, own ? `(${fmtTime(own.start, h24)})` : ''].filter(Boolean).join('\n');
    return cell(txt, { w: widths[i + 1], fill: th.cell, bold: true, sz: 26 });
  }).join('')}</w:tr>`).join('');

  const meta = [profile.teacher && `المعلم/ة: ${profile.teacher}`, profile.subject && `المادة: ${profile.subject}`, profile.year && `العام الدراسي: ${profile.year}`, profile.semester && `الفصل الدراسي: ${profile.semester}`].filter(Boolean).join('     ');

  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${para(run(profile.school || '', { b: true, sz: 32, color: th.head === 'FFFFFF' ? '000000' : th.head }))}
${para(run('الجدول الدراسي الأسبوعي', { b: true, sz: 40 }), { after: 80 })}
${para(run(meta, { sz: 22, color: '4F6077' }), { after: 200 })}
<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${usable}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/>
<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="${/inside/.test(k) ? 6 : 12}" w:space="0" w:color="${border}"/>`).join('')}</w:tblBorders>
<w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
${header}${body}</w:tbl>
${para(run('أُعدّ عبر منصة MusiTeacher', { sz: 16, color: '8A99AB' }), { jc: 'left' })}
<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="700" w:right="700" w:bottom="600" w:left="700" w:header="300" w:footer="300" w:gutter="0"/><w:bidi/></w:sectPr>
</w:body></w:document>`;

  const files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(`الجدول الدراسي - ${profile.teacher || ''}`)}</dc:title><dc:creator>MusiTeacher</dc:creator></cp:coreProperties>` },
    { name: 'word/document.xml', data: doc },
  ];
  return zip(files);
}
