// تصدير النوتة إلى PDF في المتصفح (بلا مكتبات): كل سطر نوتة يُرسم صورةً على صفحة A4 ولا يُقطع بين صفحتين،
// مع العنوان والمقام وبيانات العمل وعبارة الحقوق في أسفل الصفحة الأخيرة.
import { engrave, toSvgString } from './engrave.js';
import { noteName } from './notation.js';

const PX_W = 1240, PX_H = 1754; // A4 بدقة 150 نقطة في البوصة
const MARGIN = 90; const FONT = "'Cairo','Segoe UI',Tahoma,'Noto Naskh Arabic',sans-serif";

function svgImage(svg) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); res(img); }; img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); }; img.src = url;
  });
}
/** نص عربي ملتف من اليمين */
function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function newPage() {
  const c = document.createElement('canvas'); c.width = PX_W; c.height = PX_H; const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PX_W, PX_H); ctx.fillStyle = '#000'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
  return { c, ctx, y: MARGIN };
}
const toJpeg = (c) => new Promise((res) => c.toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), 'image/jpeg', 0.92));

/** يكتب ملف PDF من صور JPEG (صفحة لكل صورة) */
export function pdfFromJpegs(pages, { w = PX_W, h = PX_H } = {}) {
  const enc = new TextEncoder(); const chunks = []; const offsets = []; let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const N = pages.length; const pageIds = pages.map((_, i) => 3 + i * 3);
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${N} >>`));
  pages.forEach((jpg, i) => {
    const p = 3 + i * 3, content = p + 1, img = p + 2; const cs = `q 595.28 0 0 841.89 0 0 cm /Im0 Do Q`;
    obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`));
    obj(content, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(img, () => { push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
  });
  const xref = len; const total = 3 + N * 3;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
}

/**
 * @param {{title:string, meta:string, music:object, names:boolean, credits:string[], footer:string[]}} o
 * @returns {Promise<Uint8Array>} ملف PDF
 */
export async function scorePdf({ title, meta, music, names, credits = [], footer = [] }) {
  const W = PX_W - MARGIN * 2; const sp = 11;
  const full = engrave(music, { width: W, sp, showNames: names, nameOf: names ? (e) => noteName(e) : undefined });
  const pages = []; let pg = newPage();
  pg.ctx.font = `700 46px ${FONT}`; pg.ctx.textAlign = 'center'; pg.ctx.fillText(title, PX_W / 2, pg.y + 40);
  pg.ctx.font = `400 24px ${FONT}`; pg.ctx.fillText(meta, PX_W / 2, pg.y + 84); pg.ctx.textAlign = 'right';
  pg.y += 120;
  for (let i = 0; i < full.systems.length; i++) {
    const lay = engrave(music, { width: W, sp, measures: full.systems[i].measures, header: i === 0, showNames: names, nameOf: names ? (e) => noteName(e) : undefined });
    const img = await svgImage(toSvgString(lay, { ink: '#000', muted: '#444', label: '#000', chord: '#000', warn: '#444' }));
    if (pg.y + lay.height > PX_H - MARGIN) { pages.push(await toJpeg(pg.c)); pg = newPage(); }
    pg.ctx.drawImage(img, MARGIN, pg.y, lay.width, lay.height); pg.y += lay.height;
  }
  // البيانات والحقوق
  const blocks = [...credits.map((t, k) => ({ t, size: k === 0 ? 22 : 20, bold: k === 0 })), ...footer.map((t) => ({ t, size: 17, muted: true }))];
  const measure = () => { let hgt = 30; for (const b of blocks) { pg.ctx.font = `${b.bold ? 700 : 400} ${b.size}px ${FONT}`; hgt += wrap(pg.ctx, b.t, W).length * b.size * 1.55 + 8; } return hgt; };
  if (pg.y + measure() > PX_H - MARGIN / 2) { pages.push(await toJpeg(pg.c)); pg = newPage(); }
  let y = Math.max(pg.y + 30, PX_H - MARGIN / 2 - measure() + 30);
  pg.ctx.strokeStyle = '#999'; pg.ctx.lineWidth = 1.5; pg.ctx.beginPath(); pg.ctx.moveTo(MARGIN, y - 22); pg.ctx.lineTo(PX_W - MARGIN, y - 22); pg.ctx.stroke();
  for (const b of blocks) {
    pg.ctx.font = `${b.bold ? 700 : 400} ${b.size}px ${FONT}`; pg.ctx.fillStyle = b.muted ? '#444' : '#000';
    for (const line of wrap(pg.ctx, b.t, W)) { pg.ctx.fillText(line, PX_W - MARGIN, y + b.size); y += b.size * 1.55; }
    y += 8;
  }
  pages.push(await toJpeg(pg.c));
  return pdfFromJpegs(pages);
}
