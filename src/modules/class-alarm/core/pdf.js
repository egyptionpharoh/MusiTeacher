// 📑 ملف PDF حقيقي من صورة JPEG عالية الدقة (صفحة A4 أفقية واحدة) — بلا مكتبات.
// الصورة مرسومة من نفس قالب المعاينة، فالخط العربي والتنسيق مطابقان تمامًا لما يراه المعلم.

const enc = new TextEncoder();

export function jpegToPdf(jpeg, imgW, imgH, { pageW = 841.89, pageH = 595.28, title = 'Schedule' } = {}) {
  const bytes = jpeg instanceof Uint8Array ? jpeg : new Uint8Array(jpeg);
  // ملاءمة الصورة داخل الصفحة مع الحفاظ على النسبة
  const s = Math.min(pageW / imgW, pageH / imgH);
  const w = imgW * s, h = imgH * s, x = (pageW - w) / 2, y = (pageH - h) / 2;
  const content = `q\n${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  const hexTitle = 'FEFF' + [...title].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('').toUpperCase();
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    null, // الصورة (ثنائية)
    `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`,
    `<< /Title <${hexTitle}> /Producer (MusiTeacher) >>`,
  ];
  const parts = []; const offsets = []; let len = 0;
  const push = (u8) => { parts.push(u8); len += u8.length; };
  push(enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
  objs.forEach((o, i) => {
    offsets.push(len);
    if (o === null) {
      push(enc.encode(`${i + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`));
      push(bytes);
      push(enc.encode('\nendstream\nendobj\n'));
    } else push(enc.encode(`${i + 1} 0 obj\n${o}\nendobj\n`));
  });
  const xref = len;
  let x2 = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) x2 += `${String(o).padStart(10, '0')} 00000 n \n`;
  x2 += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  push(enc.encode(x2));
  const out = new Uint8Array(len); let p = 0;
  for (const u of parts) { out.set(u, p); p += u.length; }
  return out;
}
