// =====================================================================
//  عالم السباق: سماء متدرجة وشمس، طريق بأربع حارات وأرصفة، ومشاهد جانبية متكررة (مدينة عصرية، ساحل بنخيل،
//  طريق صحراوي بين جبال عُمانية). كل العناصر الجانبية «مُعادة التدوير» حول السائق (InstancedMesh) فلا يزيد
//  عدد الكائنات مهما طال السباق. الاتجاه الأمامي = −Z.
// =====================================================================
import * as THREE from 'three';
import { BEND, bendTree, bendMaterial } from './bend.js';
import { omaniFacade, roadSign, OMAN_PLACES } from './oman.js';
import { FLAG_ASPECT, flagGeometry, clothMaterial } from './flag.js';
import { grandMosque, souqGate, ministryBuilding, portraitStand, fortHill, radioKiosk, muscatHouseTex, ornateLampGeo, ridgeGeometry, compact } from './oman3d.js';

export const LANE_W = 3.4, ROAD_LANES = 4, ROAD_W = LANE_W * ROAD_LANES;
const SPAN = 420;                     // طول المنطقة المعاد تدويرها أمام السائق

function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const H = (z, k) => { const v = Math.sin(z * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export const THEMES = {
  oman: { name: 'مسقط – المعالم', omani: true, sky: ['#2f7fd0', '#a8d4f5', '#f4e6c8'], fog: '#cfe3f2', ground: '#cdb48a', sun: '#fff3da', sunI: 2.7, hemi: ['#e6f2ff', '#7a6448', 1.22], side: 'pavers' },
  muttrah: { name: 'كورنيش مطرح', omani: true, sky: ['#2a7fd6', '#9fd1f6', '#eadfca'], fog: '#cde2f2', ground: '#c9ae86', sun: '#fff3da', sunI: 2.7, hemi: ['#e6f2ff', '#7a6448', 1.22], side: 'pavers' },
  city: { name: 'مدينة الإيقاع', sky: ['#4f8fd6', '#bfe0ff', '#f6e8cf'], fog: '#c9def0', ground: '#7a8a69', sun: '#fff4dc', sunI: 2.6, hemi: ['#dceeff', '#5d5546', 1.25], side: 'sidewalk' },
  coast: { name: 'كورنيش اللحن', sky: ['#3a4c8c', '#f39a6b', '#ffd59a'], fog: '#f2b48c', ground: '#d8c39a', sun: '#ffd2a1', sunI: 2.2, hemi: ['#ffd7b8', '#3d4a66', 1.1], side: 'beach' },
  desert: { name: 'طريق المقام', sky: ['#3f86c9', '#a9d3f0', '#f3dcae'], fog: '#e8d2a8', ground: '#d9b77e', sun: '#fff1d0', sunI: 2.8, hemi: ['#fff3dc', '#8a6a44', 1.2], side: 'sand' },
};

export class World {
  constructor(scene, renderer, theme = 'city') {
    this.scene = scene; this.renderer = renderer; this.root = new THREE.Group(); scene.add(this.root);
    this.items = []; this.dist = 0; this.flagOn = true; this.flags = []; this.movers = []; this.flagTime = { value: 0 }; this.flagWind = { value: 0.72 };
    this._lights();
    this.setTheme(theme);
  }

  _lights() {
    const sc = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    sc.add(this.sun, this.sun.target);
  }

  setTheme(name) {
    const T = THEMES[name] || THEMES.city; this.theme = name; this.T = T;
    this.root.clear(); this.items = []; this.movers = []; this.flags = []; this.track = null; this.zones = []; this.radioSpots = [];
    const sc = this.scene;
    sc.fog = new THREE.Fog(new THREE.Color(T.fog), 60, SPAN * 0.92);
    sc.background = new THREE.Color(T.fog);
    this.hemi.color.set(T.hemi[0]); this.hemi.groundColor.set(T.hemi[1]); this.hemi.intensity = T.hemi[2];
    this.sun.color.set(T.sun); this.sun.intensity = T.sunI;
    this._sky(T); this._ground(T); this._road(T); this._scenery(name, T); this._flags();
    // محل مذياع متنقّل على الرصيف (أمام صف المباني) يوضع بين سؤالين لاستراحة موسيقية قصيرة
    this.breakKiosk = compact(radioKiosk()); this.breakKiosk.visible = false; this.root.add(this.breakKiosk);
    this.breakSpot = { obj: this.breakKiosk, side: -1, x: 0, dyn: true }; this.radioSpots.push(this.breakSpot);
    bendTree(this.root);
    this.setFlag(this.flagOn);
  }

  // ---------------------------------------------------------------- السماء
  _sky(T) {
    const g = new THREE.SphereGeometry(900, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { c0: { value: new THREE.Color(T.sky[0]) }, c1: { value: new THREE.Color(T.sky[1]) }, c2: { value: new THREE.Color(T.sky[2]) }, sunDir: { value: new THREE.Vector3(-0.3, 0.25, -1).normalize() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 c0,c1,c2,sunDir; varying vec3 vP;
        void main(){ float h = vP.y; vec3 col = h>0.0 ? mix(c1,c0,pow(clamp(h*1.6,0.0,1.0),0.7)) : c2;
          col = mix(c2, col, smoothstep(-0.02, 0.16, h));
          float s = max(dot(normalize(vP), sunDir), 0.0); col += vec3(1.0,0.9,0.7)*pow(s,400.0)*1.6 + vec3(1.0,0.8,0.6)*pow(s,12.0)*0.25;
          gl_FragColor = vec4(col,1.0); }`,
    });
    this.sky = new THREE.Mesh(g, m); this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.sky.userData.noBend = true;
    this.scene.add(this.sky);
    if (this._oldSky) this.scene.remove(this._oldSky); this._oldSky = this.sky;
    // جبال/مبانٍ بعيدة على الأفق (طبقة ثابتة تتبع الكاميرا)
    const far = tex(2048, 256, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      const r = rnd(7);
      x.fillStyle = THEMES[this.theme] && THEMES[this.theme].omani ? 'rgba(128,104,88,0.82)' : this.theme === 'city' ? 'rgba(98,126,160,0.85)' : this.theme === 'coast' ? 'rgba(110,80,110,0.65)' : 'rgba(150,110,80,0.75)';
      x.beginPath(); x.moveTo(0, h);
      if (this.theme === 'city') { for (let px = 0; px < w;) { const bw = 20 + r() * 60, bh = 40 + r() * 170; x.lineTo(px, h - bh); x.lineTo(px + bw, h - bh); px += bw; } }
      else { const j = this.theme === 'oman' ? 34 : 18; let y = h * (this.theme === 'oman' ? 0.45 : 0.6); for (let px = 0; px <= w; px += 8) { y += (r() - 0.5) * j; y = Math.max(h * 0.2, Math.min(h * 0.85, y)); x.lineTo(px, y); } }
      x.lineTo(w, h); x.closePath(); x.fill();
    });
    far.wrapS = THREE.RepeatWrapping;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(700, 700, 120, 64, 1, true), new THREE.MeshBasicMaterial({ map: far, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    ring.position.y = 40; ring.renderOrder = -9; this.horizon = ring; this.sky.add(ring);
    ring.material.map.repeat.set(3, 1);
    if (T.omani) { ring.visible = false; this._mountains(T); }
  }
  // ---------------------------------------------------------------- جبال الحجر العُمانية: طبقتان متدرجتان تتبعان الكاميرا (بلا تكلفة تُذكر)
  _mountains(T) {
    const fog = new THREE.Color(T.fog);
    const layer = (R, depth, hMin, hMax, seed, rock, peak, haze) => {
      const N = 360, ROWS = 6, P = [], C = [], I = [];
      const ph = [1.3, 2.1, 0.4, 3.3, 5.1, 0.9].map((v) => v + seed);
      const F = [3, 7, 13, 29, 61, 113], A = [1, 0.55, 0.32, 0.17, 0.08, 0.04];
      const hAt = (t) => { let v = 0, sum = 0; for (let o = 0; o < F.length; o++) { const rr = 1 - Math.abs(Math.sin(F[o] * t * 0.5 + ph[o])); v += A[o] * rr * rr; sum += A[o]; } return hMin + (hMax - hMin) * Math.pow(v / sum, 1.25); };
      const hs = []; for (let i = 0; i <= N; i++) hs.push(hAt((i / N) * Math.PI * 2));
      const cR = new THREE.Color(rock), cP = new THREE.Color(peak), c = new THREE.Color();
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2, h = hs[i];
        const slope = (hs[Math.min(N, i + 1)] - hs[Math.max(0, i - 1)]) / 2;      // وجه مضاء / وجه في الظل
        const shade = THREE.MathUtils.clamp(0.82 + slope * 0.09, 0.55, 1.12);
        for (let j = 0; j <= ROWS; j++) {
          const f = j / ROWS, y = -45 + (h + 45) * f, r = R - depth * (1 - f) * (1 - f);
          P.push(Math.sin(t) * r, y, Math.cos(t) * r);
          c.copy(cR).lerp(cP, Math.pow(f, 1.6)).multiplyScalar(shade);
          c.lerp(fog, haze + (1 - haze) * Math.pow(1 - f, 3) * 0.6);              // ضباب جوي أكثف عند القاعدة
          C.push(c.r, c.g, c.b);
        }
        if (i < N) for (let j = 0; j < ROWS; j++) { const a = i * (ROWS + 1) + j, b = a + ROWS + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
      m.frustumCulled = false; m.renderOrder = -8; m.userData.noBend = true;
      return m;
    };
    this.mountains = new THREE.Group();
    this.mountains.add(layer(640, 60, 60, 160, 4.2, '#7a6555', '#94796a', 0.34));   // السلسلة البعيدة (أفتح وأكثر ضبابًا)
    this.mountains.add(layer(500, 70, 26, 105, 1.7, '#5f4a3d', '#937a68', 0.14));    // التلال الأقرب (صخرية داكنة)
    this.sky.add(this.mountains);
  }

  // ---------------------------------------------------------------- الأرض
  _ground(T) {
    const g = new THREE.PlaneGeometry(1400, SPAN + 200, 60, 140);
    const groundTex = tex(256, 256, (x, w, h) => {
      x.fillStyle = T.ground; x.fillRect(0, 0, w, h);
      const r = rnd(3);
      for (let i = 0; i < 2500; i++) { const c = r() * 30 - 15; x.fillStyle = `rgba(${c > 0 ? 255 : 0},${c > 0 ? 255 : 0},${c > 0 ? 255 : 0},${Math.abs(c) / 260})`; x.fillRect(r() * w, r() * h, 2, 2); }
    }, true);
    groundTex.repeat.set(140, (SPAN + 200) / 10);
    this.ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.02; this.ground.receiveShadow = true;
    this.root.add(this.ground);
    if (this.theme === 'muttrah') {             // كورنيش مطرح: البحر يسار الطريق، وممشى ومصدّ أمواج
      const edge = ROAD_W / 2 + 13.5;
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, SPAN + 300, 40, 120), new THREE.MeshPhysicalMaterial({ color: 0x1d62a8, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(-edge - 600, -0.6, 0); this.root.add(sea); this.sea = sea;
      const prom = new THREE.Mesh(new THREE.BoxGeometry(edge - ROAD_W / 2 - 5.7, 0.16, SPAN + 160, 1, 1, 60), new THREE.MeshStandardMaterial({ map: tex(128, 128, (x, w, h) => { x.fillStyle = '#d7a596'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c58d7e'; x.lineWidth = 2; for (let i = 0; i <= w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }, true), roughness: 0.9 }));
      prom.material.map.repeat.set(2, (SPAN + 160) / 2);
      prom.position.set(-(ROAD_W / 2 + 5.7 + (edge - ROAD_W / 2 - 5.7) / 2), 0.06, 0); this.root.add(prom); (this.walks ||= []).push(prom);
    }
    if (this.theme === 'coast') {               // البحر على اليمين
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, SPAN + 300, 40, 120), new THREE.MeshPhysicalMaterial({ color: 0x2b7bb8, roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(-640, 0.02, 0); this.root.add(sea); this.sea = sea;
    }
  }

  // ---------------------------------------------------------------- الطريق
  _road(T) {
    const L = SPAN + 160;
    const roadTex = tex(512, 512, (x, w, h) => {
      x.fillStyle = '#3b3e44'; x.fillRect(0, 0, w, h);
      const r = rnd(11);
      for (let i = 0; i < 9000; i++) { const v = 40 + r() * 50; x.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; x.fillRect(r() * w, r() * h, 1.6, 1.6); }
      // الحافتان المتصلتان فقط: خطوط المسارات يرسمها كل مفترق بعدد خياراته (2–4)
      x.fillStyle = '#f4f4ee'; x.fillRect(6, 0, 7, h); x.fillRect(w - 13, 0, 7, h);
      // نوتات موسيقية باهتة مرسومة على الأسفلت كل بضعة أمتار
      x.fillStyle = 'rgba(255,255,255,0.07)'; x.font = '120px serif'; x.textAlign = 'center'; x.fillText('♪', w * 0.5, h * 0.62);
    }, true);
    roadTex.repeat.set(1, L / 12);
    this.roadTex = roadTex;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, L, 4, 220), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.82, metalness: 0.05 }));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.0; road.receiveShadow = true; this.road = road; this.root.add(road);
    // أرصفة/حواف بخطوط حمراء وبيضاء (تذكّر بحلبات السباق)
    // حواف بخطوط حمراء وبيضاء (حلبة)، وفي الطرق العُمانية بالأصفر والأسود كما في شوارع مسقط
    const kc = T.omani ? ['#f2c21b', '#1b1b1b'] : ['#e8e8e8', '#d6363c'];
    const kerbTex = tex(64, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? kc[0] : kc[1]; x.fillRect(0, i * h / 8, w, h / 8); } }, true);
    kerbTex.repeat.set(1, L / 8);
    this.kerbTex = kerbTex;
    for (const sg of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, L, 1, 1, 220), new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.6 }));
      k.position.set(sg * (ROAD_W / 2 + 0.35), 0.04, 0); k.receiveShadow = true; this.root.add(k); (this.kerbs ||= []).push(k);
      const sideCol = T.side === 'pavers' ? '#d8c7a6' : T.side === 'sidewalk' ? '#a9adb3' : T.side === 'beach' ? '#e3cf9f' : '#cdb07c';
      const sw = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, L, 1, 1, 220), new THREE.MeshStandardMaterial({ color: sideCol, roughness: 0.95 }));
      sw.position.set(sg * (ROAD_W / 2 + 0.7 + 2.5), 0.05, 0); sw.receiveShadow = true; this.root.add(sw); (this.walks ||= []).push(sw);
    }
  }

  // ---------------------------------------------------------------- العناصر الجانبية المعاد تدويرها
  _pool(geo, mat, count, place, opts = {}) {
    const im = new THREE.InstancedMesh(geo, mat, count); im.castShadow = !!opts.shadow; im.receiveShadow = true; im.frustumCulled = false;
    const p = { im, n: count, z: [], place, tmp: new THREE.Object3D(), every: opts.every || (SPAN / count), data: [], offset: opts.offset || 0 };
    for (let i = 0; i < count; i++) { p.z[i] = -i * p.every - (opts.offset || 0); p.data[i] = {}; this._place(p, i); }
    im.instanceMatrix.needsUpdate = true; this.root.add(im); this.items.push(p);
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    return p;
  }
  _place(p, i) { const t = p.tmp; t.position.set(0, 0, p.z[i]); t.rotation.set(0, 0, 0); t.scale.set(1, 1, 1); p.place(t, i, p); t.updateMatrix(); p.im.setMatrixAt(i, t.matrix); }

  _scenery(name, T) {
    const r = rnd(name.length * 97 + 5);
    const pick = (a) => a[Math.floor(r() * a.length)];
    // أعمدة الإنارة على شكل نوتة موسيقية (عمود + رأس دائري) على الجانبين
    if (T.omani) { this._omani(name, r, pick, T); return; }
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.5, metalness: 0.6 });
    const pole = new THREE.CylinderGeometry(0.09, 0.12, 7.2, 8); pole.translate(0, 3.6, 0);
    const headG = new THREE.SphereGeometry(0.42, 16, 10); headG.scale(1.25, 0.9, 0.9); headG.rotateZ(0.35); headG.translate(-0.35, 7.1, 0);
    const flag = new THREE.BoxGeometry(0.08, 1.6, 0.08); flag.translate(0.0, 6.4, 0);
    const merged = mergeGeos([pole, headG, flag]);
    for (const sg of [-1, 1]) this._pool(merged, lampMat, 14, (t, i) => { t.position.x = sg * (ROAD_W / 2 + 1.6); t.scale.x = sg; }, { every: 30, offset: sg > 0 ? 0 : 15, shadow: false });
    const glow = new THREE.SphereGeometry(0.28, 10, 8); glow.translate(-0.35, 7.05, 0);
    for (const sg of [-1, 1]) this._pool(glow, new THREE.MeshBasicMaterial({ color: 0xfff1c4 }), 14, (t) => { t.position.x = sg * (ROAD_W / 2 + 1.6); t.position.x += 0; t.scale.x = sg; }, { every: 30, offset: sg > 0 ? 0 : 15 });

    if (name === 'city') {
      const winTex = tex(256, 512, (x, w, h) => {
        x.fillStyle = '#d9dde3'; x.fillRect(0, 0, w, h);
        for (let y = 12; y < h - 8; y += 26) for (let xx = 10; xx < w - 10; xx += 30) { x.fillStyle = Math.random() < 0.25 ? '#ffe9a8' : '#4a6a8c'; x.fillRect(xx, y, 20, 16); }
      }, true);
      const bMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.6, metalness: 0.15 });
      const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
      const cols = ['#e8e2d8', '#cfd8e3', '#f1d9c7', '#d5e5d3', '#e6d3e8', '#f3e6b8'].map((c) => new THREE.Color(c));
      for (const sg of [-1, 1]) {
        const p = this._pool(bGeo, bMat, 26, (t, i, P) => {
          const w = 8 + r() * 10, d = 8 + r() * 8, h = 10 + r() * 38;
          t.position.x = sg * (ROAD_W / 2 + 7 + w / 2 + r() * 4); t.scale.set(w, h, d);
          P.im.setColorAt(i, pick(cols));
        }, { every: 17, offset: sg > 0 ? 3 : 11 });
        p.im.instanceColor.needsUpdate = true;
      }
      // أشجار صغيرة على الرصيف
      this._trees(r, 30, '#3f8f4e', 0.9);
    } else if (name === 'coast') {
      this._palms(r, 40, 1);
      // أكشاك ومظلات على الجانب الأيسر
      const umb = new THREE.ConeGeometry(1.6, 0.8, 10); umb.translate(0, 2.6, 0);
      const st = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6); st.translate(0, 1.3, 0);
      const p = this._pool(mergeGeos([umb, st]), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), 20, (t, i, P) => { t.position.x = (ROAD_W / 2 + 6 + r() * 6); P.im.setColorAt(i, new THREE.Color(pick(['#ef476f', '#ffd166', '#06d6a0', '#118ab2']))); }, { every: 21 });
      p.im.instanceColor.needsUpdate = true;
      const hotel = new THREE.BoxGeometry(1, 1, 1); hotel.translate(0, 0.5, 0);
      const hp = this._pool(hotel, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), 12, (t, i, P) => { const w = 14 + r() * 10; t.position.x = ROAD_W / 2 + 20 + w / 2; t.scale.set(w, 8 + r() * 16, 10 + r() * 8); P.im.setColorAt(i, new THREE.Color(pick(['#f6ead6', '#e9f1f4', '#f3dfcf']))); }, { every: 36 });
      hp.im.instanceColor.needsUpdate = true;
    } else {
      // صحراء: كثبان وجبال صخرية ونخيل متناثر ولافتات
      const dune = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      for (const sg of [-1, 1]) this._pool(dune, new THREE.MeshStandardMaterial({ color: new THREE.Color('#d6b072'), roughness: 1 }), 18, (t) => { const s = 8 + r() * 14; t.position.x = sg * (ROAD_W / 2 + 9 + s * 1.6 + r() * 30); t.scale.set(s * 1.6, s * 0.3, s); }, { every: 24, offset: sg > 0 ? 0 : 12 });
      const rock = new THREE.DodecahedronGeometry(1, 0);
      for (const sg of [-1, 1]) this._pool(rock, new THREE.MeshStandardMaterial({ color: new THREE.Color('#8f6b4f'), roughness: 1, flatShading: true }), 10, (t) => { const s = 18 + r() * 30; t.position.x = sg * (ROAD_W / 2 + 70 + r() * 60); t.scale.set(s, s * (0.8 + r() * 0.8), s); t.rotation.y = r() * 6; }, { every: 42, offset: sg > 0 ? 6 : 27 });
      this._palms(r, 20, 0.7);
    }
  }
  // ---------------------------------------------------------------- الطرق العُمانية (مسقط – المعالم / كورنيش مطرح)
  /** معالم فريدة على «مسار» دوري طوله C: كل معلم يظهر مرة في كل دورة، وتُخلى له المساحة من المباني المكرّرة */
  _landmarks(C, list) {
    const objs = [];
    for (const it of list) {
      const o = compact(it.make()); const side = it.side;
      o.position.set(side * (ROAD_W / 2 + it.setback), 0, -it.off); if (side > 0) o.rotation.y = Math.PI;
      if (it.scale) o.scale.setScalar(it.scale);
      o.userData.z0 = -it.off; this.root.add(o); objs.push(o);
      const half = (o.userData.half || 10) * (it.scale || 1) + 4;
      this.zones.push({ off: it.off, half, side, C, near: true });
      if (o.userData.radio) this.radioSpots.push({ obj: o, side, x: o.position.x });
    }
    this.track = { C, objs };
  }
  /** هل موضع z على الجهة side محجوز لمعلم؟ (لتجنّب تداخل المباني المكرّرة مع المعالم) */
  _blocked(z, side) {
    for (const Z of this.zones) { if (Z.side !== side || !Z.near) continue; const d = (((z + Z.off) % Z.C) + Z.C) % Z.C; if (d < Z.half || d > Z.C - Z.half) return true; }
    return false;
  }
  /** يضع محل المذياع على الرصيف عند z في الجهة side (لا يتقاطع مع المباني لأنه أمامها) */
  placeBreakKiosk(z, side) {
    const o = this.breakKiosk; if (!o) return;
    o.position.set(side * (ROAD_W / 2 + 6.4), 0, z); o.rotation.y = side > 0 ? Math.PI : 0; o.visible = true;
    Object.assign(this.breakSpot, { side, x: o.position.x, played: null });
  }
  _portraitTex(file) { const t = new THREE.TextureLoader().load(`./assets/img/landmarks/${file}`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
  _omani(name, r, pick, T) {
    const U = { uT: this.flagTime, uWind: this.flagWind };
    const twin = () => portraitStand(this._portraitTex('portrait-sultans.jpg'), 1489 / 1312, U);
    const haitham = () => portraitStand(this._portraitTex('portrait-haitham.jpg'), 1140 / 570, U);
    if (name === 'muttrah') {
      this._landmarks(900, [
        { make: twin, off: 150, side: 1, setback: 9 },
        { make: radioKiosk, off: 260, side: 1, setback: 6.5 },
        { make: () => fortHill(1), off: 360, side: 1, setback: 34 },
        { make: souqGate, off: 480, side: 1, setback: 9 },
        { make: radioKiosk, off: 610, side: -1, setback: 6.2 },
        { make: haitham, off: 700, side: 1, setback: 9 },
        { make: radioKiosk, off: 820, side: 1, setback: 6.5 },
      ]);
    } else {
      this._landmarks(1100, [
        { make: twin, off: 130, side: -1, setback: 9 },
        { make: radioKiosk, off: 250, side: 1, setback: 6.5 },
        { make: souqGate, off: 380, side: 1, setback: 9 },
        { make: grandMosque, off: 560, side: -1, setback: 42, scale: 0.8 },
        { make: radioKiosk, off: 650, side: -1, setback: 6.5 },
        { make: () => ministryBuilding(U), off: 780, side: 1, setback: 16 },
        { make: haitham, off: 900, side: -1, setback: 9 },
        { make: radioKiosk, off: 980, side: 1, setback: 6.5 },
        { make: () => fortHill(1.1), off: 1040, side: -1, setback: 48 },
      ]);
    }
    // مبانٍ مكرّرة: واجهات حجرية بنوافذ مقوّسة + بيوت مسقط البيضاء بشرفات مسننة
    const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
    const merl = []; for (let k = 0; k < 7; k++) { const m = new THREE.BoxGeometry(0.07, 0.07, 0.09); m.translate(0.5 - 0.035, 1.035, -0.45 + k * 0.15); merl.push(m); }
    const house = mergeGeos([bGeo, ...merl]);
    const facMat = new THREE.MeshStandardMaterial({ map: tex(512, 512, (x, w, h) => omaniFacade(x, w, h), true), roughness: 0.85 });
    const whiteMat = new THREE.MeshStandardMaterial({ map: muscatHouseTex(), roughness: 0.9 });
    const tints = ['#ffffff', '#f6efe2', '#efe3cc', '#fbf6ee', '#eadcc4'].map((c) => new THREE.Color(c));
    const sides = name === 'muttrah' ? [1] : [-1, 1];
    for (const sg of sides) {
      const hide = (t) => { if (this._blocked(t.position.z, sg)) t.scale.setScalar(0.0001); };
      const a = this._pool(bGeo, facMat, 12, (t, i, P) => {
        const w = 10 + r() * 7, d = 9 + r() * 6, hh = 8 + r() * 9;
        t.position.x = sg * (ROAD_W / 2 + 8 + w / 2 + r() * 3); t.scale.set(w, hh, d); if (sg > 0) t.rotation.y = Math.PI; P.im.setColorAt(i, pick(tints)); hide(t);
      }, { every: 36, offset: sg > 0 ? 4 : 22 });
      a.im.instanceColor.needsUpdate = true;
      this._pool(house, whiteMat, 12, (t) => {
        const w = 9 + r() * 6, d = 8 + r() * 5, hh = 6 + r() * 5;
        t.position.x = sg * (ROAD_W / 2 + 7.5 + w / 2 + r() * 2); t.scale.set(w, hh, d); if (sg > 0) t.rotation.y = Math.PI; hide(t);
      }, { every: 36, offset: sg > 0 ? 22 : 4 });
    }
    // أعمدة إنارة الكورنيش وفوانيسها
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.45, metalness: 0.6 });
    const lampG = mergeGeos(ornateLampGeo());
    const glowG = new THREE.SphereGeometry(0.12, 8, 6), glows = [];
    for (const s of [-1, 1]) { const g = glowG.clone(); g.translate(s * 1.0, 6.22, 0); glows.push(g); }
    const glowMerged = mergeGeos(glows);
    for (const sg of [-1, 1]) {
      const pl = (t) => { t.position.x = sg * (ROAD_W / 2 + 1.6); t.rotation.y = Math.PI / 2; };
      this._pool(lampG, lampMat, 14, pl, { every: 30, offset: sg > 0 ? 0 : 15 });
      this._pool(glowMerged, new THREE.MeshBasicMaterial({ color: 0xfff1c4 }), 14, pl, { every: 30, offset: sg > 0 ? 0 : 15 });
    }
    // أحواض زهور (أحمر/وردي/أبيض) على الرصيف
    const bed = new THREE.BoxGeometry(1.1, 0.42, 4.2); bed.translate(0, 0.21, 0);
    const flowers = ['#e63958', '#f28aa6', '#ffffff', '#ffb703'].map((c) => new THREE.Color(c));
    for (const sg of [-1, 1]) {
      if (name === 'muttrah' && sg < 0) continue;
      const p = this._pool(bed, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), 16, (t, i, P) => { t.position.x = sg * (ROAD_W / 2 + 5.4); P.im.setColorAt(i, pick(flowers)); }, { every: 26, offset: sg > 0 ? 7 : 20 });
      p.im.instanceColor.needsUpdate = true;
    }
    if (name === 'muttrah') {
      // مصدّ الأمواج: كتل خرسانية رباعية الأرجل على حافة البحر
      const tp = []; for (const v of [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]) { const leg = new THREE.CylinderGeometry(0.18, 0.32, 1.1, 6); leg.translate(0, 0.55, 0); leg.lookAt(new THREE.Vector3(...v)); tp.push(leg); }
      const tet = mergeGeos(tp);
      this._pool(tet, new THREE.MeshStandardMaterial({ color: 0xb9b5ab, roughness: 1, flatShading: true }), 90, (t) => { const z = t.position.z; t.position.x = -(ROAD_W / 2 + 13.6 + H(z, 3) * 2.2); t.position.y = -0.2 + H(z, 4) * 0.5; t.rotation.set(H(z, 5) * 6, H(z, 6) * 6, H(z, 7) * 6); }, { every: 4.8, offset: 1 });
      const rail = new THREE.BoxGeometry(0.12, 0.9, 3.6); rail.translate(0, 0.45, 0);
      this._pool(rail, new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.6 }), 120, (t) => { t.position.x = -(ROAD_W / 2 + 13.1); }, { every: 3.6 });
      this._palms(r, 22, 1);
      this._ridges(1, ROAD_W / 2 + 62, 36, 72, 7);           // جبال مطرح الصخرية خلف البيوت مباشرة
    } else {
      this._palms(r, 28, 1);
      this._ridges(1, ROAD_W / 2 + 175, 30, 70, 3);
      this._ridges(-1, ROAD_W / 2 + 190, 28, 66, 5);
    }
    // لافتات طرق زرقاء (أسماء مدن عُمانية فقط)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b939c, roughness: 0.5, metalness: 0.6 });
    const n = 5, every = 92, objs = [];
    for (let i = 0; i < n; i++) {
      const [ar, en] = OMAN_PLACES[(i * 3) % OMAN_PLACES.length];
      const g = new THREE.Group();
      const sideX = ROAD_W / 2 + 2.6;
      for (const dx of [-1.1, 1.1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.6, 8), postMat); post.position.set(sideX + dx, 2.3, 0); g.add(post); }
      const st = tex(512, 256, (x, w, h) => roadSign(x, w, h, ar, en));
      const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ map: st, roughness: 0.4 }));
      board.position.set(sideX, 4.0, 0.06); g.add(board);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.25, 1.65, 0.06), postMat); back.position.set(sideX, 4.0, 0); g.add(back);
      g.position.z = -i * every - 40; g.userData.z0 = g.position.z; this.root.add(g); objs.push(g);
    }
    this.movers.push({ objs, every, n });
  }
  /** تلال صخرية قريبة على جهة واحدة: أشرطة تتكرر (تتداخل قليلًا لإخفاء الوصلات) */
  _ridges(side, x0, hMin, hMax, seed) {
    const L = 210, every = 180, n = 4, objs = [];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(ridgeGeometry(L, 90, hMin, hMax, seed + i * 3.7), mat);
      m.position.set(side * (x0 + 45), 0, -i * every - 60); if (side < 0) m.rotation.y = Math.PI;
      m.userData.z0 = m.position.z; m.receiveShadow = false; this.root.add(m); objs.push(m);
    }
    this.movers.push({ objs, every, n });
  }
  // ---------------------------------------------------------------- أعلام سلطنة عُمان على جانبي الطريق (ترفرف)
  _flags() {
    // الصورة الرسمية للعلم + قماش يرفرف بريح ثابتة معتدلة؛ الانحناء يُحقن بعد الموجة
    const L = 2.4, y0 = 7.2 - L / FLAG_ASPECT;
    const fg = flagGeometry(L, y0, 20, 6);
    const tmp = bendMaterial(new THREE.MeshStandardMaterial());
    const fm = clothMaterial({ uT: this.flagTime, uWind: this.flagWind }, { L, y0, bendWrap: tmp.onBeforeCompile, key: 'bend1-cloth', instanced: true });
    fm.userData.bent = true;
    const pole = new THREE.CylinderGeometry(0.06, 0.08, 7.4, 8); pole.translate(0, 3.7, 0);
    const knob = new THREE.SphereGeometry(0.13, 10, 8); knob.translate(0, 7.45, 0);
    const pm = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.3, metalness: 0.8 });
    this.flags = [];
    for (const sg of [-1, 1]) {
      // السارية على الرصيف والعلم يمتد نحو الشارع مائلًا قليلًا نحو القادمين (لا نحو المباني)
      const place = (t) => { t.position.x = sg * (ROAD_W / 2 + 3.4); t.scale.x = -sg; t.rotation.y = sg * 0.35; };
      const a = this._pool(mergeGeos([pole, knob]), pm, 10, place, { every: 44, offset: sg > 0 ? 8 : 30 });
      const b = this._pool(fg, fm, 10, place, { every: 44, offset: sg > 0 ? 8 : 30 });
      b.im.castShadow = false; this.flags.push(a.im, b.im);
    }
  }
  /** يعيد العناصر الجانبية إلى مواضعها الأولى (عند بدء سباق جديد من z = 0) */
  reset() {
    for (const p of this.items) { for (let i = 0; i < p.n; i++) { p.z[i] = -i * p.every - p.offset; this._place(p, i); } p.im.instanceMatrix.needsUpdate = true; if (p.im.instanceColor) p.im.instanceColor.needsUpdate = true; }
    for (const M of this.movers) for (const o of M.objs) o.position.z = o.userData.z0;
    if (this.track) for (const o of this.track.objs) o.position.z = o.userData.z0;
  }
  setFlag(on) { this.flagOn = !!on; for (const m of this.flags) m.visible = this.flagOn; }

  _palms(r, count, density) {
    const TH = 6.5, trunk = new THREE.CylinderGeometry(0.18, 0.28, TH, 8, 6); trunk.translate(0, TH / 2, 0);
    const pos = trunk.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setX(i, pos.getX(i) + Math.sin(y * 0.25) * 0.4); }
    trunk.computeVertexNormals();
    const top = new THREE.Vector3(Math.sin(TH * 0.25) * 0.4, TH - 0.05, 0);
    // السعفة: عِرق يخرج صاعدًا قليلًا ثم ينحني تحت وزنه إلى الخارج والأسفل، والخوص على جانبيه بطيّة خفيفة (V)
    const frond = (len, rise, droop, wMax) => {
      const n = 12, P = [], U = [], I = [];
      let x = 0, y = 0;
      for (let i = 0; i <= n; i++) {
        const s = i / n, ang = rise - (rise + droop) * Math.pow(s, 1.35);
        if (i > 0) { x += Math.cos(ang) * len / n; y += Math.sin(ang) * len / n; }
        const w = wMax * Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.95)) * (1 - 0.35 * s), fold = w * 0.35;
        P.push(x, y - fold, -w, x, y, 0, x, y - fold, w); U.push(s, 0, s, 0.5, s, 1);
        if (i < n) { const k = i * 3; I.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
      return g;
    };
    const leaves = [];
    const N = 11;
    for (let k = 0; k < N; k++) {
      const young = k >= 9;                                         // سعفتان حديثتان شبه قائمتين في القلب
      const g = young ? frond(2.2, 1.15, -0.55, 0.32) : frond(3.3 + (k % 3) * 0.25, 0.55 - (k % 2) * 0.25, 1.05 + (k % 3) * 0.15, 0.5);
      g.rotateY((k / (young ? 2 : 9)) * Math.PI * 2 + (young ? 0.7 : 0) + (k % 2) * 0.12);
      g.translate(top.x, top.y, top.z); leaves.push(g);
    }
    const crown = new THREE.SphereGeometry(0.32, 10, 8); crown.scale(1, 0.8, 1); crown.translate(top.x, top.y - 0.1, top.z);
    const frondTex = tex(256, 64, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = '#3f7d36'; x.lineCap = 'round';
      for (let i = 4; i < w - 2; i += 5) {                          // الخوص مائل نحو طرف السعفة
        const t = i / w, len = h * 0.5 * (0.75 + 0.25 * Math.sin(t * Math.PI));
        x.lineWidth = 3.2; x.strokeStyle = i % 10 ? '#3d8436' : '#4f9a45';
        x.beginPath(); x.moveTo(i, h / 2); x.lineTo(i + 16, h / 2 - len); x.stroke();
        x.beginPath(); x.moveTo(i, h / 2); x.lineTo(i + 16, h / 2 + len); x.stroke();
      }
      x.strokeStyle = '#7b6a3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    });
    const tm = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 });
    const lm = new THREE.MeshStandardMaterial({ map: frondTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
    const cm = new THREE.MeshStandardMaterial({ color: 0x5b4a2a, roughness: 0.9 });
    for (const sg of [-1, 1]) {
      const n = Math.round(count * density / 2), every = SPAN / n, offset = sg > 0 ? 0 : 9;
      const pl = (t) => { const z = t.position.z; t.position.x = sg * (ROAD_W / 2 + 4.5 + H(z, 1) * 2); t.rotation.y = H(z, 2) * 6; t.scale.setScalar(0.8 + H(z, 3) * 0.5); };
      this._pool(trunk, tm, n, pl, { every, offset });
      this._pool(mergeGeos([crown]), cm, n, pl, { every, offset });
      this._pool(mergeGeos(leaves), lm, n, pl, { every, offset });
    }
  }
  _trees(r, count, color, sc) {
    const crown = new THREE.IcosahedronGeometry(1.4, 1); crown.translate(0, 3.2, 0);
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6); trunk.translate(0, 1.2, 0);
    for (const sg of [-1, 1]) {
      this._pool(mergeGeos([trunk]), new THREE.MeshStandardMaterial({ color: 0x6b4a32 }), count / 2, (t) => { t.position.x = sg * (ROAD_W / 2 + 4.2); t.scale.setScalar(sc); }, { every: SPAN / (count / 2), offset: sg > 0 ? 6 : 13 });
      this._pool(crown, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.8, flatShading: true }), count / 2, (t) => { t.position.x = sg * (ROAD_W / 2 + 4.2); t.scale.setScalar(sc); }, { every: SPAN / (count / 2), offset: sg > 0 ? 6 : 13 });
    }
  }

  /** كل إطار: z = موضع السائق (سالب كلما تقدّم) */
  update(z, camera, dt, t) {
    this.dist = -z;
    // الطريق والأرض يتبعان السائق، والقوام ينزلق
    const ahead = z - SPAN / 2 + 40;
    for (const m of [this.road, this.ground, this.sea, ...(this.kerbs || []), ...(this.walks || [])]) if (m) m.position.z = ahead;
    if (this.roadTex) this.roadTex.offset.y = -(ahead % 12) / 12;
    if (this.kerbTex) this.kerbTex.offset.y = -(ahead % 8) / 8;
    if (this.ground.material.map) this.ground.material.map.offset.y = -(ahead % 10) / 10;
    // تدوير العناصر الجانبية
    for (const p of this.items) {
      let dirty = false;
      for (let i = 0; i < p.n; i++) {
        if (p.z[i] > z + 30) { p.z[i] -= p.n * p.every; this._place(p, i); dirty = true; }
      }
      if (dirty) { p.im.instanceMatrix.needsUpdate = true; if (p.im.instanceColor) p.im.instanceColor.needsUpdate = true; }
    }
    for (const M of this.movers) for (const o of M.objs) if (o.position.z > z + 30) o.position.z -= M.n * M.every;
    if (this.track) for (const o of this.track.objs) {
      if (o.position.z > z + 80) o.position.z -= this.track.C;
      o.visible = o.position.z > z - SPAN - 20;              // المعالم البعيدة جدًا (خلف الضباب) لا تُرسم: توفير في عدد أوامر الرسم
    }
    this.flagTime.value += dt || 0.016;
    this.sky.position.copy(camera.position);
    // الشمس والظل يتبعان السائق
    this.sun.position.set(-8, 14, z + 6); this.sun.target.position.set(0, 0, z - 4);
    // انحناء العالم: يتغير ببطء (منعطفات وتلال متتالية)
    BEND.uCamZ.value = camera.position.z;
    const d = -z;
    BEND.uBendX.value = 0.0009 * Math.sin(d / 260) + 0.0005 * Math.sin(d / 97 + 1.3);
    BEND.uBendY.value = -0.0006 + 0.0005 * Math.sin(d / 180 + 0.7);
  }
}

/** دمج هندسات بسيطة (position/normal/uv) بلا اعتماد على BufferGeometryUtils */
export function mergeGeos(list) {
  const out = new THREE.BufferGeometry(), P = [], N = [], U = [], I = [];
  let off = 0;
  for (let g of list) {
    g = g.index ? g : g;
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0); U.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) I.push(i + off);
    off += p.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); out.setIndex(I);
  return out;
}
export { SPAN };
