// منصة العرض: كرسي خشبي إجرائي (يحمل العازفة عند ارتفاع الجلوس المقيس) وسجادة بسيطة. لا ملفات خارجية.
import * as THREE from 'three';
import { SEAT } from '../../_shared/3d/character/seated-player.js';

export function buildStage() {
  const g = new THREE.Group(); g.name = 'stage';
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4429, roughness: 0.55, metalness: 0.0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4d2f1c, roughness: 0.6 });
  const pad = new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.9 });
  const box = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const top = SEAT.y, zc = (SEAT.zFront + SEAT.zBack) / 2 - 0.02, depth = SEAT.zFront - SEAT.zBack + 0.1, w = SEAT.halfW * 2 + 0.1;
  box(wood, w, 0.035, depth, 0, top - 0.0175 - 0.012, zc);                 // لوح المقعد (تحت الوسادة)
  box(pad, w - 0.04, 0.024, depth - 0.05, 0, top - 0.012, zc);             // وسادة رقيقة (سطحها = ارتفاع الجلوس)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(dark, 0.04, top - 0.05, 0.04, sx * (w / 2 - 0.03), (top - 0.05) / 2, zc + sz * (depth / 2 - 0.03));
  for (const sx of [-1, 1]) box(dark, 0.04, 0.5, 0.035, sx * (w / 2 - 0.03), top + 0.2, zc - depth / 2 + 0.03);   // قائمان خلفيان
  box(wood, w - 0.02, 0.07, 0.03, 0, top + 0.34, zc - depth / 2 + 0.03); box(wood, w - 0.02, 0.07, 0.03, 0, top + 0.15, zc - depth / 2 + 0.03);   // عارضتان
  box(dark, w - 0.06, 0.025, 0.03, 0, 0.16, zc); // رباط الأرجل
  // سجادة بنقش بسيط
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const grd = x.createRadialGradient(256, 256, 10, 256, 256, 256); grd.addColorStop(0, '#7b2f2a'); grd.addColorStop(0.55, '#5e2420'); grd.addColorStop(1, '#3d1a17'); x.fillStyle = grd; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#d7b06a'; for (const [r, lw] of [[238, 6], [214, 2], [150, 3], [96, 2]]) { x.lineWidth = lw; x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = '#d7b06a'; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.beginPath(); x.arc(256 + Math.cos(a) * 182, 256 + Math.sin(a) * 182, 7, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.004; rug.receiveShadow = true; g.add(rug);
  return g;
}
