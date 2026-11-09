'use client';
// مؤشر ليزر تعليمي: نقطة حمراء متوهجة بأثر يتلاشى — واضح على شاشات العرض (Data Show). لا يُحفظ شيء.
import React, { useEffect, useRef } from 'react';

export default function LaserLayer({ color = '255, 32, 64' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; const parent = c.parentElement;
    const ctx = c.getContext('2d');
    const trail = []; let raf = 0; let alive = true;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = parent.clientWidth * dpr; c.height = parent.clientHeight * dpr;
      c.style.width = `${parent.clientWidth}px`; c.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(parent);
    const move = (e) => {
      const r = parent.getBoundingClientRect();
      trail.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
      if (trail.length > 60) trail.shift();
    };
    parent.addEventListener('pointermove', move);
    const draw = () => {
      if (!alive) return;
      const now = performance.now();
      while (trail.length && now - trail[0].t > 450) trail.shift();
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const life = 1 - (now - b.t) / 450;
        ctx.strokeStyle = `rgba(${color}, ${0.55 * life})`;
        ctx.lineWidth = 3 + 7 * life; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const last = trail[trail.length - 1];
      if (last && now - last.t < 2500) {
        const g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 26);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, `rgba(${color}, 1)`);
        g.addColorStop(0.5, `rgba(${color}, .35)`); g.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(last.x, last.y, 26, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); parent.removeEventListener('pointermove', move); };
  }, [color]);
  return <canvas ref={ref} className="ib-laser" aria-hidden="true" />;
}
