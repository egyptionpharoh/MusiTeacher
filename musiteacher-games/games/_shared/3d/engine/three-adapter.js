// جسر بين مولّدات الهندسة الأصلية (مصفوفات p/n/t/i) وThree.js.
// يوفّر كائنًا بالواجهة نفسها التي كان يستخدمها Renderer القديم (mesh / texture)
// حتى تبقى دوال buildViolin وbuildBow وbuildVSetting كما هي دون إعادة كتابة.
import * as THREE from 'three';
import { F } from './math.js';

export function geoToBuffer(g) {
  const b = new THREE.BufferGeometry();
  const nv = g.p.length / 3;
  b.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
  if (g.n.length === g.p.length) b.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
  const t = g.t.length === nv * 2 ? g.t : new Array(nv * 2).fill(0);
  b.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2));
  b.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(g.i, 1) : new THREE.Uint16BufferAttribute(g.i, 1));
  if (g.n.length !== g.p.length) b.computeVertexNormals();
  b.computeBoundingSphere();
  return b;
}

// المادة القديمة {color, rough, spec, sheen, tex} → مادة PBR
export function materialFrom(spec) {
  const color = new THREE.Color().setRGB(spec.color[0], spec.color[1], spec.color[2], THREE.SRGBColorSpace);
  const metal = (spec.spec ?? 0) >= 1.05;                 // الفضة والأوتار المعدنية
  const varnish = !metal && (spec.spec ?? 0) >= 0.5 && (spec.rough ?? 1) <= 0.36;   // ورنيش الكمان والأبنوس
  const opts = {
    color, map: spec.tex || null,
    roughness: Math.min(1, Math.max(0.08, spec.rough ?? 0.6)),
    metalness: metal ? 0.85 : 0,
    side: THREE.DoubleSide,
  };
  if (varnish) return new THREE.MeshPhysicalMaterial({ ...opts, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  if ((spec.sheen ?? 0) > 0) return new THREE.MeshPhysicalMaterial({ ...opts, sheen: spec.sheen, sheenRoughness: 0.8, sheenColor: new THREE.Color(1, 1, 1) });
  return new THREE.MeshStandardMaterial(opts);
}

function floorFadeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 4;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#fff'); g.addColorStop(0.45, '#fff'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, 256, 4);
  return new THREE.CanvasTexture(c);
}

// كائن متوافق مع Renderer القديم: R.mesh(geo, mat, opt) و R.texture(canvas, repeat)
export class LegacyBuilder {
  constructor(parent, renderer) {
    this.parent = parent; this.renderer = renderer; this.meshes = [];
    this.shadowDirty = false;
  }
  texture(canvas, repeat) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 1;
    return t;
  }
  mesh(geo, matSpec, opt = {}) {
    let mat = matSpec._three;
    if (!mat) { mat = materialFrom(matSpec); matSpec._three = mat; }
    if (opt.floor) {
      mat = mat.clone(); mat.alphaMap = floorFadeTexture(); mat.transparent = true; mat.depthWrite = false;
    }
    const m = new THREE.Mesh(geoToBuffer(geo), mat);
    m.name = opt.name || '';
    m.castShadow = opt.cast !== false && !opt.floor;
    m.receiveShadow = true;
    if (opt.model) setMatrix(m, opt.model);
    if (opt.floor) m.renderOrder = -1;
    this.parent.add(m); this.meshes.push(m);
    return m;
  }
}

// مصفوفة عمودية (Float32Array(16)) من المحرك القديم → مصفوفة الكائن
export function setMatrix(obj, colMajor) {
  obj.matrixAutoUpdate = false;
  obj.matrix.fromArray(colMajor);
  obj.matrixWorldNeedsUpdate = true;
}
export function setFrame(obj, frame) { setMatrix(obj, F.mat(frame)); }
