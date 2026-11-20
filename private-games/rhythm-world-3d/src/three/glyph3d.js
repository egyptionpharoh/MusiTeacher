// =====================================================================
//  الشخصيات ثلاثية الأبعاد: الرمز نفسه (مخططات Bravura المجسّمة بالبثق) + ملامح لطيفة منفصلة عنه.
//  الرمز لا يُشوَّه أبدًا: العينان «تجلسان» فوق رأس العلامة (أو أعلى السكتة) ولا تغطيان امتلاءه أو فراغه،
//  فيبقى الفرق بين الرأس الأسود (نوار) والمفرّغ (بلانش/روند) واضحًا من كل زاوية.
// =====================================================================
import * as THREE from 'three';
import { GLYPHS } from '../notation/smufl.js';
import { layout } from '../notation/layout.js';
import { FIG } from '../data/figures.js';

const DEPTH = 0.38;        // سُمك المجسم بمسافات المدرج
const geoCache = new Map();

function glyphGeometry(n) {
  if (geoCache.has(n)) return geoCache.get(n);
  const sp = new THREE.ShapePath();
  for (const c of GLYPHS[n].d) {
    if (c[0] === 'M') sp.moveTo(c[1], c[2]);
    else if (c[0] === 'L') sp.lineTo(c[1], c[2]);
    else if (c[0] === 'Q') sp.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (c[0] === 'C') sp.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
  }
  const shapes = sp.toShapes(true);   // مخططات CFF: الحد الخارجي عكس عقارب الساعة
  const g = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.035, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -DEPTH / 2); geoCache.set(n, g); return g;
}
function rectGeometry(w, h) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: Math.min(0.025, w / 3), bevelSegments: 2 });
  g.translate(0, 0, -DEPTH / 2); return g;
}

const EYE_W = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
const EYE_P = new THREE.MeshStandardMaterial({ color: 0x15121a, roughness: 0.3 });
const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const CHEEK = new THREE.MeshStandardMaterial({ color: 0xff8aa0, roughness: 0.8, transparent: true, opacity: 0.75 });
const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);

function makeEyes(scale = 1) {
  const g = new THREE.Group(); const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.25 * scale, 0, 0);
    const w = sph(0.19 * scale, EYE_W); w.scale.set(1, 1.12, 0.8); e.add(w);
    const p = sph(0.095 * scale, EYE_P); p.position.set(0, -0.02 * scale, 0.13 * scale); e.add(p);
    const h = sph(0.035 * scale, SHINE); h.position.set(0.035 * scale, 0.03 * scale, 0.2 * scale); e.add(h);
    g.add(e); eyes.push(e);
  }
  g.userData.eyes = eyes; return g;
}
function makeMouth(scale = 1, color = 0x2a1a1a) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.13 * scale, 0.035 * scale, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.rotation.z = Math.PI; return m;
}

/**
 * يبني شخصية من تسلسل أشكال (عادة شكل واحد).
 * @returns {THREE.Group} userData: { parts: Map('fi:pi' → {meshes, face, base}), faces, width, height, top, bottom }
 */
export function buildFigure(ids, opt = {}) {
  const L = layout(ids, { padX: 0, gap: opt.gap ?? 1.25 });
  const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner);
  const hue = opt.color || (FIG[ids[0]] && FIG[ids[0]].hue) || '#2c9be0';
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hue), roughness: 0.28, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  const parts = new Map(); const faces = [];
  const key = (p) => p.fi + ':' + p.pi;
  for (const p of L.prims) {
    const m = new THREE.Mesh(p.t === 'glyph' ? glyphGeometry(p.n) : rectGeometry(p.w, p.h), mat);
    m.position.set(p.x, p.y, 0); m.castShadow = true; m.receiveShadow = true; inner.add(m);
    const k = p.pi === -1 ? p.fi + ':*' : key(p); if (!parts.has(k)) parts.set(k, { meshes: [] }); parts.get(k).meshes.push(m);
    // الملامح: فوق كل رأس علامة، وعلى أعلى كل سكتة
    if (opt.faces !== false && p.t === 'glyph' && /^notehead|^rest/.test(p.n)) {
      const b = GLYPHS[p.n].bbox; const cx = p.x + (b.bBoxSW[0] + b.bBoxNE[0]) / 2;
      const isRest = p.n.startsWith('rest');
      const f = new THREE.Group();
      let ey = p.y + b.bBoxNE[1] + 0.12, sc = 1;
      if (isRest) {
        const pos = { restWhole: [0.55, -0.27], restHalf: [0.55, 0.3], restQuarter: [0.45, 0.95], rest8th: [0.28, 0.42], rest16th: [0.62, 0.42] }[p.n];
        f.position.set(p.x + pos[0], p.y + pos[1], DEPTH / 2 + 0.12); sc = p.n === 'restWhole' || p.n === 'restHalf' ? 0.7 : 0.8;
        const eyes = makeEyes(sc); f.add(eyes); f.userData.eyes = eyes.userData.eyes;
        if (p.n !== 'restWhole' && p.n !== 'restHalf') { const shh = makeMouth(0.55, 0xffffff); shh.scale.set(0.5, 0.5, 1); shh.position.set(0, -0.32 * sc, 0); f.add(shh); f.userData.mouth = shh; }
      } else {
        f.position.set(cx, ey, 0.05);
        const eyes = makeEyes(sc); f.add(eyes); f.userData.eyes = eyes.userData.eyes;
        const hollow = p.n !== 'noteheadBlack';
        const mouth = makeMouth(hollow ? 0.7 : 0.85, hollow ? new THREE.Color(hue).multiplyScalar(0.55).getHex() : 0xffffff);
        // الفم على الوجه الأمامي في أسفل الرأس، بعيدًا عن فراغ الرأس المفرّغ
        mouth.position.set(cx - f.position.x, (hollow ? -0.42 : -0.12) - (ey - p.y), DEPTH / 2 + 0.07); f.add(mouth); f.userData.mouth = mouth;
        if (!hollow) for (const s of [-1, 1]) { const c = sph(0.09, CHEEK); c.scale.set(1, 0.6, 0.3); c.position.set(s * 0.42, -0.02 - (ey - p.y), DEPTH / 2 + 0.06); f.add(c); }
      }
      f.userData.base = f.position.clone(); inner.add(f); faces.push(f);
      parts.get(key(p)).face = f;
    }
  }
  // توسيط أفقي: نقطة الأصل في منتصف العرض وعلى الخط الإيقاعي
  inner.position.x = -L.width / 2;
  for (const v of parts.values()) v.base = v.meshes.map((m) => m.position.clone());
  Object.assign(root.userData, { parts, faces, width: L.width, top: L.top, bottom: L.bottom, mat, ids, layout: L, blink: Math.random() * 3 + 1 });
  return root;
}

/** إطار حركة: رمش، تنفّس، كلام، وقفز الأجزاء المضروبة. state: {t, talk(0..1), hits: Map(key→{t0,rest})} */
export function animateFigure(fig, dt, time, talk = 0) {
  const u = fig.userData; u.blink -= dt;
  const blinking = u.blink < 0.12; if (u.blink < 0) u.blink = 2.5 + Math.random() * 3;
  for (const f of u.faces) {
    if (f.userData.eyes) for (const e of f.userData.eyes) e.scale.y = blinking ? 0.12 : 1;
    if (f.userData.mouth) { const o = talk > 0 ? 0.6 + 0.9 * Math.abs(Math.sin(time * 17 + f.position.x)) * talk : 1; f.userData.mouth.scale.y = o; }
  }
  const breathe = 1 + Math.sin(time * 2.2 + u.width) * 0.012 + talk * 0.02 * Math.sin(time * 9);
  fig.children[0].scale.setScalar(breathe);
}
