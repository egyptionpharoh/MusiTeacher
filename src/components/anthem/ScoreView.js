'use client';
// رسم النوتة (SVG) من ناتج المنضّد، مع مؤشر مزامنة يُحدَّث مباشرة على عناصر الرسم دون إعادة بناء الصفحة.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { engrave } from '@/lib/anthem/engrave';

function Prim({ it }) {
  switch (it.t) {
    case 'line': return <line data-ev={it.tag} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} strokeWidth={it.w} className={it.c ? `an-s-${it.c}` : undefined} stroke="currentColor" />;
    case 'circle': return <circle cx={it.cx} cy={it.cy} r={it.r} fill="currentColor" />;
    case 'rect': return <rect x={it.x} y={it.y} width={it.w} height={it.h} fill="currentColor" />;
    case 'ellipse': return <ellipse cx={it.cx} cy={it.cy} rx={it.rx} ry={it.ry} fill="none" stroke="currentColor" strokeWidth={it.sw} />;
    case 'head': return it.hollow
      ? <ellipse cx={it.cx} cy={it.cy} rx={it.rx * 0.9} ry={it.ry * 0.82} transform={`rotate(-22 ${it.cx} ${it.cy})`} fill="none" stroke="currentColor" strokeWidth={it.sw} />
      : <ellipse cx={it.cx} cy={it.cy} rx={it.rx} ry={it.ry} transform={`rotate(-22 ${it.cx} ${it.cy})`} fill="currentColor" />;
    case 'path': return it.fillNone ? <path d={it.d} fill="none" stroke="currentColor" strokeWidth={it.stroke} strokeLinecap="round" strokeLinejoin="round" /> : <path data-ev={it.tag} d={it.d} fill="currentColor" />;
    case 'poly': return <polygon points={it.pts.map((p) => p.join(',')).join(' ')} fill="currentColor" />;
    case 'text': return <text x={it.x} y={it.y} fontSize={it.size} textAnchor={it.anchor} fontWeight={it.bold ? 700 : undefined} fontStyle={it.italic ? 'italic' : undefined} className={`an-t ${it.serif ? 'an-serif' : ''} ${it.c ? `an-t-${it.c}` : ''}`} direction={it.rtl ? 'rtl' : undefined} fill="currentColor">{it.text}</text>;
    default: return null;
  }
}

/**
 * @param {{song:object, sp?:number, showNames?:boolean, nameOf?:Function, measures?:number[], compact?:boolean, header?:boolean,
 *          onNote?:(mi:number,ei:number)=>void, onMeasure?:(mi:number)=>void, selection?:{from:number,to:number}|null, marks?:object, label?:string, fixedWidth?:number}} props
 */
const ScoreView = forwardRef(function ScoreView({ song, sp = 10, showNames = false, nameOf, measures, compact = false, header = true, onNote, onMeasure, selection, marks, label, fixedWidth, autoScroll = true }, ref) {
  const wrap = useRef(null); const svgRef = useRef(null); const cursorRef = useRef(null); const active = useRef({ ev: null, ms: null });
  const [width, setWidth] = useState(fixedWidth || 0);
  useEffect(() => {
    if (fixedWidth) return undefined; const el = wrap.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(Math.max(260, Math.floor(el.clientWidth - 4)))); ro.observe(el); setWidth(Math.max(260, Math.floor(el.clientWidth - 4)));
    return () => ro.disconnect();
  }, [fixedWidth]);
  const lay = useMemo(() => (width ? engrave(song, { width, sp, showNames, nameOf, measures, compact, header }) : null), [song, width, sp, showNames, nameOf, measures, compact, header]);
  const boxes = useMemo(() => { const m = {}; if (lay) lay.measureBoxes.forEach((b) => { m[b.mi] = b; }); return m; }, [lay]);

  useImperativeHandle(ref, () => ({
    /** يضيء النغمة الحالية والمازورة، ويحرك خط المؤشر بين بداية الحدث ونهايته حسب النسبة */
    setCursor(mi, ei, frac = 0, nextX = null) {
      const svg = svgRef.current; if (!svg || !lay) return;
      const evKey = mi === null || mi === undefined ? null : `${mi}:${ei}`;
      // نعيد إضافة الصنف في كل إطار: إعادة الرسم (تحديد/علامات) قد تمسح الأصناف المضافة مباشرة
      if (active.current.ev !== evKey && active.current.ev) svg.querySelectorAll(`[data-ev="${active.current.ev}"]`).forEach((n) => n.classList.remove('is-now'));
      if (evKey) svg.querySelectorAll(`[data-ev="${evKey}"]`).forEach((n) => n.classList.add('is-now'));
      active.current.ev = evKey;
      const prevMs = active.current.ms;
      if (prevMs !== mi && prevMs !== null && prevMs !== undefined) svg.querySelector(`[data-ms="${prevMs}"]`)?.classList.remove('is-now');
      if (mi !== null && mi !== undefined) {
        const n = svg.querySelector(`[data-ms="${mi}"]`); n?.classList.add('is-now');
        if (prevMs !== mi && autoScroll && n && wrap.current) {
          const b = boxes[mi]; const sc = wrap.current.closest('[data-an-scroll]');
          if (b && sc && sc.scrollHeight > sc.clientHeight + 4) { const top = b.y - sp * 2; const vis = sc.scrollTop; if (top < vis || top + b.h > vis + sc.clientHeight) sc.scrollTo({ top: Math.max(0, top - sp * 2), behavior: 'smooth' }); }
          else { const r = n.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight - 170) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        }
      }
      active.current.ms = mi;
      const c = cursorRef.current; if (!c) return;
      if (mi === null || mi === undefined || !boxes[mi]) { c.setAttribute('visibility', 'hidden'); return; }
      const x0 = lay.eventX[`${mi}:${ei}`]; const b = boxes[mi];
      let x = x0; if (nextX !== null && nextX > x0) x = x0 + (nextX - x0) * frac; else x = x0 + Math.min(frac, 1) * (b.x + b.w - x0 - sp);
      c.setAttribute('x1', x); c.setAttribute('x2', x); c.setAttribute('y1', b.y + sp * 0.8); c.setAttribute('y2', b.y + b.h - sp * 0.8); c.setAttribute('visibility', 'visible');
    },
    eventX: (mi, ei) => (lay ? lay.eventX[`${mi}:${ei}`] : null),
    nextEventX: (mi, ei) => { if (!lay) return null; const n = lay.eventX[`${mi}:${ei + 1}`]; if (n !== undefined) return n; const b = boxes[mi]; return b ? b.x + b.w - sp : null; },
    layout: () => lay,
  }), [lay, boxes, sp, autoScroll]);

  return (
    <div ref={wrap} className={`an-score ${compact ? 'is-compact' : ''}`} dir="ltr">
      {lay && (
        <svg ref={svgRef} width={lay.width} height={lay.height} viewBox={`0 0 ${lay.width} ${lay.height}`} role="img" aria-label={label || 'نوتة موسيقية'} className="an-svg">
          <g className="an-measures">
            {lay.measureBoxes.map((b) => {
              const sel = selection && b.mi >= selection.from && b.mi <= selection.to;
              const mark = marks && marks[b.mi];
              return (
                <rect key={`m${b.mi}`} data-ms={b.mi} x={b.x} y={b.y} width={b.w} height={b.h} rx={sp * 0.6}
                  className={`an-mbox ${sel ? 'is-sel' : ''} ${mark ? `is-${mark}` : ''} ${onMeasure ? 'is-click' : ''}`}
                  onClick={onMeasure ? () => onMeasure(b.mi) : undefined}>
                  <title>{`المازورة ${song.measures[b.mi].number}`}</title>
                </rect>
              );
            })}
          </g>
          {lay.items.map((it, k) => (it.t === 'group'
            ? (
              <g key={it.key} data-ev={it.key} className={`an-ev is-${it.kind} ${onNote && it.kind === 'note' ? 'is-click' : ''} ${marks && marks[it.key] ? `is-${marks[it.key]}` : ''}`}
                onClick={onNote ? (e) => { e.stopPropagation(); onNote(it.mi, it.ei); } : undefined}>
                {it.items.map((x, j) => <Prim key={j} it={x} />)}
                {onNote && <rect className="an-hit" x={it.hit.x} y={it.hit.y} width={it.hit.w} height={it.hit.h} fill="transparent" />}
              </g>
            )
            : <Prim key={k} it={it} />))}
          <line ref={cursorRef} className="an-cursor" visibility="hidden" x1="0" x2="0" y1="0" y2="0" strokeWidth={Math.max(2, sp * 0.28)} />
        </svg>
      )}
    </div>
  );
});
export default ScoreView;
