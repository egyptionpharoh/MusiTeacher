// keymap.mjs — ربط أزرار لوحة مفاتيح الحاسوب بالنغمات. يعتمد على e.code (موضع الزر الفعلي) فيعمل مع الكيبورد العربي.
// كل زر يقابل نغمة واحدة فقط (النسخة القديمة ربطت S وD وG وH وJ بنغمتين فحُجبت الثانية).
// الصف السفلي Z..M = أوكتاف baseMidi ، والصف العلوي Q..U = الأوكتاف التالي، ثم I O P 9 0 لما فوقه. Space محجوز للـ Sustain.

const LOWER = [['KeyZ', 0], ['KeyS', 1], ['KeyX', 2], ['KeyD', 3], ['KeyC', 4], ['KeyV', 5], ['KeyG', 6],
  ['KeyB', 7], ['KeyH', 8], ['KeyN', 9], ['KeyJ', 10], ['KeyM', 11]];
const UPPER = [['KeyQ', 12], ['Digit2', 13], ['KeyW', 14], ['Digit3', 15], ['KeyE', 16], ['KeyR', 17], ['Digit5', 18],
  ['KeyT', 19], ['Digit6', 20], ['KeyY', 21], ['Digit7', 22], ['KeyU', 23],
  ['KeyI', 24], ['Digit9', 25], ['KeyO', 26], ['Digit0', 27], ['KeyP', 28]];

export const KEY_LAYOUT = Object.freeze([...LOWER, ...UPPER]);

/** baseMidi يجب أن تكون C (مضاعف 12 + 0). الافتراضي 48 = C3 فيكون Q = C4 (دو الوسطى). */
export function buildKeyMap(baseMidi = 48) {
  if (!Number.isInteger(baseMidi) || ((baseMidi % 12) + 12) % 12 !== 0) {
    throw new RangeError('baseMidi يجب أن تكون نغمة دو');
  }
  const m = new Map();
  for (const [code, off] of KEY_LAYOUT) m.set(code, baseMidi + off);
  return m;
}
