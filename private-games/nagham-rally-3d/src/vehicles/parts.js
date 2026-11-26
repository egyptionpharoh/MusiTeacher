// =====================================================================
//  أدوات بناء المركبات برمجيًا (بلا نماذج خارجية): جسم «ملفوف» من مقاطع عرضية ناعمة، عجلات بإطارات وجنوط،
//  مواد طلاء لامعة، ولوحات نصية (أرقام وشعار MusiTeacher).
// =====================================================================
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function paint(hex, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: o.rough ?? 0.28, metalness: o.metal ?? 0.25, clearcoat: o.coat ?? 1, clearcoatRoughness: 0.06, side: o.side ?? THREE.FrontSide, map: o.map || null });
}
export const MAT = {
  carbon: () => new THREE.MeshPhysicalMaterial({ color: 0x1a1d22, roughness: 0.35, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.92 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.14, metalness: 1 }),
  alloy: () => new THREE.MeshStandardMaterial({ color: 0xb9c1cc, roughness: 0.3, metalness: 0.85 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x24282f, roughness: 0.6, metalness: 0.2 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0x9fc7e8, roughness: 0.03, metalness: 0, transmission: 0, transparent: true, opacity: 0.38, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
  light: (hex = 0xfff6d8) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.6, roughness: 0.2 }),
};

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** لوحة نص مستوية (رقم/شعار) */
export function decal(text, w, h, o = {}) {
  const tex = canvasTex(512, Math.round(512 * h / w), (x, W, H) => {
    x.clearRect(0, 0, W, H);
    if (o.bg) { x.fillStyle = o.bg; x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, H * 0.22); x.fill(); }
    x.fillStyle = o.color || '#fff'; x.font = `${o.weight || 900} ${H * (o.size || 0.62)}px Cairo, Arial, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, W / 2, H * 0.54);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

/** لوحة اسم المتسابق خلف المركبة: مستطيل داكن بإطار ذهبي واسم بخط عريض؛ set(name) يعيد الرسم */
export function namePlate(w, h) {
  const W = 512, Hh = Math.round(512 * h / w);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.name = 'namePlate';
  function set(name) {
    x.clearRect(0, 0, W, Hh);
    x.fillStyle = '#ffd166'; x.beginPath(); x.roundRect(0, 0, W, Hh, Hh * 0.22); x.fill();
    x.fillStyle = '#10151d'; x.beginPath(); x.roundRect(Hh * 0.07, Hh * 0.07, W - Hh * 0.14, Hh * 0.86, Hh * 0.17); x.fill();
    const t = String(name || '').trim();
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    let size = Hh * 0.56; x.font = `900 ${size}px Cairo, Tahoma, Arial, sans-serif`;
    while (x.measureText(t).width > W * 0.86 && size > 12) { size *= 0.92; x.font = `900 ${size}px Cairo, Tahoma, Arial, sans-serif`; }
    x.fillText(t, W / 2, Hh * 0.55);
    tex.needsUpdate = true; mesh.visible = !!t;
  }
  set('');
  return { mesh, set };
}
/** شاشة صغيرة تعرض السرعة (تظهر بوضوح في منظور السائق) */
export function dashScreen(w, h, accent = '#1ea7ff') {
  const W = 256, Hh = Math.round(256 * h / w);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  let last = -1;
  function set(kmh, gear) {
    const v = Math.round(kmh); if (v === last) return; last = v;
    x.fillStyle = '#071019'; x.fillRect(0, 0, W, Hh);
    const p = Math.min(1, v / 180);
    x.fillStyle = '#16314a'; x.fillRect(W * 0.08, Hh * 0.12, W * 0.84, Hh * 0.12);
    x.fillStyle = p > 0.75 ? '#ff6b6b' : accent; x.fillRect(W * 0.08, Hh * 0.12, W * 0.84 * p, Hh * 0.12);
    x.fillStyle = '#ffffff'; x.font = `900 ${Hh * 0.5}px Cairo, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(v), W / 2, Hh * 0.6);
    x.fillStyle = '#8fb3cf'; x.font = `700 ${Hh * 0.16}px Arial`; x.fillText('km/h', W / 2, Hh * 0.9);
    tex.needsUpdate = true;
  }
  set(0);
  return { mesh, set };
}

/**
 * جسم ملفوف: مقاطع على المحور Z، كل مقطع قطع ناقص فائق (superellipse) بعرض w وارتفاع h ومركز y،
 * والأس n (2 = قطع ناقص، أكبر = أقرب إلى مستطيل مستدير). open: [{z0, z1, a}] فتحة علوية بنصف زاوية a (لمقصورة السائق).
 */
export function loft(sections, o = {}) {
  const seg = o.seg || 40, steps = o.steps || 6;
  // استيفاء ناعم بين المقاطع (Catmull-Rom لكل قيمة)
  const keys = ['z', 'w', 'h', 'y', 'n', 'x'];
  const S = sections.map((s) => ({ x: 0, n: 2.4, ...s }));
  const rows = [];
  for (let i = 0; i < S.length - 1; i++) {
    const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(S.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const r = {};
      for (const key of keys) r[key] = 0.5 * ((2 * p1[key]) + (-p0[key] + p2[key]) * t + (2 * p0[key] - 5 * p1[key] + 4 * p2[key] - p3[key]) * t2 + (-p0[key] + 3 * p1[key] - 3 * p2[key] + p3[key]) * t3);
      rows.push(r);
    }
  }
  rows.push({ ...S[S.length - 1] });
  const P = [], UV = [], I = [];
  const openAt = (z) => { for (const f of o.open || []) if (z > f.z0 && z < f.z1) return f.a * Math.sin(Math.PI * (z - f.z0) / (f.z1 - f.z0)) ** 0.35; return 0; };
  rows.forEach((r, ri) => {
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * TAU;                     // a = 0 أعلى المقطع
      const ca = Math.cos(a), sa = Math.sin(a), e = 2 / Math.max(1.01, r.n);
      const px = Math.sign(sa) * Math.pow(Math.abs(sa), e) * r.w / 2, py = Math.sign(ca) * Math.pow(Math.abs(ca), e) * r.h / 2;
      P.push(r.x + px, r.y + py, r.z); UV.push(s / seg, ri / (rows.length - 1));
    }
  });
  for (let ri = 0; ri < rows.length - 1; ri++) for (let s = 0; s < seg; s++) {
    const a = ri * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1;
    const ang = ((s + 0.5) / seg) * TAU, z = (rows[ri].z + rows[ri + 1].z) / 2, op = openAt(z);
    if (op > 0 && (ang < op || ang > TAU - op)) continue;
    I.push(a, b, c, b, d, c);
  }
  // سدّ الطرفين
  if (o.caps !== false) for (const ri of [0, rows.length - 1]) {
    const base = ri * (seg + 1), ci = P.length / 3, r = rows[ri];
    P.push(r.x, r.y, r.z); UV.push(0.5, 0.5);
    for (let s = 0; s < seg; s++) { if (ri === 0) I.push(ci, base + s + 1, base + s); else I.push(ci, base + s, base + s + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  // حافة الفتحة العلوية (لبناء إطار المقصورة): نقاط ناعمة على الجانبين
  if (o.open && o.open.length) {
    const f = o.open[0], L = [], R = [];
    const at = (r, a) => { const ca = Math.cos(a), sa = Math.sin(a), e = 2 / Math.max(1.01, r.n); return new THREE.Vector3(r.x + Math.sign(sa) * Math.pow(Math.abs(sa), e) * r.w / 2, r.y + Math.sign(ca) * Math.pow(Math.abs(ca), e) * r.h / 2, r.z); };
    for (const r of rows) { if (r.z <= f.z0 || r.z >= f.z1) continue; const op = openAt(r.z); L.push(at(r, op)); R.push(at(r, TAU - op)); }
    g.userData.edge = L.concat(R.reverse());
  }
  return g;
}

/** عجلة: إطار مطاطي بمقطع مستدير + جنط بأذرع + قرص فرامل اختياري. المحور المحلي X (العجلة تدور حوله) */
export function wheel(R, width, o = {}) {
  const grp = new THREE.Group();
  const tyreR = o.tyre ?? R * 0.28;
  // الإطار: Lathe حول المحور Y ثم ندوّره ليصبح المحور X
  const prof = [];
  for (let k = 0; k <= 16; k++) {
    const a = -Math.PI / 2 + (k / 16) * Math.PI;
    prof.push(new THREE.Vector2(R - tyreR + Math.cos(a) * tyreR, Math.sin(a) * width / 2));
  }
  prof.unshift(new THREE.Vector2(R - tyreR * 1.05, -width / 2)); prof.push(new THREE.Vector2(R - tyreR * 1.05, width / 2));
  const tyreGeo = new THREE.LatheGeometry(prof, 48);
  const tread = canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#1c1d20'; x.fillRect(0, 0, w, h); x.fillStyle = '#121315'; for (let i = 0; i < 32; i++) x.fillRect(i * 8, 0, 3, h); });
  tread.wrapS = tread.wrapT = THREE.RepeatWrapping;
  const tyre = new THREE.Mesh(tyreGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, map: o.slick ? null : tread, roughness: 0.9 }));
  if (o.slick) tyre.material.color.set(0x18191c);
  tyre.rotation.z = Math.PI / 2; grp.add(tyre);
  // الجنط
  const rimR = R - tyreR * 1.02;
  const rimMat = o.rimMat || MAT.alloy();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.82, 40, 1, true), MAT.dark()); barrel.rotation.z = Math.PI / 2; grp.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.012, 8, 48), rimMat); lip.rotation.y = Math.PI / 2; lip.position.x = width * 0.36; grp.add(lip);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.2, rimR * 0.24, width * 0.5, 20), rimMat); hub.rotation.z = Math.PI / 2; hub.position.x = width * 0.1; grp.add(hub);
  const nSp = o.spokes || 6;
  for (let k = 0; k < nSp; k++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(width * 0.12, rimR * 0.85, rimR * 0.13), rimMat);
    sp.position.set(width * 0.3, 0, 0); sp.geometry.translate(0, rimR * 0.5, 0);
    sp.rotation.x = (k / nSp) * TAU; grp.add(sp);
  }
  if (o.disc) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.72, rimR * 0.72, 0.008, 32), MAT.chrome()); disc.rotation.z = Math.PI / 2; disc.position.x = -width * 0.28; grp.add(disc);
  }
  const center = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.09, rimR * 0.09, width * 0.62, 12), o.capMat || MAT.chrome()); center.rotation.z = Math.PI / 2; center.position.x = width * 0.12; grp.add(center);
  grp.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  grp.userData.R = R;
  return grp;
}

/** أنبوب بين نقطتين */
export function rod(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; return m;
}

/** ظل دائري ناعم تحت المركبة (يكمل ظل الشمس على الأسفلت) */
export function blobShadow(w, l) {
  const tex = canvasTex(128, 128, (x, W, H) => { const g = x.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 1; return m;
}
