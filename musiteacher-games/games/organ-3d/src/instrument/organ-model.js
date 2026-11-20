// =====================================================================
//  نموذج الأورج ثلاثي الأبعاد — إجرائي بالكامل (بلا ملفات نماذج خارجية، فلا حقوق مرتبطة بالنموذج).
//  التصميم: أورج إلكتروني تعليمي 61 مفتاحًا (كالأورج المدرسي في كتاب الصف الرابع) على حامل خشبي، ومقعد بيانو، ودواسة.
//  المقاسات حقيقية: عرض المفتاح الأبيض 23.5 مم، طوله 14 سم، الأسود 9 سم وأعلى من الأبيض بـ11.5 مم، سطح المفاتيح على ارتفاع 73.5 سم.
//
//  إحداثيات العالم: العازف يجلس عند z≈0 ووجهه نحو +z، و+x يسار العازف. النغمات تعلو نحو يمين العازف (−x).
//  إطار لوحة المفاتيح kb (يُستعمل لحركة الأصابع، بنفس اصطلاح لعبة الأكورديون):
//     x = نحو الأسفل داخل المفاتيح (سطح المفتاح الأبيض عند x=0، والخارج = −x)
//     y = على طول اللوحة (+y = يسار العازف = النغمات الأخفض)
//     z = على طول المفتاح من مقدّمته (جهة العازف، z=0) نحو الداخل (حيث المفاتيح السوداء)
//  ضغط المفتاح: دوران حول محور خلفي مخفي تحت لوحة التحكم (كالمفتاح الحقيقي)، فتنزل مقدّمته ويبقى خلفه مكانه تقريبًا.
// =====================================================================
import * as THREE from 'three';
import { KEYS, WHITE_COUNT, BLACK_OFFSET, pc, VOICES, noteName } from './organ-data.js';
import { SEAT } from '../../_shared/3d/character/seated-player.js';

export const DIM = {
  KW: 0.0235, WW: 0.0222, WL: 0.140, WT: 0.016,            // الأبيض: خطوة، عرض، طول، سماكة
  BW: 0.0108, BL: 0.090, BH: 0.0115, BT: 0.024,            // الأسود: عرض، طول، ارتفاع فوق الأبيض، سماكة كلية
  Y_KEY: 0.735, Z_FRONT: 0.37, OX: -0.05,                   // سطح الأبيض، مقدّمات البيض، إزاحة اللوحة نحو اليمين (دو الوسطى أمام العازف)
  CHEEK: 0.05, DEPTH: 0.355, BODY_H: 0.085,
  PIVOT_BACK: 0.105,                                        // بُعد محور دوران المفتاح خلف نهايته الظاهرة
  W_TRAVEL: 0.010, B_TRAVEL: 0.0085,                        // نزول مقدّمة المفتاح عند الضغط الكامل
};
DIM.SPAN = WHITE_COUNT * DIM.KW;                            // 0.846
DIM.BODY_W = DIM.SPAN + 2 * DIM.CHEEK;
DIM.BLACK_ZONE = DIM.WL - DIM.BL;                           // من مقدّمة الأبيض إلى بداية الأسود (5 سم)

// ---------- أدوات هندسة ----------
function rbox(dx, dy, dz, r = 0.002, seg = 2) {               // صندوق بحواف مستديرة، الأبعاد النهائية dx,dy,dz بالضبط
  r = Math.min(r, dx / 2 - 1e-4, dy / 2 - 1e-4, dz / 2 - 1e-4);
  const a = dz / 2 - r, b = dy / 2 - r;
  const s = new THREE.Shape(); s.moveTo(-a, -b); s.lineTo(a, -b); s.lineTo(a, b); s.lineTo(-a, b); s.lineTo(-a, -b);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, dx - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 1 });
  g.translate(0, 0, -(dx - 2 * r) / 2); g.rotateY(Math.PI / 2);
  return g;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData = { canvas: c, ctx: x };
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- الخامات ----------
function materials() {
  const woodTex = canvasTex(512, 512, (x, w, h) => {
    const R = rng(3); x.fillStyle = '#5a3a24'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const y = R() * h, a = 0.05 + R() * 0.12; x.strokeStyle = R() < 0.5 ? `rgba(30,16,8,${a})` : `rgba(140,96,60,${a})`; x.lineWidth = 0.6 + R() * 2.4; x.beginPath(); x.moveTo(0, y); for (let X = 0; X <= w; X += 32) x.lineTo(X, y + Math.sin(X * 0.01 + i) * 4 + (R() - 0.5) * 2); x.stroke(); }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  const grille = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#16171a'; x.fillRect(0, 0, w, h);
    for (let yy = 6; yy < h; yy += 10) for (let xx = (yy / 10) % 2 ? 6 : 11; xx < w; xx += 10) { x.fillStyle = '#050506'; x.beginPath(); x.arc(xx, yy, 3.2, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.arc(xx - 0.8, yy - 0.8, 1.2, 0, 7); x.fill(); }
  });
  return {
    ivory: new THREE.MeshPhysicalMaterial({ color: 0xf6f2e8, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
    ebony: new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    body: new THREE.MeshPhysicalMaterial({ color: 0x1d1f24, roughness: 0.45, metalness: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    panel: new THREE.MeshPhysicalMaterial({ color: 0x2a2d33, roughness: 0.38, metalness: 0.35 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.25, metalness: 0.85 }),
    felt: new THREE.MeshStandardMaterial({ color: 0x7a1420, roughness: 0.95 }),
    keybed: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 }),
    grille: new THREE.MeshStandardMaterial({ map: grille, roughness: 0.7, metalness: 0.2 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, color: 0xffffff, roughness: 0.55 }),
    woodDark: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x9a8070, roughness: 0.6 }),
    leather: new THREE.MeshPhysicalMaterial({ color: 0x1b1412, roughness: 0.55, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x5a4038) }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.85 }),
    btn: new THREE.MeshPhysicalMaterial({ color: 0x3a3e46, roughness: 0.4, clearcoat: 0.3 }),
    btnA: new THREE.MeshPhysicalMaterial({ color: 0xc8cdd4, roughness: 0.35, clearcoat: 0.4 }),
    led: new THREE.MeshStandardMaterial({ color: 0x40ff70, emissive: 0x30ff60, emissiveIntensity: 1.4 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xb01c24, roughness: 0.35, clearcoat: 0.5 }),
  };
}

// ---------- العلامة التجارية: نوتتان ذهبيتان + «Musi» فضي + «Teacher» ذهبي، بخط عريض أنيق وتدرّج معدني ----------
function brandTexture() {
  const W = 1024, H = 176;
  return canvasTex(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    const fam = '"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif';
    const silver = x.createLinearGradient(0, 30, 0, 140); silver.addColorStop(0, '#ffffff'); silver.addColorStop(0.45, '#d9dde3'); silver.addColorStop(0.55, '#aeb4bd'); silver.addColorStop(1, '#e9ecf0');
    const gold = x.createLinearGradient(0, 30, 0, 140); gold.addColorStop(0, '#fff1b8'); gold.addColorStop(0.45, '#e7bf55'); gold.addColorStop(0.55, '#b98a22'); gold.addColorStop(1, '#f2d27a');
    // شعار: نوتتان موصولتان (كروش مزدوجة)
    const nx = 70, ny = 112;
    x.save(); x.fillStyle = gold; x.strokeStyle = gold; x.lineWidth = 9;
    const head = (cx, cy) => { x.beginPath(); x.ellipse(cx, cy, 21, 15, -0.42, 0, Math.PI * 2); x.fill(); };
    head(nx, ny); head(nx + 62, ny - 14);
    x.beginPath(); x.moveTo(nx + 17, ny - 5); x.lineTo(nx + 17, 28); x.moveTo(nx + 79, ny - 19); x.lineTo(nx + 79, 14); x.stroke();
    x.beginPath(); x.moveTo(nx + 13, 26); x.lineTo(nx + 83, 12); x.lineTo(nx + 83, 30); x.lineTo(nx + 13, 44); x.closePath(); x.fill();
    x.restore();
    // النص
    x.textBaseline = 'alphabetic';
    x.font = `300 112px ${fam}`; const w1 = x.measureText('Musi').width;
    x.font = `700 112px ${fam}`; const w2 = x.measureText('Teacher').width;
    const x0 = 190, base = 128;
    x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 4; x.shadowOffsetY = 2;
    x.font = `300 112px ${fam}`; x.fillStyle = silver; x.fillText('Musi', x0, base);
    x.font = `700 112px ${fam}`; x.fillStyle = gold; x.fillText('Teacher', x0 + w1 + 4, base);
    x.shadowColor = 'transparent';
    // خط رفيع تحت الاسم
    const end = Math.min(W - 10, x0 + w1 + w2 + 8);
    const ul = x.createLinearGradient(x0, 0, end, 0); ul.addColorStop(0, 'rgba(231,191,85,0)'); ul.addColorStop(0.15, 'rgba(231,191,85,.9)'); ul.addColorStop(0.85, 'rgba(231,191,85,.9)'); ul.addColorStop(1, 'rgba(231,191,85,0)');
    x.fillStyle = ul; x.fillRect(x0, base + 16, end - x0, 4);
  });
}

// ---------- الشاشة (قوام يُعاد رسمه عند تغيير الصوت أو النغمة) ----------
function drawScreen(t, st) {
  const { canvas: c, ctx: x } = t.userData, w = c.width, h = c.height;
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd7c4'); g.addColorStop(1, '#7cbfa9'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,40,30,.06)'; for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1);
  x.fillStyle = '#0f2a22'; x.textBaseline = 'middle';
  x.font = '700 30px "DejaVu Sans Mono",monospace'; x.textAlign = 'left'; x.fillText(st.no || '001', 14, 30);
  x.font = '700 26px Tajawal,Tahoma,sans-serif'; x.fillText(st.en || '', 86, 30);
  x.textAlign = 'right'; x.font = '700 26px Tajawal,Tahoma,sans-serif'; x.direction = 'rtl'; x.fillText(st.ar || '', w - 14, 72); x.direction = 'ltr';
  x.textAlign = 'left'; x.font = '600 20px "DejaVu Sans Mono",monospace'; x.fillText('TEMPO ' + (st.tempo || 90), 14, 108);
  x.textAlign = 'right'; x.font = '700 24px Tajawal,Tahoma,sans-serif'; if (st.note) x.fillText('♪ ' + st.note, w - 14, 108);
  t.needsUpdate = true;
}

export function buildOrgan() {
  const M = materials();
  const root = new THREE.Group(); root.name = 'organ';
  const pickables = [];
  const add = (parent, mesh, x, y, z, part, extra = {}) => { mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); if (part) { mesh.userData = { part, ...extra }; pickables.push(mesh); } return mesh; };
  const { KW, WW, WL, WT, BW, BL, BH, BT, Y_KEY, Z_FRONT, OX, CHEEK, DEPTH, BODY_H, SPAN, BODY_W } = DIM;
  const zBack = Z_FRONT + DEPTH, yBot = Y_KEY - BODY_H;
  const inst = new THREE.Group(); inst.name = 'instrument'; inst.position.x = OX; root.add(inst);

  // ---------------- جسم الآلة ----------------
  // القاعدة السفلية (تحت المفاتيح وحتى الخلف)
  add(inst, new THREE.Mesh(rbox(BODY_W, BODY_H - 0.012, DEPTH + 0.016, 0.012, 3), M.body), 0, yBot + (BODY_H - 0.012) / 2, Z_FRONT - 0.016 + (DEPTH + 0.016) / 2, 'body');
  // لوحة التحكم الخلفية (أعلى من المفاتيح، مائلة قليلًا نحو العازف)
  const pz0 = Z_FRONT + WL + 0.006, pz1 = zBack, pd = pz1 - pz0;
  const panelShape = new THREE.Shape(); panelShape.moveTo(0, 0); panelShape.lineTo(pd, 0); panelShape.lineTo(pd, 0.058); panelShape.lineTo(0.012, 0.030); panelShape.lineTo(0, 0.026); panelShape.closePath();
  const pg = new THREE.ExtrudeGeometry(panelShape, { depth: BODY_W - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 1 });
  pg.translate(0, 0, -(BODY_W - 0.004) / 2); pg.rotateY(-Math.PI / 2);         // x(الشكل)=z العالم ، y=الأعلى
  const panel = add(inst, new THREE.Mesh(pg, M.panel), 0, Y_KEY - 0.012, pz0, 'body');
  const panelTopY = (zz) => Y_KEY - 0.012 + 0.030 + (0.058 - 0.030) * ((zz - pz0 - 0.012) / (pd - 0.012));   // ارتفاع سطح اللوحة عند عمق zz
  const panelSlope = Math.atan2(0.058 - 0.030, pd - 0.012);
  // وجنتا الطرفين
  for (const sx of [-1, 1]) add(inst, new THREE.Mesh(rbox(CHEEK - 0.004, 0.034, WL + 0.03, 0.008, 3), M.body), sx * (SPAN / 2 + CHEEK / 2), Y_KEY - 0.012 + 0.017, Z_FRONT - 0.012 + (WL + 0.03) / 2, 'body');
  // الحافة الأمامية تحت المفاتيح (key slip) وشريط معدني رفيع
  add(inst, new THREE.Mesh(rbox(SPAN + 0.004, 0.022, 0.016, 0.003), M.body), 0, Y_KEY - 0.006 - 0.011, Z_FRONT - 0.008, 'body');
  add(inst, new THREE.Mesh(new THREE.BoxGeometry(SPAN, 0.002, 0.0012), M.trim), 0, Y_KEY - 0.0075, Z_FRONT - 0.0158);
  // قاع المفاتيح المظلم (يخفي الفراغ بين المفاتيح) وشريط لبّاد أحمر عند نهايتها
  add(inst, new THREE.Mesh(new THREE.BoxGeometry(SPAN, 0.004, WL + 0.01), M.keybed), 0, Y_KEY - WT - 0.006, Z_FRONT + WL / 2);
  add(inst, new THREE.Mesh(new THREE.BoxGeometry(SPAN, 0.006, 0.006), M.felt), 0, Y_KEY + 0.002, Z_FRONT + WL + 0.003);

  // ---------------- لوحة التحكم: سماعتان، شاشة، أزرار، قرص الصوت، زر التشغيل، عجلة الطبقة ----------------
  const onPanel = (mesh, x, zz, lift, part, extra) => { const m = add(inst, mesh, x, panelTopY(zz) + lift, zz, part, extra); m.rotation.x = -panelSlope; return m; };
  const spkW = 0.16, spkD = 0.15, spkZ = pz0 + 0.04 + spkD / 2;
  for (const sx of [-1, 1]) {
    onPanel(new THREE.Mesh(rbox(spkW, 0.004, spkD, 0.0018), M.grille), sx * (BODY_W / 2 - 0.035 - spkW / 2), spkZ, 0.0018, 'speaker');
    onPanel(new THREE.Mesh(rbox(spkW + 0.006, 0.0016, spkD + 0.006, 0.0008), M.trim), sx * (BODY_W / 2 - 0.035 - spkW / 2), spkZ, 0.0003);
  }
  // الشاشة
  const scrTex = canvasTex(512, 136, () => {}); const scrSt = { no: VOICES[0].no, en: VOICES[0].en, ar: VOICES[0].ar, tempo: 90 }; drawScreen(scrTex, scrSt);
  const scrMat = new THREE.MeshStandardMaterial({ map: scrTex, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 0.45, roughness: 0.25 });
  const scrW = 0.16, scrD = 0.044, scrZ = pz0 + 0.075;
  onPanel(new THREE.Mesh(rbox(scrW + 0.016, 0.003, scrD + 0.014, 0.0015), M.rubber), 0.02, scrZ, 0.0012);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(scrW, scrD), scrMat); scr.rotation.set(-Math.PI / 2, 0, Math.PI);     // أعلى النص نحو الداخل: يُقرأ من مكان العازف
  const scrG = onPanel(new THREE.Group(), 0.02, scrZ, 0.0032); scrG.add(scr); scr.userData = { part: 'screen' }; pickables.push(scr);
  // أزرار الأصوات (يمين الشاشة من جهة العازف = −x) وأزرار الإيقاعات (يسارها)
  const btnGeo = rbox(0.016, 0.006, 0.011, 0.002);
  const voiceBtns = [];
  for (let i = 0; i < 10; i++) {
    const col = i % 5, row = Math.floor(i / 5), x = -0.085 - col * 0.022, zz = scrZ - 0.012 + row * 0.024;
    const m = onPanel(new THREE.Mesh(btnGeo, i < VOICES.length ? M.btnA : M.btn), x, zz, 0.003, 'voices', { voiceIndex: i < VOICES.length ? i : null });
    voiceBtns.push(m);
  }
  const rhythmBtns = [];
  for (let i = 0; i < 6; i++) { const col = i % 3, row = Math.floor(i / 3); rhythmBtns.push(onPanel(new THREE.Mesh(btnGeo, M.btn), 0.14 + col * 0.022, scrZ - 0.012 + row * 0.024, 0.003, 'rhythms')); }
  // تشغيل/إيقاف الإيقاع (زر أحمر)
  onPanel(new THREE.Mesh(rbox(0.02, 0.007, 0.013, 0.003), M.red), 0.215, scrZ - 0.012, 0.0035, 'rhythms');
  // أزرار السرعة − +
  for (const k of [0, 1]) onPanel(new THREE.Mesh(rbox(0.014, 0.006, 0.014, 0.003), M.btn), 0.205 + k * 0.022, scrZ + 0.012, 0.003, 'tempo');
  // زر التشغيل + لمبة، وقرص مستوى الصوت (يسار اللوحة من جهة العازف = +x)
  const pX = BODY_W / 2 - 0.035 - spkW - 0.035;
  onPanel(new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 24), M.btnA), pX, pz0 + 0.045, 0.003, 'power');
  const led = onPanel(new THREE.Mesh(new THREE.SphereGeometry(0.0022, 12, 8), M.led), pX, pz0 + 0.028, 0.001);
  const knob = onPanel(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.0135, 0.016, 32), M.rubber), pX, pz0 + 0.09, 0.008, 'volume');
  onPanel(new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.0012, 0.009), M.trim), pX, pz0 + 0.085, 0.0165);
  // عجلة تغيير الطبقة (يسار المفاتيح على اللوحة)
  const wheel = onPanel(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 32), M.rubber), pX - 0.04, pz0 + 0.05, 0.006, 'wheel');
  wheel.rotation.set(0, 0, Math.PI / 2);
  // ---------------- العلامة التجارية MusiTeacher ----------------
  // مطبوعة بحبر معدني على جسم الآلة (فضي + ذهبي) كعلامات الأورج الحقيقية: على لوحة التحكم خلف المفاتيح مباشرة (تُقرأ من مكان العازف
  // ومن زوايا الكاميرا المعتادة) وعلى ظهر الآلة (تُرى من جهة الطلاب). جزء من سطح الجسم (لا لوحة عائمة) فتتبع الكاميرا والإضاءة طبيعيًا.
  const brandTex = brandTexture();
  const brandMat = new THREE.MeshStandardMaterial({ map: brandTex, transparent: true, alphaTest: 0.04, metalness: 0.2, roughness: 0.38, emissive: 0xffffff, emissiveMap: brandTex, emissiveIntensity: 0.38, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  const BR_W = 0.17, BR_H = BR_W * brandTex.image.height / brandTex.image.width;
  const brand = new THREE.Mesh(new THREE.PlaneGeometry(BR_W, BR_H), brandMat); brand.rotation.set(-Math.PI / 2, 0, Math.PI); brand.renderOrder = 2;
  brand.userData = { part: 'body' }; pickables.push(brand); brand.castShadow = false;
  onPanel(new THREE.Group(), 0.02, pz0 + 0.032, 0.0042).add(brand);          // فوق سطح اللوحة مباشرة (الحافة الأمامية مستديرة وأعلى قليلًا)
  const brandBack = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22 * brandTex.image.height / brandTex.image.width), brandMat); brandBack.renderOrder = 2;
  add(inst, brandBack, 0, yBot + (BODY_H - 0.012) / 2, zBack + 0.0006, 'body'); brandBack.castShadow = false;
  // حامل النوتة (لوح شفاف داكن مائل) وكتاب نوتة مفتوح
  const rest = new THREE.Group(); rest.position.set(0.02, panelTopY(zBack - 0.025) + 0.004, zBack - 0.025); rest.rotation.x = 0.26; inst.add(rest);          // يميل للخلف بعيدًا عن العازف
  add(rest, new THREE.Mesh(rbox(0.56, 0.16, 0.005, 0.004), new THREE.MeshPhysicalMaterial({ color: 0x15161a, roughness: 0.2, clearcoat: 0.8, transparent: true, opacity: 0.8 })), 0, 0.08, 0, 'musicrest');
  add(rest, new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.012, 0.03), M.panel), 0, 0.006, -0.012, 'musicrest');
  // ورقة النوتة: تُرسم من بيانات التمرين الحالي (انظر teaching/score.js) — نوتة حقيقية لا زخرفة
  const sheet = canvasTex(1024, 512, (x, w, h) => { x.fillStyle = '#f7f3e8'; x.fillRect(0, 0, w, h); });
  sheet.generateMipmaps = true;
  const book = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.15), new THREE.MeshStandardMaterial({ map: sheet, roughness: 0.9 }));
  book.rotation.y = Math.PI; add(rest, book, 0, 0.082, -0.0032, 'musicrest');      // الكتاب على وجه الحامل المقابل للعازف

  // ---------------- المفاتيح ----------------
  const kb = new THREE.Group(); kb.name = 'keyboard';
  kb.position.set(0, Y_KEY, Z_FRONT); kb.rotation.z = -Math.PI / 2;                // x_l = −y العالم، y_l = +x العالم، z_l = +z العالم
  inst.add(kb);
  const keys = {};
  const whiteGeo = rbox(WT, WW, WL, 0.0016, 2), blackGeo = rbox(BT, BW, BL, 0.0014, 2);
  // مقدّمة البيض المستديرة قليلًا وجوانبها: صندوق واحد يكفي (الفراغات بين المفاتيح ظاهرة)
  const slotY = (slot) => (WHITE_COUNT / 2 - 0.5 - slot) * KW;                       // y_l لمنتصف خانة بيضاء (الأخفض عند +y)
  for (const k of KEYS) {
    const black = k.black, len = black ? BL : WL, thick = black ? BT : WT, wid = black ? BW : WW;
    const off = black ? (BLACK_OFFSET[pc(k.midi)] || 0) : 0;
    const y = slotY(k.slot + off);
    const topX = black ? -BH : 0;                                                    // سطح المفتاح (−x = الأعلى)
    const backZ = black ? WL - 0.002 : WL;                                           // نهاية المفتاح الظاهرة
    const pivot = new THREE.Group(); pivot.position.set(topX, y, backZ + DIM.PIVOT_BACK);
    const mat = black ? M.ebony : M.ivory;
    const m = new THREE.Mesh(black ? blackGeo : whiteGeo, mat);
    m.position.set(thick / 2, 0, -DIM.PIVOT_BACK - len / 2);
    m.castShadow = true; m.receiveShadow = true; m.userData = { part: black ? 'blackkey' : 'whitekey', keyId: k.id, midi: k.midi };
    pivot.add(m); kb.add(pivot); pickables.push(m);
    const zc = backZ - len / 2;                                                      // منتصف المفتاح على z_l
    const touchZ = black ? -len / 2 + 0.017 : -len / 2 + 0.024;                     // نقطة لمس الإصبع (إحداثيات شبكة المفتاح)
    const travel = black ? DIM.B_TRAVEL : DIM.W_TRAVEL, armLen = DIM.PIVOT_BACK + len;
    keys[k.id] = { id: k.id, midi: k.midi, black, slot: k.slot, slotEff: k.slot + off, mesh: m, pivot, base: mat, press: 0, ang: Math.asin(travel / armLen), zc, len, thick, wid, y, topX, touchZ };
  }

  // ---------------- الحامل الخشبي (جانبان ولوح خلفي منخفض — لا شيء أمام الركبتين) ----------------
  const stand = new THREE.Group(); stand.name = 'stand'; inst.add(stand);
  const sideH = yBot - 0.004, sideD = DEPTH - 0.03, sideZ = Z_FRONT + 0.012 + sideD / 2, sideX = BODY_W / 2 - 0.022;
  for (const sx of [-1, 1]) {
    add(stand, new THREE.Mesh(rbox(0.028, sideH, sideD, 0.004), M.wood), sx * sideX, sideH / 2, sideZ, 'stand');
    add(stand, new THREE.Mesh(rbox(0.05, 0.03, sideD + 0.08, 0.006), M.woodDark), sx * sideX, 0.015, sideZ - 0.02, 'stand');    // قدم أمامية ممتدة للتوازن
  }
  add(stand, new THREE.Mesh(rbox(BODY_W - 0.07, 0.30, 0.016, 0.003), M.wood), 0, 0.30, Z_FRONT + DEPTH - 0.035, 'stand');           // اللوح الخلفي
  add(stand, new THREE.Mesh(rbox(BODY_W - 0.07, 0.03, 0.05, 0.004), M.woodDark), 0, yBot - 0.02, Z_FRONT + DEPTH - 0.05, 'stand');   // دعامة علوية خلفية

  // ---------------- المقعد (مقعد بيانو بغطاء جلدي) ----------------
  const bench = new THREE.Group(); bench.name = 'bench'; root.add(bench);
  const bz = (SEAT.zFront + SEAT.zBack) / 2 + 0.01, bd = SEAT.zFront - SEAT.zBack + 0.03, bw = 0.66;
  add(bench, new THREE.Mesh(rbox(bw, 0.05, bd, 0.012, 3), M.leather), 0, SEAT.y - 0.025, bz, 'bench');
  add(bench, new THREE.Mesh(rbox(bw + 0.012, 0.03, bd + 0.012, 0.006), M.woodDark), 0, SEAT.y - 0.065, bz, 'bench');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(bench, new THREE.Mesh(rbox(0.04, SEAT.y - 0.08, 0.04, 0.006), M.woodDark), sx * (bw / 2 - 0.04), (SEAT.y - 0.08) / 2, bz + sz * (bd / 2 - 0.04), 'bench');
  for (const sz of [-1, 1]) add(bench, new THREE.Mesh(new THREE.BoxGeometry(bw - 0.1, 0.022, 0.02), M.woodDark), 0, 0.12, bz + sz * (bd / 2 - 0.04));

  // ---------------- دواسة الاستمرار (تحت القدم اليمنى) ----------------
  const pedal = new THREE.Group(); pedal.position.set(-0.13, 0, Z_FRONT + 0.13); root.add(pedal);
  add(pedal, new THREE.Mesh(rbox(0.08, 0.02, 0.15, 0.006), M.rubber), 0, 0.01, 0, 'pedal');
  const pedalTop = add(pedal, new THREE.Mesh(rbox(0.066, 0.012, 0.11, 0.004), M.trim), 0, 0.028, 0.012, 'pedal');
  pedalTop.rotation.x = 0.12;
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.13, 0.01, Z_FRONT + 0.21), new THREE.Vector3(-0.13, 0.004, Z_FRONT + 0.3), new THREE.Vector3(-0.2, 0.006, zBack - 0.02), new THREE.Vector3(-0.22, yBot - 0.05, zBack - 0.01), new THREE.Vector3(-0.22, yBot + 0.02, zBack - 0.004)]), 30, 0.003, 6), M.rubber);
  cable.castShadow = true; root.add(cable);

  // ---------------- الحالة والتفاعل ----------------
  root.updateMatrixWorld(true);
  function setKeyPress(id, v) { const k = keys[id]; if (!k) return; k.press = v; k.pivot.rotation.y = -k.ang * v; }
  const lit = new Map();
  function setLit(id, on = true, color = 0x35c5ff) {
    const k = keys[id]; if (!k) return;
    if (on) {
      if (!k.litMat) { k.litMat = k.base.clone(); k.litMat.emissive = new THREE.Color(color); }
      k.litMat.emissive.set(color); k.litMat.emissiveIntensity = k.black ? 1.1 : 0.55; k.mesh.material = k.litMat; lit.set(id, k);
    } else { k.mesh.material = k.base; lit.delete(id); }
  }
  function clearLit() { for (const id of [...lit.keys()]) setLit(id, false); }
  function setScreen(patch) { Object.assign(scrSt, patch); drawScreen(scrTex, scrSt); }
  function setVoiceLed(i) { voiceBtns.forEach((b, j) => { b.material = j === i ? M.led : (j < VOICES.length ? M.btnA : M.btn); }); }
  setVoiceLed(0);
  const W = (p) => kb.localToWorld(new THREE.Vector3(p[0], p[1], p[2]));
  return {
    root, kb, keys, pickables, DIM, M, slotY, setKeyPress, setLit, clearLit, setScreen, setVoiceLed,
    /** يعيد رسم ورقة النوتة على الحامل: draw(ctx, w, h) */
    drawSheet(draw) { const { canvas: c, ctx: x } = sheet.userData; x.fillStyle = '#f7f3e8'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = 'rgba(120,90,40,.10)'; x.fillRect(0, c.height - 6, c.width, 6); draw(x, c.width, c.height); sheet.needsUpdate = true; },
    /** نقطة منتصف الشاشة (لنظر العازف) */
    panelPoint() { return scr.getWorldPosition(new THREE.Vector3()); },
    musicRestPoint() { return book.getWorldPosition(new THREE.Vector3()); },
    keyTopWorld(id) { const k = keys[id]; return k.mesh.localToWorld(new THREE.Vector3(-k.thick / 2, 0, k.touchZ)); },
    W, setKnob(v) { knob.rotation.y = -2.4 + 4.8 * v; },
    labelFor: (midi, lang, oct) => noteName(midi, lang, oct),
  };
}
