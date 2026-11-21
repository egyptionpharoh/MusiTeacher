// =====================================================================
//  التخزين المحلي (على جهاز المعلم فقط) — منفصل تمامًا عن محتوى الدروس الأصلي (banks.js للقراءة فقط).
//   rz_activities : أنشطة المعلم المعتمدة (مع سجل النسخ السابقة)
//   rz_recent     : آخر الأنشطة المستخدمة
//   rz_drafts     : مسودات المراجعة (لا تضيع عند إعادة تحميل الصفحة)
//   rz_prefs      : تفضيلات العرض (الصوت، طريقة المشاركة…)
//   sessionStorage rz_names : أسماء الطلاب للحصة الحالية فقط (لا تُحفظ دائمًا ولا تُرسل لأي خادم)
//  القوالب الكلاسيكية (edu_templates / edu_questions) تُقرأ كما هي، ولا تُعدَّل إلا عند «فتح في العجلة الكلاسيكية».
// =====================================================================
import { clone, uid, toClassic, fromClassic, normalize } from './model.js';

const MAX_VERSIONS = 15;
const read = (k, d, s = localStorage) => { try { const v = JSON.parse(s.getItem(k)); return v ?? d; } catch { return d; } };
const write = (k, v, s = localStorage) => {
  try { s.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { console.warn('[rz] storage', e); return false; }
};
let quotaCb = null;
export const onQuota = (f) => { quotaCb = f; };
const save = (k, v, s) => { const ok = write(k, v, s); if (!ok && quotaCb) quotaCb(); return ok; };

// ------------------------------------------------ الأنشطة
export const activities = () => read('rz_activities', []).filter((a) => a && a.id && Array.isArray(a.questions));
export const activity = (id) => activities().find((a) => a.id === id) || null;
export const activitiesFor = (lessonId) => activities().filter((a) => a.lessonId === lessonId);

/** حفظ/تحديث نشاط. النسخة السابقة تُنقل إلى versions ولا تُحذف. */
export function saveActivity(a, note = '') {
  const all = activities();
  const now = Date.now();
  const i = all.findIndex((x) => x.id === a.id);
  const next = { ...clone(a), questions: a.questions.map(normalize), updatedAt: now };
  if (i >= 0) {
    const prev = all[i];
    const versions = [{ at: prev.updatedAt || prev.createdAt || now, title: prev.title, questions: prev.questions, note: prev.lastNote || '' }, ...(prev.versions || [])].slice(0, MAX_VERSIONS);
    all[i] = { ...next, versions, lastNote: note, createdAt: prev.createdAt || now };
  } else all.unshift({ ...next, id: next.id || uid('act'), versions: [], lastNote: note, createdAt: now });
  if (!save('rz_activities', all)) return null;
  return all[i >= 0 ? i : 0];
}
export function duplicateActivity(id) {
  const a = activity(id); if (!a) return null;
  const copy = { ...clone(a), id: uid('act'), title: `${a.title} (نسخة)`, versions: [], questions: a.questions.map((q) => ({ ...q, id: uid() })), origin: a.origin, copiedFrom: a.id };
  delete copy.classicId;
  return saveActivity(copy, 'نسخة مكررة');
}
export function renameActivity(id, title) { const a = activity(id); if (!a || !title.trim()) return null; return saveActivity({ ...a, title: title.trim() }, 'تغيير الاسم'); }
export function deleteActivity(id) {
  const a = activity(id);
  save('rz_activities', activities().filter((x) => x.id !== id));
  save('rz_recent', recent().filter((r) => r.id !== id));
  if (a && a.classicId) removeClassic(a.classicId);
}
export function restoreVersion(id, idx) {
  const a = activity(id); const v = a && a.versions && a.versions[idx]; if (!v) return null;
  return saveActivity({ ...a, title: v.title, questions: v.questions }, 'استرجاع نسخة سابقة');
}

// ------------------------------------------------ الأخيرة
export const recent = () => read('rz_recent', []);
export function touchRecent(id) { save('rz_recent', [{ id, at: Date.now() }, ...recent().filter((r) => r.id !== id)].slice(0, 12)); }

// ------------------------------------------------ مسودات وتفضيلات
export const draft = (key) => read('rz_drafts', {})[key] || null;
export function saveDraft(key, d) { const all = read('rz_drafts', {}); if (d) all[key] = { ...d, at: Date.now() }; else delete all[key]; save('rz_drafts', all); }
export const prefs = () => ({ sound: true, mode: 'both', noRepeatStudents: true, timer: 0, ...read('rz_prefs', {}) });
export const setPrefs = (p) => save('rz_prefs', { ...prefs(), ...p });

// ------------------------------------------------ أسماء الحصة الحالية
export const sessionNames = () => read('rz_names', [], sessionStorage);
export const setSessionNames = (n) => save('rz_names', n, sessionStorage);

// ------------------------------------------------ العجلة الكلاسيكية (edu_templates)
export const classicTemplates = () => read('edu_templates', []).filter((t) => t && t.id && t.id !== 'temp_run_session');
const classicQuestions = () => read('edu_questions', []);

/** يحوّل قالبًا كلاسيكيًا إلى أسئلة المكتبة الجديدة (القالب الأصلي يبقى كما هو) */
export function classicToQuestions(tpl) {
  const qs = classicQuestions();
  return (tpl.questionRefs || []).map((r) => qs.find((q) => q.id === r.questionId)).filter(Boolean).map(fromClassic);
}

/**
 * يكتب نشاطًا بصيغة العجلة الكلاسيكية. persistent=false → قالب الجلسة المؤقت (temp_run_session) كما يفعل المعالج القديم.
 * يحافظ على قاعدة التنظيف في العجلة القديمة: لا يُحذف أي سؤال ما زال قالب ما يشير إليه.
 */
export function writeClassic(act, names, { persistent = false, settings = {} } = {}) {
  const id = persistent ? (act.classicId || `rz_${act.id}`) : 'temp_run_session';
  const cq = act.questions.map((q) => toClassic(q, `rz_${act.id}`));
  const tpls = read('edu_templates', []).filter((t) => t.id !== id);
  const old = read('edu_templates', []).find((t) => t.id === id);
  const tpl = {
    id, name: act.title, description: 'أعد بواسطة: مكتبة الدروس التفاعلية', classId: act.lessonTitle || '',
    participantsMode: 'INDIVIDUAL',
    participants: (names || []).map((n) => ({ id: uid('p'), displayId: n, presence: 'IN_WHEEL', lastOutcome: 'NONE', weight: 1 })),
    questionRefs: cq.map((q) => ({ questionId: q.id, assignmentRule: 'ALL' })),
    settings: { autoRemoveOnPass: true, allowRepeat: false, themeVariant: 'vintage', enableQuestions: cq.length >= 3, enableLifelines: true, gameMode: 'WHEEL', ...settings },
    createdAt: old ? old.createdAt : Date.now(), updatedAt: Date.now(),
  };
  const allT = [...tpls, tpl];
  const byId = new Map(classicQuestions().map((q) => [q.id, q]));
  cq.forEach((q) => byId.set(q.id, q));
  const used = new Set(); allT.forEach((t) => (t.questionRefs || []).forEach((r) => used.add(r.questionId)));
  if (!save('edu_templates', allT)) return null;
  save('edu_questions', [...byId.values()].filter((q) => used.has(q.id)));
  return id;
}
function removeClassic(id) {
  const allT = read('edu_templates', []).filter((t) => t.id !== id);
  const used = new Set(); allT.forEach((t) => (t.questionRefs || []).forEach((r) => used.add(r.questionId)));
  save('edu_templates', allT);
  save('edu_questions', classicQuestions().filter((q) => used.has(q.id)));
}

/** فتح عجلة الاختيار (index.html) على مسار معيّن — كما كان التطبيق القديم يتنقل داخليًا */
export function openClassic(path = '/') {
  try { sessionStorage.setItem('rz-launch', JSON.stringify({ path, at: Date.now() })); } catch { /* ignore */ }
  location.href = new URL('../../index.html', import.meta.url).href;   // العجلة عادت إلى index.html
}
