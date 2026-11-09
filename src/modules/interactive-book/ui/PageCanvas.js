'use client';
// صفحة واحدة: تظهر صورتها المصغّرة فورًا، ثم تُستبدل بنسخة حادة بدقة الشاشة الحالية.
import React, { useEffect, useRef, useState } from 'react';

export default function PageCanvas({ n, renderer, w, h, thumbUrl, label }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!n || !renderer || w < 2 || h < 2) return undefined;
    let alive = true;
    setFailed(false);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const t = setTimeout(() => {
      renderer.render(n, w * dpr).then((src) => {
        if (!alive || !ref.current) return;
        const c = ref.current;
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        // احتواء الصفحة داخل الخانة مع الحفاظ على نسبتها (الصفحات ذات الأبعاد المختلفة)
        const s = Math.min(c.width / src.width, c.height / src.height);
        const dw = src.width * s, dh = src.height * s;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
        setReady(true);
      }).catch(() => { if (alive) setFailed(true); });
    }, 0);
    return () => { alive = false; clearTimeout(t); };
  }, [n, renderer, w, h]);

  useEffect(() => { setReady(false); }, [n]);

  if (!n) return <div className="ib-page ib-page--blank" style={{ width: w, height: h }} />;
  return (
    <div className="ib-page" style={{ width: w, height: h }} aria-label={label || `صفحة ${n}`} role="img">
      {thumbUrl && !ready ? <img className="ib-page__thumb" src={thumbUrl} alt="" draggable={false} /> : null}
      {!thumbUrl && !ready && !failed ? <span className="ib-page__spin" aria-hidden="true" /> : null}
      {failed ? <span className="ib-page__err">تعذّر عرض هذه الصفحة</span> : null}
      <canvas ref={ref} className="ib-page__canvas" style={{ width: w, height: h, opacity: ready ? 1 : 0 }} />
    </div>
  );
}
