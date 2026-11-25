// تخزين «كوبون التميز» على جهاز المعلم فقط (localStorage) وبمفتاح منفصل لكل حساب.
// أسماء الطلبة لا تُرسل إلى أي خادم ولا إلى أي جهة خارجية.
import { INITIATIVE, DEFAULT_CRITERIA } from '../data/content.js';
import { PHRASES } from '../data/phrases.js';
import { TEMPLATES } from '../data/templates.js';
import { PER_PAGE } from './layout.js';

export const STORE_VERSION = 1;
export const BACKUP_KIND = 'musiteacher-excellence-backup';
export const LIMITS = { students: 1500, awards: 20000, queue: 200, criteria: 20, text: 120, long: 2000 };
export const keyFor = (uid) => `musiteacher-excellence:${uid || 'guest'}`;

const str = (v, max = LIMITS.text) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '');
const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (v) => (typeof v === 'string' && ISO.test(v) ? v : '');
const TPL_IDS = TEMPLATES.map((t) => t.id);
const PH_IDS = PHRASES.map((p) => p.id);

export const newId = () => {
  try { if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch { /* */ }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function normalizeCard(c = {}) {
  return {
    template: pick(c.template, TPL_IDS, 'notes'),
    gift: c.gift === undefined ? true : !!c.gift,
    gender: pick(c.gender, ['m', 'f'], 'm'),
    phraseId: pick(c.phraseId, PH_IDS, 'p01'),
    custom: str(c.custom, 160),
    student: str(c.student, 60),
    grade: str(c.grade, 30),
    dateMode: pick(c.dateMode, ['today', 'blank', 'fixed'], 'today'),
    date: iso(c.date),
  };
}

export function emptyState() {
  return normalize({});
}

export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const s = r.settings || {};
  const pr = r.print || {};
  const rep = r.report || {};
  const students = (Array.isArray(r.students) ? r.students : []).slice(0, LIMITS.students)
    .map((x) => ({ id: str(x && x.id, 64) || newId(), name: str(x && x.name, 60).trim(), grade: str(x && x.grade, 30).trim(), gender: pick(x && x.gender, ['m', 'f'], 'm'), archived: !!(x && x.archived) }))
    .filter((x) => x.name);
  const ids = new Set(students.map((x) => x.id));
  const awards = (Array.isArray(r.awards) ? r.awards : []).slice(0, LIMITS.awards)
    .map((a) => ({ id: str(a && a.id, 64) || newId(), studentId: str(a && a.studentId, 64), date: iso(a && a.date), criterion: str(a && a.criterion, 60), note: str(a && a.note, 160) }))
    .filter((a) => ids.has(a.studentId) && a.date);
  const criteria = (Array.isArray(r.criteria) ? r.criteria : DEFAULT_CRITERIA).map((c) => str(c, 60).trim()).filter(Boolean).slice(0, LIMITS.criteria);
  return {
    v: STORE_VERSION,
    settings: {
      initiativeName: str(s.initiativeName, 50).trim() || INITIATIVE.name,
      school: str(s.school, 80), teacher: str(s.teacher, 60), teacherGender: pick(s.teacherGender, ['m', 'f'], 'm'),
      subject: str(s.subject, 50), grades: str(s.grades, 80), period: str(s.period, 50),
    },
    card: normalizeCard(r.card),
    queue: (Array.isArray(r.queue) ? r.queue : []).slice(0, LIMITS.queue).map((c) => ({ ...normalizeCard(c), qid: str(c && c.qid, 64) || newId() })),
    print: { perPage: PER_PAGE.includes(+pr.perPage) ? +pr.perPage : 10, color: pr.color !== false, cut: pr.cut !== false, source: pick(pr.source, ['copies', 'variety', 'students', 'queue'], 'copies'), copies: Math.min(200, Math.max(1, +pr.copies || 10)), varietyTag: str(pr.varietyTag, 20) || 'all' },
    tracking: !!r.tracking,
    criteria: criteria.length ? criteria : [...DEFAULT_CRITERIA],
    students, awards,
    report: {
      from: iso(rep.from), to: iso(rep.to), periodLabel: str(rep.periodLabel, 60), top: Math.min(50, Math.max(1, +rep.top || 5)),
      honorType: str(rep.honorType, 80), showNames: rep.showNames !== false,
      participants: str(rep.participants, 10), coupons: str(rep.coupons, 10),
      notes: str(rep.notes, LIMITS.long), impact: str(rep.impact, LIMITS.long), recommendations: str(rep.recommendations, LIMITS.long),
      manualHonorees: str(rep.manualHonorees, LIMITS.long),
    },
  };
}

export function load(storage, uid) {
  try { const raw = storage && storage.getItem(keyFor(uid)); return raw ? normalize(JSON.parse(raw)) : emptyState(); } catch { return emptyState(); }
}
export function save(storage, uid, state) {
  try { storage.setItem(keyFor(uid), JSON.stringify(state)); return true; } catch { return false; }
}
export function clearAll(storage, uid) { try { storage.removeItem(keyFor(uid)); } catch { /* */ } }

export function exportBackup(state, now = new Date()) {
  return JSON.stringify({ kind: BACKUP_KIND, v: STORE_VERSION, exportedAt: now.toISOString().slice(0, 10), data: state }, null, 1);
}
export function importBackup(text) {
  let j;
  try { j = JSON.parse(text); } catch { throw new Error('الملف ليس نسخة احتياطية صالحة.'); }
  if (!j || j.kind !== BACKUP_KIND || !j.data) throw new Error('هذا الملف ليس نسخة احتياطية من «كوبون التميز».');
  return normalize(j.data);
}
