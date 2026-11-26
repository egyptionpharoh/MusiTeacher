// =====================================================================
//  مؤثرات بصرية خفيفة: قصاصات ملوّنة عند الإجابة الصحيحة وخط النهاية، ونجوم «دوخة» كرتونية حول الخوذة بعد الارتطام.
// =====================================================================
import * as THREE from 'three';

export class FX {
  constructor(scene) {
    this.scene = scene;
    const N = this.N = 260;
    const geo = new THREE.PlaneGeometry(0.16, 0.24);
    this.conf = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), N);
    this.conf.frustumCulled = false; this.conf.count = 0; scene.add(this.conf);
    this.p = Array.from({ length: N }, () => ({ pos: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 }));
    const cols = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#ffffff'].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) this.conf.setColorAt(i, cols[i % cols.length]);
    this.tmp = new THREE.Object3D(); this.next = 0;
    // نجوم الدوخة
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#ffd43b'; x.strokeStyle = '#b8860b'; x.lineWidth = 3; x.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 12 : 28; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    x.closePath(); x.fill(); x.stroke();
    const tex = new THREE.CanvasTexture(cv);
    this.starG = new THREE.Group(); this.starG.visible = false;
    for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); s.scale.setScalar(0.32); this.starG.add(s); }
    scene.add(this.starG);
  }
  confetti(x, z, mult = 1) {
    const n = Math.min(this.N, Math.round(70 * mult));
    for (let k = 0; k < n; k++) {
      const p = this.p[this.next]; this.next = (this.next + 1) % this.N;
      p.pos.set(x + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, z + (Math.random() - 0.5) * 2);
      p.v.set((Math.random() - 0.5) * 9, 5 + Math.random() * 7, (Math.random() - 0.7) * 8);
      p.w.set(Math.random() * 9, Math.random() * 9, Math.random() * 9); p.life = 2.6 + Math.random();
    }
    this.conf.count = this.N;
  }
  stars(on, target) { this.starG.visible = on; this.starTarget = target || this.starTarget; }
  update(dt, headPos) {
    let alive = 0;
    for (let i = 0; i < this.N; i++) {
      const p = this.p[i], t = this.tmp;
      if (p.life > 0) {
        p.life -= dt; p.v.y -= 9 * dt; p.v.multiplyScalar(1 - dt * 0.9); p.pos.addScaledVector(p.v, dt);
        p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; p.r.z += p.w.z * dt;
        t.position.copy(p.pos); t.rotation.copy(p.r); t.scale.setScalar(p.life > 0 && p.pos.y > 0 ? 1 : 0); alive++;
      } else t.scale.setScalar(0);
      t.updateMatrix(); this.conf.setMatrixAt(i, t.matrix);
    }
    this.conf.instanceMatrix.needsUpdate = true; if (this.conf.instanceColor) this.conf.instanceColor.needsUpdate = true;
    if (this.starG.visible && headPos) {
      const tt = performance.now() / 1000;
      this.starG.children.forEach((s, k) => { const a = tt * 3 + k * Math.PI * 2 / 5; s.position.set(headPos.x + Math.cos(a) * 0.38, headPos.y + 0.32 + Math.sin(tt * 5 + k) * 0.05, headPos.z + Math.sin(a) * 0.38); });
    }
  }
}
