// منصة العرض: سجادة بنقش بسيط (المقعد جزء من نموذج الأورج). لا ملفات خارجية.
import * as THREE from 'three';

export function buildStage() {
  const g = new THREE.Group(); g.name = 'stage';
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const grd = x.createRadialGradient(256, 256, 10, 256, 256, 256); grd.addColorStop(0, '#2f4a5e'); grd.addColorStop(0.55, '#243a4b'); grd.addColorStop(1, '#172633'); x.fillStyle = grd; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#d7b06a'; for (const [r, lw] of [[238, 6], [214, 2], [150, 3], [96, 2]]) { x.lineWidth = lw; x.beginPath(); x.arc(256, 256, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = '#d7b06a'; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.beginPath(); x.arc(256 + Math.cos(a) * 182, 256 + Math.sin(a) * 182, 7, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.35, 64), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, 0.2); rug.receiveShadow = true; g.add(rug);
  return g;
}
