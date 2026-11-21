// =====================================================================
//  «تماريني»: حفظ تمارين المعلم في المتصفح، مع نسخة احتياطية تلقائية والتحقق من كل كتابة،
//  وتصدير/استيراد ملف JSON (حتى لا تضيع التمارين عند مسح بيانات المتصفح أو تغيير الجهاز).
//  التمرين يُخزَّن شبكةً (خانات) ويُحوَّل إلى مدوّنة عند العرض؛ التمارين الأصلية في اللعبة لا تُمسّ أبدًا.
// =====================================================================
import { unitsPerBar, unitsPerBeat, parsePattern } from './rhythms.js';

const KEY = 'perc3d.myExercises.v1', BAK = KEY + '.bak';
export const METERS = [[2, 4], [3, 4], [4, 4], [6, 8]];
export const RES = { 4: 'نوار', 2: 'كروش', 1: 'دوبل كروش' };

let lastError = '';
export const storeError = () => lastError;
function parseList(txt) { const a = JSON.parse(txt || '[]'); if (!Array.isArray(a)) throw new Error('bad'); return a.filter((x) => x && x.id && Array.isArray(x.bars)); }
export function loadMine() {
  lastError = '';
  try { return parseList(localStorage.getItem(KEY)); } catch (e) {
    try { const b = parseList(localStorage.getItem(BAK)); lastError = 'تعذّرت قراءة التمارين المحفوظة فاستُعيدت آخر نسخة احتياطية.'; return b; } catch (e2) { lastError = 'تعذّرت قراءة التمارين المحفوظة في هذا المتصفح.'; return []; }
  }
}
/** يحفظ القائمة ويتحقق أن ما كُتب هو ما قُرئ؛ يعيد true/false ولا يبتلع الخطأ بصمت */
export function saveMine(list) {
  lastError = '';
  const txt = JSON.stringify(list);
  try {
    const prev = localStorage.getItem(KEY); if (prev != null) localStorage.setItem(BAK, prev);
    localStorage.setItem(KEY, txt);
    if (localStorage.getItem(KEY) !== txt) throw new Error('verify');
    return true;
  } catch (e) {
    lastError = e && e.name === 'QuotaExceededError' ? 'مساحة التخزين في المتصفح ممتلئة؛ لم يُحفظ التغيير. صدّر تمارينك ملفًا ثم احذف بعضها.' : 'لم يُحفظ التغيير: المتصفح يمنع التخزين المحلي (ربما وضع التصفح الخاص). صدّر تمارينك ملفًا حتى لا تضيع.';
    return false;
  }
}
export const newId = () => 'my_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** شبكة فارغة */
export function emptyGrid(meter, res, bars = 1) { const n = unitsPerBar(meter) / res; return Array.from({ length: bars }, () => Array.from({ length: n }, () => null)); }

/** الشبكة → مدوّنة بصيغة D/T/K/R مع العوارض داخل كل نبضة */
export function gridToPattern(ex) {
  const { meter, res } = ex, upb = unitsPerBeat(meter), per = upb / res;
  const OK = new Set([1, 2, 3, 4, 6]);
  const split = (d) => { const out = []; while (d > 0) { const c = [6, 4, 3, 2, 1].find((v) => v <= d); out.push(c); d -= c; } return out; };
  return ex.bars.map((bar) => {
    const beats = [];
    for (let b = 0; b < bar.length / per; b++) {
      const cells = bar.slice(b * per, b * per + per), toks = [];
      let i = 0;
      while (i < cells.length) {
        const c = cells[i];
        if (c && c.k) {
          let j = i + 1; while (j < cells.length && !(cells[j] && cells[j].k)) j++;
          let d = (j - i) * res; while (!OK.has(d)) d -= res;           // تمتد العلامة على السكتات التالية في النبضة نفسها
          toks.push(`${c.k}${d}${c.acc ? '>' : ''}`); i += d / res;
        } else {
          let j = i; while (j < cells.length && !(cells[j] && cells[j].k)) j++;
          for (const d of split((j - i) * res)) toks.push(`R${d}`); i = j;
        }
      }
      const shortNotes = toks.filter((t) => t[0] !== 'R' && parseInt(t.slice(1)) < 4).length;
      beats.push(shortNotes >= 2 ? `[${toks.join(' ')}]` : toks.join(' '));
    }
    return beats.join(' ');
  }).join(' | ');
}

/** مدوّنة → شبكة (لنسخ ضرب أو تمرين أصلي إلى «تماريني»)؛ يعيد null إن تعذّر (رباط زمني) */
export function patternToGrid(p, meter) {
  const { bars } = parsePattern(p, meter);
  if (bars.flat().some((n) => n.tie || n.tied)) return null;
  const vals = bars.flat().flatMap((n) => [n.u, n.d]);
  const res = [4, 2, 1].find((r) => vals.every((v) => v % r === 0));
  const upbar = unitsPerBar(meter);
  if (meter[1] === 8 && res === 4) return { res: 2, bars: conv(2) };
  return { res, bars: conv(res) };
  function conv(r) { return bars.map((bar, bi) => { const g = Array.from({ length: upbar / r }, () => null); for (const n of bar) if (n.k !== 'R') g[(n.u - bi * upbar) / r] = { k: n.k, acc: n.acc }; return g; }); }
}
