// =====================================================================
//  نماذج آلات الباند — مبنية برمجيًا بنِسَب قريبة من الآلات الحقيقية (الوحدة: متر).
//  كل دالة تُرجع { group, parts, fire(act, level, data), update(dt) }.
//  userData.act على الجزء = الفعل الذي يُصدره النقر عليه · userData.part = اسم الجزء وشرحه.
// =====================================================================
import * as THREE from 'three';
import { woodTexture, skinTexture, headTexture, brandTexture, cymbalTexture } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (o) => new THREE.MeshStandardMaterial(o);
const m = (geo, mat, p, r) => { const o = new THREE.Mesh(geo, mat); if (p) o.position.set(...p); if (r) o.rotation.set(...r); o.castShadow = o.receiveShadow = true; return o; };
function rod(a, b, r, mat, r2 = r) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A); const o = m(new THREE.CylinderGeometry(r2, r, d.length(), 14), mat);
  o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return o;
}
const mats = () => ({
  steel: std({ color: 0xdfe3e8, metalness: 1, roughness: 0.2 }), chrome: std({ color: 0xf2f4f6, metalness: 1, roughness: 0.08 }),
  brass: std({ color: 0xd2a94e, metalness: 1, roughness: 0.3 }), black: std({ color: 0x17171b, metalness: 0.2, roughness: 0.55 }),
  felt: std({ color: 0xe8e4da, roughness: 1 }), cord: std({ color: 0xd8cfb8, roughness: 0.9 }), leather: std({ color: 0x5a3a22, roughness: 0.8 }),
  dark: std({ color: 0x0c0a09, roughness: 0.9 }),
});
const wood = (base, dark, seed, rep = [1, 1], vertical = false, o = {}) => std({ map: woodTexture(base, dark, seed, rep, vertical), roughness: 0.5, metalness: 0.02, ...o });

// --------------------------------------------------------------- علامة MusiTeacher
/** لوحة معدنية صغيرة كعلامة الصانع على أجسام الطبول والإطارات */
function badge(w = 0.07) {
  const g = new THREE.Group(), h = w / 4;
  g.add(m(new THREE.BoxGeometry(w, h, 0.002), std({ color: 0x1b1b21, metalness: 0.7, roughness: 0.35 })));
  const t = m(new THREE.PlaneGeometry(w * 0.94, h * 0.94), std({ map: brandTexture('#ecd9a0'), transparent: true, metalness: 0.6, roughness: 0.35 }), [0, 0, 0.0013]); t.castShadow = false; g.add(t);
  return g;
}
/** علامة مطبوعة على مقبض أسطواني محوره Y، والكتابة بطول المقبض */
function axisLabel(radius, len, ink = '#f3e3b0') {
  const t = brandTexture(ink); t.center.set(0.5, 0.5); t.rotation = Math.PI / 2;
  const arc = Math.min(2.2, len / 4 / radius);
  const o = m(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, len, 20, 1, true, -arc / 2, arc), std({ map: t, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
  o.castShadow = false; return o;
}

// --------------------------------------------------------------- رقمة تهتز عند الضرب
function makeHead(R, map) {
  const geo = new THREE.RingGeometry(0.0001, R, 64, 10);
  const h = m(geo, std({ map, roughness: 0.78, side: THREE.DoubleSide })); h.castShadow = false;
  h.userData.base = geo.attributes.position.array.slice(); h.userData.hits = []; h.userData.R = R; return h;
}
function punch(head, world, amp) {
  const p = world ? head.worldToLocal(world.clone()) : V((Math.random() - 0.5) * 0.1 * head.userData.R, (Math.random() - 0.5) * 0.1 * head.userData.R, 0);
  head.userData.hits.push({ x: p.x, y: p.y, a: amp, t: 0 }); if (head.userData.hits.length > 5) head.userData.hits.shift(); return p;
}
function updHead(head, dt) {
  const h = head.userData.hits; if (!h.length && !head.userData.dirty) return;
  for (const k of h) k.t += dt; while (h.length && h[0].t > 0.6) h.shift();
  const p = head.geometry.attributes.position, b = head.userData.base, R = head.userData.R;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3], y = b[i * 3 + 1]; let z = 0; const edge = 1 - Math.min(1, (x * x + y * y) / (R * R));
    for (const k of h) { const d2 = ((x - k.x) ** 2 + (y - k.y) ** 2) / (R * R); z -= k.a * R * 0.05 * Math.exp(-d2 * 8) * Math.exp(-k.t * 9) * Math.cos(k.t * 60) * edge; }
    p.array[i * 3 + 2] = z;
  }
  p.needsUpdate = true; head.userData.dirty = h.length > 0;
}

// --------------------------------------------------------------- مضرب يتحرك إلى موضع الضرب ويعود
const strike = (t, a = 0.035, b = 0.3) => (t < 0 ? 0 : t < a ? t / a : t < b ? 1 - ((t - a) / (b - a)) ** 0.7 : 0);
function striker(obj, lift = V(0, 0.07, 0)) {
  const rest = obj.position.clone(); const s = { obj, rest, from: rest.clone(), to: rest.clone(), t: 9, idle: 9 };
  s.go = (target) => { s.to.copy(target); s.from.copy(target).add(lift); s.t = 0; s.idle = 0; };
  s.update = (dt) => {
    s.t += dt; s.idle += dt;
    if (s.t < 0.3) obj.position.lerpVectors(s.from, s.to, strike(s.t));
    else if (s.idle > 1.4) obj.position.lerp(rest, Math.min(1, dt * 6));
    else obj.position.lerp(s.from, Math.min(1, dt * 10));
  };
  return s;
}
const local = (group, world, fallback) => (world ? group.worldToLocal(world.clone()) : fallback.clone());
const P = (parts, o, n, d) => { o.userData.part = { n, d }; parts.push(o); return o; };
const Z = (o, a, extra) => { o.userData.act = a; if (extra) Object.assign(o.userData, extra); return o; };

// =============================================================== الكاستنيت
function castanets() {
  const M = mats(), g = new THREE.Group(), parts = [], w = wood('#8a5a2c', '#5a3414', 11, [1, 1], true);
  const handle = new THREE.Group();
  handle.add(m(new THREE.CylinderGeometry(0.011, 0.013, 0.17, 20), w, [0, -0.085, 0]));
  handle.add(m(new THREE.SphereGeometry(0.0135, 16, 12), w, [0, -0.17, 0]));
  const lb = axisLabel(0.0125, 0.075); lb.position.set(0, -0.09, 0); lb.rotation.y = Math.PI / 2; handle.add(lb);
  const board = m(new THREE.CylinderGeometry(0.034, 0.034, 0.007, 32), w, [0, 0.04, 0], [Math.PI / 2, 0, 0]); board.scale.set(1, 1, 1.25); handle.add(board);
  g.add(P(parts, Z(handle, 'hit'), 'المقبض الخشبي', 'يُمسك باليد اليمنى، وتُثبّت فيه القطعتان بالخيط.'));
  const shells = [];
  const shellMat = wood('#7a4a22', '#4a2a10', 12, [1, 1]);
  for (const s of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(0, 0.008, s * 0.006);
    const sh = m(new THREE.SphereGeometry(0.036, 32, 20), shellMat, [0, 0.036, s * 0.007]); sh.scale.set(1, 1.2, 0.32); piv.add(sh);
    piv.userData.s = s; shells.push(piv); g.add(Z(piv, 'hit'));
  }
  P(parts, shells[0], 'القطعتان', 'قطعتان بيضاويتان أو دائريتان من الخشب أو البلاستيك، مرتخيتان لتنطبقا وتصدرا الصوت.');
  const cord = m(new THREE.TorusGeometry(0.012, 0.0022, 8, 24), M.cord, [0, 0.012, 0], [0, Math.PI / 2, 0]); g.add(P(parts, cord, 'الخيط', 'يثبّت القطعتين في المقبض على بعد ٢ سم منه بشكل مرتخٍ.'));
  g.rotation.set(0.25, -0.5, 0.35);
  let t = 9, amp = 1;
  return { group: g, parts, fire: (a, lv) => { t = 0; amp = lv === 'w' ? 0.6 : 1; },
    update: (dt) => { t += dt; const open = 0.3 * Math.min(1, t / 0.16) + (t < 0.5 ? 0.05 * Math.sin(t * 60) * Math.exp(-t * 9) : 0); for (const s of shells) s.rotation.x = s.userData.s * open; g.rotation.z = 0.35 - amp * 0.18 * strike(t, 0.03, 0.25); } };
}

// =============================================================== المثلث
function triangle() {
  const M = mats(), g = new THREE.Group(), parts = [], tri = new THREE.Group(); g.add(tri);
  const T = [0, 0.09, 0], BL = [-0.094, -0.073, 0], BR = [0.094, -0.073, 0], r = 0.0052;
  const k = 0.2, BR1 = [BR[0] - 0.034, BR[1], 0], BR2 = [BR[0] + (T[0] - BR[0]) * k, BR[1] + (T[1] - BR[1]) * k, 0];
  const sides = new THREE.Group();
  for (const [a, b] of [[T, BL], [BL, BR1], [BR2, T]]) sides.add(rod(a, b, r, M.steel));
  for (const c of [T, BL, BR1, BR2]) sides.add(m(new THREE.SphereGeometry(r, 14, 10), M.steel, c));
  tri.add(P(parts, Z(sides, 'hit'), 'جسم المثلث', 'قضيب معدني على شكل مثلث، مفتوح من إحدى زواياه لخروج الصوت بوضوح.'));
  const hold = new THREE.Group();
  hold.add(rod([0, 0.092, 0], [0, 0.135, 0], 0.0012, M.cord)); hold.add(m(new THREE.TorusGeometry(0.008, 0.0012, 6, 20), M.cord, [0, 0.09, 0], [0, Math.PI / 2, 0]));
  hold.add(m(new THREE.TorusGeometry(0.017, 0.0045, 10, 28), M.black, [0, 0.155, 0]));
  tri.add(P(parts, hold, 'مقبض الحمل', 'مقبض من البلاستيك مثبت في إحدى الزوايا، يُعلَّق منه المثلث على السبابة.'));
  tri.position.y = -0.155; const swing = new THREE.Group(); swing.position.y = 0.155; swing.add(tri); g.add(swing);
  const beater = new THREE.Group();
  beater.add(rod([0, 0, 0], [0.085, -0.035, 0.05], 0.0032, M.steel)); beater.add(rod([0.085, -0.035, 0.05], [0.14, -0.058, 0.082], 0.0065, M.black));
  const lb = axisLabel(0.0066, 0.05); lb.position.set(0.1125, -0.0465, 0.066); lb.quaternion.setFromUnitVectors(V(0, 1, 0), V(0.085, -0.035, 0.05).normalize()); beater.add(lb);
  beater.position.set(0.02, -0.02, 0.05); g.add(P(parts, beater, 'المضرب', 'مضرب من المعدن بمقبض بلاستيكي، يُمسك باليد اليمنى.'));
  const st = striker(beater, V(0.03, -0.015, 0.05)); let t = 9, amp = 1, roll = false;
  return { group: g, parts,
    fire: (a, lv, d = {}) => { amp = lv === 'w' ? 0.5 : 1; t = 0; roll = a === 'roll'; const p = roll ? V(0.07, -0.062, 0.006) : local(g, d.point, V(0, -0.073, 0.006)); p.z = 0.006; st.go(p); },
    stop: () => { roll = false; },
    update: (dt) => { t += dt; if (roll && st.t > 0.07) { st.go(V(0.07 + (Math.random() - 0.5) * 0.01, st.to.y < -0.066 ? -0.05 : -0.071, 0.006)); t = 0; } st.update(dt); swing.rotation.z = amp * 0.09 * Math.exp(-t * 2.2) * Math.sin(t * 9); swing.rotation.x = amp * 0.05 * Math.exp(-t * 2.5) * Math.sin(t * 7); } };
}

// =============================================================== الجلاجل
function jingles() {
  const M = mats(), g = new THREE.Group(), parts = [], R = 0.07;
  const h = new THREE.Group(); h.add(m(new THREE.CylinderGeometry(0.014, 0.014, R * 2 + 0.02, 24), wood('#d9a441', '#a8741c', 21, [1, 1], true), null, [0, 0, Math.PI / 2]));
  const lb = axisLabel(0.0142, 0.085, '#3b2408'); lb.rotation.set(0, 0, Math.PI / 2); lb.rotateY(Math.PI / 2); h.add(lb);
  g.add(P(parts, Z(h, 'hit'), 'المقبض الخشبي', 'يُمسك باليد اليمنى، ويتصل طرفاه بالسلك.'));
  const arc = m(new THREE.TorusGeometry(R, 0.0065, 10, 48, Math.PI), std({ color: 0x1f5fb8, roughness: 0.4, metalness: 0.1 })); g.add(P(parts, Z(arc, 'hit'), 'السلك', 'قوس يتصل بطرفي المقبض وتتدلى منه الجلاجل.'));
  const bells = new THREE.Group(), list = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + 0.84 * i / 6), b = new THREE.Group(); b.position.set(Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02), 0); b.rotation.z = a - Math.PI / 2;
    b.add(m(new THREE.SphereGeometry(0.0135, 20, 14), M.steel)); b.add(m(new THREE.BoxGeometry(0.0025, 0.012, 0.03), M.dark, [0, 0.0085, 0])); b.add(m(new THREE.BoxGeometry(0.03, 0.012, 0.0025), M.dark, [0, 0.0085, 0]));
    b.add(m(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 8), M.steel, [0, -0.016, 0])); b.userData.a = a; list.push(b); bells.add(b);
  }
  g.add(P(parts, Z(bells, 'hit'), 'الجلاجل', 'كرات معدنية مجوفة ومشقوقة، بداخل كل منها كرة صغيرة حرة الحركة.'));
  g.rotation.set(0.15, -0.35, 0.2); let t = 9, amp = 1, hold = false;
  return { group: g, parts, fire: (a, lv) => { t = 0; amp = lv === 'w' ? 0.6 : 1; hold = a === 'shake'; }, stop: () => { hold = false; },
    update: (dt) => { t += dt; const e = hold ? 1 : Math.exp(-t * 6); g.rotation.z = 0.2 + amp * 0.22 * e * Math.sin(t * (hold ? 38 : 30)); list.forEach((b, i) => { b.rotation.x = amp * 0.5 * e * Math.sin(t * 44 + i * 1.7); }); } };
}

// =============================================================== الإكسيليفون المعدني
function glock(inst) {
  const M = mats(), g = new THREE.Group(), parts = [], n = inst.bars.length, pitch = 0.0275, W = n * pitch;
  const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 0.02, -0.1); sh.lineTo(W / 2 + 0.02, -0.066); sh.lineTo(W / 2 + 0.02, 0.066); sh.lineTo(-W / 2 - 0.02, 0.1); sh.closePath();
  const base = m(new THREE.ExtrudeGeometry(sh, { depth: 0.032, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }), wood('#b98045', '#7c4c22', 31, [2, 1]), [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const frame = new THREE.Group(); frame.add(base);
  for (const s of [1, -1]) frame.add(rod([-W / 2, 0.039, s * 0.06], [W / 2, 0.039, s * 0.034], 0.004, M.felt));
  const bd = badge(0.075); bd.position.set(0, 0.018, 0.0855); bd.rotation.x = -0.0; bd.rotation.y = 0; frame.add(bd);
  const fb = new THREE.Group(); fb.add(frame); g.add(P(parts, fb, 'الإطار الخشبي', 'تُثبَّت عليه القضبان مرتبة كلوحة مفاتيح.'));
  const bars = [], barsG = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const len = 0.17 - 0.075 * i / (n - 1), x = -W / 2 + pitch * (i + 0.5);
    const b = m(new THREE.BoxGeometry(0.0235, 0.0055, len), std({ color: 0xe6e9ee, metalness: 1, roughness: 0.16, emissive: 0x3aa0ff, emissiveIntensity: 0 }), [x, 0.046, 0]);
    for (const s of [1, -1]) b.add(m(new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 8), M.black, [0, 0.0032, s * len * 0.3]));
    Z(b, 'bar', { bar: i }); b.userData.y = 0.046; b.userData.t = 9; bars.push(b); barsG.add(b);
  }
  g.add(P(parts, barsG, 'القضبان المعدنية', 'الطويلة للنغمات الغليظة والقصيرة للنغمات الحادة.'));
  const mal = [], malG = new THREE.Group(), cols = [0xc23b2e, 0xc23b2e];
  for (let k = 0; k < 2; k++) {
    const o = new THREE.Group(); o.add(m(new THREE.SphereGeometry(0.0105, 18, 14), std({ color: cols[k], roughness: 0.35 }))); o.add(rod([0, 0, 0], [k ? 0.03 : -0.03, 0.05, 0.19], 0.0028, wood('#e2c79a', '#b99864', 33 + k)));
    o.position.set((k ? 0.07 : -0.07), 0.075, 0.14); malG.add(o); mal.push(striker(o, V(0, 0.06, 0.012)));
  }
  g.add(P(parts, malG, 'المضربان', 'مضربان برؤوس كروية أو بيضاوية، يُمسكان بالأصابع.'));
  let k = 0;
  return { group: g, parts, bars,
    fire: (a, lv, d = {}) => { const b = bars[d.bar ?? 0]; if (!b) return; b.userData.t = 0; b.userData.amp = lv === 'w' ? 0.6 : 1; const s = mal[b.position.x < 0 ? 0 : 1]; k++; s.go(V(b.position.x, 0.046 + 0.0135, 0.012)); },
    update: (dt) => { for (const s of mal) s.update(dt); for (const b of bars) { b.userData.t += dt; const e = Math.exp(-b.userData.t * 5) * (b.userData.amp || 1); b.material.emissiveIntensity = b.userData.t < 2 ? 0.55 * e : 0; b.position.y = b.userData.y + 0.0012 * e * Math.sin(b.userData.t * 90); } } };
}

// =============================================================== أجزاء مشتركة للطبول
function lugs(g, M, R, n, len, axis) {   // قضبان الشد ومفاتيحها حول الإطار
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * Math.PI * 2, c = Math.cos(a) * (R + 0.012), s = Math.sin(a) * (R + 0.012);
    const A = axis === 'z' ? [c, s, -len / 2] : [c, -len / 2, s], B = axis === 'z' ? [c, s, len / 2] : [c, len / 2, s];
    g.add(rod(A, B, 0.0035, M.chrome));
    const lug = m(new THREE.BoxGeometry(0.02, 0.02, 0.05), M.chrome, axis === 'z' ? [c * 0.985, s * 0.985, 0] : [c * 0.985, 0, s * 0.985]);
    if (axis === 'z') lug.rotation.z = a; else { lug.rotation.y = -a; lug.geometry = new THREE.BoxGeometry(0.02, 0.05, 0.02); } g.add(lug);
    for (const e of [A, B]) g.add(m(new THREE.SphereGeometry(0.0065, 10, 8), M.chrome, e));
  }
}

// =============================================================== الطبل الكبير
function bass() {
  const M = mats(), g = new THREE.Group(), parts = [], R = 0.3, D = 0.28, drum = new THREE.Group(); drum.position.y = R + 0.2; g.add(drum);
  const shell = new THREE.Group(); shell.add(m(new THREE.CylinderGeometry(R, R, D, 64, 1, true), wood('#7b2a1c', '#3c0f0a', 41, [6, 1], true, { roughness: 0.25, side: THREE.DoubleSide }), null, [Math.PI / 2, 0, 0]));
  const bd = badge(0.1); bd.position.set(0, R + 0.0015, 0); bd.rotation.x = -Math.PI / 2; shell.add(bd);
  drum.add(P(parts, shell, 'الإطار', 'إطار خشبي معدني مشدود، عليه جلد من الناحيتين.'));
  const hw = new THREE.Group(); const hoop = wood('#c9a26a', '#8a6638', 42, [8, 1]);
  for (const s of [1, -1]) hw.add(m(new THREE.TorusGeometry(R + 0.004, 0.013, 12, 72), hoop, [0, 0, s * D / 2]));
  lugs(hw, M, R, 8, D + 0.02, 'z'); drum.add(P(parts, hw, 'أطواق ومفاتيح الشد', 'تشدّ الجلد على الإطار وتضبط توتره.'));
  const tex = headTexture(3), front = makeHead(R - 0.004, tex), back = makeHead(R - 0.004, headTexture(4)); front.position.z = D / 2 + 0.002; back.position.z = -D / 2 - 0.002; back.rotation.y = Math.PI;
  drum.add(P(parts, Z(front, 'hit'), 'الرقمة (الجلد)', 'جلد مشدود من الناحيتين؛ يُضرب بالعصا ذات رأس اللباد.')); drum.add(Z(back, 'hit'));
  const stand = new THREE.Group();
  for (const s of [1, -1]) { stand.add(m(new THREE.TorusGeometry(R + 0.03, 0.008, 8, 32, 1.5), M.black, [0, R + 0.2, s * 0.09], [0, 0, -Math.PI / 2 - 0.75])); for (const x of [1, -1]) stand.add(rod([x * 0.21, R + 0.2 - 0.25, s * 0.09], [x * 0.3, 0.004, s * 0.14], 0.009, M.black)); }
  for (const x of [1, -1]) stand.add(rod([x * 0.27, 0.07, -0.13], [x * 0.27, 0.07, 0.13], 0.006, M.black));
  g.add(P(parts, stand, 'الحامل', 'حامل خاص يوضع عليه الطبل ويُضبط حسب طول العازف.'));
  const beater = new THREE.Group(); beater.add(m(new THREE.SphereGeometry(0.038, 24, 18), M.felt)); beater.add(rod([0, 0, 0], [0.16, -0.12, 0.26], 0.008, wood('#d8b98a', '#a8855a', 43, [1, 1], true), 0.0095));
  beater.position.set(0.2, R + 0.12, D / 2 + 0.2); g.add(P(parts, beater, 'العصا', 'عصا ذات رأس دائري من اللباد أو الخشب.'));
  const st = striker(beater, V(0.03, 0, 0.16));
  return { group: g, parts, fire: (a, lv, d = {}) => { const h = d.point && d.point.z < 0 ? front : front; const p = punch(h, d.point && d.object === front ? d.point : null, lv === 'w' ? 0.5 : 1); st.go(V(p.x, drum.position.y + p.y, D / 2 + 0.04)); },
    update: (dt) => { st.update(dt); updHead(front, dt); } };
}

// =============================================================== الدف ذو الجلاجل
function tamb() {
  const M = mats(), g = new THREE.Group(), parts = [], R = 0.125, H = 0.046, body = new THREE.Group(); g.add(body);
  const w = wood('#b9824a', '#7a4c22', 51, [5, 1], true, { side: THREE.DoubleSide });
  const frame = new THREE.Group(); frame.add(m(new THREE.CylinderGeometry(R, R, H, 64, 1, true), w)); frame.add(m(new THREE.CylinderGeometry(R - 0.007, R - 0.007, H, 64, 1, true), w));
  for (const y of [H / 2, -H / 2]) frame.add(m(new THREE.RingGeometry(R - 0.007, R, 64), w, [0, y, 0], [Math.PI / 2, 0, 0]));
  body.add(P(parts, Z(frame, 'shake'), 'الإطار الخشبي', 'إطار دائري يُمسك باليد اليسرى.'));
  const hole = m(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), M.dark, [0, 0, R - 0.003], [Math.PI / 2, 0, 0]); body.add(P(parts, hole, 'الثقب', 'يوضع فيه الإبهام عند الإمساك بالآلة.'));
  const zills = new THREE.Group(), list = [];
  for (let i = 0; i < 6; i++) {
    const a = (i + 0.5) / 6 * Math.PI * 2 + Math.PI / 2 + Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
    const slot = m(new THREE.BoxGeometry(0.05, 0.022, 0.009), M.dark, [c * (R - 0.0036), 0, s * (R - 0.0036)]); slot.rotation.y = -a + Math.PI / 2; zills.add(slot);
    const pair = new THREE.Group(); pair.position.set(c * (R - 0.003), 0, s * (R - 0.003));
    for (const y of [0.004, -0.004]) { const z = m(new THREE.CylinderGeometry(0.0205, 0.0205, 0.0016, 28), M.brass, [0, y, 0]); z.userData.y = y; pair.add(z); }
    pair.add(m(new THREE.CylinderGeometry(0.0018, 0.0018, 0.024, 8), M.steel)); list.push(pair); zills.add(pair);
  }
  body.add(P(parts, Z(zills, 'shake'), 'الصنوج النحاسية', 'عدد مزدوج من الصنوج الصغيرة مثبت في الإطار، تهتز مع كل ضربة أو هزّة.'));
  const head = makeHead(R - 0.001, skinTexture('sheep', 52, true)); head.rotation.x = -Math.PI / 2; head.position.y = H / 2 + 0.0012; body.add(P(parts, Z(head, 'hit'), 'الجلد', 'جلد رقيق مشدود على الإطار؛ يُضرب في منتصفه بأطراف اليد اليمنى.'));
  body.rotation.x = 1.05; let t = 9, amp = 1, hold = false, kind = 'hit';
  return { group: g, parts, fire: (a, lv, d = {}) => { t = 0; kind = a; amp = lv === 'w' ? 0.55 : 1; hold = a === 'roll'; if (a === 'hit') punch(head, d.object === head ? d.point : null, amp); }, stop: () => { hold = false; },
    update: (dt) => { t += dt; updHead(head, dt); const e = hold ? 1 : Math.exp(-t * (kind === 'hit' ? 9 : 5)); g.rotation.z = (kind === 'hit' ? 0.02 : 0.16) * amp * e * Math.sin(t * (hold ? 40 : 26));
      list.forEach((p, i) => p.children.forEach((z, j) => { if (z.userData.y != null) { z.position.y = z.userData.y + 0.004 * amp * e * Math.sin(t * 70 + i * 2 + j * 3); z.rotation.x = 0.25 * amp * e * Math.sin(t * 55 + i + j * 2); } })); } };
}

// =============================================================== الصنوج
function cymbals() {
  const M = mats(), g = new THREE.Group(), parts = [], R = 0.165;
  const prof = [[0.004, 0.034], [0.014, 0.034], [0.026, 0.03], [0.036, 0.02], [0.05, 0.014], [0.1, 0.008], [R - 0.004, 0.001], [R, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const mat = std({ map: cymbalTexture(), metalness: 1, roughness: 0.3, side: THREE.DoubleSide });
  const mk = (s) => {
    const c = new THREE.Group(), body = new THREE.Group();
    body.add(m(new THREE.LatheGeometry(prof, 96), mat));
    const strap = new THREE.Group(); strap.add(m(new THREE.TorusGeometry(0.034, 0.009, 8, 24, Math.PI), M.leather, [0, 0.034, 0])); strap.add(m(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 24), M.leather, [0, 0.036, 0]));
    body.add(strap); body.rotation.z = s * Math.PI / 2; c.add(body); c.userData.strap = strap; c.userData.s = s; return c;   // قبّة الصنج إلى الخارج
  };
  const L = mk(1), Rt = mk(-1); g.add(Z(L, 'hit'), Z(Rt, 'hit'));
  P(parts, L, 'الصنجان', 'قرصان من المعدن في مواجهة بعضهما، بكل منهما تجويف (قبّة) في المنتصف.');
  P(parts, Rt.userData.strap, 'المقبض الجلدي', 'قطعة من الجلد مثبتة في ظهر كل صنج لإدخال اليد والإمساك به.');
  let t = 9, amp = 1, choke = false;
  const pose = (dt) => {
    t += dt; const hit = strike(t, 0.045, choke ? 0.5 : 0.9), ring = choke ? 0 : Math.exp(-t * 1.6) * (t > 0.045 ? 1 : 0);
    const gap = 0.075 * (1 - hit) + 0.004, open = t > 0.045 && !choke ? Math.min(1, (t - 0.045) / 0.35) * Math.exp(-Math.max(0, t - 2.5)) : 0;
    L.position.set(-gap - open * 0.05, 0.035 * (1 - hit) + open * 0.02, 0); Rt.position.set(gap + open * 0.05, -0.035 * (1 - hit) - open * 0.02, 0);
    const w = 0.012 * amp * ring * Math.sin(t * 95);
    L.rotation.set(0, open * 0.55 + w, w); Rt.rotation.set(0, -open * 0.55 - w, -w);
  };
  g.rotation.y = 0.5; pose(0);
  return { group: g, parts, fire: (a, lv) => { t = 0; amp = lv === 'w' ? 0.5 : 1; choke = a === 'choke'; }, update: pose };
}

// =============================================================== الطبل الصغير
function snare() {
  const M = mats(), g = new THREE.Group(), parts = [], R = 0.178, D = 0.14, Y = 0.5, drum = new THREE.Group(); drum.position.y = Y; drum.rotation.x = 0.3; g.add(drum);
  const shell = new THREE.Group(); shell.add(m(new THREE.CylinderGeometry(R, R, D, 64, 1, true), wood('#a8632c', '#5e3210', 61, [6, 1], true, { roughness: 0.22 })));
  const bd = badge(0.07); bd.position.set(0, 0, R + 0.0015); shell.add(bd);
  const thr = m(new THREE.BoxGeometry(0.03, 0.07, 0.02), M.chrome, [R + 0.01, -0.01, 0]); shell.add(thr);
  drum.add(P(parts, shell, 'الجسم', 'أسطوانة قليلة العمق من الخشب أو المعدن.'));
  const hoops = new THREE.Group(); const top = new THREE.Group();
  top.add(m(new THREE.TorusGeometry(R + 0.004, 0.006, 10, 72), M.chrome, [0, D / 2 + 0.004, 0], [Math.PI / 2, 0, 0])); top.add(m(new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.012, 64, 1, true), M.chrome, [0, D / 2 - 0.004, 0]));
  hoops.add(Z(top, 'rim')); hoops.add(m(new THREE.TorusGeometry(R + 0.004, 0.006, 10, 72), M.chrome, [0, -D / 2 - 0.004, 0], [Math.PI / 2, 0, 0]));
  lugs(hoops, M, R, 8, D + 0.012, 'y'); drum.add(P(parts, hoops, 'الأطواق ومفاتيح الشد', 'أطواق معدنية تشدّ الرقمتين؛ النقر على الطوق العلوي يعطي صوتًا خشبيًا جافًا.'));
  const head = makeHead(R - 0.002, headTexture(6)); head.rotation.x = -Math.PI / 2; head.position.y = D / 2 + 0.003; drum.add(P(parts, Z(head, 'hit'), 'الرقمة العليا', 'رقمة الضرب؛ يُعزف عليها بالعصوين.'));
  const wires = new THREE.Group(); wires.add(m(new THREE.CircleGeometry(R - 0.002, 48), std({ color: 0xf0ede4, roughness: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), [0, -D / 2 - 0.002, 0], [Math.PI / 2, 0, 0]));
  for (let i = -6; i <= 6; i++) wires.add(rod([-R + 0.02, -D / 2 - 0.005, i * 0.006], [R - 0.02, -D / 2 - 0.005, i * 0.006], 0.0011, M.steel));
  drum.add(P(parts, wires, 'أسلاك السنير', 'أسلاك معدنية مشدودة على الرقمة السفلى تهتز معها وتمنح الطبل صوته المميز.'));
  const stand = new THREE.Group(); stand.add(rod([0, 0.1, 0], [0, Y - 0.12, 0.03], 0.012, M.chrome));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; stand.add(rod([0, 0.22, 0], [Math.cos(a) * 0.26, 0.008, Math.sin(a) * 0.26], 0.008, M.chrome)); stand.add(m(new THREE.SphereGeometry(0.014, 10, 8), M.black, [Math.cos(a) * 0.26, 0.012, Math.sin(a) * 0.26]));
    const b = i / 3 * Math.PI * 2 + 1.55; stand.add(rod([0, Y - 0.13, 0.03], [Math.cos(b) * (R + 0.01), Y - 0.085 - Math.sin(b) * 0.05, Math.sin(b) * (R + 0.01) * 0.96 + 0.01], 0.006, M.chrome)); }
  g.add(P(parts, stand, 'الحامل', 'حامل ثلاثي يُثبَّت عليه الطبل مائلًا قليلًا نحو العازف.'));
  const sticks = [], sg = new THREE.Group(); const sw = wood('#e0c495', '#b08c58', 63, [1, 1], true);
  for (const s of [1, -1]) { const o = new THREE.Group(); o.add(m(new THREE.SphereGeometry(0.0065, 12, 10), sw)); o.children[0].scale.set(1, 1.5, 1); o.add(rod([0, 0, 0], [s * 0.13, 0.06, 0.34], 0.0045, sw, 0.0078)); o.position.set(s * 0.06, D / 2 + 0.07, 0.03); sg.add(o); sticks.push(striker(o, V(0, 0.08, 0.03))); }
  drum.add(P(parts, sg, 'العصوان', 'عصوان خشبيتان برأس صغير.')); let k = 0, roll = false;
  const go = (lv, p) => { const s = sticks[k++ % 2]; s.go(V(p.x, D / 2 + 0.008, -p.y)); punch(head, null, lv === 'w' ? 0.4 : 0.9); head.userData.hits.at(-1).x = p.x; head.userData.hits.at(-1).y = p.y; };
  return { group: g, parts, stop: () => { roll = false; },
    fire: (a, lv, d = {}) => { roll = a === 'roll';
      if (a === 'rim') { const s = sticks[k++ % 2]; const q = d.point ? drum.worldToLocal(d.point.clone()) : V(0.05, 0, R); const n = Math.hypot(q.x, q.z) || 1; s.go(V(q.x / n * (R + 0.004), D / 2 + 0.014, q.z / n * (R + 0.004))); return; }
      const p = d.object === head && d.point ? head.worldToLocal(d.point.clone()) : V((Math.random() - 0.5) * 0.05, -0.02 + (Math.random() - 0.5) * 0.04, 0); go(lv, p); },
    update: (dt) => { if (roll && sticks[(k + 1) % 2].t > 0.055) go('w', V((k % 2 ? 1 : -1) * 0.025, -0.02, 0)); for (const s of sticks) s.update(dt); updHead(head, dt); } };
}

// =============================================================== الكلافس
function claves() {
  const g = new THREE.Group(), parts = [], w = wood('#6e2f1c', '#3a140a', 71, [1, 3], false, { roughness: 0.28 });
  const mk = () => { const o = new THREE.Group(); o.add(m(new THREE.CylinderGeometry(0.0135, 0.0135, 0.2, 24), w)); for (const y of [0.1, -0.1]) { const c = m(new THREE.SphereGeometry(0.0135, 20, 10), w, [0, y, 0]); c.scale.y = 0.35; o.add(c); } return o; };
  const a = mk(); a.rotation.z = Math.PI / 2; const lb = axisLabel(0.0137, 0.07); lb.position.y = -0.055; lb.rotation.y = Math.PI / 2 + 0.6; a.add(lb);
  g.add(P(parts, Z(a, 'hit'), 'العصا الساكنة', 'توضع على أطراف أصابع اليد المقوّسة لتكوّن الراحة تجويفًا للرنين.'));
  const piv = new THREE.Group(); piv.position.set(0.02, 0.0, 0.16); const b = mk(); b.rotation.x = Math.PI / 2; b.position.z = -0.1; piv.add(b); piv.rotation.y = -0.25; g.add(P(parts, Z(piv, 'hit'), 'العصا الضاربة', 'تُضرب بها العصا الساكنة في منتصفها.'));
  g.rotation.set(0.5, -0.3, 0); let t = 9, amp = 1;
  return { group: g, parts, fire: (x, lv) => { t = 0; amp = lv === 'w' ? 0.6 : 1; }, update: (dt) => { t += dt; piv.rotation.x = -0.16 - 0.3 * (1 - strike(t, 0.03, 0.3)) ; a.position.y = -0.004 * amp * strike(t, 0.03, 0.2); } };
}

// =============================================================== القالب الخشبي
function woodblock() {
  const M = mats(), g = new THREE.Group(), parts = [], w = wood('#c99755', '#8a5c26', 81, [2, 1], false, { roughness: 0.35 });
  const blk = new THREE.Group(); const top = m(new THREE.BoxGeometry(0.19, 0.058, 0.07), w, [0, 0.05, 0]); blk.add(Z(top, 'hit'));
  blk.add(m(new THREE.BoxGeometry(0.165, 0.008, 0.012), M.dark, [0, 0.062, 0.0305])); blk.add(m(new THREE.BoxGeometry(0.165, 0.007, 0.012), M.dark, [0, 0.036, -0.0305]));
  const bd = badge(0.06); bd.position.set(0, 0.041, 0.0362); blk.add(bd);
  g.add(P(parts, blk, 'القالب', 'قطعة مستطيلة من الخشب الصلب.')); const slit = blk.children[1]; P(parts, slit, 'الشق', 'شق طولي يكوّن تجويفًا يضخّم الرنين.');
  for (const x of [1, -1]) g.add(m(new THREE.BoxGeometry(0.02, 0.02, 0.07), M.felt, [x * 0.07, 0.011, 0]));
  const mal = new THREE.Group(); mal.add(m(new THREE.SphereGeometry(0.014, 18, 14), wood('#a56a34', '#6d4018', 82))); mal.add(rod([0, 0, 0], [0.08, 0.05, 0.2], 0.0042, wood('#e0c495', '#b08c58', 83, [1, 1], true)));
  mal.position.set(0.05, 0.14, 0.05); g.add(P(parts, mal, 'المضرب', 'مضرب خشبي أو مطاطي يُطرق به سطح القالب.')); const st = striker(mal, V(0, 0.07, 0.02));
  return { group: g, parts, fire: (a, lv, d = {}) => { const p = d.object === top && d.point ? g.worldToLocal(d.point.clone()) : V((Math.random() - 0.5) * 0.04, 0, 0.005); st.go(V(p.x, 0.079 + 0.014, Math.max(-0.02, Math.min(0.025, p.z)))); }, update: (dt) => st.update(dt) };
}

// =============================================================== الماراكاس
function maracas() {
  const g = new THREE.Group(), parts = [], list = [];
  for (const s of [1, -1]) {
    const o = new THREE.Group(), body = m(new THREE.SphereGeometry(0.042, 32, 24), wood(s > 0 ? '#b5422a' : '#b5422a', '#6e1f12', 91, [2, 1], false, { roughness: 0.3 }), [0, 0.03, 0]); body.scale.y = 1.28; o.add(body);
    for (const y of [0.012, 0.05]) o.add(m(new THREE.TorusGeometry(y < 0.03 ? 0.0385 : 0.0375, 0.0022, 8, 40), std({ color: 0xe9c765, roughness: 0.4 }), [0, y + (y < 0.03 ? 0 : 0.002), 0], [Math.PI / 2, 0, 0]));
    const hd = wood('#d9b57c', '#a8824a', 92, [1, 1], true); o.add(m(new THREE.CylinderGeometry(0.012, 0.0095, 0.14, 20), hd, [0, -0.085, 0])); o.add(m(new THREE.SphereGeometry(0.0115, 14, 10), hd, [0, -0.155, 0]));
    const lb = axisLabel(0.0112, 0.06, '#4a2a10'); lb.position.y = -0.085; lb.rotation.y = Math.PI / 2; o.add(lb);
    const piv = new THREE.Group(); piv.position.set(s * 0.06, -0.02, 0); piv.rotation.z = -s * 0.3; piv.add(o); o.position.y = 0.02; piv.userData.t = 9; piv.userData.s = s; list.push(piv); g.add(Z(piv, 'hit', { which: s > 0 ? 0 : 1 }));
  }
  P(parts, list[0].children[0].children[0], 'الوعاء', 'وعاء مجوف بداخله حبيبات صغيرة حرة الحركة تصدر الخشخشة.'); P(parts, list[1].children[0].children[4], 'المقبض', 'تُمسك منه الآلة وتُهزّ بحركة قصيرة من الرسغ.');
  let k = 0;
  return { group: g, parts, fire: (a, lv, d = {}) => { const p = list[d.object ? (function f(o) { while (o) { if (o.userData.which != null) return o.userData.which; o = o.parent; } return k++ % 2; })(d.object) : k++ % 2]; p.userData.t = 0; p.userData.amp = lv === 'w' ? 0.6 : 1; },
    update: (dt) => { for (const p of list) { p.userData.t += dt; const t = p.userData.t; p.rotation.x = (p.userData.amp || 1) * 0.5 * Math.exp(-t * 7) * Math.sin(t * 28); } } };
}

export const BUILDERS = { castanets, triangle, jingles, glock, bass, tamb, cymbals, snare, claves, wood: woodblock, maracas };
