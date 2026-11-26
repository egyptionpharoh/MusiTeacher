// =====================================================================
//  «العالم المنحني»: إزاحة رؤوس كل شيء بعيد عن الكاميرا إزاحة تربيعية بحسب المسافة أمامها، فيبدو الطريق
//  ملتويًا صاعدًا ونازلًا ومنعطفًا يمينًا ويسارًا، بينما يبقى منطق اللعبة على خط مستقيم (المسارات والبوابات دقيقة).
//  تُحقن في كل المواد مرة واحدة (onBeforeCompile) وتتحكم فيها ثلاثة uniforms مشتركة.
// =====================================================================
export const BEND = { uCamZ: { value: 0 }, uBendX: { value: 0 }, uBendY: { value: -0.0011 } };

const CHUNK = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bwp = modelMatrix * mvPosition;
float bdz = min( 0.0, bwp.z - uCamZ );
bwp.x += uBendX * bdz * bdz;
bwp.y += uBendY * bdz * bdz;
mvPosition = viewMatrix * bwp;
gl_Position = projectionMatrix * mvPosition;`;

/** يحقن الانحناء في مادة (يُتجاهل للمواد التي لا تستعمل project_vertex) */
export function bendMaterial(mat) {
  if (!mat || mat.userData.bent) return mat;
  mat.userData.bent = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    if (!sh.vertexShader.includes('#include <project_vertex>')) return;
    Object.assign(sh.uniforms, BEND);
    sh.vertexShader = 'uniform float uCamZ;\nuniform float uBendX;\nuniform float uBendY;\n' + sh.vertexShader.replace('#include <project_vertex>', CHUNK);
  };
  mat.customProgramCacheKey = () => 'bend1';
  mat.needsUpdate = true;
  return mat;
}
export function bendTree(obj) {
  obj.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints || o.isLine) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(bendMaterial); } });
  return obj;
}
