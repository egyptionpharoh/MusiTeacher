// =====================================================================
//  عالم السباق: سماء متدرجة وشمس، طريق بأربع حارات وأرصفة، ومشاهد جانبية متكررة (مدينة عصرية، ساحل بنخيل،
//  طريق صحراوي بين جبال عُمانية). كل العناصر الجانبية «مُعادة التدوير» حول السائق (InstancedMesh) فلا يزيد
//  عدد الكائنات مهما طال السباق. الاتجاه الأمامي = −Z.
// =====================================================================
import * as THREE from 'three';
import { BEND, bendTree, bendMaterial, dipMaterial } from './bend.js';
import { omaniFacade, roadSign, OMAN_PLACES } from './oman.js';
import { FLAG_ASPECT, flagGeometry, clothMaterial } from './flag.js';
import { roadHeight, RAMP } from './bend.js';
import { STATIONS, ORDER, DEFAULT_FROM, DEFAULT_TO, routeBetween, planStops, stationData } from './stations.js';
import { educationMinistry } from './ministry.js';
import { sahwaTower, giantFlagpole, tallShip, dhow, suspBridge, fortCastle, portCranes, blueMosque, lighthouse, muscatGate, billboard, cruiseShip } from './landmarks2.js';
import { grandMosque, souqGate, ministryBuilding, portraitStand, fortHill, radioKiosk, muscatHouseTex, ornateLampGeo, ridgeGeometry, compact } from './oman3d.js';

export const LANE_W = 3.4, ROAD_LANES = 4, ROAD_W = LANE_W * ROAD_LANES;
const LEAD = 340;                     // «رحلة عُمان»: المحطة التالية تبدأ على هذا البعد أمام السائق (داخل الضباب)
const SPAN = 420;                     // طول المنطقة المعاد تدويرها أمام السائق

function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const H = (z, k) => { const v = Math.sin(z * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** كل البيئات محطات عُمانية حقيقية (لا بيئات خيالية). الاسم THEMES باقٍ للتوافق مع بقية الملفات. */
export const THEMES = STATIONS;

// ---------------------------------------------------------------- توقيت الرحلة: نهاري / غروب / ليلي
const mixHex = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
/** كل توقيت يعدّل ألوان السماء والضباب والإضاءة انطلاقًا من ألوان المحطة نفسها (فتبقى لكل محطة شخصيتها) */
const TODS = {
  day: null,
  sunset: (T) => ({ sky: [mixHex(T.sky[0], '#2c3f7c', 0.6), mixHex(T.sky[1], '#f3a35c', 0.72), mixHex(T.sky[2], '#f0c08c', 0.6)], fog: mixHex(T.fog, '#eab084', 0.58), sun: '#ffb070', sunI: T.sunI * 0.74,
    hemi: [mixHex(T.hemi[0], '#ffd2a6', 0.6), mixHex(T.hemi[1], '#4a3a3a', 0.4), T.hemi[2] * 0.84], sunDir: [-0.5, 0.075, -1], sunPos: [-13, 5, 2], tint: ['#d98f66', 0.3, 0.86] }),
  night: (T) => ({ sky: ['#040816', '#0b1630', '#0f1a2e'], fog: mixHex('#0d1628', T.fog, 0.06), sun: '#9db6ee', sunI: 0.4, hemi: ['#5b6ea0', '#10131b', 0.46], sunDir: [-0.35, 0.42, -1], sunPos: [-8, 14, 6], tint: ['#172038', 0.74, 0.55], night: true }),
};
export const TOD_NAMES = { day: '☀️ نهاري', sunset: '🌇 غروب الشمس', night: '🌙 ليلي' };
const bell = (a, c, w) => Math.exp(-(((a - c) / w) ** 2));

export class World {
  constructor(scene, renderer, theme = 'city') {
    this.scene = scene; this.renderer = renderer; this.root = new THREE.Group(); scene.add(this.root);
    this.items = []; this.dist = 0; this.flagOn = true; this.flags = []; this.movers = []; this.flagTime = { value: 0 }; this.flagWind = { value: 0.72 };
    this._lights(); this.cineSeen = new Set();
    this.setRoute();
  }

  _lights() {
    const sc = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    sc.add(this.sun, this.sun.target);
    // ضوء المركبة ليلًا (كشّافها): ضوء واحد قريب يتبعها فيضيء المركبة والطريق أمامها
    this.carLight = new THREE.PointLight(0xfff0d0, 0, 22, 1.5); sc.add(this.carLight);
  }

  setTheme() { this.setRoute(); }                 // توافق مع الاستدعاءات القديمة
  /** يحدد الرحلة: من محطة إلى محطة + التوقيت، ويبني محطة الانطلاق فورًا */
  setRoute(from = DEFAULT_FROM, to = DEFAULT_TO, tod = 'day') {
    const R = routeBetween(from, to);
    this.tod = tod in TODS ? tod : 'day';
    this.theme = this.routeKey = `${from}>${to}>${this.tod}`;
    this.journey = { ids: R.ids, flip: R.flip, stops: R.ids.slice(), N: R.ids.length * 2, n: 0, i: 0 };
    this._build(this.journey.stops[0], 0);
  }
  /** يعيد بناء الرحلة فقط إذا تغيّر الانطلاق أو الوصول أو التوقيت */
  ensureRoute(from = DEFAULT_FROM, to = DEFAULT_TO, tod = 'day') { if (!(tod in TODS)) tod = 'day'; if (this.routeKey !== `${from}>${to}>${tod}`) this.setRoute(from, to, tod); }
  /** خطة المسابقة: عدد الأسئلة ومتوسط المسافة لكل سؤال يحددان كم محطة تمر بها الرحلة (كل محطة ≈ ٤٣٠ م على الأقل) ومتى يحين الانتقال */
  planJourney(questions, metersPerQuestion = 300) {
    const J = this.journey; J.N = Math.max(1, questions | 0); this.cineSeen.clear();
    J.stops = planStops(J.ids, Math.min(J.N, Math.floor((J.N * metersPerQuestion) / 430) + 1)); J.n = 0; this._goto(0);
  }
  /** المحطة المناسبة بعد n سؤالًا (متقدمة بسؤال واحد: المحطة الجديدة تُبنى أمام السائق فيبلغها مع السؤال التالي) */
  _stopFor(n) { const J = this.journey; return Math.min(J.stops.length - 1, Math.floor((Math.min(J.N, n + 1) * J.stops.length) / J.N)); }
  /** بداية دور متسابق: n = عدد الأسئلة التي سبقت دوره */
  syncTurn(n) { const J = this.journey; J.n = n; this._goto(this._stopFor(n)); }
  /** بعد كل سؤال: يعيد رقم المحطة التالية إن حان الانتقال إليها، وإلا −1 */
  answered() { const J = this.journey; J.n++; const k = this._stopFor(J.n); return k > J.i ? k : -1; }
  stationAt(k) { return STATIONS[this.journey.stops[k]]; }
  /** بناء محطة من أولها عند z = 0 (بداية دور أو معاينة) — بلا محطة سابقة */
  _goto(k) { const J = this.journey; this.queued = null; if (k === J.i && this.env === J.stops[k] && !this.old) { this.rebase(0); return; } J.i = k; this._build(J.stops[k], 0); }
  /** الانتقال المتصل: تُبنى المحطة التالية على الطريق أمام السائق (بعد حدٍّ يبعد ٣٤٠ م داخل الضباب) وتبقى الحالية حتى يتجاوزها.
   *  لا ستار ولا توقف: يرى السائق البيئة تتغير أمامه وهو يقود. إن كانت محطة سابقة لم تُتجاوز بعدُ يؤجَّل الطلب حتى يتجاوزها. */
  beginTravel(k, z) {
    const J = this.journey; J.i = k;
    if (this.old) { this.queued = k; return; }
    let zb = Math.round(z) - LEAD;                    // الحد لا يقطع معلمًا قائمًا (جسرًا أو ميدانًا): يُدفع إلى ما بعده
    if (this.track) for (let pass = 0; pass < 3; pass++) for (const o of this.track.objs) { const h = (o.userData.half || 10) + 52; if (zb < o.position.z + h && zb > o.position.z - h) zb = Math.round(o.position.z - h); }
    this._build(J.stops[k], zb, true);
  }
  /** ستار انتقال قصير بين محطتين (يغطي لحظة تبديل البيئة ويعرض اسم المحطة) */
  veil(op, T, from) {
    let v = this._veil;
    if (!v) { if (op <= 0) return; v = this._veil = document.createElement('div'); v.style.cssText = 'position:fixed;inset:0;z-index:3;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:46vh;gap:.5vh;font-family:Cairo,Tahoma,Arial,sans-serif;direction:rtl;text-align:center;opacity:0'; v.innerHTML = '<div style="font-size:clamp(14px,2.2vw,26px);font-weight:700;opacity:.85"></div><div style="font-size:clamp(30px,6vw,84px);font-weight:900;line-height:1.15"></div><div style="font-size:clamp(13px,1.8vw,22px);font-weight:700;letter-spacing:.12em;opacity:.8"></div>'; document.body.appendChild(v); }
    if (T) { v.style.background = this.night ? 'linear-gradient(#0b1630, #0d1628)' : `linear-gradient(${T.sky[1]}, ${T.fog})`; v.children[0].textContent = from ? `رحلة عُمان · من ${from} إلى` : 'رحلة عُمان'; v.style.color = this.night ? '#eef3ff' : '#12324f'; v.children[1].textContent = `📍 ${T.name}`; v.children[2].textContent = T.en || ''; }
    v.style.opacity = String(Math.max(0, Math.min(1, op))); v.style.display = op <= 0 ? 'none' : 'flex';
  }
  _kill(obj) {
    const seen = new Set();
    obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); for (const m of [].concat(o.material || [])) { if (seen.has(m)) continue; seen.add(m); for (const k of ['map', 'alphaMap', 'emissiveMap']) if (m[k]) m[k].dispose(); m.dispose(); } });
    if (obj.parent) obj.parent.remove(obj);
  }
  _dropOld() { const O = this.old; if (!O) return; this._kill(O.root); if (O.mount) this._kill(O.mount); this.old = null; this._env(1); }
  /** يجمّد المحطة الحالية كما هي أمام السائق حتى الحد zb، ويفتح جذرًا جديدًا للمحطة التالية */
  _freeze(zb) {
    const hideAt = zb + 46, t = new THREE.Object3D(); t.scale.setScalar(0.0001); t.updateMatrix();
    for (const p of this.items) { for (let i = 0; i < p.n; i++) if (p.z[i] < hideAt) p.im.setMatrixAt(i, t.matrix); p.im.instanceMatrix.needsUpdate = true; }
    for (const M of this.movers) for (const o of M.objs) if (o.position.z < hideAt) o.visible = false;
    if (this.track) for (const o of this.track.objs) { o.userData.gone = o.position.z - (o.userData.half || 10) < hideAt; if (o.userData.gone) o.visible = false; }
    for (const m of [this.road, ...this.kerbs, ...this.walks]) if (m && m !== this.strip) m.visible = false;      // الطريق والأرصفة يكملها الجذر الجديد
    for (const m of [this.ground, this.sea, this.strip]) if (m) m.position.z = zb + m.userData.len / 2;           // الأرض والبحر القديمان ينتهيان عند الحد
    if (this.breakKiosk) this.breakKiosk.visible = false;
    this.old = { root: this.root, track: this.track, mount: this.mountains, zb };
    this.root = new THREE.Group(); this.scene.add(this.root);
  }
  _build(name, base = 0, keepOld = false) {
    const T0 = stationData(name, this.journey && this.journey.flip), D = TODS[this.tod] ? TODS[this.tod](T0) : null;
    const T = D ? { ...T0, ...D } : T0; this.env = name; this.T = T;
    this.night = !!(D && D.night); this.carLight.intensity = this.night ? 46 : 0; this.tint = D ? D.tint : null; this.sunPos = (D && D.sunPos) || [-8, 14, 6];
    const sc = this.scene, first = !sc.fog;
    if (keepOld && !first) this._freeze(base);
    else { this._dropOld(); this._kill(this.root); this.root = new THREE.Group(); sc.add(this.root); if (this.mountains) { this._kill(this.mountains); this.mountains = null; } }
    this.items = []; this.movers = []; this.flags = []; this.track = null; this.zones = []; this.radioSpots = [];
    this.walks = []; this.kerbs = []; this.sea = null; this.strip = null;
    // ألوان الجو والإضاءة: تُطبَّق فورًا، أو تتدرج من المحطة السابقة كلما اقترب السائق من الحد
    if (first) { sc.fog = new THREE.Fog(new THREE.Color(T.fog), 60, SPAN * 0.92); sc.background = new THREE.Color(T.fog); }
    const to = { fog: new THREE.Color(T.fog), far: SPAN * 0.92 * ((T.env && T.env.fogFar) || 1), h0: new THREE.Color(T.hemi[0]), h1: new THREE.Color(T.hemi[1]), hi: T.hemi[2], sun: new THREE.Color(T.sun), si: T.sunI, sky: T.sky.map((c) => new THREE.Color(c)) };
    const U = this.sky && this.sky.material.uniforms;
    const from = this.old && U ? { fog: sc.fog.color.clone(), far: sc.fog.far, h0: this.hemi.color.clone(), h1: this.hemi.groundColor.clone(), hi: this.hemi.intensity, sun: this.sun.color.clone(), si: this.sun.intensity, sky: [U.c0.value.clone(), U.c1.value.clone(), U.c2.value.clone()] } : to;
    this.blend = { from, to };
    this._sky(T);
    this._env(this.old ? 0 : 1);
    if (this.old) {            // ربوتان صخريتان عند الحد (كأن الطريق يعبر مضيقًا بين منطقتين) تخفيان التقاء أرض المحطتين
      for (const sd of [-1, 1]) this.zones.push({ off: -base, half: 46, side: sd, C: 1e9, near: true });
      const pal = (T.env && T.env.ridges && T.env.ridges[0] && T.env.ridges[0][5]) || undefined, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
      for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) { const m = new THREE.Mesh(ridgeGeometry(120, 92, 9 + q * 6, 22 + q * 12, base * 0.013 + sd + q * 2.3, pal), mat); m.position.set(sd * (ROAD_W / 2 + 5.9 + 46 + q * 88), -0.2, base); if (sd < 0) m.rotation.y = Math.PI; this.root.add(m); }
    }
    this._ground(T); this._road(T); this._scenery(name, T); this._flags();
    // محل مذياع متنقّل على الرصيف (أمام صف المباني) يوضع بين سؤالين لاستراحة موسيقية قصيرة
    this.breakKiosk = compact(radioKiosk()); this.breakKiosk.visible = false; this.root.add(this.breakKiosk);
    this.breakSpot = { obj: this.breakKiosk, side: -1, x: 0, dyn: true }; this.radioSpots.push(this.breakSpot);
    bendTree(this.root);
    if (this.night) this._nightGlow();
    this.setFlag(this.flagOn);
    this.rebase(base);
  }
  /** يطبّق ألوان الجو والإضاءة بنسبة k بين المحطة السابقة (0) والحالية (1) */
  _env(k) {
    const B = this.blend; if (!B) return; const a = B.from, b = B.to, sc = this.scene, L = THREE.MathUtils.lerp;
    sc.fog.color.copy(a.fog).lerp(b.fog, k); sc.background.copy(sc.fog.color); sc.fog.far = L(a.far, b.far, k);
    this.hemi.color.copy(a.h0).lerp(b.h0, k); this.hemi.groundColor.copy(a.h1).lerp(b.h1, k); this.hemi.intensity = L(a.hi, b.hi, k);
    this.sun.color.copy(a.sun).lerp(b.sun, k); this.sun.intensity = L(a.si, b.si, k);
    const U = this.sky.material.uniforms; ['c0', 'c1', 'c2'].forEach((n, i) => U[n].value.copy(a.sky[i]).lerp(b.sky[i], k));
    const op = (g, v) => { if (g) { g.visible = v > 0.01; for (const m of g.children) m.material.opacity = v; } };
    op(this.mountains, this.old ? k : 1); if (this.old) op(this.old.mount, 1 - k);
  }

  /** لون غير مضاء (جبال الأفق) بحسب التوقيت */
  _tc(hex) { if (!this.tint) return hex; const c = new THREE.Color(hex).lerp(new THREE.Color(this.tint[0]), this.tint[1]).multiplyScalar(this.tint[2]); return '#' + c.getHexString(); }
  /** الليل: المباني والمعالم والطريق مضاءة إضاءة خافتة (كأنها تحت أعمدة الإنارة والكشافات) دون أضواء حقيقية مكلفة */
  _nightGlow() {
    const seen = new Set();
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m || !m.isMeshStandardMaterial || seen.has(m) || m.vertexColors) continue; seen.add(m);
        const soft = o === this.ground || o === this.sea;
        if (m.map) { m.emissiveMap = m.map; m.emissive.set(0xffffff); m.emissiveIntensity = soft ? 0.1 : 0.12; }
        else { m.emissive.copy(m.color); m.emissiveIntensity = soft || o.isInstancedMesh ? 0.08 : 0.14; }
        m.needsUpdate = true;
      }
    });
  }
  // ---------------------------------------------------------------- السماء
  _sky(T) {
    if (!this.sky) {           // قبة السماء تُنشأ مرة واحدة، وألوانها تتدرج بين المحطات
      const g = new THREE.SphereGeometry(900, 32, 16);
      const m = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { c0: { value: new THREE.Color(T.sky[0]) }, c1: { value: new THREE.Color(T.sky[1]) }, c2: { value: new THREE.Color(T.sky[2]) }, sunDir: { value: new THREE.Vector3(-0.3, 0.25, -1).normalize() }, glow: { value: 1 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }',
        fragmentShader: `uniform vec3 c0,c1,c2,sunDir; uniform float glow; varying vec3 vP;
          void main(){ float h = vP.y; vec3 col = h>0.0 ? mix(c1,c0,pow(clamp(h*1.6,0.0,1.0),0.7)) : c2;
            col = mix(c2, col, smoothstep(-0.02, 0.16, h));
            float s = max(dot(normalize(vP), sunDir), 0.0); col += vec3(1.0,0.9,0.7)*pow(s,400.0)*1.6 + vec3(1.0,0.8,0.6)*pow(s,12.0)*0.25*glow;
            gl_FragColor = vec4(col,1.0); }`,
      });
      this.sky = new THREE.Mesh(g, m); this.sky.frustumCulled = false; this.sky.renderOrder = -10; this.sky.userData.noBend = true;
      this.scene.add(this.sky);
    }
    const U = this.sky.material.uniforms;
    U.sunDir.value.set(...(T.sunDir || [-0.3, 0.25, -1])).normalize(); U.glow.value = T.night ? 0.3 : 1;
    this._mountains(T);
    if (this.stars) this.stars.visible = !!this.night;
    else if (this.night) {     // نجوم
      const N = 420, P = new Float32Array(N * 3), r = rnd(99);
      for (let k = 0; k < N; k++) { const a = r() * Math.PI * 2, e = 0.08 + r() * 1.4, R = 860; P[k * 3] = Math.cos(a) * Math.cos(e) * R; P[k * 3 + 1] = Math.sin(e) * R; P[k * 3 + 2] = Math.sin(a) * Math.cos(e) * R; }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(P, 3));
      this.stars = new THREE.Points(g2, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 })); this.stars.frustumCulled = false; this.stars.renderOrder = -9; this.sky.add(this.stars);
    }
  }
  // ---------------------------------------------------------------- جبال الحجر العُمانية: طبقتان متدرجتان تتبعان الكاميرا (بلا تكلفة تُذكر)
  _mountains(T) {
    const fog = new THREE.Color(T.fog);
    const layer = (R, depth, hMin, hMax, seed, rock, peak, haze) => {
      const N = 360, ROWS = 6, P = [], C = [], I = [];
      const ph = [1.3, 2.1, 0.4, 3.3, 5.1, 0.9].map((v) => v + seed);
      const F = [3, 7, 13, 29, 61, 113], A = [1, 0.55, 0.32, 0.17, 0.08, 0.04];
      const hAt = (t) => { let v = 0, sum = 0; for (let o = 0; o < F.length; o++) { const rr = 1 - Math.abs(Math.sin(F[o] * t * 0.5 + ph[o])); v += A[o] * rr * rr; sum += A[o]; } return hMin + (hMax - hMin) * Math.pow(v / sum, 1.25); };
      // جهة البحر بلا جبال: الأفق هناك ماء وسماء
      const sd = T.env && T.env.sea ? T.env.sea.side : 0;
      const open = (t) => { if (!sd) return 1; const v = THREE.MathUtils.smoothstep(Math.sin(t) * sd, -0.12, 0.3); return 1 - v * 0.97; };
      const hs = []; for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI * 2; hs.push(hAt(t) * open(t)); }
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
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
      m.frustumCulled = false; m.renderOrder = -8; m.userData.noBend = true;
      return m;
    };
    this.mountains = new THREE.Group();
    const E = T.env || {}, mc = E.mount || ['#7a6555', '#94796a', '#5f4a3d', '#937a68'], mk = E.mountK || 1;
    this.mountains.add(layer(640, 60, 60 * mk, 160 * mk, 4.2, this._tc(mc[0]), this._tc(mc[1]), 0.34));   // السلسلة البعيدة (أفتح وأكثر ضبابًا)
    this.mountains.add(layer(500, 70, 26 * mk, 105 * mk, 1.7, this._tc(mc[2]), this._tc(mc[3]), 0.14));    // التلال الأقرب (صخرية داكنة)
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
    this.ground = new THREE.Mesh(g, dipMaterial(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.02; this.ground.receiveShadow = true;
    this.ground.userData.len = SPAN + 200; this.root.add(this.ground);
    const SE = T.env && T.env.sea;
    if (SE) {                                   // بحر على جهة واحدة: كورنيش مبلّط (prom) أو شاطئ رملي
      const sd = SE.side, edge = ROAD_W / 2 + SE.edge, w = edge - ROAD_W / 2 - 5.7;
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, SPAN + 300, 40, 120), dipMaterial(new THREE.MeshPhysicalMaterial({ color: SE.color, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 })));
      sea.rotation.x = -Math.PI / 2; sea.position.set(sd * (edge + 600), -0.6, 0); sea.userData.len = SPAN + 300; this.root.add(sea); this.sea = sea;
      this.ground.position.x = -sd * (700 - edge - 0.5);                       // الأرض تنتهي عند حافة البحر
      const stripTex = SE.prom ? tex(128, 128, (x, w, h) => { x.fillStyle = '#d7a596'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c58d7e'; x.lineWidth = 2; for (let i = 0; i <= w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }, true)
        : tex(128, 128, (x, w, h) => { x.fillStyle = SE.sand || '#e3d3ae'; x.fillRect(0, 0, w, h); const r = rnd(5); for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${r() > 0.5 ? 255 : 90},${r() > 0.5 ? 250 : 80},${r() > 0.5 ? 230 : 60},0.07)`; x.fillRect(r() * w, r() * h, 2, 2); } }, true);
      stripTex.repeat.set(Math.max(1, w / 4), (SPAN + 160) / 4);
      const prom = new THREE.Mesh(new THREE.BoxGeometry(w + (SE.prom ? 0 : 1.2), SE.prom ? 0.16 : 0.1, SPAN + 160, 1, 1, 120), dipMaterial(new THREE.MeshStandardMaterial({ map: stripTex, roughness: 0.95 })));
      prom.position.set(sd * (ROAD_W / 2 + 5.7 + w / 2), SE.prom ? 0.06 : 0.0, 0); prom.receiveShadow = true; prom.userData.len = SPAN + 160; this.root.add(prom); this.walks.push(prom); this.strip = prom;
    }
    if (this.env === 'coast') {                 // البحر على اليسار
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
      k.position.set(sg * (ROAD_W / 2 + 0.35), 0.04, 0); k.receiveShadow = true; this.root.add(k); this.kerbs.push(k);
      const sideCol = T.side === 'pavers' ? '#d8c7a6' : T.side === 'sidewalk' ? '#a9adb3' : T.side === 'beach' ? '#e3cf9f' : '#cdb07c';
      const sw = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, L, 1, 1, 220), new THREE.MeshStandardMaterial({ color: sideCol, roughness: 0.95 }));
      sw.position.set(sg * (ROAD_W / 2 + 0.7 + 2.5), 0.05, 0); sw.receiveShadow = true; this.root.add(sw); this.walks.push(sw);
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
      const o = compact(it.make(it.side)); const side = it.side, opt = it.opt || {};
      o.position.set(side * (ROAD_W / 2 + it.setback), it.y || 0, -it.off); if (side > 0) o.rotation.y = Math.PI;
      if (it.cine) { o.userData.cine = it.cine; o.userData.ckey = `${this.env}:${o.name}:${it.off}`; } if (opt.slide) o.userData.slide = opt.slide;
      if (it.scale) o.scale.setScalar(it.scale);
      o.userData.z0 = -it.off; this.root.add(o); objs.push(o);
      const half = opt.zone || (o.userData.half || 10) * (it.scale || 1) + 4;
      if (!(it.y < 0)) for (const sd of side ? [side] : [-1, 1]) this.zones.push({ off: it.off, half, side: sd, C, near: true });
      if (o.userData.radio) this.radioSpots.push({ obj: o, side, x: o.position.x });
    }
    this.track = { C, objs };
  }
  /** هل موضع z على الجهة side محجوز لمعلم؟ (لتجنّب تداخل المباني المكرّرة مع المعالم) */
  _blocked(z, side) {
    for (const Z of this.zones) { if (Z.side !== side || !Z.near) continue; const d = (((z + Z.off) % Z.C) + Z.C) % Z.C; if (d < Z.half || d > Z.C - Z.half) return true; }
    return false;
  }
  /** أقرب معلم أمام السائق له لقطة سينمائية لم تُعرض بعد في هذه المسابقة (extra: مدى إضافي للتخطيط المسبق) */
  _cinePending(z, extra) {
    let best = null;
    for (const o of [...(this.old && this.old.track ? this.old.track.objs : []), ...(this.track ? this.track.objs : [])]) {
      const U = o.userData; if (!U.cine || U.gone || !o.visible || this.cineSeen.has(U.ckey)) continue;
      const a = z - o.position.z;
      if (a > 45 && a < this.cineRange(o) + extra && (!best || a < best.a)) best = { o, a };
    }
    return best && best.o;
  }
  cineRange(o) { return 150 + (o.userData.half || 10) * 0.5; }
  cineTarget(z) { return this._cinePending(z, 0); }
  cineAhead(z) { return this._cinePending(z, 75); }
  /** يضع محل المذياع على الرصيف عند z في الجهة side (لا يتقاطع مع المباني لأنه أمامها) */
  placeBreakKiosk(z, side) {
    const o = this.breakKiosk; if (!o || this._bridgeAt(z) || this._bridgeAt(z + 30) || this._bridgeAt(z - 30)) return;
    o.position.set(side * (ROAD_W / 2 + 6.4), 0, z); o.rotation.y = side > 0 ? Math.PI : 0; o.visible = true;
    Object.assign(this.breakSpot, { side, x: o.position.x, played: null });
  }
  _portraitTex(file) { const t = new THREE.TextureLoader().load(`./assets/img/landmarks/${file}`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
  _omani(name, r, pick, T) {
    const E = T.env || {}, U = { uT: this.flagTime, uWind: this.flagWind };
    // مصنع المعالم: الاسم في بيانات المحطة ← الدالة التي تبنيه
    const M = {
      twin: () => portraitStand(this._portraitTex('portrait-sultans.jpg'), 1489 / 1312, U),
      haitham: () => portraitStand(this._portraitTex('portrait-haitham.jpg'), 1140 / 570, U),
      kiosk: radioKiosk, fort: () => fortHill(1), souq: souqGate, mosque: grandMosque, ministry: () => educationMinistry(U),
      flagpole: () => giantFlagpole(U), ship: tallShip, dhow: () => dhow(false), dhowYard: () => dhow(true),
      sahwa: () => sahwaTower(U, true), bridge: () => suspBridge(ROAD_W, E.sea ? E.sea.color : 0x1f9fb4), castle: () => fortCastle(U), port: portCranes, blueMosque, lighthouse,
      gate: () => muscatGate(ROAD_W), cruise: cruiseShip,
      // لوحات الطريق الوطنية (الصور الرسمية التي زوّدنا بها المعلم كما هي)
      bbQ: (sd) => billboard(this._portraitTex('portrait-qaboos.jpg'), 16 / 9, sd), bbH: (sd) => billboard(this._portraitTex('portrait-haitham.jpg'), 1140 / 570, sd),
    };
    this._landmarks(E.C || 900, (E.marks || []).filter((m) => M[m[0]]).map(([k, off, side, setback, scale, y, cine, opt]) => ({ make: M[k], off, side, setback: setback || 0, scale, y, cine, opt })));
    const seaSide = E.sea ? E.sea.side : 0;
    // مبانٍ مكرّرة: واجهات حجرية بنوافذ مقوّسة + بيوت مسقط البيضاء بشرفات مسننة
    const B = E.build || { sides: [-1, 1], stone: 12, white: 12, every: 36 };
    const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
    const merl = []; for (let k = 0; k < 7; k++) { const m = new THREE.BoxGeometry(0.07, 0.07, 0.09); m.translate(0.5 - 0.035, 1.035, -0.45 + k * 0.15); merl.push(m); }
    const house = mergeGeos([bGeo, ...merl]);
    const tints = ['#ffffff', '#f6efe2', '#efe3cc', '#fbf6ee', '#eadcc4'].map((c) => new THREE.Color(c));
    for (const sg of B.sides) {
      // المبنى يُخفى إذا مسّ أي جزء منه (لا مركزه فقط) نطاق معلم أو لوحة — فلا يتداخل مبنى مع معلم
      const hide = (t) => { const z = t.position.z; if (this._blocked(z, sg) || this._blocked(z + 10, sg) || this._blocked(z - 10, sg)) t.scale.setScalar(0.0001); };
      if (B.stone) {
        const facMat = new THREE.MeshStandardMaterial({ map: tex(512, 512, (x, w, h) => omaniFacade(x, w, h), true), roughness: 0.85 });
        const a = this._pool(bGeo, facMat, B.stone, (t, i, P) => {
          const w = 10 + r() * 7, d = 9 + r() * 6, hh = 8 + r() * 9;
          t.position.x = sg * (ROAD_W / 2 + 8 + w / 2 + r() * 3); t.scale.set(w, hh, d); if (sg > 0) t.rotation.y = Math.PI; P.im.setColorAt(i, pick(tints)); hide(t);
        }, { every: B.every, offset: sg > 0 ? 4 : B.every * 0.6 });
        a.im.instanceColor.needsUpdate = true;
      }
      if (B.white) this._pool(house, new THREE.MeshStandardMaterial({ map: muscatHouseTex(), roughness: 0.9 }), B.white, (t) => {
        const w = 9 + r() * 6, d = 8 + r() * 5, hh = 6 + r() * 5;
        t.position.x = sg * (ROAD_W / 2 + 7.5 + w / 2 + r() * 2 + (B.every > 60 ? r() * 14 : 0)); t.scale.set(w, hh, d); if (sg > 0) t.rotation.y = Math.PI; hide(t);
      }, { every: B.every, offset: sg > 0 ? B.every * 0.6 : 4 });
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
      if (this.night) {        // هالة الفانوس وبقعة الضوء على الطريق
        const soft = tex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#8a8a8a'); g.addColorStop(1, '#000000'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
        const add = (color, opacity, map) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
        const halo = mergeGeos([-1, 1].map((q) => { const g = new THREE.SphereGeometry(0.34, 10, 8); g.translate(q * 1.0, 6.22, 0); return g; }));
        this._pool(halo, add(0xffd48a, 0.45), 14, pl, { every: 30, offset: sg > 0 ? 0 : 15 });
        const spot = new THREE.PlaneGeometry(20, 20); spot.rotateX(-Math.PI / 2); spot.translate(0, 0.075, 0);
        this._pool(spot, add(0xffc27a, 0.42, soft), 14, (t) => { t.position.x = sg * (ROAD_W / 2 - 2.2); }, { every: 30, offset: sg > 0 ? 0 : 15 });
      }
    }
    // أحواض زهور: حوض حجري منخفض تعلوه كتلة زهور ملوّنة
    const rim = new THREE.BoxGeometry(1.2, 0.3, 4.2); rim.translate(0, 0.15, 0);
    const blooms = []; for (let k = 0; k < 9; k++) { const b = new THREE.SphereGeometry(0.34, 6, 5); b.scale(1, 0.62, 1); b.translate((H(k, 1) - 0.5) * 0.5, 0.42 + H(k, 2) * 0.08, -1.7 + k * 0.42); blooms.push(b); }
    const flowers = ['#e63958', '#f28aa6', '#ffffff', '#ffb703', '#c23fa0'].map((c) => new THREE.Color(c));
    for (const sg of E.beds || [-1, 1]) {
      const pl = (t) => { t.position.x = sg * (ROAD_W / 2 + 5.0); if (this._blocked(t.position.z, sg) && this._bridgeAt(t.position.z)) t.scale.setScalar(0.0001); };
      this._pool(rim, new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9 }), 16, pl, { every: 26, offset: sg > 0 ? 7 : 20 });
      const p = this._pool(mergeGeos(blooms), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), 16, (t, i, P) => { pl(t); P.im.setColorAt(i, pick(flowers)); }, { every: 26, offset: sg > 0 ? 7 : 20 });
      p.im.instanceColor.needsUpdate = true;
    }
    if (E.sea && E.sea.prom) {
      // مصدّ الأمواج: كتل خرسانية رباعية الأرجل على حافة البحر، وسور الكورنيش
      const ex = ROAD_W / 2 + E.sea.edge;
      const tp = []; for (const v of [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]) { const leg = new THREE.CylinderGeometry(0.18, 0.32, 1.1, 6); leg.translate(0, 0.55, 0); leg.lookAt(new THREE.Vector3(...v)); tp.push(leg); }
      this._pool(mergeGeos(tp), new THREE.MeshStandardMaterial({ color: 0xb9b5ab, roughness: 1, flatShading: true }), 90, (t) => { const z = t.position.z; t.position.x = seaSide * (ex + 0.1 + H(z, 3) * 2.2); t.position.y = -0.2 + H(z, 4) * 0.5; t.rotation.set(H(z, 5) * 6, H(z, 6) * 6, H(z, 7) * 6); }, { every: 4.8, offset: 1 });
      const rail = new THREE.BoxGeometry(0.12, 0.9, 3.6); rail.translate(0, 0.45, 0);
      this._pool(rail, new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.6 }), 120, (t) => { t.position.x = seaSide * (ex - 0.4); }, { every: 3.6 });
    }
    const PM = E.palms || { count: 28 };
    if (PM.count) this._palms(r, PM.count, 1, PM);
    for (const R of E.ridges || []) this._ridges(R[0], R[1], R[2], R[3], R[4], R[5]);
    if (E.bushes) {             // شجيرات خضراء كثيفة (جبال ظفار في الخريف)
      const g = new THREE.IcosahedronGeometry(1, 1); g.scale(1, 0.72, 1); g.translate(0, 0.5, 0);
      const cols = [E.bushes.color, '#5f9a45', '#3f7a35', '#6fa552'].map((c) => new THREE.Color(c));
      for (const sg of E.bushes.sides) {
        const p = this._pool(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), E.bushes.n, (t, i, P) => { const z = t.position.z, s = 1.3 + H(z, 8) * 2.6; t.position.x = sg * (E.bushes.near ? ROAD_W / 2 + E.sea.edge - 2.5 + H(z, 9) * E.bushes.near : ROAD_W / 2 + 8 + H(z, 9) * H(z, 9) * 34); t.scale.setScalar(s); t.rotation.y = H(z, 4) * 6; P.im.setColorAt(i, cols[i % cols.length]); if (this._blocked(z, sg)) t.scale.setScalar(0.0001); }, { every: 450 / E.bushes.n, offset: 3 });
        p.im.instanceColor.needsUpdate = true;
      }
    }
    if (E.rocks) {              // صخور مستديرة متناثرة (حديقة الصخور في الدقم)
      const g = new THREE.IcosahedronGeometry(1, 1);
      for (const sg of E.rocks.sides) this._pool(g, new THREE.MeshStandardMaterial({ color: 0xcfc2a4, roughness: 1, flatShading: true }), E.rocks.n, (t) => { const z = t.position.z, s = 0.8 + H(z, 8) * H(z, 8) * 3.4, far = sg === seaSide ? 9 : 30; t.position.x = sg * (ROAD_W / 2 + 7.5 + H(z, 9) * far); t.position.y = s * 0.45; t.scale.set(s * (0.9 + H(z, 2) * 0.5), s * (0.7 + H(z, 3) * 0.4), s); t.rotation.y = H(z, 4) * 6; if (this._blocked(z, sg)) t.scale.setScalar(0.0001); }, { every: 450 / E.rocks.n, offset: sg > 0 ? 5 : 14 });
    }
    // لافتتان فقط في كل محطة: اسمها عند مدخلها، واسم المحطة التالية في الرحلة بعد منتصفها (لا تكرار للّافتات)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b939c, roughness: 0.5, metalness: 0.6 });
    const J = this.journey, nextId = J && J.stops[J.i + 1], nx = nextId && nextId !== name ? STATIONS[nextId] : null;
    const short = (S) => [S.name.replace('مسقط – ', ''), S.en];
    const names = [short(T)].concat(nx ? [short(nx)] : []);
    const every = Math.max(380, (E.C || 900) / 2), objs = [];
    names.forEach(([ar, en], i) => {
      const g = new THREE.Group();
      const sideX = (seaSide > 0 ? -1 : 1) * (ROAD_W / 2 + 2.6);
      for (const dx of [-1.1, 1.1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.6, 8), postMat); post.position.set(sideX + dx, 2.3, 0); g.add(post); }
      const st = tex(512, 256, (x, w, h) => roadSign(x, w, h, ar, en));
      const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ map: st, roughness: 0.4 }));
      board.position.set(sideX, 4.0, 0.06); g.add(board);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.25, 1.65, 0.06), postMat); back.position.set(sideX, 4.0, 0); g.add(back);
      g.position.z = -i * every - 34; g.userData.z0 = g.position.z; this.root.add(g); objs.push(g);
    });
    this.movers.push({ objs, every, n: 2 });
  }
  /** هل z داخل نطاق معلم يعبر الطريق (الجسر)؟ */
  _bridgeAt(z) { return this._blocked(z, -1) && this._blocked(z, 1); }
  /** تلال صخرية قريبة على جهة واحدة: أشرطة تتكرر (تتداخل قليلًا لإخفاء الوصلات) */
  _ridges(side, x0, hMin, hMax, seed, pal) {
    const L = 210, every = 180, n = 4, objs = [];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(ridgeGeometry(L, 90, hMin, hMax, seed + i * 3.7, pal), mat);
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
  /** يعيد العناصر الجانبية إلى مواضعها الأولى ابتداءً من z = base (0 عند بدء سباق جديد) */
  rebase(base = 0) {
    this.base = base;
    for (const p of this.items) { for (let i = 0; i < p.n; i++) { p.z[i] = base - i * p.every - p.offset; this._place(p, i); } p.im.instanceMatrix.needsUpdate = true; if (p.im.instanceColor) p.im.instanceColor.needsUpdate = true; }
    for (const M of this.movers) for (const o of M.objs) o.position.z = base + o.userData.z0;
    if (this.track) for (const o of this.track.objs) o.position.z = base + o.userData.z0;
    if (this.breakKiosk) this.breakKiosk.visible = false;
  }
  reset() { this.rebase(0); }
  setFlag(on) { this.flagOn = !!on; for (const m of this.flags) m.visible = this.flagOn; }

  _palms(r, count, density, o = {}) {
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
    for (const sg of o.sides || [-1, 1]) {
      const n = Math.round(count * density / 2), every = SPAN / n, offset = sg > 0 ? 0 : 9;
      const pl = (t) => { const z = t.position.z; t.position.x = sg * (ROAD_W / 2 + (o.x0 || 4.5) + H(z, 1) * (o.spread || 2)); t.rotation.y = H(z, 2) * 6; t.scale.setScalar(this._blocked(z, sg) && (o.spread > 4 || this._bridgeAt(z)) ? 0.0001 : (0.8 + H(z, 3) * 0.5) * (o.sc || 1)); };
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
    const O = this.old;
    for (const m of [this.road, ...(this.kerbs || []), ...(this.walks || [])]) if (m) m.position.z = ahead;
    // أرض المحطة الجديدة وبحرها يبدآن من الحد (ما دامت المحطة السابقة أمام السائق) ثم يتبعانه
    for (const m of [this.ground, this.sea, this.strip]) if (m) m.position.z = O ? Math.min(ahead, O.zb - m.userData.len / 2) : ahead;
    if (this.roadTex) this.roadTex.offset.y = -(ahead % 12) / 12;
    if (this.kerbTex) this.kerbTex.offset.y = -(ahead % 8) / 8;
    if (this.ground.material.map) this.ground.material.map.offset.y = -(this.ground.position.z % 10) / 10;
    if (O) {
      this._env(1 - THREE.MathUtils.smoothstep(z, O.zb - 40, O.zb + 240));       // الجو يتدرج قبل الحد وبعده بقليل
      if (z < O.zb - 80) { this._dropOld(); if (this.queued != null) { const k = this.queued; this.queued = null; this.beginTravel(k, z); } }
    }
    // تدوير العناصر الجانبية
    for (const p of this.items) {
      let dirty = false;
      for (let i = 0; i < p.n; i++) {
        if (p.z[i] > z + 30) { p.z[i] -= p.n * p.every; this._place(p, i); dirty = true; }
      }
      if (dirty) { p.im.instanceMatrix.needsUpdate = true; if (p.im.instanceColor) p.im.instanceColor.needsUpdate = true; }
    }
    for (const M of this.movers) for (const o of M.objs) if (o.position.z > z + 30) o.position.z -= M.n * M.every;
    let dipZ = 1e7, dipH = 60, dipD = 0, bx = 0, busy = 0;
    const each = (o, live) => {
      const U = o.userData;
      if (live && o.position.z > z + (U.half || 0) + 80) o.position.z -= this.track.C;
      o.visible = !U.gone && o.position.z > z - SPAN - 20;   // المعالم البعيدة جدًا (خلف الضباب) لا تُرسم: توفير في عدد أوامر الرسم
      const a = z - o.position.z;                            // a موجب: المعلم أمام السائق
      if (U.slide) {         // الدوّار: الميدان يظهر في منتصف الطريق من بعيد، ثم ينحرف الطريق يمينًا ويدور حوله (الميدان عن يسار السائق)
        o.position.x = -U.slide * (1 - THREE.MathUtils.smoothstep(a, 80, 200));
        bx += 0.0015 * bell(a, 150, 55) - 0.0032 * bell(a, 15, 70); busy = Math.max(busy, bell(a, 60, 150));
      }
      if (U.dip && !U.gone && Math.abs(a) < Math.abs(z - dipZ)) { dipZ = o.position.z; dipH = U.dip.half; dipD = U.dip.depth; busy = Math.max(busy, bell(a, 40, 190)); }
    };
    if (this.old && this.old.track) for (const o of this.old.track.objs) each(o, false);
    if (this.track) for (const o of this.track.objs) each(o, true);
    BEND.uDip.value.set(dipZ, dipH, dipD); BEND.uCarP.value = roadHeight(z);    // الجسر: صعود حقيقي ثم سطح مستوٍ ثم هبوط
    this.flagTime.value += dt || 0.016;
    this.sky.position.copy(camera.position);
    // الشمس والظل يتبعان السائق
    this.carLight.position.set(camera.position.x * 0.5, 3.6, z - 2.5);
    const sp = this.sunPos || [-8, 14, 6]; this.sun.position.set(sp[0], sp[1], z + sp[2]); this.sun.target.position.set(0, 0, z - 4);
    // انحناء العالم: يتغير ببطء (منعطفات وتلال متتالية)
    BEND.uCamZ.value = camera.position.z;
    const d = -z;
    const RD = (this.T && this.T.road) || [1, 1], calm = 1 - busy;     // لكل محطة شدّة منعطفاتها وتلالها (طرق جبلية ملتوية / طرق سهلية مستقيمة)
    BEND.uBendX.value = RD[0] * calm * (0.0009 * Math.sin(d / 260) + 0.0005 * Math.sin(d / 97 + 1.3)) + bx;
    BEND.uBendY.value = -0.0006 + RD[1] * calm * 0.0005 * Math.sin(d / 180 + 0.7);
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
