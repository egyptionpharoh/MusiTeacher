// مولّد ملف Word حقيقي (DOCX) من نموذج الغلاف — بلا مكتبات.
// • كل النصوص نصوص Word حقيقية داخل مربعات نص قابلة للتحرير (لا صور للنصوص).
// • الخلفية الفنية والشعارات صور عالية الدقة مثبتة بموضع دقيق خلف النص.
// • كل غلاف صفحة واحدة A4 مضمونة: لا شيء يجري في متن الصفحة فيدفع عناصر إلى صفحة ثانية.
// • تأثيرات العنوان (تدرّج، ظل، حواف مجسّمة) بتأثيرات نص Word الأصلية (Word 2010 فأحدث).
import { zip } from './zip.js';

const EMU = 36000;            // لكل ملم
const e = (mm) => Math.round(mm * EMU);
const tw = (pt) => Math.round(pt * 20); // twips لكل نقطة
const hex = (c) => String(c || '#000000').replace('#', '').toUpperCase().slice(0, 6);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" mc:Ignorable="w14 wp14"';

// ---------------------------------------------------------------- تأثيرات العنوان
function w14clr(c, alpha) { return `<w14:srgbClr w14:val="${hex(c)}">${alpha ? `<w14:alpha w14:val="${alpha}"/>` : ''}</w14:srgbClr>`; }
function effectXml(fx) {
  if (!fx) return '';
  const shadow = (c, dist, blur, dir, alpha) => `<w14:shadow w14:blurRad="${blur}" w14:dist="${dist}" w14:dir="${dir}" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl">${w14clr(c, alpha)}</w14:shadow>`;
  const outline = (c, w) => `<w14:textOutline w14:w="${w}" w14:cap="flat" w14:cmpd="sng" w14:algn="ctr"><w14:solidFill>${w14clr(c)}</w14:solidFill><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline>`;
  const bevel = (w, h, prst) => `<w14:props3d w14:extrusionH="0" w14:contourW="0" w14:prstMaterial="warmMatte"><w14:bevelT w14:w="${w}" w14:h="${h}" w14:prst="${prst}"/></w14:props3d>`;
  switch (fx.type) {
    case 'deep3d': // ظل صلب مزاح + حافة مشطوفة = إحساس بالعمق
      return shadow(fx.dark, 28575, 0, 2700000, 0) + outline(fx.dark, 3175) + `<w14:textFill><w14:solidFill>${w14clr(fx.color)}</w14:solidFill></w14:textFill>` + bevel(25400, 12700, 'softRound');
    case 'gold': {
      const [a, b, c] = fx.grad;
      return shadow(fx.dark, 19050, 19050, 2700000, 45000) + outline(c, 6350)
        + `<w14:textFill><w14:gradFill><w14:gsLst><w14:gs w14:pos="0">${w14clr(a)}</w14:gs><w14:gs w14:pos="50000">${w14clr(b)}</w14:gs><w14:gs w14:pos="100000">${w14clr(c)}</w14:gs></w14:gsLst><w14:lin w14:ang="5400000" w14:scaled="0"/></w14:gradFill></w14:textFill>`
        + bevel(38100, 19050, 'circle');
    }
    case 'emboss':
      return shadow(fx.dark, 12700, 12700, 2700000, 50000) + `<w14:textFill><w14:solidFill>${w14clr(fx.color)}</w14:solidFill></w14:textFill>` + bevel(19050, 12700, 'circle');
    case 'outline': // للطباعة الاقتصادية: أسود مع ظل رمادي صلب
      return shadow('#BBBBBB', 22225, 0, 2700000, 0);
    default: return '';
  }
}

// ---------------------------------------------------------------- النص
const LATIN = /[A-Za-z][A-Za-z0-9 .\-_]*[A-Za-z0-9]|[A-Za-z]/g;
function splitDir(t) {
  const out = []; let last = 0, m;
  LATIN.lastIndex = 0;
  while ((m = LATIN.exec(t))) { if (m.index > last) out.push([t.slice(last, m.index), true]); out.push([m[0], false]); last = m.index + m[0].length; }
  if (last < t.length) out.push([t.slice(last), true]);
  return out;
}
function runXml(r) {
  const f = esc(r.font);
  return splitDir(r.t).map(([txt, rtl]) => `<w:r><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>${r.bold ? '<w:b/><w:bCs/>' : ''}<w:color w:val="${hex(r.color)}"/><w:sz w:val="${Math.round(r.size * 2)}"/><w:szCs w:val="${Math.round(r.size * 2)}"/>${rtl ? '<w:rtl/>' : ''}<w:lang w:val="ar-OM" w:bidi="ar-OM"/>${effectXml(r.effect)}</w:rPr><w:t xml:space="preserve">${esc(txt)}</w:t></w:r>`).join('');
}
function paraXml(p) {
  const size = p.runs.length ? Math.max(...p.runs.map((r) => r.size)) : 10;
  const jc = p.align === 'right' ? 'right' : p.align === 'left' ? 'left' : 'center';
  return `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="${tw(size * (p.lineH || 1.2))}" w:lineRule="exact"/><w:jc w:val="${jc}"/></w:pPr>${p.runs.map(runXml).join('')}</w:p>`;
}
function txbxContent(b) {
  const ps = b.paras && b.paras.length ? b.paras.map(paraXml).join('') : '<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';
  return `<w:txbxContent>${ps}</w:txbxContent>`;
}

// ---------------------------------------------------------------- الرسوم المثبتة
function anchor({ id, name, x, y, w, h, z, behind, graphic, locks }) {
  return `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${z}" behindDoc="${behind ? 1 : 0}" locked="${behind ? 1 : 0}" layoutInCell="1" allowOverlap="1">`
    + '<wp:simplePos x="0" y="0"/>'
    + `<wp:positionH relativeFrom="page"><wp:posOffset>${e(x)}</wp:posOffset></wp:positionH>`
    + `<wp:positionV relativeFrom="page"><wp:posOffset>${e(y)}</wp:posOffset></wp:positionV>`
    + `<wp:extent cx="${e(w)}" cy="${e(h)}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>`
    + `<wp:docPr id="${id}" name="${esc(name)}"/><wp:cNvGraphicFramePr>${locks || ''}</wp:cNvGraphicFramePr>`
    + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${graphic}</a:graphic></wp:anchor>`;
}
function pictureXml(o) {
  const g = '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + `<pic:nvPicPr><pic:cNvPr id="${o.id}" name="${esc(o.name)}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${o.rid}">${o.opacity && o.opacity < 1 ? `<a:alphaModFix amt="${Math.round(o.opacity * 100000)}"/>` : ''}</a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${e(o.w)}" cy="${e(o.h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData>`;
  return `<w:r><w:drawing>${anchor({ ...o, graphic: g, locks: '<a:graphicFrameLocks noChangeAspect="1"/>' })}</w:drawing></w:r>`;
}
function textBoxXml(b, id, z) {
  const fill = b.fill ? `<a:solidFill><a:srgbClr val="${hex(b.fill)}"${b.fillAlpha ? `><a:alpha val="${Math.round(b.fillAlpha * 100000)}"/></a:srgbClr>` : '/>'}</a:solidFill>` : '<a:noFill/>';
  const ln = b.stroke ? `<a:ln w="${e(b.strokeW || 0.35)}"><a:solidFill><a:srgbClr val="${hex(b.stroke)}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const geom = b.radius ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round(Math.min(50000, (b.radius / Math.min(b.w, b.h)) * 100000))}"/></a:avLst></a:prstGeom>` : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
  const content = txbxContent(b);
  const wsp = '<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/>'
    + `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${e(b.w)}" cy="${e(b.h)}"/></a:xfrm>${geom}${fill}${ln}</wps:spPr>`
    + `<wps:txbx>${content}</wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${b.valign === 'top' ? 't' : 'ctr'}" anchorCtr="0">${b.paras && b.paras.length ? '<a:spAutoFit/>' : '<a:noAutofit/>'}</wps:bodyPr></wps:wsp></a:graphicData>`;
  const mm2pt = (mm) => (mm / 25.4 * 72).toFixed(2);
  const vtag = b.radius ? 'v:roundrect' : 'v:rect';
  const vml = `<w:pict><${vtag} id="tb${id}" ${b.radius ? `arcsize="${Math.round(Math.min(0.5, b.radius / Math.min(b.w, b.h)) * 65536)}f" ` : ''}style="position:absolute;margin-left:${mm2pt(b.x)}pt;margin-top:${mm2pt(b.y)}pt;width:${mm2pt(b.w)}pt;height:${mm2pt(b.h)}pt;z-index:${z};mso-position-horizontal-relative:page;mso-position-vertical-relative:page;v-text-anchor:middle" `
    + `${b.fill ? `fillcolor="#${hex(b.fill)}" filled="t"` : 'filled="f"'} ${b.stroke ? `strokecolor="#${hex(b.stroke)}" strokeweight="${mm2pt(b.strokeW || 0.35)}pt"` : 'stroked="f"'}><v:textbox inset="0,0,0,0"${b.paras && b.paras.length ? ' style="mso-fit-shape-to-text:t"' : ''}>${content}</v:textbox></${vtag}></w:pict>`;
  return `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>${anchor({ id, name: `${b.id || 'نص'} ${id}`, x: b.x, y: b.y, w: b.w, h: b.h, z, behind: false, graphic: wsp })}</w:drawing></mc:Choice><mc:Fallback>${vml}</mc:Fallback></mc:AlternateContent></w:r>`;
}

// ---------------------------------------------------------------- الملف
/**
 * pages: [{ model, background: { bytes, key } }]
 * assets: { emblem?: {bytes,key}, school?: {bytes,key}, brand?: {bytes,key} } — صور PNG/JPEG
 */
export async function buildDocx({ pages, assets = {}, title = 'غلاف سجل', author = 'MusiTeacher' }) {
  const media = new Map(); // key → { rid, name, bytes, ext }
  const addMedia = (m) => {
    if (!m || !m.bytes) return null;
    if (media.has(m.key)) return media.get(m.key).rid;
    const ext = m.ext || 'png';
    const rid = `rIdImg${media.size + 1}`;
    media.set(m.key, { rid, name: `image${media.size + 1}.${ext}`, bytes: m.bytes, ext });
    return rid;
  };
  let docId = 1, z = 251658240;
  const body = pages.map((pg, pi) => {
    let runs = '';
    const bgRid = addMedia(pg.background);
    if (bgRid) runs += pictureXml({ id: docId++, name: 'الخلفية الفنية', rid: bgRid, x: 0, y: 0, w: 210, h: 297, z: z++, behind: true });
    for (const it of pg.model.items) {
      if (it.type === 'image') {
        const rid = addMedia(assets[it.key]);
        if (rid) runs += pictureXml({ id: docId++, name: { emblem: 'شعار سلطنة عمان', school: 'شعار المدرسة', brand: 'MusiTeacher' }[it.key] || 'صورة', rid, x: it.x, y: it.y, w: it.w, h: it.h, z: z++, opacity: it.opacity });
      } else if (it.type === 'box') runs += textBoxXml(it, docId++, z++);
    }
    // فقرة مرساة صغيرة جدًا: كل العناصر مثبتة بالصفحة، فلا يتجاوز الغلاف صفحة واحدة
    return `<w:p><w:pPr>${pi > 0 ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>${runs}</w:p>`;
  }).join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${[...media.values()].map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}</Relationships>`;
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Sakkal Majalla" w:hAnsi="Sakkal Majalla" w:eastAsia="Times New Roman" w:cs="Sakkal Majalla"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ar-OM" w:eastAsia="en-US" w:bidi="ar-OM"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>';
  const settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:themeFontLang w:val="en-US" w:bidi="ar-OM"/></w:settings>';
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><cp:keywords>MusiTeacher</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>MusiTeacher Cover Studio</Application></Properties>';

  return zip([
    { name: '[Content_Types].xml', data: ct },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/document.xml', data: document },
    { name: 'word/_rels/document.xml.rels', data: rels },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/settings.xml', data: settings },
    { name: 'docProps/core.xml', data: core },
    { name: 'docProps/app.xml', data: app },
    ...[...media.values()].map((m) => ({ name: `word/media/${m.name}`, data: m.bytes })),
  ]);
}
