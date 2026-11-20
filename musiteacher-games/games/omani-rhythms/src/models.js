// =====================================================================
//  مجسّمات الآلات الإيقاعية العُمانية — مبنية برمجيًا (لا نماذج خارجية) من أوصاف وصور أدلة المعلم.
//  كل دالة تعيد { group, size:{w,h}, hit(group, t, k) } حيث t الزمن منذ آخر ضربة (ث) و k نوعها.
//  الوحدات بالمتر والمقاسات تقريبية. «الرنة» و«الكاسر المفلطح» من وصف دليل الصف السابع وصورتيه (ص 71).
//  البرغام والجم والمعاضد آلات ترد في الوصف دون مدوّنة: صور فقط (لا صوت).
// =====================================================================
import * as THREE from 'three';
import { skinTexture, woodTexture, ropeTexture } from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const mesh = (g, mat) => sh(new THREE.Mesh(g, mat));
const brass = (c = 0xd2a23c, r = 0.3) => std({ color: c, metalness: 1, roughness: r });
function band(ri, ro, y0, y1, mat) {
  const pts = [new THREE.Vector2(ri, y0), new THREE.Vector2(ro, y0), new THREE.Vector2(ro, y1), new THREE.Vector2(ri, y1), new THREE.Vector2(ri, y0)];
  return mesh(new THREE.LatheGeometry(pts, 72), mat);
}
const skinDisc = (R, kind, seed, brand = true) => { const m = mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshPhysicalMaterial({ map: skinTexture(kind, seed, brand), roughness: 0.62, sheen: 0.3, side: THREE.DoubleSide })); m.castShadow = false; return m; };

/** طبل أسطواني برَقمتين مشدودتين بالحبال (الكاسر/الرحماني/…): مبنيّ قائمًا على المحور Y */
function barrel({ R, H, skin, seed, woodA, woodB, lace, bulge = 0.06, belt = true }) {
  const g = new THREE.Group();
  const prof = []; for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push(new THREE.Vector2(R * (1 - bulge + bulge * Math.sin(Math.PI * t)), H * t)); }
  g.add(mesh(new THREE.LatheGeometry(prof, 72), std({ map: woodTexture(woodA, woodB, seed, [3, 1], true), roughness: 0.5, side: THREE.DoubleSide })));
  const Re = R * (1 - bulge), rope = std({ map: ropeTexture('#cdbd98', [40, 1]), roughness: 0.85 }), tube = Math.max(0.008, R * 0.05), Rh = Re + 0.012;
  const top = skinDisc(Re + 0.004, skin, seed + 40); top.rotation.x = -Math.PI / 2; top.position.y = H + 0.003; g.add(top);
  const bot = skinDisc(Re + 0.004, skin, seed + 41, false); bot.rotation.x = Math.PI / 2; bot.position.y = -0.003; g.add(bot);
  for (const [y, s] of [[H, 1], [0, -1]]) {
    g.add(band(Re + 0.004, Re + 0.0056, Math.min(y, y - s * 0.03), Math.max(y, y - s * 0.03), std({ color: skin === 'goat' ? 0xb9a074 : 0xd8c7a2, roughness: 0.75 })));
    const hp = mesh(new THREE.TorusGeometry(Rh, tube, 10, 72), rope); hp.rotation.x = Math.PI / 2; hp.position.y = y - s * 0.022; g.add(hp);
  }
  const ropeV = std({ map: ropeTexture('#d6c7a4', [1, 18]), roughness: 0.85 }), y1 = H - 0.022, y0 = 0.022, Rr = Rh + tube * 0.6, up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < lace * 2; i++) {
    const a = i / (lace * 2) * Math.PI * 2, b = (i + 1) / (lace * 2) * Math.PI * 2, t = i % 2 === 0;
    const A = new THREE.Vector3(Rr * Math.sin(a), t ? y1 : y0, Rr * Math.cos(a)), B = new THREE.Vector3(Rr * Math.sin(b), t ? y0 : y1, Rr * Math.cos(b)), dv = B.clone().sub(A);
    const rd = mesh(new THREE.CylinderGeometry(0.0034, 0.0034, dv.length(), 6), ropeV); rd.position.copy(A).add(B).multiplyScalar(0.5); rd.quaternion.setFromUnitVectors(up, dv.normalize()); g.add(rd);
  }
  if (belt) { const bl = mesh(new THREE.TorusGeometry(R + 0.006, 0.004, 8, 72), rope); bl.rotation.x = Math.PI / 2; bl.position.y = H / 2; g.add(bl); }
  return g;
}
/** يضع الطبل الأسطواني مائلًا على جنبه كما يُحمل ويُعرض، مع ظهور إحدى الرقمتين */
function lay(body, R, H, yaw = 0.5) {
  const g = new THREE.Group(), inner = new THREE.Group();
  body.position.y = -H / 2; inner.add(body); inner.rotation.z = Math.PI / 2 - 0.16; inner.rotation.y = yaw; inner.position.y = R + 0.01; g.add(inner);
  return g;
}
const pulse = (g, t, amp = 0.07) => { const k = t < 0.28 ? Math.exp(-t / 0.07) * Math.cos(t * 42) : 0; g.scale.setScalar(1 + amp * k); g.position.y = (g.userData.y0 || 0) + 0.02 * Math.max(0, k); };

export const BUILDERS = {
  rahmani() { const R = 0.2, H = 0.5; return { group: lay(barrel({ R, H, skin: 'goat', seed: 61, woodA: '#6a2418', woodB: '#2a0d08', lace: 14 }), R, H, 0.55), size: { w: 0.62, h: 0.46 }, hit: (g, t) => pulse(g, t, 0.06) }; },
  kasir() { const R = 0.13, H = 0.42; return { group: lay(barrel({ R, H, skin: 'sheep', seed: 51, woodA: '#7a3a1c', woodB: '#3a1808', lace: 11 }), R, H, 0.55), size: { w: 0.5, h: 0.32 }, hit: (g, t) => pulse(g, t, 0.08) }; },
  /** الكاسر المفلطح (دليل الصف السابع ص 71): من فصيلة الكاسر، أقصر ومفلطح، وجهاه بجلد بشعره مشدود بالحبل؛ ومعه عصا معقوفة كما في صورة الدليل */
  kasir_flat() {
    const R = 0.17, H = 0.11, w = lay(barrel({ R, H, skin: 'hair', seed: 71, woodA: '#6a3a1c', woodB: '#2e160a', lace: 9, bulge: 0.02, belt: false }), R, H, 1.0);
    const pts = [[-0.2, 0.012, 0.16], [0.02, 0.012, 0.15], [0.16, 0.014, 0.135], [0.2, 0.03, 0.12], [0.195, 0.06, 0.112]].map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts), wood = std({ map: woodTexture('#d7a861', '#9a6a30', 33, [1, 4], true), roughness: 0.5 });
    w.add(mesh(new THREE.TubeGeometry(curve, 48, 0.0075, 10), wood));
    const wrap = mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.1, 12), std({ color: 0x1d1a18, roughness: 0.7 })); wrap.rotation.z = Math.PI / 2; wrap.position.set(-0.03, 0.012, 0.155); w.add(wrap);
    return { group: w, size: { w: 0.46, h: 0.38 }, hit: (g, t) => pulse(g, t, 0.06) };
  },
  /** طبل الرنة (دليل الصف السابع ص 71): يشبه الكاسر والرحماني، متوسط الحجم بينهما؛ خشب فاتح كما في صورة الدليل */
  ranna() { const R = 0.165, H = 0.4; return { group: lay(barrel({ R, H, skin: 'sheep', seed: 81, woodA: '#d39a4e', woodB: '#8a5a24', lace: 12 }), R, H, 0.6), size: { w: 0.52, h: 0.38 }, hit: (g, t) => pulse(g, t, 0.06) }; },
  /** المسيندو: جسم طويل مخروطي برَقمة واحدة في الأعلى مشدودة بحبال متعرجة */
  msindo() {
    const g = new THREE.Group(), H = 0.86, Rt = 0.125;
    const prof = [[0.03, 0], [0.036, 0.02], [0.045, 0.16], [0.062, 0.36], [0.086, 0.56], [0.11, 0.72], [Rt, H]].map((p) => new THREE.Vector2(p[0], p[1]));
    g.add(mesh(new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(40), 64), std({ map: woodTexture('#8a4a22', '#4a2410', 91, [2, 1], true), roughness: 0.42, side: THREE.DoubleSide })));
    const top = skinDisc(Rt + 0.004, 'goat', 95); top.rotation.x = -Math.PI / 2; top.position.y = H + 0.003; g.add(top);
    g.add(band(Rt + 0.003, Rt + 0.006, H - 0.05, H + 0.003, std({ color: 0xcdb98e, roughness: 0.75 })));
    const rope = std({ map: ropeTexture('#d6c7a4', [30, 1]), roughness: 0.85 });
    const r1 = mesh(new THREE.TorusGeometry(Rt + 0.008, 0.007, 8, 64), rope); r1.rotation.x = Math.PI / 2; r1.position.y = H - 0.03; g.add(r1);
    const r2 = mesh(new THREE.TorusGeometry(0.106, 0.006, 8, 64), rope); r2.rotation.x = Math.PI / 2; r2.position.y = H - 0.17; g.add(r2);
    const up = new THREE.Vector3(0, 1, 0), rv = std({ map: ropeTexture('#d6c7a4', [1, 10]), roughness: 0.85 });
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2, b = (i + 1) / 20 * Math.PI * 2, t = i % 2 === 0;
      const A = new THREE.Vector3((t ? Rt + 0.012 : 0.112) * Math.sin(a), t ? H - 0.03 : H - 0.17, (t ? Rt + 0.012 : 0.112) * Math.cos(a)), B = new THREE.Vector3((t ? 0.112 : Rt + 0.012) * Math.sin(b), t ? H - 0.17 : H - 0.03, (t ? 0.112 : Rt + 0.012) * Math.cos(b)), dv = B.clone().sub(A);
      const rd = mesh(new THREE.CylinderGeometry(0.003, 0.003, dv.length(), 6), rv); rd.position.copy(A).add(B).multiplyScalar(0.5); rd.quaternion.setFromUnitVectors(up, dv.normalize()); g.add(rd);
    }
    g.rotation.z = -0.1; g.rotation.x = 0.2;
    const w = new THREE.Group(); w.add(g); return { group: w, size: { w: 0.34, h: 0.9 }, hit: (gr, t) => pulse(gr, t, 0.05) };
  },
  /** التنك: علبة معدنية فارغة يُضرب عليها بعصوين خشبيتين */
  tanak() {
    const g = new THREE.Group(), W = 0.24, H = 0.34;
    const tin = std({ color: 0x9aa56a, metalness: 0.92, roughness: 0.34 }), edge = std({ color: 0xb9bf9a, metalness: 1, roughness: 0.25 });
    const body = mesh(new THREE.BoxGeometry(W, H, W), tin); body.position.y = H / 2; g.add(body);
    for (const y of [0.004, H - 0.004]) { const r = mesh(new THREE.BoxGeometry(W + 0.012, 0.012, W + 0.012), edge); r.position.y = y; g.add(r); }
    for (const y of [H * 0.3, H * 0.7]) { const r = mesh(new THREE.BoxGeometry(W + 0.004, 0.006, W + 0.004), edge); r.position.y = y; g.add(r); }
    const cap = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 24), std({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.5 })); cap.position.set(W * 0.28, H + 0.01, W * 0.28); g.add(cap);
    const wood = std({ map: woodTexture('#c79a5a', '#8a6230', 12, [1, 3], true), roughness: 0.55 }), sticks = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(), st = mesh(new THREE.CylinderGeometry(0.0075, 0.0095, 0.36, 12), wood); st.rotation.z = Math.PI / 2; st.position.x = 0.15; p.add(st);
      p.position.set(-0.05, H + 0.075, s * 0.05); p.rotation.y = s * 0.28; p.rotation.z = 0.3; p.userData.rz = 0.3; g.add(p); sticks.push(p);
    }
    g.rotation.y = 0.6; const w = new THREE.Group(); w.add(g); w.userData.sticks = sticks; w.userData.n = 0;
    return { group: w, size: { w: 0.5, h: 0.5 }, hit: (gr, t, k, fresh) => { if (fresh) gr.userData.n++; const s = gr.userData.sticks, a = gr.userData.n % 2; s.forEach((p, i) => { const d = i === a && t < 0.16 ? Math.sin(Math.PI * Math.min(1, t / 0.16)) : 0; p.rotation.z = p.userData.rz - 0.42 * (i === a ? Math.max(0, 1 - t / 0.07) : 0) + 0.05 * d; }); pulse(gr, t, 0.025); } };
  },
  /** الصاجات (السحال): زوج من الصاجات النحاسية الدائرية بمقبضين من القماش */
  sajat() {
    const g = new THREE.Group(), R = 0.1, mk = () => {
      const c = new THREE.Group(), prof = [[0, 0.03], [0.022, 0.028], [0.034, 0.012], [0.05, 0.006], [R, 0]].map((p) => new THREE.Vector2(p[0], p[1]));
      c.add(mesh(new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(24), 64), std({ color: 0xc9a23a, metalness: 1, roughness: 0.32, side: THREE.DoubleSide })));
      const strap = mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 20, Math.PI), std({ color: 0x2a1a22, roughness: 0.9 })); strap.position.y = 0.03; c.add(strap);
      const tail = mesh(new THREE.BoxGeometry(0.02, 0.004, 0.09), std({ color: 0x2a1a22, roughness: 0.9 })); tail.position.set(0.03, 0.03, 0.04); tail.rotation.x = 0.4; c.add(tail);
      return c;
    };
    const a = mk(), b = mk(); a.position.y = 0.11; a.rotation.z = 0.5; a.rotation.x = Math.PI; a.userData.y0 = 0.11; b.position.y = 0.02; b.rotation.z = -0.12; g.add(a, b);
    g.position.y = 0.06; g.rotation.x = 0.5; const w = new THREE.Group(); w.add(g); w.userData.topC = a;
    return { group: w, size: { w: 0.34, h: 0.3 }, hit: (gr, t) => { const c = gr.userData.topC, k = t < 0.22 ? Math.exp(-t / 0.05) : 0; c.position.y = 0.11 - 0.06 * k; c.rotation.z = 0.5 - 0.42 * k; pulse(gr, t, 0.03); } };
  },
  /** البرغام (دليل الصف الخامس): آلة نفخ من قرن الوعل أو المها العربي تصدر نغمة واحدة — صورة فقط */
  bargham() {
    const g = new THREE.Group(), N = 46, up = new THREE.Vector3(0, 1, 0);
    const curve = new THREE.CatmullRomCurve3([[-0.26, 0.05, 0], [-0.12, 0.07, 0.02], [0.02, 0.12, 0.03], [0.12, 0.22, 0.02], [0.15, 0.34, -0.01], [0.11, 0.44, -0.04]].map((p) => new THREE.Vector3(...p)));
    const horn = std({ map: woodTexture('#cfb27f', '#7d6240', 17, [1, 6], true), roughness: 0.4 }), tip = std({ color: 0x3b2d22, roughness: 0.4 });
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, A = curve.getPoint(t0), B = curve.getPoint(t1), d = B.clone().sub(A);
      const r = (t) => 0.042 * (1 - t) + 0.007 * t;
      const c = mesh(new THREE.CylinderGeometry(r(t1), r(t0), d.length() * 1.02, 20), t0 > 0.9 ? tip : horn); c.position.copy(A).add(B).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(up, d.normalize()); g.add(c);
      if (i % 4 === 2 && t0 < 0.72) { const ring = mesh(new THREE.TorusGeometry(r(t0) + 0.002, 0.0055, 8, 24), horn); ring.position.copy(A); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize()); g.add(ring); }
    }
    const mouth = mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.006, 24), std({ color: 0x2a1d14, roughness: 0.9 })); const d0 = curve.getTangent(0); mouth.position.copy(curve.getPoint(0)); mouth.quaternion.setFromUnitVectors(up, d0); g.add(mouth);
    g.rotation.y = 0.5; const w = new THREE.Group(); w.add(g); return { group: w, size: { w: 0.5, h: 0.48 }, hit: () => {} };
  },
  /** الجم (اليم) (دليل الصف السادس): صدفة بحرية يُنفخ فيها فتصدر صوتًا واحدًا — صورة فقط */
  jem() {
    const g = new THREE.Group(), shell = std({ map: woodTexture('#f1e2c8', '#c79c6c', 41, [1, 5], false), roughness: 0.45 }), ridge = std({ color: 0xa8774a, roughness: 0.5 });
    // الجسم: قناة سفلية ضيقة ← أعرض جزء ← كتف ← قمّة لولبية مخروطية
    const prof = [[0.006, 0], [0.018, 0.05], [0.04, 0.11], [0.072, 0.18], [0.09, 0.23], [0.086, 0.26], [0.06, 0.285], [0.04, 0.305], [0.022, 0.33], [0.006, 0.36]].map((p) => new THREE.Vector2(p[0], p[1]));
    g.add(mesh(new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(60), 64), shell));
    const hel = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * Math.PI * 10, y = 0.262 + t * 0.095, rr = 0.084 * (1 - t) ** 1.15 + 0.004; hel.push(new THREE.Vector3(rr * Math.cos(a), y, rr * Math.sin(a))); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hel), 260, 0.0045, 8), ridge));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, k = mesh(new THREE.ConeGeometry(0.011, 0.034, 10), shell); k.position.set(0.088 * Math.cos(a), 0.252, 0.088 * Math.sin(a)); k.lookAt(0.3 * Math.cos(a), 0.3, 0.3 * Math.sin(a)); k.rotateX(Math.PI / 2); g.add(k); }
    // الشفة المتسعة (فتحة الصدفة) بلون وردي من الداخل
    const sh2 = new THREE.Shape(); sh2.moveTo(0, 0.02); sh2.quadraticCurveTo(0.09, 0.06, 0.07, 0.17); sh2.quadraticCurveTo(0.05, 0.25, 0, 0.24); sh2.lineTo(0, 0.02);
    const lip = mesh(new THREE.ExtrudeGeometry(sh2, { depth: 0.008, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 24 }), std({ color: 0xf2b4a0, roughness: 0.3 }));
    lip.position.set(0.02, 0, 0.055); lip.rotation.y = -0.5; g.add(lip);
    g.rotation.z = Math.PI / 2 + 0.12; g.rotation.y = -0.35; g.position.set(0.17, 0.095, 0);
    const w = new THREE.Group(); w.add(g); return { group: w, size: { w: 0.42, h: 0.3 }, hit: () => {} };
  },
  /** المعاضد الفضية (دليل الصف الخامس، فن الكيذا): حُليّ فضية تُحدث صوتًا رنّانًا — صورة فقط */
  maadid() {
    const g = new THREE.Group(), silver = std({ color: 0xdfe3e8, metalness: 1, roughness: 0.22 }), dark = std({ color: 0x8c939b, metalness: 1, roughness: 0.4 });
    [[0, 0.02, 0, 0.12], [0.03, 0.05, 0.02, -0.15], [-0.02, 0.085, -0.01, 0.2]].forEach(([x, y, z, tilt], j) => {
      const b = new THREE.Group(), R = 0.085;
      b.add(mesh(new THREE.TorusGeometry(R, 0.014, 18, 72), silver));
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, s = mesh(new THREE.SphereGeometry(0.0068, 10, 8), j === 1 ? dark : silver); s.position.set((R + 0.012) * Math.cos(a), (R + 0.012) * Math.sin(a), 0); b.add(s); }
      b.rotation.x = Math.PI / 2 + tilt; b.position.set(x, y, z); g.add(b);
    });
    const w = new THREE.Group(); w.add(g); return { group: w, size: { w: 0.32, h: 0.2 }, hit: () => {} };
  },
  /** الطار (السمّاع): إطار خشبي دائري مغطى بالجلد */
  tar() {
    const g = new THREE.Group(), R = 0.24, D = 0.075, ri = R - 0.012;
    g.add(band(ri, R, 0, D, std({ map: woodTexture('#b98a52', '#7a5226', 8, [5, 1]), roughness: 0.5 })));
    const head = skinDisc(R - 0.001, 'goat', 23); head.rotation.x = -Math.PI / 2; head.position.y = D + 0.001; g.add(head);
    g.add(band(R, R + 0.0018, D - 0.03, D + 0.001, std({ color: 0xc9b48c, roughness: 0.75 })));
    for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, t = mesh(new THREE.SphereGeometry(0.0045, 10, 8), brass()); t.position.set((R + 0.002) * Math.sin(a), D - 0.018, (R + 0.002) * Math.cos(a)); g.add(t); }
    g.rotation.x = Math.PI / 2 - 0.35; g.position.y = R * 0.98; g.rotation.z = 0.0;
    const w = new THREE.Group(); const p = new THREE.Group(); p.add(g); p.rotation.y = -0.45; w.add(p);
    return { group: w, size: { w: 0.52, h: 0.5 }, hit: (gr, t) => pulse(gr, t, 0.05) };
  },
};

export const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } };
