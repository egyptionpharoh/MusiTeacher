// مواد الجلد والعينين والحاجبين والأسنان… ملف MakeHuman يأتي بلا صور قوام (ملفات الـ diffuse غير موجودة)،
// فنصنع المواد برمجيًا: لون بشرة قمحي، عينان بقزحية وبؤبؤ من ألوان الرؤوس، ولا نطلب أي ملف خارجي (لا 404).
import * as THREE from 'three';

const col = (hex) => new THREE.Color(hex);

function skin(hex, rough = 0.6) {
  return new THREE.MeshPhysicalMaterial({
    color: col(hex), roughness: rough, metalness: 0,
    sheen: 0.5, sheenRoughness: 0.5, sheenColor: col('#ff9a7a'),        // وهج خفيف يحاكي تبعثر الضوء تحت الجلد
    clearcoat: 0.05, clearcoatRoughness: 0.6,
  });
}

// كرتا العينين: قزحية خضراء بنقش شعاعي وحلقة داكنة وبؤبؤ، تُرسم لكل بكسل (لا لكل رأس) فيخرج البؤبؤ دائريًا ناعمًا
// رغم قلة رؤوس الشبكة. الاتجاه عن مركز كل كرة يُحسب مرة واحدة ويُحمل كسمة رأس، فيدور مع العين حين تدور عظمتها.
function paintEyes(mesh) {
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count;
  const cent = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
  for (let i = 0; i < n; i++) { const k = pos.getX(i) > 0 ? 'L' : 'R', c = cent[k]; c[0] += pos.getX(i); c[1] += pos.getY(i); c[2] += pos.getZ(i); c[3]++; }
  for (const k in cent) { const c = cent[k]; c[0] /= c[3]; c[1] /= c[3]; c[2] /= c[3]; }
  const dir = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = cent[pos.getX(i) > 0 ? 'L' : 'R'];
    let dx = pos.getX(i) - c[0], dy = pos.getY(i) - c[1], dz = pos.getZ(i) - c[2];
    const l = Math.hypot(dx, dy, dz) || 1; dir[i * 3] = dx / l; dir[i * 3 + 1] = dy / l; dir[i * 3 + 2] = dz / l;   // النظر للأمام = −y في فضاء الهندسة (Z للأعلى)
  }
  g.setAttribute('eyeDir', new THREE.BufferAttribute(dir, 3));
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 eyeDir;\nvarying vec3 vEyeDir;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeDir = eyeDir;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vEyeDir;
float eh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`).replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 d = normalize(vEyeDir);
  float ang = acos(clamp(-d.y, -1.0, 1.0));
  float az = atan(d.x, d.z);
  vec3 white = vec3(0.93, 0.90, 0.87), vein = vec3(0.89, 0.78, 0.75);
  vec3 iin = vec3(0.20, 0.36, 0.16), iout = vec3(0.03, 0.17, 0.10), gold = vec3(0.34, 0.30, 0.12);
  float t = clamp((ang - 0.15) / 0.40, 0.0, 1.0);
  float streak = 0.5 + 0.5 * sin(az * 17.0 + sin(az * 5.0) * 1.5);
  float fine = eh(vec2(floor(az * 40.0), floor(ang * 30.0)));
  vec3 iris = mix(iin, iout, smoothstep(0.0, 1.0, t));
  iris = mix(iris, gold, (1.0 - t) * 0.55 * streak);               // حلقة عسلية حول البؤبؤ تضيف عمقًا
  iris *= 0.82 + 0.3 * streak * 0.6 + 0.08 * fine;
  iris = mix(iris, vec3(0.02, 0.05, 0.05), smoothstep(0.46, 0.57, ang) * 0.85);   // حلقة الحافة الداكنة
  vec3 sclera = mix(white, vein, clamp((ang - 0.58) * 1.0, 0.0, 0.55));
  vec3 c = mix(iris, sclera, smoothstep(0.55, 0.60, ang));
  c = mix(c, vec3(0.012, 0.012, 0.014), 1.0 - smoothstep(0.135, 0.165, ang));       // البؤبؤ
  diffuseColor.rgb = c;
}`);
  };
  m.customProgramCacheKey = () => 'eyeIris';
  mesh.material = m;
}

export function applyMaterials(root, cfg = {}) {
  const log = [];
  let lashMesh = null, eyeMesh = null, browMesh = null, skinMesh = null;
  const tone = (cfg.skinTone || '#d09f82');
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name;
    if (/^Human$/.test(n)) {
      const slots = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.name);
      o.material = slots.map((nm) => {
        if (/nipple|genitals/.test(nm)) { const m = skin(tone); m.visible = false; return m; }     // لا يُرسم أبدًا
        if (/lips/.test(nm)) return skin('#b2625d', 0.42);
        if (/fingernails|toenails/.test(nm)) return skin('#e0b3a0', 0.3);
        return skin(tone);
      });
      skinMesh = o; log.push('body:' + slots.length);
    } else if (/eyebrow/.test(n)) { o.material = new THREE.MeshStandardMaterial({ color: col('#2a1b13'), roughness: 0.8, side: THREE.DoubleSide }); browMesh = o; }
    else if (/eyelashes/.test(n)) { o.material = new THREE.MeshStandardMaterial({ color: col('#140e0c'), roughness: 0.5, side: THREE.DoubleSide }); lashMesh = o; }
    else if (/teeth/.test(n)) { o.material = new THREE.MeshStandardMaterial({ color: col('#e9e2d4'), roughness: 0.35 }); }
    else if (/tongue/.test(n)) { o.material = new THREE.MeshStandardMaterial({ color: col('#b0605f'), roughness: 0.5 }); }
    else if (/high-poly/.test(n)) { paintEyes(o); eyeMesh = o; log.push('eyes'); }
    else if (/shoes/.test(n)) { o.material = new THREE.MeshStandardMaterial({ color: col('#2b201c'), roughness: 0.5 }); }
  });
  if (lashMesh && eyeMesh) log.push('lashes:' + rebuildLashes(lashMesh, eyeMesh));
  if (browMesh) log.push('brows:' + rebuildBrows(browMesh, skinMesh));
  return log;
}

// أهداب الشبكة بطاقات سوداء مصمتة (بلا قوام شفاف)؛ السفلية تُظهر خط كحل ثقيلًا تحت العين. نبقي العلوية فقط، ونُصغّر البطاقات قليلًا نحو حافة الجفن.
function trimLowerLashes(lash, eyes) {
  const ep = eyes.geometry.attributes.position, cent = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
  for (let i = 0; i < ep.count; i++) { const c = cent[ep.getX(i) > 0 ? 'L' : 'R']; c[0] += ep.getX(i); c[1] += ep.getY(i); c[2] += ep.getZ(i); c[3]++; }
  const g = lash.geometry, pos = g.attributes.position, idx = g.index;
  const get = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
  const nTri = (idx ? idx.count : pos.count) / 3, keep = [];
  for (let t = 0; t < nTri; t++) {
    const ids = idx ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
    const p = ids.map(get), cx = (p[0][0] + p[1][0] + p[2][0]) / 3, cz = (p[0][2] + p[1][2] + p[2][2]) / 3;
    const c = cent[cx > 0 ? 'L' : 'R'], ez = c[2] / c[3];
    if (cz >= ez - 0.0015) keep.push(...ids);
  }
  const removed = nTri - keep.length / 3;
  g.setIndex(keep);
  return removed;
}

// حواجب MakeHuman الأصلية: 192 مثلثًا منفصلًا (96 لكل حاجب) صُمّمت لتُرسم بقوام ألفا (صورة شعيرات) غير موجود في الملف،
// فتظهر مثلثات سوداء صلبة متناثرة بدل حاجب. نستعمل المثلثات كـ«خريطة» فقط: منها نستخرج لكل حاجب منحناه المركزي
// وسُمكه عند كل نقطة وسطحه (الإحداثيات والعمودي)، ثم نزرع عليه شعيرات رفيعة بكثافة منتظمة وباتجاه طبيعي
// (نحو الصدغ، مع ميل للأعلى عند جهة الأنف، والشعيرات العليا تميل للأسفل والسفلى للأعلى فتلتقي في المنتصف).
// الأوزان من أقرب مثلث أصلي (الحاجب مثبّت بالرأس)، فيتحرك معه.
function rebuildBrows(brow, skin, seed = 11) {
  const g = brow.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  let rs = seed; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const idx = g.index, nT = (idx ? idx.count : pos.count) / 3, tri = [];
  for (let t = 0; t < nT; t++) {
    const ids = idx ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
    const p = ids.map((i) => [pos.getX(i), pos.getY(i), pos.getZ(i)]);
    const c = [0, 1, 2].map((a) => (p[0][a] + p[1][a] + p[2][a]) / 3);
    let n = nrm(crs([p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]]));
    if (n[1] > 0) n = [-n[0], -n[1], -n[2]];                                   // السطح يواجه الأمام (−y)
    tri.push({ c, n, src: ids[0], side: c[0] > 0 ? 'L' : 'R' });
  }
  // لكل حاجب: شرائح عرضها ~2.5 مم على |x| (من الأنف إلى الصدغ): مركز (y,z)، العمودي، نصف السُّمك
  const curve = {};
  for (const side of ['L', 'R']) {
    const ts = tri.filter((q) => q.side === side), ax = ts.map((q) => Math.abs(q.c[0]));
    const x0 = Math.min(...ax), x1 = Math.max(...ax), nb = Math.max(6, Math.round((x1 - x0) / 0.0025));
    const bins = Array.from({ length: nb }, () => ({ y: 0, z: 0, n: [0, 0, 0], k: 0, zmin: 9, zmax: -9 }));
    ts.forEach((q, i) => {
      const b = bins[Math.min(nb - 1, Math.floor((ax[i] - x0) / (x1 - x0 + 1e-9) * nb))];
      b.y += q.c[1]; b.z += q.c[2]; b.k++; b.n = [b.n[0] + q.n[0], b.n[1] + q.n[1], b.n[2] + q.n[2]]; b.zmin = Math.min(b.zmin, q.c[2]); b.zmax = Math.max(b.zmax, q.c[2]);
    });
    const fill = bins.map((b) => (b.k ? { y: b.y / b.k, z: b.z / b.k, n: nrm(b.n), h: Math.max(0.0012, Math.min(0.0045, (b.zmax - b.zmin) / 2 + 0.0008)) } : null));
    for (let i = 0; i < nb; i++) if (!fill[i]) { const a = fill.slice(0, i).reverse().find(Boolean) || fill.find(Boolean), b = fill.slice(i).find(Boolean) || a; fill[i] = { y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, n: nrm([a.n[0] + b.n[0], a.n[1] + b.n[1], a.n[2] + b.n[2]]), h: (a.h + b.h) / 2 }; }
    const sm = fill.map((v, i) => { const a = fill[Math.max(0, i - 1)], c = fill[Math.min(nb - 1, i + 1)], w = (f) => (a[f] + 2 * v[f] + c[f]) / 4; return { y: w('y'), z: w('z'), h: w('h'), n: nrm([w0(a, v, c, 0), w0(a, v, c, 1), w0(a, v, c, 2)]) }; });
    function w0(a, v, c, k) { return (a.n[k] + 2 * v.n[k] + c.n[k]) / 4; }
    curve[side] = { x0, x1, nb, b: sm };
  }
  // سطح الجلد الحقيقي في منطقة الحاجبين: مثلثات شبكة الجسم (وضع الراحة) المسقَطة على المستوى x–z؛ نأخذ أمامها (أصغر y)
  const sp = skin.geometry.attributes.position, sIdx = skin.geometry.index, skinTris = [];
  for (let t = 0; t < (sIdx ? sIdx.count : sp.count) / 3; t++) {
    const ids = sIdx ? [sIdx.getX(t * 3), sIdx.getX(t * 3 + 1), sIdx.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
    const p = ids.map((i) => [sp.getX(i), sp.getY(i), sp.getZ(i)]);
    if (p.some((q) => q[2] > 1.22 && q[2] < 1.31 && Math.abs(q[0]) < 0.075) && p.every((q) => q[1] < -0.04)) skinTris.push(p);
  }
  const surfaceAt = (x, z) => {
    let best = null;
    for (const [a, b, c] of skinTris) {
      const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d, v = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const y = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
      if (!best || y < best.y) {
        let n = nrm(crs([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); if (n[1] > 0) n = [-n[0], -n[1], -n[2]];
        best = { y, n };
      }
    }
    return best;
  };
  const P = [], N = [], U = [], I = [], SI = [], SW = [], COL = [], NS = 4;
  let hairs = 0, missed = 0;
  const srcTri = (side, x, z) => { let best = null, bd = 1e9; for (const q of tri) { if (q.side !== side) continue; const d = (Math.abs(q.c[0]) - x) ** 2 + (q.c[2] - z) ** 2; if (d < bd) { bd = d; best = q; } } return best; };
  for (const side of ['L', 'R']) {
    const cv = curve[side], sgn = side === 'L' ? 1 : -1, nh = 520;
    for (let hIdx = 0; hIdx < nh; hIdx++) {
      const t = Math.pow(rnd(), 0.9) * 0.985, f = t * cv.nb - 0.5, i0 = Math.max(0, Math.min(cv.nb - 2, Math.floor(f))), a = cv.b[i0], b = cv.b[i0 + 1], w = Math.max(0, Math.min(1, f - i0));
      const zc = a.z + (b.z - a.z) * w, yc = a.y + (b.y - a.y) * w, hh = (a.h + (b.h - a.h) * w) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.9)));
      let nn;
      const sb = cv.b[Math.max(0, i0 - 1)], sc = cv.b[Math.min(cv.nb - 1, i0 + 2)];
      const slope = Math.max(-0.9, Math.min(0.9, (sc.z - sb.z) / (((Math.min(cv.nb - 1, i0 + 2) - Math.max(0, i0 - 1)) || 1) * (cv.x1 - cv.x0) / cv.nb)));   // dz/d|x| (على أربع شرائح)
      const u = (rnd() * 2 - 1), x = cv.x0 + t * (cv.x1 - cv.x0), dz = u * hh;
      const qs = srcTri(side, x, zc + dz), xs = sgn * x, zz = zc + dz, sf = surfaceAt(xs, zz);
      if (!sf) { missed++; continue; }
      nn = sf.n;                                                                           // عمودي الجلد الحقيقي لا عمودي البطاقة
      const root = [xs + nn[0] * 0.0012, sf.y + nn[1] * 0.0012, zz + nn[2] * 0.0012];       // الشعر يرتفع عن الجلد قرابة 1.2 مم (الشبكة مضلّعة وتنحني بين الأوجه)
      const up = 0.85 * Math.pow(1 - t, 1.8), spread = -u * 0.38 * (1 - 0.5 * t);
      let d = nrm([sgn * 1, 0, slope + up + spread]);
      const dt = d[0] * nn[0] + d[1] * nn[1] + d[2] * nn[2]; d = nrm([d[0] - nn[0] * dt, d[1] - nn[1] * dt, d[2] - nn[2] * dt]);
      const tang = nrm(crs(nn, d)), lean = (rnd() - 0.5) * 0.10;
      const L = (0.0050 + 0.0030 * rnd()) * (1 - 0.35 * t), w0h = 0.00034 * (0.8 + 0.4 * rnd()) * (1 - 0.3 * t);
      const shade = 0.85 + 0.35 * rnd();
      let cur = root; const pts = [cur];
      for (let k = 1; k <= NS; k++) {
        const s = k / NS, dd = nrm([d[0] + tang[0] * lean + nn[0] * 0.30 * s, d[1] + tang[1] * lean + nn[1] * 0.30 * s, d[2] + tang[2] * lean + nn[2] * 0.30 * s]);
        cur = [cur[0] + dd[0] * L / NS, cur[1] + dd[1] * L / NS, cur[2] + dd[2] * L / NS]; pts.push(cur);
      }
      const src = qs.src, base = P.length / 3;
      for (let k = 0; k <= NS; k++) {
        const s = k / NS, hw = w0h * (1 - 0.75 * Math.pow(s, 1.2)), cm = shade * (0.82 + 0.3 * s);        // الطرف أفتح قليلًا
        for (const sg of [-1, 1]) {
          P.push(pts[k][0] + tang[0] * hw * sg, pts[k][1] + tang[1] * hw * sg, pts[k][2] + tang[2] * hw * sg); N.push(nn[0], nn[1], nn[2]); U.push(sg > 0 ? 1 : 0, s);
          COL.push(0.125 * cm, 0.077 * cm, 0.055 * cm);
          for (let z = 0; z < 4; z++) { SI.push(si.array[src * 4 + z]); SW.push(sw.array[src * 4 + z]); }
        }
        if (k < NS) { const i0b = base + k * 2; I.push(i0b, i0b + 1, i0b + 2, i0b + 1, i0b + 3, i0b + 2); }
      }
      hairs++;
    }
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ng.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  ng.setAttribute('color', new THREE.Float32BufferAttribute(COL, 3));
  ng.setAttribute('skinIndex', si.array.constructor === Uint16Array ? new THREE.Uint16BufferAttribute(SI, 4) : new THREE.Float32BufferAttribute(SI, 4));
  ng.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4)); ng.setIndex(I);
  g.dispose(); brow.geometry = ng;
  brow.material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  if (missed) console.warn('[brows] شعيرات بلا سطح جلد تحتها:', missed, 'من', hairs + missed);
  return hairs;
}

// أهداب MakeHuman الأصلية بطاقات صغيرة مصمتة (96 علوية و88 سفلية بلا قوام شفاف)، فتظهر خط كحل أسود عريضًا لا رموشًا.
// نستعمل مواضع البطاقات كجذور فقط، ونولّد منها رموشًا رفيعة منحنية مدببة الطرف (علوية أطول وأكثف عند الطرف الخارجي للعين، سفلية قصيرة قليلة)،
// ونحافظ على أوزان الهيكل العظمي من أقرب رأس أصلي، حتى تتبع الجفن في الرمش (Face._prepLids يحسبها من المواضع).
function rebuildLashes(lash, eyes, seed = 7) {
  const g = lash.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const ep = eyes.geometry.attributes.position, cg = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
  for (let i = 0; i < ep.count; i++) { const c = cg[ep.getX(i) > 0 ? 'L' : 'R']; c[0] += ep.getX(i); c[1] += ep.getY(i); c[2] += ep.getZ(i); c[3]++; }
  for (const k in cg) { const c = cg[k]; cg[k] = [c[0] / c[3], c[1] / c[3], c[2] / c[3]]; }
  let rs = seed; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const cards = [], nC = Math.floor(pos.count / 6), ext = { L: [9, -9], R: [9, -9] };
  for (let c = 0; c < nC; c++) {
    let x = 0, y = 0, z = 0; for (let j = 0; j < 6; j++) { x += pos.getX(c * 6 + j); y += pos.getY(c * 6 + j); z += pos.getZ(c * 6 + j); }
    x /= 6; y /= 6; z /= 6;
    const side = x > 0 ? 'L' : 'R', C = cg[side], upper = z >= C[2] - 0.0015;
    cards.push({ c, P: [x, y, z], side, C, upper });
    const e = ext[side], ax = Math.abs(x); e[0] = Math.min(e[0], ax); e[1] = Math.max(e[1], ax);
  }
  const P = [], N = [], U = [], I = [], SI = [], SW = [];
  const NS = 7, nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let hairs = 0;
  for (const cd of cards) {
    const e = ext[cd.side], t = Math.min(1, Math.max(0, (Math.abs(cd.P[0]) - e[0]) / Math.max(1e-6, e[1] - e[0])));   // 0 = الزاوية الداخلية، 1 = الخارجية
    const rel = [cd.P[0] - cd.C[0], 0, cd.P[2] - cd.C[2]], rr0 = nrm(rel), F = [0, -1, 0];
    // الاتجاه الشعاعي يتحول إلى «لأعلى/لأسفل» أكثر منه جانبيًا (الرموش الحقيقية تتجه للأمام والأعلى حتى عند الزوايا، لا نجمة شعاعية)
    const rr = nrm([rr0[0] * 0.45, 0, (cd.upper ? 1 : -1) * 0.9 + rr0[2] * 0.25]);
    const tang = nrm(crs(F, rr));                                                  // مماس حافة الجفن
    const n = cd.upper ? 4 : 0;                      // السفلية غير مرسومة: كانت تظهر شعيرات منفصلة عن حافة الجفن السفلي؛ الرموش السفلية الحقيقية شبه غير مرئية
    for (let h = 0; h < n; h++) {
      const off = (h - (n - 1) / 2) * 0.0011 + (rnd() - 0.5) * 0.0006;
      const root = [cd.P[0] + tang[0] * off - rr[0] * 0.0004, cd.P[1] + 0.0004 + tang[1] * off, cd.P[2] + tang[2] * off - rr[2] * 0.0004];
      const L = (cd.upper ? 0.0030 + 0.0040 * Math.pow(t, 0.9) : 0.0018 + 0.0012 * t) * (0.82 + 0.36 * rnd());
      const th0 = cd.upper ? 0.28 + 0.10 * rnd() : 0.20, th1 = cd.upper ? 0.95 + 0.20 * rnd() : 0.6, w0 = (cd.upper ? 0.00032 : 0.00022) * (0.85 + 0.3 * rnd());
      const lean = (rnd() - 0.5) * 0.18 * (cd.upper ? 1 : 0.5) + (cd.side === 'L' ? 1 : -1) * 0.12 * t;                          // ميل جانبي طفيف حتى لا تتوازى
      const pts = [root]; let cur = root;
      for (let k = 1; k <= NS; k++) {
        const s = (k - 0.5) / NS, th = th0 + (th1 - th0) * Math.pow(s, 1.25);
        const d = nrm([F[0] * Math.cos(th) + rr[0] * Math.sin(th) + tang[0] * lean, F[1] * Math.cos(th) + tang[1] * lean, F[2] * Math.cos(th) + rr[2] * Math.sin(th) + tang[2] * lean]);
        cur = [cur[0] + d[0] * L / NS, cur[1] + d[1] * L / NS, cur[2] + d[2] * L / NS]; pts.push(cur);
      }
      const base = P.length / 3, src = cd.c * 6;
      for (let k = 0; k <= NS; k++) {
        const s = k / NS, a = pts[Math.max(0, k - 1)], b = pts[Math.min(NS, k + 1)], d = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        const W = nrm(crs(d, rr)), nn = nrm(crs(W, d)), hw = w0 * (1 - 0.88 * Math.pow(s, 1.4));
        for (const sg of [-1, 1]) {
          P.push(pts[k][0] + W[0] * hw * sg, pts[k][1] + W[1] * hw * sg, pts[k][2] + W[2] * hw * sg); N.push(nn[0], nn[1], nn[2]); U.push(sg > 0 ? 1 : 0, s);
          for (let z = 0; z < 4; z++) { SI.push(si.array[src * 4 + z]); SW.push(sw.array[src * 4 + z]); }
        }
        if (k < NS) { const i0 = base + k * 2; I.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
      }
      hairs++;
    }
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ng.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  ng.setAttribute('skinIndex', new si.array.constructor(SI).constructor === Uint16Array ? new THREE.Uint16BufferAttribute(SI, 4) : new THREE.Float32BufferAttribute(SI, 4));
  ng.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4)); ng.setIndex(I);
  g.dispose(); lash.geometry = ng;
  return hairs;
}
