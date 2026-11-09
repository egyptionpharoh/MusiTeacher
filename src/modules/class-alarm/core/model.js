// 🗂️ نموذج بيانات «منبّه الحصص الذكي» + التطبيع والقيم الافتراضية (دوال نقية).
//
// Profile (جدول واحد، ويمكن حفظ عدة جداول):
//   { id, name, teacher, school, subject, year, semester, tz, schoolLogo,
//     days: [0..6]            أيام العمل (0 = الأحد)
//     periods: [Period]       توقيت اليوم الدراسي (حصص + فسح) مشترك بين الأيام
//     dayTimes: { [day]: { [periodId]: { start, end } } }   توقيت مختلف ليوم معين (اختياري)
//     lessons: { [day]: { [periodId]: Lesson } }            خانات الجدول الأسبوعي
//     overrides: { [dateKey]: Override }                    تعديلات «لهذا اليوم فقط»
//     holidays: [{ id, name, from, to }]
//     plan: AlertPlan                                       خطة التنبيه الافتراضية لهذا الجدول
//   }
// Period  = { id, no, label, start:'HH:MM', end:'HH:MM', kind:'lesson'|'break', name }
// Lesson  = { subject, grade, section, room, note, muted, plan: AlertPlan|null }
// Override= { muted, note, cancelled:{[periodId]:true}, changed:{[periodId]:{start,end}}, notes:{[periodId]:text}, extra:[Extra] }
// Extra   = { id, kind:'lesson'|'meeting'|'activity', title, start, end, grade, section, room, note, plan }
// AlertPlan = { before:[{ min, tone }], start:{ on, tone }, end:{ on, min, tone } }
import { DEFAULT_TZ, normHHMM, parseHHMM, toHHMM, isDateKey, safeTz } from './time.js';

export const STORE_VERSION = 1;
export const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];
export const OMAN_DAYS = [0, 1, 2, 3, 4];
export const BEFORE_PRESETS = [60, 30, 15, 10, 5, 2, 1];
export const EXTRA_KINDS = [
  { id: 'lesson', label: 'حصة استثنائية' },
  { id: 'meeting', label: 'اجتماع' },
  { id: 'activity', label: 'نشاط مدرسي' },
];

let seq = 0;
export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const str = (v, n = 120) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' ? String(v) : '');
const bool = (v) => v === true;
const intIn = (v, lo, hi, d) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export function defaultYear(now = new Date()) {
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
export function defaultSemester(now = new Date()) {
  const m = now.getMonth();
  return m >= 7 || m === 0 ? 'الأول' : 'الثاني';
}

export function defaultPlan() {
  return { before: [{ min: 10, tone: 'chime' }, { min: 2, tone: 'bell' }], start: { on: false, tone: 'start' }, end: { on: false, min: 5, tone: 'soft' } };
}

export function normalizePlan(p, fallback = defaultPlan()) {
  if (!p || typeof p !== 'object') return null;
  const seen = new Set();
  const before = (Array.isArray(p.before) ? p.before : [])
    .map((a) => ({ min: intIn(a && a.min, 1, 180, 0), tone: str(a && a.tone, 60) || 'chime' }))
    .filter((a) => a.min > 0 && !seen.has(a.min) && seen.add(a.min))
    .sort((a, b) => b.min - a.min)
    .slice(0, 6);
  const s = p.start || {}, e = p.end || {};
  return {
    before,
    start: { on: bool(s.on), tone: str(s.tone, 60) || fallback.start.tone },
    end: { on: bool(e.on), min: intIn(e.min, 1, 60, 5), tone: str(e.tone, 60) || fallback.end.tone },
  };
}

/** توليد توقيت يوم: البداية + مدة الحصة + العدد + الفسح */
export function generatePeriods({ first = '07:30', duration = 40, count = 8, gap = 0, breaks = [{ after: 4, minutes: 20, name: 'الفسحة' }] } = {}) {
  const out = [];
  let t = parseHHMM(first) ?? 450;
  const brk = new Map((breaks || []).filter((b) => b && b.after > 0 && b.minutes > 0).map((b) => [+b.after, b]));
  for (let i = 1; i <= Math.min(12, Math.max(1, count)); i++) {
    out.push({ id: `p${i}`, no: i, label: ORDINALS[i - 1] || String(i), start: toHHMM(t), end: toHHMM(t + duration), kind: 'lesson', name: '' });
    t += duration;
    const b = brk.get(i);
    if (b && i < count) {
      out.push({ id: `b${i}`, no: 0, label: '', start: toHHMM(t), end: toHHMM(t + b.minutes), kind: 'break', name: b.name || 'الفسحة' });
      t += b.minutes;
    } else if (i < count) t += Math.max(0, gap);
  }
  return out;
}

export function emptyProfile(over = {}, now = new Date()) {
  return normalizeProfile({
    id: uid('s'), name: 'جدولي الدراسي', teacher: '', school: '', subject: 'المهارات الموسيقية',
    year: defaultYear(now), semester: defaultSemester(now), tz: DEFAULT_TZ,
    days: OMAN_DAYS, periods: generatePeriods(), lessons: {}, overrides: {}, holidays: [], plan: defaultPlan(),
    createdAt: now.getTime(), updatedAt: now.getTime(), ...over,
  });
}

function normalizeLesson(l) {
  if (!l || typeof l !== 'object') return null;
  const o = { subject: str(l.subject, 80), grade: str(l.grade, 60), section: str(l.section, 30), room: str(l.room, 60), note: str(l.note, 500), muted: bool(l.muted), plan: l.plan ? normalizePlan(l.plan) : null };
  if (l.uncertain) o.uncertain = true;
  return o.subject || o.grade || o.section || o.room || o.note ? o : null;
}

function normalizeExtra(x) {
  if (!x || typeof x !== 'object') return null;
  const start = normHHMM(x.start), end = normHHMM(x.end);
  if (!start) return null;
  return {
    id: str(x.id, 40) || uid('e'), kind: ['lesson', 'meeting', 'activity'].includes(x.kind) ? x.kind : 'lesson',
    title: str(x.title, 100), start, end: end && parseHHMM(end) > parseHHMM(start) ? end : toHHMM(parseHHMM(start) + 40),
    grade: str(x.grade, 60), section: str(x.section, 30), room: str(x.room, 60), note: str(x.note, 500),
    plan: x.plan ? normalizePlan(x.plan) : null,
  };
}

export function normalizeProfile(p) {
  const src = p && typeof p === 'object' ? p : {};
  const periodsIn = Array.isArray(src.periods) ? src.periods : [];
  const ids = new Set();
  const periods = periodsIn.map((x, i) => {
    let id = str(x && x.id, 40) || `p${i + 1}`;
    while (ids.has(id)) id = id + '_';
    ids.add(id);
    const start = normHHMM(x && x.start), end = normHHMM(x && x.end);
    return { id, no: intIn(x && x.no, 0, 20, 0), label: str(x && x.label, 40), start, end, kind: x && x.kind === 'break' ? 'break' : 'lesson', name: str(x && x.name, 60) };
  }).slice(0, 24);
  periods.sort((a, b) => (parseHHMM(a.start) ?? 9999) - (parseHHMM(b.start) ?? 9999));
  // ترقيم الحصص تلقائيًا إن غاب
  let n = 0;
  for (const x of periods) if (x.kind === 'lesson') { n++; if (!x.no) x.no = n; if (!x.label) x.label = ORDINALS[x.no - 1] || String(x.no); }

  const days = [...new Set((Array.isArray(src.days) ? src.days : OMAN_DAYS).map((d) => intIn(d, 0, 6, -1)).filter((d) => d >= 0))].sort((a, b) => a - b);

  const lessons = {};
  for (const [d, row] of Object.entries(src.lessons || {})) {
    const di = intIn(d, 0, 6, -1);
    if (di < 0 || !row || typeof row !== 'object') continue;
    for (const [pid, l] of Object.entries(row)) {
      if (!ids.has(pid)) continue;
      const nl = normalizeLesson(l);
      if (nl) (lessons[di] ||= {})[pid] = nl;
    }
  }

  const dayTimes = {};
  for (const [d, row] of Object.entries(src.dayTimes || {})) {
    const di = intIn(d, 0, 6, -1);
    if (di < 0 || !row || typeof row !== 'object') continue;
    for (const [pid, t] of Object.entries(row)) {
      if (!ids.has(pid) || !t) continue;
      const s = normHHMM(t.start), e = normHHMM(t.end);
      if (s && e && parseHHMM(e) > parseHHMM(s)) (dayTimes[di] ||= {})[pid] = { start: s, end: e };
    }
  }

  const overrides = {};
  for (const [k, o] of Object.entries(src.overrides || {})) {
    if (!isDateKey(k) || !o || typeof o !== 'object') continue;
    const cancelled = {}, changed = {}, notes = {};
    for (const [pid, v] of Object.entries(o.cancelled || {})) if (v === true) cancelled[pid] = true;
    for (const [pid, v] of Object.entries(o.changed || {})) { const s = normHHMM(v && v.start), e = normHHMM(v && v.end); if (s && e && parseHHMM(e) > parseHHMM(s)) changed[pid] = { start: s, end: e }; }
    for (const [pid, v] of Object.entries(o.notes || {})) { const t = str(v, 500); if (t) notes[pid] = t; }
    const extra = (Array.isArray(o.extra) ? o.extra : []).map(normalizeExtra).filter(Boolean).slice(0, 20);
    const no = { muted: bool(o.muted), note: str(o.note, 500), cancelled, changed, notes, extra };
    if (no.muted || no.note || Object.keys(cancelled).length || Object.keys(changed).length || Object.keys(notes).length || extra.length) overrides[k] = no;
  }

  const holidays = (Array.isArray(src.holidays) ? src.holidays : []).map((h) => {
    const from = isDateKey(h && h.from) ? h.from : null; let to = isDateKey(h && h.to) ? h.to : from;
    if (!from) return null;
    if (to < from) to = from;
    return { id: str(h.id, 40) || uid('h'), name: str(h.name, 80) || 'إجازة', from, to };
  }).filter(Boolean).slice(0, 60);

  return {
    id: str(src.id, 40) || uid('s'),
    name: str(src.name, 80) || 'جدولي الدراسي',
    teacher: str(src.teacher, 80), school: str(src.school, 120), subject: str(src.subject, 80),
    year: str(src.year, 20), semester: str(src.semester, 30),
    tz: safeTz(src.tz),
    schoolLogo: typeof src.schoolLogo === 'string' && src.schoolLogo.startsWith('data:image/') && src.schoolLogo.length < 400000 ? src.schoolLogo : '',
    days, periods, dayTimes, lessons, overrides, holidays,
    plan: normalizePlan(src.plan) || defaultPlan(),
    createdAt: +src.createdAt || Date.now(), updatedAt: +src.updatedAt || Date.now(),
  };
}

export function defaultSettings() {
  return {
    enabled: true,
    sound: true, volume: 0.8,
    visual: true,          // نافذة التنبيه داخل الأداة
    system: true,          // إشعار نظام التشغيل (يتطلب إذن المتصفح)
    repeat: { on: true, every: 30, count: 3 },
    quiet: { on: false, from: '06:00', to: '15:30' },  // السماح بالتنبيهات داخل هذه الفترة فقط
    pausedUntil: 0,
    graceSec: 90,          // أقصى تأخير مقبول لإطلاق تنبيه (بعده يُعدّ فائتًا ولا يرن)
    h24: false,
    motivation: true,
    sync: false,
    // تذكير المساء من «الخطط الفصلية» (يعمل فقط إن وُجدت خطط وروابط معتمدة)
    planReminders: { on: false, time: '19:00', tone: 'soft', tomorrow: true, postponed: true, incomplete: true, unlinked: false },
  };
}
export function normalizeSettings(s) {
  const d = defaultSettings();
  const o = s && typeof s === 'object' ? s : {};
  const r = o.repeat || {}, q = o.quiet || {};
  return {
    enabled: o.enabled !== false,
    sound: o.sound !== false,
    volume: Math.min(1, Math.max(0, Number.isFinite(+o.volume) ? +o.volume : d.volume)),
    visual: o.visual !== false,
    system: o.system !== false,
    repeat: { on: o.repeat ? r.on !== false : d.repeat.on, every: intIn(r.every, 10, 300, 30), count: intIn(r.count, 1, 10, 3) },
    quiet: { on: bool(q.on), from: normHHMM(q.from) || d.quiet.from, to: normHHMM(q.to) || d.quiet.to },
    pausedUntil: +o.pausedUntil > 0 ? +o.pausedUntil : 0,
    graceSec: intIn(o.graceSec, 30, 600, 90),
    h24: bool(o.h24),
    motivation: o.motivation !== false,
    sync: bool(o.sync),
    planReminders: (() => { const p = o.planReminders || {}, dp = d.planReminders; return { on: bool(p.on), time: normHHMM(p.time) || dp.time, tone: str(p.tone, 60) || dp.tone, tomorrow: p.tomorrow !== false, postponed: p.postponed !== false, incomplete: p.incomplete !== false, unlinked: bool(p.unlinked) }; })(),
  };
}

export function emptyStore(now = new Date()) {
  const p = emptyProfile({}, now);
  return { version: STORE_VERSION, activeId: p.id, profiles: [p], settings: defaultSettings() };
}
export function normalizeStore(s) {
  const o = s && typeof s === 'object' ? s : {};
  const profiles = (Array.isArray(o.profiles) ? o.profiles : []).map(normalizeProfile).slice(0, 20);
  const ids = new Set();
  for (const p of profiles) { while (ids.has(p.id)) p.id = uid('s'); ids.add(p.id); }
  if (!profiles.length) return { ...emptyStore(), settings: normalizeSettings(o.settings) };
  const activeId = profiles.some((p) => p.id === o.activeId) ? o.activeId : profiles[0].id;
  return { version: STORE_VERSION, activeId, profiles, settings: normalizeSettings(o.settings), updatedAt: +o.updatedAt || 0 };
}

/** نسخة جدول لفصل جديد: نفس الحصص والتوقيت، بلا تعديلات أيام سابقة ولا إجازات */
export function cloneProfile(p, over = {}) {
  const c = JSON.parse(JSON.stringify(p));
  return normalizeProfile({ ...c, id: uid('s'), name: `${p.name} (نسخة)`, overrides: {}, holidays: [], createdAt: Date.now(), updatedAt: Date.now(), ...over });
}

export const lessonTitle = (l, profile) => (l && l.subject) || (profile && profile.subject) || 'حصة';
export function classLabel(l) {
  if (!l) return '';
  const g = l.grade ? (/^(الصف|صف)/.test(l.grade) || !/^\d+$/.test(l.grade) ? l.grade : `الصف ${l.grade}`) : '';
  const s = l.section ? (/^(الشعبة|شعبة|فصل)/.test(l.section) ? l.section : `الشعبة ${l.section}`) : '';
  return [g, s].filter(Boolean).join(' – ');
}
