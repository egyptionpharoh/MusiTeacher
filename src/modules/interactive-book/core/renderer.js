// رسم صفحات الكتاب عند الحاجة فقط وبدقة الشاشة الحالية، مع ذاكرة مؤقتة صغيرة (LRU)
// حتى يكون الرجوع إلى صفحة سابقة فوريًا دون إعادة معالجة الملف.

const MAX_SIDE = 4096; // حد آمن لأبعاد اللوحة في المتصفحات

export class PageRenderer {
  constructor(doc, { capacity = 12 } = {}) {
    this.doc = doc;
    this.capacity = capacity;
    this.cache = new Map(); // key → { canvas, w, h }
    this.pending = new Map(); // key → Promise
    this.pages = new Map(); // n → PDFPageProxy
    this.sizes = new Map();
    this.destroyed = false;
  }

  async page(n) {
    if (!this.pages.has(n)) this.pages.set(n, this.doc.getPage(n));
    return this.pages.get(n);
  }

  /** أبعاد الصفحة الأصلية (نقاط PDF) */
  async size(n) {
    if (!this.sizes.has(n)) {
      const p = await this.page(n);
      const vp = p.getViewport({ scale: 1 });
      this.sizes.set(n, { w: vp.width, h: vp.height });
    }
    return this.sizes.get(n);
  }

  /** يعيد لوحة مرسومة بعرض targetPx بكسل (أقرب درجة محفوظة). */
  async render(n, targetPx) {
    if (this.destroyed) throw new Error('destroyed');
    const bucket = Math.max(200, Math.ceil(targetPx / 200) * 200); // درجات ثابتة: تقلل إعادة الرسم مع تغيرات صغيرة
    // صورة محفوظة بدقة أعلى أو مساوية تكفي
    let best = null;
    for (const [k, v] of this.cache) {
      if (v.n === n && v.bucket >= bucket && (!best || v.bucket < best.bucket)) best = { k, v };
    }
    if (best) { this.touch(best.k); return best.v.canvas; }
    const key = `${n}@${bucket}`;
    if (this.pending.has(key)) return this.pending.get(key);
    const job = (async () => {
      const p = await this.page(n);
      const vp1 = p.getViewport({ scale: 1 });
      let scale = bucket / vp1.width;
      if (vp1.height * scale > MAX_SIDE) scale = MAX_SIDE / vp1.height;
      if (vp1.width * scale > MAX_SIDE) scale = MAX_SIDE / vp1.width;
      const vp = p.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
      if (this.destroyed) { canvas.width = 0; throw new Error('destroyed'); }
      this.cache.set(key, { canvas, n, bucket });
      this.evict();
      return canvas;
    })();
    this.pending.set(key, job);
    try { return await job; } finally { this.pending.delete(key); }
  }

  touch(k) { const v = this.cache.get(k); this.cache.delete(k); this.cache.set(k, v); }

  evict() {
    while (this.cache.size > this.capacity) {
      const [k, v] = this.cache.entries().next().value;
      this.cache.delete(k);
      v.canvas.width = 0; v.canvas.height = 0; // تحرير ذاكرة اللوحة فورًا
    }
  }

  /** تجهيز الصفحات المجاورة مسبقًا ليكون التقليب فوريًا */
  prefetch(list, targetPx) {
    for (const n of list) if (n >= 1 && n <= this.doc.numPages) this.render(n, targetPx).catch(() => {});
  }

  destroy() {
    this.destroyed = true;
    for (const v of this.cache.values()) { v.canvas.width = 0; v.canvas.height = 0; }
    this.cache.clear();
    for (const p of this.pages.values()) Promise.resolve(p).then((pg) => pg.cleanup()).catch(() => {});
    this.pages.clear();
  }
}
