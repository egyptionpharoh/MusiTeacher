// =====================================================================
//  الهوية العُمانية: عناصر طريق عُماني: مبانٍ بيضاء وبيج بنوافذ مقوّسة وشرفات مسننة، برج قلعة، ولافتات طرق.
//  (العلم نفسه صورة رسمية في assets/img/oman-flag.png — انظر flag.js)
// =====================================================================

/** واجهة مبنى عُماني: جدار أبيض/بيج، نوافذ مقوّسة بمشربيات خشبية، شريط زخرفي، شرفات مسننة في الأعلى */
export function omaniFacade(x, w, h) {
  x.fillStyle = '#f3ede2'; x.fillRect(0, 0, w, h);
  // ظل خفيف ونسيج جصّي
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  // الشرفات المسننة
  x.fillStyle = '#e6dccb'; x.fillRect(0, 0, w, h * 0.06);
  for (let px = 0; px < w; px += w / 8) { x.fillStyle = '#f3ede2'; x.fillRect(px + w / 32, 0, w / 16, h * 0.035); }
  x.fillStyle = '#c9a77a'; x.fillRect(0, h * 0.075, w, h * 0.012);
  // ثلاثة طوابق من النوافذ المقوّسة
  const cols = 3, rows = 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cw = w / cols, ch = (h * 0.86) / rows;
    const wx = c * cw + cw * 0.28, wy = h * 0.12 + r * ch + ch * 0.18, ww = cw * 0.44, wh = ch * 0.62;
    x.fillStyle = '#7a5232'; x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx, wy + ww / 2); x.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); x.lineTo(wx + ww, wy + wh); x.closePath(); x.fill();
    x.strokeStyle = '#5b3a20'; x.lineWidth = 2;
    for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(wx + (ww * k) / 4, wy + ww * 0.25); x.lineTo(wx + (ww * k) / 4, wy + wh); x.stroke(); }
    x.strokeStyle = '#c9a77a'; x.lineWidth = 3; x.beginPath(); x.moveTo(wx - 3, wy + wh); x.lineTo(wx - 3, wy + ww / 2); x.arc(wx + ww / 2, wy + ww / 2, ww / 2 + 3, Math.PI, 0); x.lineTo(wx + ww + 3, wy + wh); x.stroke();
  }
}

/** لافتة طريق زرقاء ثنائية اللغة (أسماء مدن فقط، بلا مسافات أو اتجاهات مخترعة) */
export function roadSign(x, w, h, ar, en) {
  x.fillStyle = '#0d4f9e'; x.beginPath(); x.roundRect(0, 0, w, h, h * 0.08); x.fill();
  x.strokeStyle = '#ffffff'; x.lineWidth = h * 0.035; x.beginPath(); x.roundRect(h * 0.05, h * 0.05, w - h * 0.1, h * 0.9, h * 0.06); x.stroke();
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `800 ${h * 0.38}px Cairo, Tahoma, Arial`; x.fillText(ar, w / 2, h * 0.38);
  x.font = `700 ${h * 0.2}px Arial, sans-serif`; x.fillText(en, w / 2, h * 0.75);
}
export const OMAN_PLACES = [['مسقط', 'Muscat'], ['نزوى', 'Nizwa'], ['صور', 'Sur'], ['صحار', 'Sohar'], ['صلالة', 'Salalah'], ['البريمي', 'Al Buraimi'], ['عبري', 'Ibri'], ['خصب', 'Khasab']];
