// =====================================================================
//  سيارة السباق: سيارة «فورمولا» مدرسية بمقصورة مفتوحة (السائق ظاهر للطلاب)، جسم ملفوف ناعم، جناحان،
//  قوس حماية خلف الرأس، عجلات مكشوفة بإطارات ناعمة، ومقود دائري يدور فعليًا مع تغيير المسار.
//  الإحداثيات المحلية: +Z للأمام، +Y للأعلى، +X يسار السائق. الأصل على الأرض تحت الحوض.
// =====================================================================
import * as THREE from 'three';
import { loft, wheel, paint, MAT, decal, rod, blobShadow, TAU, namePlate, dashScreen } from './parts.js';
import { vehicleFlag } from '../world/flag.js';

export function buildCar(o = {}) {
  const color = o.color || '#e63946', accent = o.accent || '#ffffff', num = o.number || '7';
  const root = new THREE.Group(); root.name = 'car';
  const body = new THREE.Group(); root.add(body);              // الجسم (يميل قليلًا عند الانعطاف)
  const pMain = paint(color), pAcc = paint(accent, { metal: 0.1 }), carbon = MAT.carbon();
  const inner = new THREE.MeshStandardMaterial({ color: 0x1c1f25, roughness: 0.8, side: THREE.DoubleSide });

  // ---- الهيكل الأحادي (المقصورة من z=-0.25 إلى 0.55 مفتوحة من الأعلى) ----
  const tub = loft([
    { z: -1.45, w: 0.50, h: 0.36, y: 0.36, n: 3 },
    { z: -1.05, w: 0.78, h: 0.46, y: 0.38, n: 3.2 },
    { z: -0.55, w: 0.86, h: 0.58, y: 0.40, n: 3.4 },
    { z: -0.20, w: 0.80, h: 0.62, y: 0.38, n: 3.6 },
    { z: 0.30, w: 0.74, h: 0.56, y: 0.36, n: 3.4 },
    { z: 0.70, w: 0.56, h: 0.44, y: 0.36, n: 3 },
    { z: 1.20, w: 0.38, h: 0.32, y: 0.32, n: 2.6 },
    { z: 1.75, w: 0.22, h: 0.18, y: 0.26, n: 2.2 },
    { z: 1.95, w: 0.10, h: 0.08, y: 0.24, n: 2 },
  ], { seg: 96, steps: 14, open: [{ z0: -0.30, z1: 0.62, a: 0.95 }] });
  const tubM = new THREE.Mesh(tub, paint(color, { side: THREE.DoubleSide })); body.add(tubM);
  // إطار المقصورة المبطّن يغطي حافة الفتحة
  if (tub.userData.edge && tub.userData.edge.length > 4) {
    const coam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tub.userData.edge, true, 'centripetal'), 120, 0.03, 10, true), new THREE.MeshStandardMaterial({ color: 0x1d2026, roughness: 0.7 }));
    body.add(coam);
  }
  // أرضية المقصورة الداكنة + المقعد
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.95), inner); floor.position.set(0, 0.16, 0.12); body.add(floor);
  const seatBack = new THREE.Mesh(loft([{ z: -0.02, w: 0.46, h: 0.62, y: 0.46, n: 4 }, { z: 0.04, w: 0.46, h: 0.62, y: 0.46, n: 4 }], { steps: 1, seg: 24 }), inner);
  seatBack.rotation.x = -0.36; seatBack.position.set(0, 0.0, -0.27); body.add(seatBack);
  const seatPan = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.42), inner); seatPan.position.set(0, 0.19, 0.0); body.add(seatPan);
  // الجانبان (حاويات المبرّد) بلون ثانوي
  for (const sg of [-1, 1]) {
    const pod = new THREE.Mesh(loft([
      { z: -0.95, w: 0.20, h: 0.30, y: 0.30, n: 3 }, { z: -0.6, w: 0.32, h: 0.34, y: 0.30, n: 3.6 }, { z: 0.15, w: 0.34, h: 0.32, y: 0.28, n: 3.6 }, { z: 0.45, w: 0.26, h: 0.26, y: 0.26, n: 3 }, { z: 0.62, w: 0.06, h: 0.12, y: 0.24, n: 2 },
    ], { seg: 28, steps: 5 }), pMain);
    pod.position.x = sg * 0.50; body.add(pod);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 1.1), pAcc); stripe.position.set(sg * 0.672, 0.33, -0.25); body.add(stripe);
    const num1 = decal(num, 0.26, 0.26, { bg: '#ffffff', color: color }); num1.position.set(sg * 0.675, 0.30, -0.42); num1.rotation.y = sg * Math.PI / 2; body.add(num1);
  }
  // غطاء المحرك خلف السائق + فتحة الهواء فوق الرأس
  const engine = new THREE.Mesh(loft([
    { z: -1.40, w: 0.36, h: 0.20, y: 0.52, n: 2.4 }, { z: -0.95, w: 0.40, h: 0.34, y: 0.62, n: 2.6 }, { z: -0.50, w: 0.34, h: 0.48, y: 0.72, n: 2.8 }, { z: -0.32, w: 0.26, h: 0.44, y: 0.78, n: 2.6 }, { z: -0.24, w: 0.10, h: 0.12, y: 0.86, n: 2 },
  ], { seg: 32, steps: 6 }), pMain); body.add(engine);
  const intake = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 10, 24), carbon); intake.position.set(0, 0.96, -0.30); body.add(intake);
  // قوس الحماية (Halo) فوق المقصورة
  const haloCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.28, 0.62, -0.18), new THREE.Vector3(-0.22, 0.86, 0.02), new THREE.Vector3(0, 0.92, 0.22), new THREE.Vector3(0.22, 0.86, 0.02), new THREE.Vector3(0.28, 0.62, -0.18)]);
  const halo = new THREE.Mesh(new THREE.TubeGeometry(haloCurve, 40, 0.022, 10), carbon); body.add(halo);
  // الأنف والجناح الأمامي
  const fw = new THREE.Group(); fw.position.set(0, 0.12, 1.82); body.add(fw);
  const wingMain = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.025, 0.32), carbon); fw.add(wingMain);
  const wingFlap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.18), pMain); wingFlap.position.set(0, 0.05, -0.12); wingFlap.rotation.x = 0.35; fw.add(wingFlap);
  for (const sg of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.42), pAcc); ep.position.set(sg * 0.81, 0.06, 0); fw.add(ep); }
  fw.add(rod([-0.12, 0.02, 0.05], [-0.06, 0.16, 0.05], 0.012, carbon), rod([0.12, 0.02, 0.05], [0.06, 0.16, 0.05], 0.012, carbon));
  // الجناح الخلفي بشعار المنصة
  const rw = new THREE.Group(); rw.position.set(0, 0.78, -1.55); body.add(rw);
  const rMain = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.32), pMain); rw.add(rMain);
  const rTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.025, 0.2), carbon); rTop.position.set(0, 0.11, -0.04); rTop.rotation.x = -0.3; rw.add(rTop);
  for (const sg of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.36, 0.46), pAcc); ep.position.set(sg * 0.5, -0.02, 0); rw.add(ep); }
  rw.add(rod([0, -0.02, 0.05], [0, -0.42, 0.2], 0.03, carbon));
  const logo = decal('MusiTeacher', 0.9, 0.16, { color: '#ffffff', size: 0.7 }); logo.position.set(0, 0.03, -0.161); logo.rotation.y = Math.PI; rw.add(logo);
  const logo2 = decal('MusiTeacher', 0.9, 0.16, { color: '#ffffff', size: 0.7 }); logo2.rotation.x = -Math.PI / 2; logo2.position.set(0, 0.017, 0); rw.add(logo2);
  // لوحة اسم المتسابق تحت شعار MusiTeacher (بين صفيحتي الجناح الجانبيتين)
  const plateBar = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.15, 0.03), carbon); plateBar.position.set(0, -0.135, -0.14); rw.add(plateBar);
  const plate = namePlate(0.9, 0.13); plate.mesh.position.set(0, -0.135, -0.157); plate.mesh.rotation.y = Math.PI; rw.add(plate.mesh);
  // علم سلطنة عُمان على سارية صغيرة فوق الصفيحة الجانبية للجناح الخلفي (كأعلام السيارات في المناسبات الوطنية)
  const flag = vehicleFlag({ poleH: 0.78, L: 0.6, lean: 0.1 }); flag.group.position.set(-0.5, 0.16, 0.06); rw.add(flag.group);
  // رقم السيارة على الأنف
  const nn = decal(num, 0.16, 0.16, { color: '#ffffff' }); nn.rotation.x = -Math.PI / 2 + 0.2; nn.position.set(0, 0.43, 1.05); body.add(nn);
  // المرايا
  for (const sg of [-1, 1]) {
    body.add(rod([sg * 0.36, 0.56, 0.42], [sg * 0.5, 0.66, 0.40], 0.008, carbon));
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), pMain); mir.position.set(sg * 0.52, 0.67, 0.40); body.add(mir);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.04), MAT.chrome()); glass.position.set(sg * 0.52, 0.67, 0.384); glass.rotation.y = Math.PI; body.add(glass);
  }
  // الأضواء الخلفية (تضيء عند الفرملة)
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 0.2 });
  const brake = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.02), brakeMat); brake.position.set(0, 0.36, -1.47); body.add(brake);
  // ---- العجلات ----
  const wheels = [];
  const W = [[0.74, 0.33, 1.25, 0.33, 0.30], [-0.74, 0.33, 1.25, 0.33, 0.30], [0.76, 0.36, -1.05, 0.36, 0.40], [-0.76, 0.36, -1.05, 0.36, 0.40]];
  for (const [x, y, z, R, w] of W) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); root.add(pivot);
    const wh = wheel(R, w, { slick: true, spokes: 5, rimMat: paint(accent, { metal: 0.6 }) }); if (x < 0) wh.rotation.y = Math.PI;
    pivot.add(wh); wheels.push({ pivot, wh, front: z > 0, R });
    // ذراعا التعليق
    const inX = Math.sign(x) * 0.32;
    root.add(rod([inX, y + 0.06, z + 0.12], [x * 0.92, y + 0.04, z], 0.012, carbon), rod([inX, y - 0.08, z - 0.12], [x * 0.92, y - 0.06, z], 0.012, carbon));
  }
  // ---- المقود ----
  const steer = new THREE.Group(); steer.name = 'steering';
  const SW = { c: [0, 0.60, 0.42], R: 0.15, tilt: 0.42 };       // tilt: ميل مستوى المقود نحو السائق
  steer.position.set(...SW.c); steer.rotation.x = SW.tilt; body.add(steer);
  const spin = new THREE.Group(); steer.add(spin);                // يدور حول محوره المحلي Z
  const rimGeo = new THREE.TorusGeometry(SW.R, 0.017, 12, 48);
  const grip = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.75 });
  spin.add(new THREE.Mesh(rimGeo, grip));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 20), pMain); hub.rotation.x = Math.PI / 2; spin.add(hub);
  for (const a of [0, Math.PI, -Math.PI / 2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, SW.R, 0.012), MAT.alloy()); sp.geometry.translate(0, SW.R / 2, 0); sp.rotation.z = a - Math.PI / 2; spin.add(sp); }
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.022), paint('#ffcc00')); mark.position.set(0, SW.R, 0); spin.add(mark);
  const column = rod([0, 0, -0.02], [0, 0, 0.28], 0.018, MAT.dark()); steer.add(column);
  // شاشة صغيرة على المقود
  const dash = dashScreen(0.10, 0.05); const scr = dash.mesh; scr.position.set(0, 0.012, -0.033); scr.rotation.y = Math.PI; spin.add(scr);
  root.add(blobShadow(2.2, 4.4));
  root.traverse((m) => { if (m.isMesh && m.material && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });

  const seatAnchor = new THREE.Group(); seatAnchor.name = 'seat'; body.add(seatAnchor);

  // ---- مواصفات الجلوس (للسائق) ----
  const spec = {
    kind: 'car',
    hip: [0, 0.33, -0.02], seatY: 0.215,
    torsoLean: -0.38, leanDist: [0.55, 0.3, 0.15], neckExtra: 0.22, headPitch: 0.05,
    legs: { ankle: [0.13, 0.30, 0.86], pole: [0.15, 1, 0.25], foot: [0, 0.55, 0.84] },
    elbowPole: [0.75, -0.55, -0.35],
  };
  const tmp = new THREE.Vector3();
  /** نقاط القبضة: «٩ و٣» على الإطار، بحسب دوران المقود الحالي (إحداثيات عالمية) */
  function gripFrames() {
    steer.updateWorldMatrix(true, true);
    const m = spin.matrixWorld, out = [];
    const toW = (x, y, z) => tmp.set(x, y, z).applyMatrix4(m).toArray();
    const dirW = (x, y, z) => { const a = new THREE.Vector3(x, y, z).transformDirection(m); return a.toArray(); };
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1, a = sg > 0 ? 0 : Math.PI;           // محليًا: +X = يسار السائق (السائق ينظر +Z والمقود ينظر نحوه)
      const ang = a + sg * 0.18;                                          // فوق خط المنتصف قليلًا (٩:١٥ و٢:٤٥)
      const P = toW(Math.cos(ang) * SW.R, Math.sin(ang) * SW.R, 0);
      const tang = dirW(-Math.sin(ang) * sg, Math.cos(ang) * sg, 0);     // المماس نحو الأعلى عند كل يد (جهة الإبهام)
      const radial = dirW(Math.cos(ang), Math.sin(ang), 0), normal = dirW(0, 0, -1); // normal نحو السائق (المقود يواجه −Z المحلي بعد الإمالة؟)
      const palm = new THREE.Vector3(...radial).multiplyScalar(-0.55).add(new THREE.Vector3(...normal).multiplyScalar(-0.8)).normalize().toArray();
      out.push({ s, P, axis: tang, palm, r: 0.017 });
    }
    return out;
  }
  let steerA = 0, roll = 0;
  return {
    kind: 'car', root, body, seatAnchor, spec, gripFrames,
    brakeLight(on) { brakeMat.emissiveIntensity = on ? 2.2 : 0.2; },
    /** a: زاوية المقود (راديان، موجب = يسار) */
    setSteer(a) { steerA = a; spin.rotation.z = -a * 2.2; for (const w of wheels) if (w.front) w.pivot.rotation.y = a * 0.5; },
    update(dt, speed, lat) {
      for (const w of wheels) w.wh.rotation.x += (speed * dt) / w.R * (w.wh.rotation.y ? -1 : 1);
      roll += ((-lat * 0.04) - roll) * Math.min(1, dt * 6); body.rotation.z = roll;
      flag.update(dt, speed);
    },
    camera: { back: 5.2, up: 2.2, look: 1.0, fov: 58 },
    pov: { fwd: 0.13, up: 0.07, fov: 76, pitch: -0.12 }, povHide: [halo], flag,
    setPlate: plate.set, setDash: dash.set,
    collider: { halfW: 0.95, len: 4.0 },
  };
}
