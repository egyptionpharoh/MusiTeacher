// =====================================================================
//  علم سلطنة عُمان: الصورة الرسمية التي زوّدنا بها المعلم (assets/img/oman-flag.png — نسبتها 1920×1098)
//  وقماش يرفرف في مظلّل الرؤوس: موجة تسير من السارية إلى الطرف، سعتها تزيد نحو الطرف، مع تموّج ثانوي
//  وتدلٍّ خفيف حين تبطؤ الريح، وتُحسب العموديات (normals) من الموجة نفسها فتظهر طيّات الضوء والظل.
// =====================================================================
import * as THREE from 'three';

export const FLAG_SRC = './assets/img/oman-flag.png';
export const FLAG_ASPECT = 1920 / 1098;
let TEX = null;
export function flagTexture() {
  if (!TEX) {
    TEX = new THREE.TextureLoader().load(FLAG_SRC);
    TEX.colorSpace = THREE.SRGBColorSpace; TEX.anisotropy = 4;
  }
  return TEX;
}

/** هندسة العلم: من x = 0 (جهة السارية) إلى x = L، ومن y = y0 إلى y0 + L / النسبة */
export function flagGeometry(L, y0, segX = 20, segY = 6) {
  const H = L / FLAG_ASPECT;
  const g = new THREE.PlaneGeometry(L, H, segX, segY); g.translate(L / 2, y0 + H / 2, 0);
  return g;
}

/**
 * مادة قماش ترفرف. U: { uT (الزمن), uWind (0..1 قوة الريح) } — مشتركة بين الأعلام لتوفير الأداء.
 * opts: { L, y0, bendWrap (دالة onBeforeCompile سابقة تُستدعى بعد إدخال الموجة), key, instanced }
 */
export function clothMaterial(U, { L, y0, bendWrap = null, key = 'cloth', instanced = false } = {}) {
  const H = L / FLAG_ASPECT;
  const m = new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
  const wave = `
    float fl_u = clamp(position.x / ${L.toFixed(4)}, 0.0, 1.0);
    float fl_v = clamp((position.y - ${y0.toFixed(4)}) / ${H.toFixed(4)}, 0.0, 1.0);
    float fl_ph = ${instanced ? 'float(gl_InstanceID) * 1.93' : '0.0'};
    float fl_w = mix(3.2, 9.0, uWind);                         // سرعة الموجة
    float fl_a = ${L.toFixed(4)} * mix(0.07, 0.11, uWind);      // السعة
    float fl_arg = fl_u * 6.2831 * 1.15 - uT * fl_w + fl_ph + fl_v * 0.9;
    float fl_env = pow(fl_u, 1.15);
    float fl_z = fl_a * fl_env * (sin(fl_arg) + 0.32 * sin(fl_arg * 2.1 + 1.3 + fl_v * 2.0));
    float fl_dz = fl_a * (1.15 * pow(max(fl_u, 1e-3), 0.15) * (sin(fl_arg) + 0.32 * sin(fl_arg * 2.1 + 1.3 + fl_v * 2.0))
                + fl_env * 6.2831 * 1.15 * (cos(fl_arg) + 0.672 * cos(fl_arg * 2.1 + 1.3 + fl_v * 2.0))) / ${L.toFixed(4)};
    float fl_droop = ${H.toFixed(4)} * 0.32 * (1.0 - uWind) * fl_u * fl_u;
  `;
  m.onBeforeCompile = (sh, r) => {
    sh.uniforms.uT = U.uT; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = 'uniform float uT;\nuniform float uWind;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        ${wave}
        objectNormal = normalize(vec3(-fl_dz, 0.0, 1.0));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.z += fl_z;
        transformed.y -= fl_droop;
        transformed.x -= abs(fl_z) * 0.25 * fl_u;`);
    if (bendWrap) bendWrap(sh, r);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/** علم صغير على سارية خلف المركبة. يعيد { group, update(dt, speed) } */
export function vehicleFlag({ poleH = 0.95, L = 0.62, lean = 0.12 } = {}) {
  const U = { uT: { value: Math.random() * 10 }, uWind: { value: 0 } };
  const group = new THREE.Group(); group.name = 'vehicleFlag';
  const pm = new THREE.MeshStandardMaterial({ color: 0xd7dce2, roughness: 0.3, metalness: 0.85 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, poleH, 8), pm); pole.position.y = poleH / 2; group.add(pole);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), pm); tip.position.y = poleH + 0.01; group.add(tip);
  const H = L / FLAG_ASPECT;
  const cloth = new THREE.Mesh(flagGeometry(L, poleH - H - 0.02, 18, 5), clothMaterial(U, { L, y0: poleH - H - 0.02, key: 'vflag' }));
  cloth.castShadow = false;
  // القماش يتجه للخلف مع ميل نحو الخارج ليُرى وجهه من الكاميرا الخلفية
  const pivot = new THREE.Group(); pivot.add(cloth); group.add(pivot);
  pivot.rotation.y = Math.PI / 2 + 0.62;           // محور x للعلم يتجه إلى الخلف (‎-Z) والخارج
  group.rotation.z = lean;
  let wind = 0;
  function update(dt, speed) {
    const target = Math.min(1, 0.18 + speed / 22);  // نسيم خفيف حتى عند التوقف
    wind += (target - wind) * Math.min(1, dt * 1.5);
    U.uWind.value = wind; U.uT.value += dt * (0.7 + wind * 0.6);
  }
  return { group, update, U };
}
