'use client';
// طبقة الرسم فوق صفحة واحدة — مستقلة تمامًا عن محتوى PDF.
import React, { useEffect, useRef } from 'react';
import { drawAll, drawShape, makeShape, extend, meaningful, hits } from '../core/annotations.js';

const DRAW = new Set(['pen', 'highlight', 'arrow', 'rect', 'ellipse', 'eraser']);

export default function AnnotLayer({ page, shapes, w, h, tool, color, width, visible, onChange }) {
  const ref = useRef(null);
  const live = useRef(null); // الشكل الجاري رسمه
  const erasing = useRef(null); // { before, current }
  const active = visible && DRAW.has(tool);

  const repaint = (list) => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAll(ctx, visible ? list : [], w, h);
    if (live.current) drawShape(ctx, live.current, w, h);
  };

  useEffect(() => { repaint(erasing.current ? erasing.current.current : shapes); });

  const pt = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const down = (e) => {
    if (!active || e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    ref.current.setPointerCapture(e.pointerId);
    const p = pt(e);
    if (tool === 'eraser') {
      erasing.current = { before: shapes || [], current: (shapes || []).slice() };
      eraseAt(p);
    } else {
      live.current = makeShape(tool, color, width, p);
      repaint(shapes);
    }
  };
  const eraseAt = (p) => {
    const r = Math.max(0.012, (width * 2.2) / 800);
    const cur = erasing.current.current;
    const left = cur.filter((s) => !hits(s, p, r));
    if (left.length !== cur.length) { erasing.current.current = left; repaint(left); }
  };
  const move = (e) => {
    if (!active) return;
    if (erasing.current) { e.preventDefault(); eraseAt(pt(e)); return; }
    if (!live.current) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) extend(live.current, pt(ev));
    repaint(shapes);
  };
  const up = () => {
    if (erasing.current) {
      const { before, current } = erasing.current;
      erasing.current = null;
      if (current.length !== before.length) onChange(page, current, before);
      return;
    }
    const s = live.current; live.current = null;
    if (s && meaningful(s)) onChange(page, [...(shapes || []), s], shapes || []);
    else repaint(shapes);
  };

  return (
    <canvas ref={ref} className={`ib-annot ${active ? 'is-active' : ''} ${tool === 'eraser' ? 'is-eraser' : ''}`}
      style={{ width: w, height: h }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
  );
}
