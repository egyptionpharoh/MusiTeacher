// =====================================================================
//  مفترق الإجابة: جسر لافتات فوق الطريق (لافتة لكل مسار)، حواجز فاصلة بين المسارات قبل البوابة (منطقة الالتزام)،
//  وبوابات ملوّنة بستارة «؟». عند العبور تنكشف النتيجة: البوابة الصحيحة تتحول أخضر وتنطلق الزينة،
//  والبوابات الخاطئة تظهر فيها حواجز إسفنجية ملوّنة (ارتطام كرتوني غير مخيف).
// =====================================================================
import * as THREE from 'three';
import { ROAD_W } from './world.js';
import { signTexture, LANE_COLORS, LANE_LETTERS } from './signs.js';
import { bendTree } from './bend.js';

export const COMMIT = 26;           // طول منطقة الحواجز الفاصلة قبل البوابة (م)

/** مراكز المسارات (عالميًا) لعدد n من الخيارات، مرتبة من اليمين إلى اليسار على الشاشة (أ = أقصى اليمين) */
export function laneXs(n) {
  const w = ROAD_W / n, out = [];
  for (let i = 0; i < n; i++) out.push(ROAD_W / 2 - w / 2 - i * w);       // i = 0 → +X = يمين الشاشة
  return out;
}

const concreteMat = () => new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.85 });

export class Junction {
  constructor(scene, challenge, z, opts = {}) {
    this.scene = scene; this.ch = challenge; this.z = z; this.n = challenge.options.length;
    this.xs = laneXs(this.n); this.group = new THREE.Group(); this.group.position.z = z;
    this.revealed = false; this.parts = []; this.fx = [];
    this.ready = this._build(opts);
  }
  async _build(opts) {
    const g = this.group, n = this.n, w = ROAD_W / n;
    // ---- جسر اللافتات ----
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.45, metalness: 0.7 });
    const H = 6.6, ZG = 8;                                        // الجسر قبل البوابة بقليل (يُقرأ من بعيد)
    for (const sg of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, H + 1.2, 0.5), steel); p.position.set(sg * (ROAD_W / 2 + 1.1), (H + 1.2) / 2, ZG); g.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 2.8, 0.45, 0.45), steel); beam.position.set(0, H + 0.9, ZG); g.add(beam);
    const beam2 = beam.clone(); beam2.position.y = H - 1.75; g.add(beam2);
    const sW = Math.min(3.5, w * 0.94), sH = sW * 0.625;
    for (let i = 0; i < n; i++) {
      const tex = await signTexture(this.ch.options[i].sign, LANE_COLORS[i], LANE_LETTERS[i]);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(sW, sH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      panel.position.set(this.xs[i], H - 0.5 + 0.12, ZG + 0.26); g.add(panel);
      const back = new THREE.Mesh(new THREE.BoxGeometry(sW + 0.1, sH + 0.1, 0.08), steel); back.position.set(this.xs[i], H - 0.5 + 0.12, ZG + 0.2); g.add(back);
      // ضوء صغير فوق كل لافتة
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.2), new THREE.MeshBasicMaterial({ color: LANE_COLORS[i] })); lamp.position.set(this.xs[i], H - 0.5 + sH / 2 + 0.25, ZG + 0.3); g.add(lamp);
    }
    // ---- علامات المسارات على الأسفلت + حواجز فاصلة ----
    for (let i = 0; i < n; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, COMMIT + 10), new THREE.MeshBasicMaterial({ color: LANE_COLORS[i], transparent: true, opacity: 0.22, depthWrite: false }));
      strip.rotation.x = -Math.PI / 2; strip.position.set(this.xs[i], 0.02, (COMMIT + 10) / 2); g.add(strip);
      const lt = document.createElement('canvas'); lt.width = 256; lt.height = 256; const x = lt.getContext('2d');
      x.fillStyle = '#ffffff'; x.font = '900 200px Cairo, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(LANE_LETTERS[i], 128, 140);
      const letter = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lt), transparent: true, depthWrite: false, opacity: 0.9 }));
      letter.rotation.x = -Math.PI / 2; letter.position.set(this.xs[i], 0.03, COMMIT + 4); g.add(letter);
    }
    // خطوط المسارات المتقطعة على طول الاقتراب (بعدد الخيارات)
    const APPROACH = Math.max(140, opts.approach || 0);
    const dashG = new THREE.PlaneGeometry(0.18, 3), dashM = new THREE.MeshBasicMaterial({ color: 0xf4f4ee });
    const nd = Math.floor((APPROACH - COMMIT) / 9) * (n - 1);
    if (nd > 0) {
      const dashes = new THREE.InstancedMesh(dashG, dashM, nd); const t = new THREE.Object3D(); let q = 0;
      for (let i = 1; i < n; i++) { const bx = (this.xs[i - 1] + this.xs[i]) / 2; for (let z = COMMIT + 4; z < APPROACH && q < nd; z += 9) { t.position.set(bx, 0.025, z); t.rotation.set(-Math.PI / 2, 0, 0); t.updateMatrix(); dashes.setMatrixAt(q++, t.matrix); } }
      dashes.count = q; g.add(dashes);
    }
    for (let i = 1; i < n; i++) {
      const bx = (this.xs[i - 1] + this.xs[i]) / 2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, COMMIT), concreteMat());
      wall.position.set(bx, 0.45, COMMIT / 2); g.add(wall);
      const stripeTex = document.createElement('canvas'); stripeTex.width = 64; stripeTex.height = 512; const sx = stripeTex.getContext('2d');
      for (let k = 0; k < 16; k++) { sx.fillStyle = k % 2 ? '#ffffff' : '#ff6b35'; sx.fillRect(0, k * 32, 64, 32); }
      const st = new THREE.CanvasTexture(stripeTex); st.wrapT = THREE.RepeatWrapping; st.repeat.set(1, 3);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.18, COMMIT), new THREE.MeshStandardMaterial({ map: st })); top.position.set(bx, 0.95, COMMIT / 2); g.add(top);
      this.parts.push({ type: 'wall', x: bx });
    }
    // ---- البوابات ----
    this.portals = [];
    for (let i = 0; i < n; i++) {
      const pg = new THREE.Group(); pg.position.set(this.xs[i], 0, 0); g.add(pg);
      const col = new THREE.Color(LANE_COLORS[i]);
      const frameMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.4 });
      const pw = Math.min(w * 0.92, 4.2), ph = 4.2;
      for (const sg of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.35, ph, 0.6), frameMat); pl.position.set(sg * pw / 2, ph / 2, 0); pg.add(pl); }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(pw / 2, 0.22, 10, 32, Math.PI), frameMat); arch.position.y = ph; pg.add(arch);
      // نوتة موسيقية ذهبية فوق القوس
      const noteCv = document.createElement('canvas'); noteCv.width = 128; noteCv.height = 128; const nx = noteCv.getContext('2d'); nx.fillStyle = '#ffd166'; nx.font = '110px serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText('♪', 64, 70);
      const note = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(noteCv), transparent: true, depthWrite: false, side: THREE.DoubleSide })); note.position.y = ph + pw / 2 + 0.7; pg.add(note);
      // الستارة «؟»
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const cx = cv.getContext('2d');
      const grd = cx.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, LANE_COLORS[i] + 'cc'); grd.addColorStop(1, LANE_COLORS[i] + '55');
      cx.fillStyle = grd; cx.fillRect(0, 0, 256, 256); cx.fillStyle = 'rgba(255,255,255,0.9)'; cx.font = '900 150px Cairo, Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('؟', 128, 140);
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.3, ph + pw / 2 - 0.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      curtain.position.y = (ph + pw / 2) / 2; pg.add(curtain);
      // الحواجز الإسفنجية (تظهر عند كشف الخطأ)
      const blocks = new THREE.Group(); blocks.visible = false; blocks.position.z = -3.5; pg.add(blocks);
      const colors = ['#ff8fab', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b'];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.75), new THREE.MeshStandardMaterial({ color: colors[(r + c) % colors.length], roughness: 0.9 }));
        b.position.set((c - 1.5) * 1.0 + (r % 2) * 0.3, 0.38 + r * 0.76, 0); b.userData.home = b.position.clone(); blocks.add(b);
      }
      this.portals.push({ pg, curtain, blocks, frameMat, note, i });
    }
    bendTree(g);
    g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });
    this.scene.add(g);
    return this;
  }

  /** يكشف النتيجة: chosen = رقم المسار الذي دخله السائق */
  reveal(chosen, correct) {
    if (this.revealed) return; this.revealed = true;
    for (const p of this.portals) {
      if (p.i === correct) { p.frameMat.color.set('#2fd16b'); p.frameMat.emissive.set('#2fd16b'); p.frameMat.emissiveIntensity = 1.1; p.curtain.material.opacity = 0; }
      else { p.blocks.visible = true; p.curtain.material.opacity = 0.15; p.frameMat.emissiveIntensity = 0.1; p.frameMat.color.multiplyScalar(0.55); }
    }
    this.chosen = chosen; this.correct = correct;
  }
  /** ارتطام بالحواجز: تتطاير الكتل */
  scatter(i, speed) {
    const p = this.portals[i]; if (!p) return;
    p.blocks.children.forEach((b) => { b.userData.v = new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 5, -(4 + speed * 0.35) * (0.5 + Math.random())); b.userData.w = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6); });
    this.flying = p.blocks.children;
  }
  update(dt) {
    if (this.flying) for (const b of this.flying) {
      const v = b.userData.v; if (!v) continue;
      v.y -= 14 * dt; b.position.addScaledVector(v, dt);
      if (b.position.y < 0.38) { b.position.y = 0.38; v.y *= -0.3; v.x *= 0.8; v.z *= 0.8; }
      b.rotation.x += b.userData.w.x * dt; b.rotation.y += b.userData.w.y * dt;
    }
    for (const p of this.portals || []) { p.note.position.y = 4.2 + 2.1 + 0.7 + Math.sin(performance.now() / 300 + p.i) * 0.15; }
  }
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
  }
}

/** خط النهاية: قوس بشطرنج أبيض وأسود ولافتة «خط النهاية» */
export function finishLine(scene, z) {
  const g = new THREE.Group(); g.position.z = z;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const x = cv.getContext('2d');
  for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); }
  const checker = new THREE.CanvasTexture(cv);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 2), new THREE.MeshBasicMaterial({ map: checker })); road.rotation.x = -Math.PI / 2; road.position.y = 0.03; g.add(road);
  const steel = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 });
  for (const sg of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 16), steel); p.position.set(sg * (ROAD_W / 2 + 1), 4, 0); g.add(p); }
  const ban = document.createElement('canvas'); ban.width = 1024; ban.height = 160; const b = ban.getContext('2d');
  for (let i = 0; i < 64; i++) for (let j = 0; j < 2; j++) { b.fillStyle = (i + j) % 2 ? '#111' : '#fff'; b.fillRect(i * 16, j * 16, 16, 16); b.fillRect(i * 16, 128 + j * 16, 16, 16); }
  b.fillStyle = '#e63946'; b.fillRect(0, 32, 1024, 96); b.fillStyle = '#fff'; b.font = '900 70px Cairo, Arial'; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillText('🏁 خط النهاية — رالي النغم', 512, 84);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 2, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ban), side: THREE.DoubleSide, toneMapped: false })); banner.position.set(0, 7.2, 0); g.add(banner);
  bendTree(g); scene.add(g);
  return g;
}
