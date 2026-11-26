// =====================================================================
//  «العالم المنحني»: إزاحة رؤوس كل شيء بعيد عن الكاميرا إزاحة تربيعية بحسب المسافة أمامها، فيبدو الطريق
//  ملتويًا صاعدًا ونازلًا ومنعطفًا يمينًا ويسارًا، بينما يبقى منطق اللعبة على خط مستقيم (المسارات والبوابات دقيقة).
//  تُحقن في كل المواد مرة واحدة (onBeforeCompile) وتتحكم فيها uniforms مشتركة.
//
//  الجسور: للطريق «مقطع ارتفاع» حقيقي P(z) — صعود تدريجي ثم سطح مستوٍ ثم هبوط تدريجي. كل ما على الطريق (الطريق والأرصفة
//  والأعمدة والبوابات والجسر نفسه) يرتفع بمقدار P(z) − P(موضع المركبة)، والأرض والبحر ينخفضان بمقدار P(موضع المركبة)؛
//  فتبقى المركبة والكاميرا عند مستواهما في منطق اللعبة، ويرى السائق الطريق يصعد أمامه ثم الماء أسفله ثم الهبوط.
// =====================================================================
import * as THREE from 'three';
/** uDip: (موضع منتصف الجسر على z، نصف طول السطح المستوي، ارتفاع الجسر) — uCarP: ارتفاع الطريق عند موضع المركبة */
export const BEND = { uCamZ: { value: 0 }, uBendX: { value: 0 }, uBendY: { value: -0.0011 }, uDip: { value: new THREE.Vector3(1e7, 60, 0) }, uCarP: { value: 0 } };
export const RAMP = 70;                // طول منحدر الصعود/الهبوط بالمتر
/** ارتفاع الطريق عند z (نفس معادلة المظلِّل) */
export const roadHeight = (z) => { const D = BEND.uDip.value; return D.z * (1 - THREE.MathUtils.smoothstep(Math.abs(z - D.x), D.y, D.y + RAMP)); };

const chunk = (lift) => `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bwp = modelMatrix * mvPosition;
float bq = abs( bwp.z - uDip.x );
${lift}
float bdz = min( 0.0, bwp.z - uCamZ );
bwp.x += uBendX * bdz * bdz;
bwp.y += uBendY * bdz * bdz;
mvPosition = viewMatrix * bwp;
gl_Position = projectionMatrix * mvPosition;`;
const ROADSIDE = chunk(`bwp.y += uDip.z * ( 1.0 - smoothstep( uDip.y, uDip.y + ${RAMP}.0, bq ) ) - uCarP;`);
// الأرض والبحر: ينخفضان مع صعود المركبة، وتنخفض الأرض قليلًا تحت الجسر ليظهر الماء فوقها
const TERRAIN = chunk(`bwp.y -= uCarP + 3.2 * step( 0.001, uDip.z ) * ( 1.0 - smoothstep( uDip.y - 14.0, uDip.y + 34.0, bq ) );`);

/** يحقن الانحناء في مادة (يُتجاهل للمواد التي لا تستعمل project_vertex). terrain: مادة أرض/بحر */
export function bendMaterial(mat, terrain = false) {
  if (!mat || mat.userData.bent) return mat;
  mat.userData.bent = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    if (!sh.vertexShader.includes('#include <project_vertex>')) return;
    Object.assign(sh.uniforms, BEND);
    sh.vertexShader = 'uniform float uCamZ;\nuniform float uBendX;\nuniform float uBendY;\nuniform vec3 uDip;\nuniform float uCarP;\n' + sh.vertexShader.replace('#include <project_vertex>', terrain ? TERRAIN : ROADSIDE);
  };
  mat.customProgramCacheKey = () => (terrain ? 'bend2t' : 'bend2');
  mat.needsUpdate = true;
  return mat;
}
/** مادة أرض/بحر (لا ترتفع مع الجسور) */
export const dipMaterial = (mat) => bendMaterial(mat, true);
export function bendTree(obj) {
  obj.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints || o.isLine) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => bendMaterial(x)); } });
  return obj;
}
