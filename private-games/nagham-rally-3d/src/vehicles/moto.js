// =====================================================================
//  موتوسيكل السباق: دراجة رياضية بهيكل مغطّى (فيرينغ) وخزان ومقعد مرتفع الذيل، شوكة أمامية مائلة،
//  مقبضان منخفضان، مسندا قدمين خلفيان، عجلتان بأذرع وأقراص فرامل. الشوكة والعجلة والمقبضان تدور
//  حول محور التوجيه المائل، والدراجة كلها تميل عند الانعطاف (والسائق معها).
//  الإحداثيات المحلية: +Z للأمام، +Y للأعلى، +X يسار السائق. الأصل على الأرض تحت المقعد.
// =====================================================================
import * as THREE from 'three';
import { loft, wheel, paint, MAT, decal, rod, blobShadow, namePlate, dashScreen } from './parts.js';
import { vehicleFlag } from '../world/flag.js';

export function buildMoto(o = {}) {
  const color = o.color || '#1f6feb', accent = o.accent || '#ffffff', num = o.number || '21';
  const root = new THREE.Group(); root.name = 'moto';
  const lean = new THREE.Group(); root.add(lean);               // كل الدراجة تميل حول خط التماس مع الأرض
  const body = new THREE.Group(); lean.add(body);
  const pMain = paint(color), pAcc = paint(accent, { metal: 0.1 }), carbon = MAT.carbon(), dark = MAT.dark();
  const RW = 0.31;                                               // نصف قطر العجلة
  const WB = 1.40;                                               // قاعدة العجلات
  const zF = 0.80, zR = zF - WB;

  // ---- العجلة الخلفية والذراع المتأرجح ----
  const rear = wheel(RW, 0.19, { spokes: 5, disc: false, rimMat: paint(accent, { metal: 0.5 }) });
  rear.rotation.y = 0; const rearP = new THREE.Group(); rearP.position.set(0, RW, zR); rearP.add(rear); body.add(rearP);
  for (const sg of [-1, 1]) body.add(rod([sg * 0.11, RW, zR], [sg * 0.09, 0.42, -0.08], 0.022, MAT.alloy()));
  // ---- الهيكل والخزان والمقعد والذيل ----
  const fairing = new THREE.Mesh(loft([
    { z: -0.78, w: 0.12, h: 0.10, y: 0.86, n: 2.2 },
    { z: -0.55, w: 0.26, h: 0.18, y: 0.84, n: 2.8 },
    { z: -0.25, w: 0.30, h: 0.16, y: 0.78, n: 3.2 },          // تحت المقعد
    { z: 0.05, w: 0.34, h: 0.46, y: 0.66, n: 3 },
    { z: 0.38, w: 0.40, h: 0.62, y: 0.64, n: 2.8 },
    { z: 0.62, w: 0.36, h: 0.62, y: 0.70, n: 2.6 },
    { z: 0.80, w: 0.22, h: 0.42, y: 0.80, n: 2.3 },
    { z: 0.90, w: 0.08, h: 0.14, y: 0.86, n: 2 },
  ], { seg: 40, steps: 7 }), pMain);
  body.add(fairing);
  // الخزان فوق الهيكل (تضمّه الركبتان)
  const tank = new THREE.Mesh(loft([
    { z: 0.02, w: 0.20, h: 0.10, y: 0.86, n: 2.4 }, { z: 0.16, w: 0.34, h: 0.20, y: 0.92, n: 2.6 }, { z: 0.36, w: 0.34, h: 0.22, y: 0.96, n: 2.6 }, { z: 0.52, w: 0.24, h: 0.16, y: 0.97, n: 2.4 }, { z: 0.60, w: 0.10, h: 0.06, y: 0.97, n: 2 },
  ], { seg: 32, steps: 6 }), pMain); body.add(tank);
  const tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.005, 0.46), pAcc); tankStripe.position.set(0, 1.075, 0.32); tankStripe.rotation.x = 0.06; body.add(tankStripe);
  // المقعد
  const seat = new THREE.Mesh(loft([{ z: -0.42, w: 0.18, h: 0.06, y: 0.84, n: 3 }, { z: -0.20, w: 0.27, h: 0.07, y: 0.82, n: 3.4 }, { z: 0.04, w: 0.25, h: 0.06, y: 0.82, n: 3.4 }], { seg: 24, steps: 4 }), new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.75 }));
  body.add(seat);
  // الذيل المرتفع
  const tail = new THREE.Mesh(loft([{ z: -0.40, w: 0.24, h: 0.10, y: 0.90, n: 2.6 }, { z: -0.66, w: 0.16, h: 0.10, y: 0.98, n: 2.4 }, { z: -0.80, w: 0.06, h: 0.05, y: 1.02, n: 2 }], { seg: 24, steps: 4 }), pMain); body.add(tail);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 0.25 })); tl.position.set(0, 0.99, -0.80); body.add(tl);
  // علم سلطنة عُمان على سارية مثبتة في ذيل الدراجة
  const flag = vehicleFlag({ poleH: 0.72, L: 0.5, lean: 0.12 }); flag.group.position.set(-0.07, 1.0, -0.70); body.add(flag.group);
  // لوحة اسم المتسابق تحت المصباح الخلفي (حامل مائل مثل لوحة الأرقام)
  const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.03), MAT.dark()); hanger.position.set(0, 0.90, -0.80); hanger.rotation.x = -0.25; body.add(hanger);
  const plateBack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.012), MAT.dark()); plateBack.position.set(0, 0.83, -0.835); plateBack.rotation.x = 0.18; body.add(plateBack);
  const plate = namePlate(0.32, 0.105); plate.mesh.position.set(0, 0.83, -0.843); plate.mesh.rotation.set(0.18, Math.PI, 0); body.add(plate.mesh);
  // المحرك والعادم
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.26, 0.34), dark); engine.position.set(0, 0.42, 0.18); body.add(engine);
  const exh = rod([-0.13, 0.30, 0.12], [-0.16, 0.48, -0.55], 0.045, MAT.chrome()); body.add(exh);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.32, 18), MAT.alloy()); can.position.set(-0.17, 0.52, -0.62); can.rotation.x = Math.PI / 2 - 0.25; body.add(can);
  // مسندا القدمين
  for (const sg of [-1, 1]) {
    const peg = rod([sg * 0.10, 0.40, -0.12], [sg * 0.20, 0.40, -0.12], 0.014, MAT.alloy()); body.add(peg);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.18), MAT.alloy()); plate.position.set(sg * 0.10, 0.46, -0.10); body.add(plate);
  }
  // الأرقام والشعار على الجانبين
  for (const sg of [-1, 1]) {
    const n1 = decal(num, 0.2, 0.2, { bg: '#ffffff', color }); n1.position.set(sg * 0.205, 0.70, -0.62); n1.rotation.y = sg * Math.PI / 2; body.add(n1);
    const lg = decal('MusiTeacher', 0.42, 0.08, { color: '#ffffff', size: 0.7 }); lg.position.set(sg * 0.205, 0.62, 0.42); lg.rotation.y = sg * Math.PI / 2; lg.rotation.z = -sg * 0.0; body.add(lg);
  }

  // ---- المقدمة الدوّارة (محور توجيه مائل) ----
  const RAKE = 0.42;                                             // ميل الشوكة (≈24°)
  const head = new THREE.Vector3(0, 1.0, 0.62);                 // رأس الشوكة (أعلى)
  const steer = new THREE.Group(); steer.position.copy(head); steer.rotation.x = RAKE; body.add(steer);
  const turn = new THREE.Group(); steer.add(turn);              // يدور حول المحور المحلي Y (محور الشوكة)
  // الشوكة: من رأس التوجيه إلى محور العجلة الأمامية (في إطار steer: المحور −Y نحو العجلة)
  const forkLen = (head.y - RW) / Math.cos(RAKE);
  for (const sg of [-1, 1]) {
    turn.add(rod([sg * 0.09, 0, 0], [sg * 0.09, -forkLen * 0.55, 0], 0.028, MAT.chrome()));
    turn.add(rod([sg * 0.09, -forkLen * 0.5, 0], [sg * 0.09, -forkLen, 0], 0.036, paint('#d4a72c', { metal: 0.8 })));
  }
  const front = wheel(RW, 0.13, { spokes: 5, disc: true, rimMat: paint(accent, { metal: 0.5 }) });
  const frontP = new THREE.Group(); frontP.position.set(0, -forkLen, 0); frontP.rotation.x = -RAKE; frontP.add(front); turn.add(frontP);
  const fender = new THREE.Mesh(new THREE.TorusGeometry(RW + 0.04, 0.05, 6, 24, 1.4), pMain); fender.rotation.y = Math.PI / 2; fender.rotation.x = 0; fender.position.set(0, -forkLen, 0); fender.rotation.z = Math.PI / 2 + 0.2; fender.scale.set(1, 1, 0.9); turn.add(fender);
  // المقود المنخفض (Clip-ons) والمقبضان
  const BAR = { y: -0.02, half: 0.31, rise: 0.0 };
  const triple = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.10), MAT.alloy()); turn.add(triple);
  const grips = [];
  for (const sg of [-1, 1]) {
    turn.add(rod([sg * 0.09, BAR.y, 0.0], [sg * 0.20, BAR.y - 0.02, -0.04], 0.014, MAT.alloy()));
    const g = rod([sg * 0.20, BAR.y - 0.02, -0.04], [sg * BAR.half, BAR.y - 0.035, -0.07], 0.018, new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.85 }));
    turn.add(g);
    const lever = rod([sg * 0.21, BAR.y - 0.0, -0.01], [sg * 0.30, BAR.y - 0.01, 0.05], 0.006, MAT.alloy()); turn.add(lever);
    grips.push({ s: sg > 0 ? 'L' : 'R', a: new THREE.Vector3(sg * 0.20, BAR.y - 0.02, -0.04), b: new THREE.Vector3(sg * BAR.half, BAR.y - 0.035, -0.07) });
  }
  // واجهة الفيرينغ الأمامية والزجاج والمصباح (ثابتة على الهيكل)
  const nose = new THREE.Mesh(loft([
    { z: 0.62, w: 0.40, h: 0.42, y: 0.92, n: 2.4 }, { z: 0.82, w: 0.36, h: 0.36, y: 0.92, n: 2.4 }, { z: 0.98, w: 0.24, h: 0.24, y: 0.88, n: 2.2 }, { z: 1.06, w: 0.08, h: 0.08, y: 0.86, n: 2 },
  ], { seg: 32, steps: 5 }), pMain); body.add(nose);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), MAT.light()); lamp.scale.set(1.4, 0.7, 0.5); lamp.position.set(0, 0.88, 1.06); body.add(lamp);
  const screen = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12, -0.7, 1.4, 0.15, 0.8), MAT.glass()); screen.position.set(0, 0.86, 0.66); screen.rotation.x = -0.35; screen.scale.set(0.9, 1, 1); body.add(screen);
  const dashS = dashScreen(0.13, 0.065); const dash = dashS.mesh; dash.position.set(0, 1.08, 0.70); dash.rotation.x = -1.0; dash.rotation.y = Math.PI; dash.rotation.order = 'YXZ'; body.add(dash);
  const num2 = decal(num, 0.14, 0.12, { color: '#ffffff' }); num2.position.set(0, 0.96, 1.0); num2.rotation.x = -0.5; body.add(num2);
  lean.add(blobShadow(0.9, 2.3));
  root.traverse((m) => { if (m.isMesh && m.material && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
  const seatAnchor = new THREE.Group(); seatAnchor.name = 'seat'; body.add(seatAnchor);

  const spec = {
    kind: 'moto',
    hip: [0, 0.93, -0.06], seatY: 0.855,
    torsoLean: 0.78, leanDist: [0.45, 0.35, 0.2], neckExtra: -0.2, headPitch: -0.05,
    legs: { ankle: [0.16, 0.47, -0.17], pole: [0.35, 0.15, 1], foot: [0.05, -0.15, 1] },
    elbowPole: [0.8, -0.45, -0.1],
  };
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  function gripFrames() {
    turn.updateWorldMatrix(true, true);
    const m = turn.matrixWorld, out = [];
    for (const g of grips) {
      A.copy(g.a).applyMatrix4(m); B.copy(g.b).applyMatrix4(m);
      const P = A.clone().lerp(B, 0.55).toArray();
      const inward = A.clone().sub(B).normalize();                  // نحو منتصف الدراجة: جهة السبابة والإبهام
      const up = new THREE.Vector3(0, 1, 0).transformDirection(body.matrixWorld), fwd = new THREE.Vector3(0, 0, 1).transformDirection(body.matrixWorld);
      const palm = fwd.clone().multiplyScalar(0.75).addScaledVector(up, -0.66).normalize();
      out.push({ s: g.s, P, axis: inward.toArray(), palm: palm.toArray(), r: 0.018 });
    }
    return out;
  }
  let rollV = 0;
  return {
    kind: 'moto', root, body, seatAnchor, spec, gripFrames,
    brakeLight(on) { tl.material.emissiveIntensity = on ? 2.4 : 0.25; },
    setSteer(a) { turn.rotation.y = a * 0.35; },
    update(dt, speed, lat) {
      rear.rotation.x += speed * dt / RW; front.rotation.x += speed * dt / RW;
      rollV += ((lat * 0.12) - rollV) * Math.min(1, dt * 5);
      lean.rotation.z = rollV;                                    // الميل نحو جهة الانعطاف
      flag.update(dt, speed);
    },
    camera: { back: 4.3, up: 2.0, look: 1.1, fov: 58 },
    pov: { fwd: -0.04, up: 0.11, fov: 88, pitch: -0.42, collapse: true }, flag,
    setPlate: plate.set, setDash: dashS.set,
    collider: { halfW: 0.45, len: 2.2 },
  };
}
