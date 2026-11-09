// طبقة الشرح فوق الصفحة: خطوط وأشكال بإحداثيات نسبية (0..1) فتبقى في مكانها مع أي تكبير أو حجم شاشة.
// تُحفظ منفصلة عن ملف PDF فلا يتغير المحتوى الأصلي.

export const TOOLS = ['pen', 'highlight', 'arrow', 'rect', 'ellipse', 'eraser'];
export const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#111827', '#ffffff'];
export const WIDTHS = [2, 4, 7, 12];

export function makeShape(tool, color, width, p) {
  const base = { id: Math.random().toString(36).slice(2, 10), tool, color, width };
  if (tool === 'pen' || tool === 'highlight') return { ...base, pts: [p] };
  return { ...base, a: p, b: p };
}

export function extend(shape, p) {
  if (shape.pts) {
    const last = shape.pts[shape.pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.0015) shape.pts.push(p);
  } else shape.b = p;
  return shape;
}

/** هل الشكل صالح للحفظ (ليس نقرة عابرة) */
export function meaningful(s) {
  if (s.pts) return s.pts.length >= 1;
  return Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 0.01;
}

/** سُمك الخط بالبكسل نسبةً إلى عرض الصفحة المعروض (يبقى متناسقًا مع التكبير) */
const px = (s, W) => Math.max(1, (s.tool === 'highlight' ? s.width * 3.2 : s.width) * (W / 800));

export function drawShape(ctx, s, W, H) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
  ctx.lineWidth = px(s, W);
  if (s.tool === 'highlight') { ctx.globalAlpha = 0.33; ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'butt'; }
  if (s.pts) {
    const P = s.pts.map(([x, y]) => [x * W, y * H]);
    if (P.length === 1) {
      ctx.beginPath(); ctx.arc(P[0][0], P[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length - 1; i++) {
        const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
        ctx.quadraticCurveTo(P[i][0], P[i][1], mx, my);
      }
      ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
      ctx.stroke();
    }
  } else {
    const ax = s.a[0] * W, ay = s.a[1] * H, bx = s.b[0] * W, by = s.b[1] * H;
    ctx.beginPath();
    if (s.tool === 'rect') ctx.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    else if (s.tool === 'ellipse') ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2 || 1, Math.abs(by - ay) / 2 || 1, 0, 0, Math.PI * 2);
    else if (s.tool === 'arrow') {
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const ang = Math.atan2(by - ay, bx - ax), head = Math.max(10, ctx.lineWidth * 3.5);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - head * Math.cos(ang - 0.45), by - head * Math.sin(ang - 0.45));
      ctx.lineTo(bx - head * Math.cos(ang + 0.45), by - head * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAll(ctx, shapes, W, H) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const s of shapes || []) drawShape(ctx, s, W, H);
}

const distSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

/** هل تلمس الممحاة (نقطة p بنصف قطر r نسبي) هذا الشكل؟ */
export function hits(s, p, r) {
  if (s.pts) {
    if (s.pts.length === 1) return Math.hypot(p[0] - s.pts[0][0], p[1] - s.pts[0][1]) < r;
    for (let i = 1; i < s.pts.length; i++) if (distSeg(p, s.pts[i - 1], s.pts[i]) < r) return true;
    return false;
  }
  const [x1, y1] = s.a, [x2, y2] = s.b;
  if (s.tool === 'arrow') return distSeg(p, s.a, s.b) < r;
  const lx = Math.min(x1, x2), hx = Math.max(x1, x2), ly = Math.min(y1, y2), hy = Math.max(y1, y2);
  if (s.tool === 'rect') {
    const inside = p[0] > lx - r && p[0] < hx + r && p[1] > ly - r && p[1] < hy + r;
    const deep = p[0] > lx + r && p[0] < hx - r && p[1] > ly + r && p[1] < hy - r;
    return inside && !deep;
  }
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = (hx - lx) / 2 || 1e-6, ry = (hy - ly) / 2 || 1e-6;
  const d = Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry);
  return Math.abs(d - 1) * Math.min(rx, ry) < r * 1.2;
}

/**
 * سجل التراجع/الإعادة لكل الكتاب. كل عملية: { page, before, after } (لقطة أشكال الصفحة).
 */
export class History {
  constructor(limit = 100) { this.undo = []; this.redo = []; this.limit = limit; }
  push(op) { this.undo.push(op); if (this.undo.length > this.limit) this.undo.shift(); this.redo = []; }
  canUndo() { return this.undo.length > 0; }
  canRedo() { return this.redo.length > 0; }
  popUndo() { const op = this.undo.pop(); if (op) this.redo.push(op); return op; }
  popRedo() { const op = this.redo.pop(); if (op) this.undo.push(op); return op; }
}
