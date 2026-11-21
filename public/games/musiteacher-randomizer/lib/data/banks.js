// =====================================================================
//  الأنشطة الجاهزة — 🔒 لا تُخزَّن في ملفات اللعبة العامة.
//  تُجلب من خادم MusiTeacher (GET /api/randomizer/banks) بعد التحقق من حساب المعلم،
//  وتبقى في ذاكرة الصفحة فقط. مصدرها على الخادم: src/modules/randomizer-ai/data/banks.js
// =====================================================================
import { fetchBanks } from '../core/ai.js';

export const BANKS = [];
export const banksState = { status: 'idle', error: '' };   // idle | loading | ready | error

export async function loadBanks() {
  banksState.status = 'loading';
  const r = await fetchBanks();
  if (r && r.ok && Array.isArray(r.banks)) {
    BANKS.splice(0, BANKS.length, ...r.banks);
    banksState.status = 'ready'; banksState.error = '';
  } else {
    banksState.status = 'error';
    banksState.error = (r && r.error) || 'تعذر تحميل الأنشطة الجاهزة.';
  }
  return banksState;
}
export const bankFor = (lessonId) => BANKS.find((b) => b.lessonId === lessonId) || null;
