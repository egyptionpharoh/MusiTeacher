'use client';
// عرض نموذج الغلاف في المتصفح بنفس المواضع والمقاسات المستعملة في ملف Word (وحدات ملم ونقاط).
import { memo, useMemo } from 'react';
import { renderArt } from '@/lib/cover-studio/art';
import { fontCss } from '@/lib/cover-studio/designs';

const artCache = new Map();
export function artDataUrl(artId, palette) {
  const key = artId + JSON.stringify(palette);
  if (!artCache.has(key)) {
    if (artCache.size > 120) artCache.clear();
    artCache.set(key, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderArt(artId, palette)));
  }
  return artCache.get(key);
}

const rgba = (hex, a) => {
  const h = String(hex || '#000').replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
};

function effectStyle(fx, color) {
  if (!fx) return { color };
  switch (fx.type) {
    case 'deep3d': return { color: fx.color, textShadow: `0.45pt 0.45pt 0 ${fx.dark}, 0.9pt 0.9pt 0 ${fx.dark}, 1.35pt 1.35pt 0 ${fx.dark}, 1.8pt 1.8pt 0 ${fx.dark}, 2.4pt 2.8pt 3pt ${rgba('#000', 0.28)}` };
    case 'gold': return {
      backgroundImage: `linear-gradient(180deg, ${fx.grad[0]} 8%, ${fx.grad[1]} 52%, ${fx.grad[2]} 96%)`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
      filter: `drop-shadow(0 0.9pt 0.6pt ${rgba(fx.dark, 0.6)}) drop-shadow(0 1.6pt 2pt ${rgba('#000', 0.25)})`,
    };
    case 'emboss': return { color: fx.color, textShadow: `0 1pt 1.2pt ${rgba(fx.dark, 0.5)}, 0 -0.4pt 0 ${rgba('#fff', 0.5)}` };
    case 'outline': return { color: fx.color, textShadow: '1.6pt 1.6pt 0 #BBBBBB' };
    default: return { color: fx.color || color };
  }
}

function CoverPageImpl({ model, images = {}, width, showMissing = true, className = '' }) {
  const scale = width ? width / ((210 / 25.4) * 96) : 1;
  const art = useMemo(() => artDataUrl(model.art, model.palette), [model.art, model.palette]);
  return (
    <div className={`cs-page-wrap ${className}`} style={width ? { width, height: width * (297 / 210) } : undefined}>
      <div className="cs-page" style={{ transform: scale !== 1 ? `scale(${scale})` : undefined }} dir="rtl">
        <img className="cs-art" src={art} alt="" draggable="false" />
        {model.items.map((it, i) => {
          const pos = { left: `${it.x}mm`, top: `${it.y}mm`, width: `${it.w}mm`, height: `${it.h}mm` };
          if (it.type === 'image') {
            const src = images[it.key] && images[it.key].src;
            return src ? <img key={i} className="cs-img" src={src} alt="" style={{ ...pos, opacity: it.opacity || 1 }} draggable="false" /> : null;
          }
          return (
            <div key={i} className="cs-box" data-box={it.id} style={{
              ...pos, background: it.fill || undefined, border: it.stroke ? `${it.strokeW || 0.35}mm solid ${it.stroke}` : undefined,
              borderRadius: it.radius ? `${it.radius}mm` : undefined, boxSizing: 'border-box',
            }}>
              {it.paras.map((p, j) => (
                <p key={j} style={{ textAlign: p.align, lineHeight: p.lineH }}>
                  {p.runs.map((r, k) => (
                    <span key={k} style={{ fontFamily: fontCss(r.font), fontSize: `${r.size}pt`, fontWeight: r.bold ? 700 : 400, ...effectStyle(r.effect, r.color) }}>{r.t}</span>
                  ))}
                </p>
              ))}
            </div>
          );
        })}
        {showMissing && model.missing.map((m) => (
          <div key={m.key} className="cs-missing" style={{ left: `${m.x}mm`, top: `${m.y}mm`, width: `${m.w}mm`, height: `${m.h}mm`, borderColor: model.palette.ink2, color: model.palette.ink2 }}>
            شعار السلطنة
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CoverPageImpl);
