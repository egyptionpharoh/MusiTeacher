// 📅 التقويم المدرسي في «منبّه الحصص الذكي»: الأعوام الدراسية + المواعيد والمناسبات + تنبيهاتها (دوال نقية بلا React).
//
// البنية (تُحفظ داخل مخزن المنبّه نفسه store.calendar: على الجهاز لكل حساب، ومع المزامنة الاختيارية):
//   calendar = { v, activeYearId, years: [Year], events: [Event], trash: [Event+deletedAt], settings, seeds: { [packId]: at } }
//   Year  = { id, name, start, end, status: 'active'|'archived', semesters: [{ id, name, start, end }], note, createdAt, updatedAt }
//   Event = { id, yearId, seedId, title, desc, category, kind: 'day'|'range'|'annual'|'variable',
//             start, end,                      // للمحدد والفترة، وللمتغير بعد أن يحدد المعلم تاريخه
//             annual: { m, d, m2, d2, month }, // للسنوي الثابت: يُحسب تاريخه داخل كل عام دراسي تلقائيًا
//             rule, hijri: { m, d, d2 },       // للمتغير: وصف التوقيت كما ورد، والتاريخ الهجري (اقتراح تقريبي فقط)
//             semester, grades, src: { id, label, ref }, review: { need, note }, expected, suspend, enabled, notes,
//             remind: { mode: 'default'|'custom'|'off', before: [أيام], onStart, endBefore, time }, history, createdAt, updatedAt }
// لا يوجد عام دراسي مكتوب في المنطق: كل عام سجلٌّ يُنشأ ويُعدَّل من الواجهة، والبيانات الأولية في calendarSeed.js.
import { addDays, weekdayOf, zonedToMs, fmtDate, MONTHS, isDateKey, normHHMM } from './time.js';

export const CAL_VERSION = 1;

export const CATEGORIES = [
  { id: 'school', label: 'الدوام والعام الدراسي', color: '#0F766E', group: 'school', alert: true },
  { id: 'admin', label: 'التقارير والدرجات', color: '#1D4ED8', group: 'school', alert: true },
  { id: 'exams', label: 'الامتحانات والفحص', color: '#B42318', group: 'school', alert: true },
  { id: 'music', label: 'المهارات الموسيقية', color: '#7C3AED', group: 'school', alert: true },
  { id: 'holiday', label: 'الإجازات', color: '#EA580C', group: 'school', alert: true },
  { id: 'national', label: 'وطنية وعُمانية', color: '#B91C1C', group: 'occasion', alert: true },
  { id: 'educational', label: 'تربوية وتعليمية', color: '#0369A1', group: 'occasion', alert: false },
  { id: 'cultural', label: 'ثقافية', color: '#A21CAF', group: 'occasion', alert: false },
  { id: 'health', label: 'صحية وسلامة', color: '#047857', group: 'occasion', alert: false },
  { id: 'environment', label: 'بيئية', color: '#4D7C0F', group: 'occasion', alert: false },
  { id: 'social', label: 'اجتماعية', color: '#C2410C', group: 'occasion', alert: false },
  { id: 'global', label: 'عالمية ودولية', color: '#4338CA', group: 'occasion', alert: false },
  { id: 'religious', label: 'دينية', color: '#15803D', group: 'occasion', alert: true },
  { id: 'other', label: 'أخرى', color: '#64748B', group: 'occasion', alert: true },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const KINDS = [
  { id: 'day', label: 'يوم محدد' },
  { id: 'range', label: 'فترة زمنية' },
  { id: 'annual', label: 'مناسبة سنوية (تاريخ ميلادي ثابت)' },
  { id: 'variable', label: 'مناسبة متغيرة (هجرية أو مرتبطة بيوم/فترة)' },
];
export const SEMESTERS = [{ id: 's1', label: 'الفصل الدراسي الأول' }, { id: 's2', label: 'الفصل الدراسي الثاني' }];
export const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
export const BEFORE_CHOICES = [1, 3, 7, 14];

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const int = (v, lo, hi, d) => { const n = Math.round(+v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
const key = (v) => (isDateKey(v) ? v : '');
let seq = 0;
export const calId = (p = 'e') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- الإعدادات ----------
export function defaultCalSettings() {
  return {
    enabled: true, time: '07:00', tone: 'soft',
    before: [3, 1], onStart: true, endBefore: 1, // للفترات: تذكير قبل نهايتها بيوم
    cats: Object.fromEntries(CATEGORIES.map((c) => [c.id, c.alert])),
    suspendClasses: true,                         // الإجازات المؤكدة (suspend) توقف تنبيهات الحصص
  };
}
export function normalizeCalSettings(s) {
  const d = defaultCalSettings(), o = s && typeof s === 'object' ? s : {};
  const cats = { ...d.cats };
  if (o.cats && typeof o.cats === 'object') for (const c of CATEGORIES) if (typeof o.cats[c.id] === 'boolean') cats[c.id] = o.cats[c.id];
  return {
    enabled: o.enabled !== false, time: normHHMM(o.time) || d.time, tone: str(o.tone, 60) || d.tone,
    before: beforeList(o.before, d.before), onStart: o.onStart !== false, endBefore: int(o.endBefore, -1, 30, d.endBefore),
    cats, suspendClasses: o.suspendClasses !== false,
  };
}
function beforeList(v, d = []) {
  if (!Array.isArray(v)) return d;
  return [...new Set(v.map((x) => int(x, 1, 60, 0)).filter(Boolean))].sort((a, b) => b - a).slice(0, 5);
}

// ---------- العام الدراسي ----------
export function normalizeYear(y) {
  const o = y && typeof y === 'object' ? y : {};
  const name = str(o.name, 40);
  if (!name) return null;
  const semesters = (Array.isArray(o.semesters) ? o.semesters : []).map((s, i) => ({
    id: str(s && s.id, 20) || `s${i + 1}`, name: str(s && s.name, 60) || (SEMESTERS[i] || {}).label || `الفصل ${i + 1}`, start: key(s && s.start), end: key(s && s.end),
  })).slice(0, 4);
  return {
    id: str(o.id, 60) || calId('y'), name, start: key(o.start), end: key(o.end), status: o.status === 'archived' ? 'archived' : 'active',
    semesters, note: str(o.note, 600), createdAt: +o.createdAt || Date.now(), updatedAt: +o.updatedAt || Date.now(),
  };
}

/** اقتراح العام التالي لعام موجود: الاسم +1 والتواريخ مزاحة 52 أسبوعًا (اليوم نفسه من الأسبوع) — المعلم يعدّلها */
export function nextYearDraft(y) {
  const m = /^(\d{4})\s*\/\s*(\d{4})$/.exec((y && y.name) || '');
  const name = m ? `${+m[1] + 1}/${+m[2] + 1}` : '';
  const sh = (k) => (k ? addDays(k, 364) : '');
  return { name, start: sh(y && y.start), end: sh(y && y.end), status: 'active', semesters: ((y && y.semesters) || []).map((s) => ({ id: s.id, name: s.name, start: sh(s.start), end: sh(s.end) })), note: '' };
}

export function semesterOf(year, dateKey) {
  if (!year || !dateKey) return '';
  const s = year.semesters.find((x) => x.start && x.end && x.start <= dateKey && dateKey <= x.end);
  return s ? s.id : '';
}

// ---------- الموعد ----------
const REMIND_MODES = ['default', 'custom', 'off'];
export function normalizeEvent(e) {
  const o = e && typeof e === 'object' ? e : {};
  const title = str(o.title, 160);
  if (!title) return null;
  const kind = KINDS.some((k) => k.id === o.kind) ? o.kind : 'day';
  const a = o.annual && typeof o.annual === 'object' ? o.annual : null;
  const h = o.hijri && typeof o.hijri === 'object' ? o.hijri : null;
  let start = key(o.start), end = key(o.end);
  if (kind === 'day') end = start;
  if (start && (!end || end < start)) end = start;
  const r = o.remind && typeof o.remind === 'object' ? o.remind : {};
  return {
    id: str(o.id, 60) || calId('e'), yearId: str(o.yearId, 60), seedId: str(o.seedId, 60),
    title, desc: str(o.desc, 1200), category: CAT[o.category] ? o.category : 'other', kind,
    start, end,
    annual: kind === 'annual' && a ? { m: int(a.m, 1, 12, 1), d: int(a.d, 1, 31, 1), m2: int(a.m2, 1, 12, 0), d2: int(a.d2, 1, 31, 0), month: !!a.month } : null,
    rule: str(o.rule, 200),
    hijri: h ? { m: int(h.m, 1, 12, 1), d: int(h.d, 1, 30, 1), d2: int(h.d2, 1, 30, 0) } : null,
    semester: ['s1', 's2', 's3', 's4'].includes(o.semester) ? o.semester : '',
    grades: str(o.grades, 40),
    src: { id: str(o.src && o.src.id, 30) || 'manual', label: str(o.src && o.src.label, 200) || 'إدخال يدوي', ref: str(o.src && o.src.ref, 200) },
    review: { need: !!(o.review && o.review.need), note: str(o.review && o.review.note, 600) },
    expected: !!o.expected, suspend: !!o.suspend, enabled: o.enabled !== false, notes: str(o.notes, 1500),
    remind: {
      mode: REMIND_MODES.includes(r.mode) ? r.mode : 'default', before: beforeList(r.before, []),
      onStart: r.onStart !== false, endBefore: int(r.endBefore, -1, 30, -1), time: normHHMM(r.time) || '',
    },
    history: (Array.isArray(o.history) ? o.history : []).filter((x) => x && x.at).map((x) => ({ at: +x.at, what: str(x.what, 200) })).slice(-20),
    createdAt: +o.createdAt || Date.now(), updatedAt: +o.updatedAt || Date.now(),
  };
}

export function normalizeCalendar(c) {
  if (!c || typeof c !== 'object') return null;
  const years = (Array.isArray(c.years) ? c.years : []).map(normalizeYear).filter(Boolean).slice(0, 30);
  const yids = new Set(years.map((y) => y.id));
  const fix = (e) => { const n = normalizeEvent(e); return n && (yids.has(n.yearId) || !years.length) ? n : n && years.length ? { ...n, yearId: years[0].id } : null; };
  const events = (Array.isArray(c.events) ? c.events : []).map(fix).filter(Boolean).slice(0, 2000);
  const trash = (Array.isArray(c.trash) ? c.trash : []).map((e) => { const n = fix(e); return n ? { ...n, deletedAt: +e.deletedAt || Date.now() } : null; })
    .filter((e) => e && Date.now() - e.deletedAt < 60 * 86400000).slice(-300);
  const activeYearId = yids.has(c.activeYearId) ? c.activeYearId : (years.find((y) => y.status === 'active') || years[0] || {}).id || '';
  const seeds = c.seeds && typeof c.seeds === 'object' ? Object.fromEntries(Object.entries(c.seeds).filter(([k, v]) => str(k, 60) && +v > 0)) : {};
  return { v: CAL_VERSION, activeYearId, years, events, trash, settings: normalizeCalSettings(c.settings), seeds };
}
export const emptyCalendar = () => normalizeCalendar({ years: [], events: [] });

// ---------- حساب التاريخ الفعلي داخل العام ----------
const pad = (n) => String(n).padStart(2, '0');
const validDay = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : ''; };
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** أول تاريخ للشهر/اليوم يقع ضمن سنة كاملة تبدأ من بداية العام الدراسي (فمناسبات أغسطس بعد بداية العام تقع في نهايته) */
export function annualOccurrence(year, a) {
  if (!year || !year.start || !a) return null;
  const y0 = +year.start.slice(0, 4);
  for (const y of [y0, y0 + 1]) {
    const s = a.month ? validDay(y, a.m, 1) : validDay(y, a.m, a.d);
    if (!s || s < year.start) continue;
    if (s >= addDays(year.start, 365)) break;
    let e = s;
    if (a.month) e = validDay(y, a.m, lastDay(y, a.m));
    else if (a.m2 && a.d2) { const yy = a.m2 < a.m ? y + 1 : y; e = validDay(yy, a.m2, a.d2) || s; }
    return { start: s, end: e >= s ? e : s };
  }
  return null;
}

let hijriFmt = null;
function hijriParts(dateKey) {
  try {
    if (!hijriFmt) hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
    const p = hijriFmt.formatToParts(new Date(`${dateKey}T12:00:00Z`));
    return { m: +p.find((x) => x.type === 'month').value, d: +p.find((x) => x.type === 'day').value };
  } catch { return null; }
}
/** تاريخ ميلادي تقريبي لتاريخ هجري داخل العام (تقويم أم القرى) — اقتراح فقط: المعتمد في السلطنة إعلان الرؤية */
export function hijriEstimate(year, h) {
  if (!year || !year.start || !h || !hijriParts(year.start)) return null;
  for (let i = 0, k = year.start; i < 366; i++, k = addDays(k, 1)) {
    const p = hijriParts(k);
    if (p && p.m === h.m && p.d === h.d) {
      if (!h.d2 || h.d2 <= h.d) return { start: k, end: k };
      let e = k; for (let j = 0; j < 40; j++) { const n = addDays(e, 1), q = hijriParts(n); if (!q || q.m !== h.m || q.d > h.d2) break; e = n; }
      return { start: k, end: e };
    }
  }
  return null;
}

/** التاريخ الفعلي للموعد في عامه: { start, end } أو null (متغير لم يُحدَّد تاريخه بعد) */
export function occurrence(ev, year) {
  if (ev.kind === 'annual') return annualOccurrence(year, ev.annual);
  if (ev.start) return { start: ev.start, end: ev.end || ev.start };
  return null;
}

export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export function dayWord(n) {
  if (n === 0) return 'اليوم';
  if (n === 1) return 'غدًا';
  if (n === 2) return 'بعد يومين';
  return n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`;
}
const plainDays = (n) => (n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n <= 10 ? `${n} أيام` : `${n} يومًا`);

/** حالة الموعد بالنسبة لليوم: past | ongoing | today | soon (خلال 7 أيام) | upcoming | unscheduled */
export function statusOf(occ, today) {
  if (!occ) return 'unscheduled';
  if (occ.end < today) return 'past';
  if (occ.start <= today && today <= occ.end) return occ.start === occ.end ? 'today' : 'ongoing';
  return daysBetween(today, occ.start) <= 7 ? 'soon' : 'upcoming';
}
export const STATUS_LABEL = { past: 'انتهى', ongoing: 'جارٍ الآن', today: 'اليوم', soon: 'قريب', upcoming: 'قادم', unscheduled: 'بلا تاريخ' };

export function shortDate(k) { const [, m, d] = k.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; }
export function rangeText(occ) {
  if (!occ) return '';
  if (occ.start === occ.end) return fmtDate(occ.start);
  return `من ${fmtDate(occ.start)} إلى ${fmtDate(occ.end)}`;
}

// ---------- العرض: قوائم وتصفية وبحث ----------
const norm = (s) => String(s || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
/**
 * عناصر العام مع تاريخها الفعلي وحالتها، مرتبة زمنيًا (بلا تاريخ في الآخر).
 * f: { q, category, semester, source, status ('upcoming' = لم ينتهِ، 'past', 'review', 'unscheduled', 'disabled') }
 */
export function listItems(cal, yearId, today, f = {}) {
  if (!cal) return [];
  const year = cal.years.find((y) => y.id === yearId);
  if (!year) return [];
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  const out = [];
  for (const ev of cal.events) {
    if (ev.yearId !== yearId) continue;
    const occ = occurrence(ev, year);
    const st = statusOf(occ, today);
    const sem = ev.semester || (occ ? semesterOf(year, occ.start) : '');
    if (f.category && ev.category !== f.category) continue;
    if (f.semester && sem !== f.semester) continue;
    if (f.source && ev.src.id !== f.source) continue;
    if (f.status === 'upcoming' && (st === 'past' || st === 'unscheduled')) continue;
    if (f.status === 'past' && st !== 'past') continue;
    if (f.status === 'review' && !ev.review.need) continue;
    if (f.status === 'unscheduled' && st !== 'unscheduled') continue;
    if (f.status === 'disabled' && ev.enabled) continue;
    if (words.length) { const h = norm([ev.title, ev.desc, ev.notes, ev.grades, ev.rule, CAT[ev.category].label].join(' ')); if (!words.every((w) => h.includes(w))) continue; }
    out.push({ ev, occ, status: st, sem, est: !occ && ev.hijri ? hijriEstimate(year, ev.hijri) : null });
  }
  return out.sort((a, b) => (a.occ ? 0 : 1) - (b.occ ? 0 : 1) || (a.occ && b.occ ? a.occ.start.localeCompare(b.occ.start) || a.occ.end.localeCompare(b.occ.end) : 0) || a.ev.title.localeCompare(b.ev.title, 'ar'));
}

/** تجميع القادم: اليوم/الجاري، هذا الأسبوع (7 أيام)، هذا الشهر (30 يومًا)، لاحقًا */
export function upcomingGroups(items, today) {
  const g = { now: [], week: [], month: [], later: [] };
  for (const it of items) {
    if (!it.occ || it.status === 'past') continue;
    if (it.status === 'today' || it.status === 'ongoing') g.now.push(it);
    else { const n = daysBetween(today, it.occ.start); (n <= 7 ? g.week : n <= 31 ? g.month : g.later).push(it); }
  }
  return g;
}

/** عناصر يوم معيّن (تشمل الفترات الممتدة عليه) من كل الأعوام غير المؤرشفة أو من عام محدد */
export function itemsOnDay(cal, dateKey, yearId = '') {
  if (!cal) return [];
  const out = [];
  for (const y of cal.years) {
    if (yearId ? y.id !== yearId : y.status === 'archived') continue;
    for (const ev of cal.events) {
      if (ev.yearId !== y.id) continue;
      const occ = occurrence(ev, y);
      if (occ && occ.start <= dateKey && dateKey <= occ.end) out.push({ ev, occ, year: y });
    }
  }
  return out;
}

/** شبكة شهر (أسابيع تبدأ الأحد): [[dateKey|null × 7] ...] */
export function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const first = `${y}-${pad(m)}-01`, n = lastDay(y, m);
  const cells = new Array(weekdayOf(first)).fill(null);
  for (let d = 1; d <= n; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`; };
export const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

// ---------- التنبيهات ----------
/** خطة التذكير الفعلية لموعد: null = لا تنبيه */
export function remindPlan(ev, s) {
  if (!s || !s.enabled || !ev.enabled || ev.remind.mode === 'off') return null;
  if (ev.remind.mode === 'default') {
    if (!s.cats[ev.category]) return null;
    return { before: s.before, onStart: s.onStart, endBefore: s.endBefore, time: s.time };
  }
  return { before: ev.remind.before, onStart: ev.remind.onStart, endBefore: ev.remind.endBefore, time: ev.remind.time || s.time };
}

/** تنبيهات التقويم المستحقة في يوم dateKey (تُدمج مع تنبيهات الحصص في المحرك نفسه) */
export function calendarAlertsForDay(cal, dateKey, tz, alarmSettings = {}) {
  if (!cal || !cal.settings.enabled || alarmSettings.enabled === false) return [];
  const s = cal.settings, out = [];
  for (const y of cal.years) {
    if (y.status === 'archived') continue;
    for (const ev of cal.events) {
      if (ev.yearId !== y.id) continue;
      const plan = remindPlan(ev, s);
      if (!plan) continue;
      const occ = occurrence(ev, y);
      if (!occ) continue;
      const isRange = occ.end !== occ.start;
      const cat = CAT[ev.category];
      const tail = [ev.grades ? `الصفوف: ${ev.grades}` : '', cat.label, ev.expected ? 'موعد متوقع' : '', ev.review.need ? '⚠ يحتاج مراجعة' : ''].filter(Boolean).join(' • ');
      const push = (type, title, line) => {
        const due = zonedToMs(dateKey, plan.time, tz);
        if (!Number.isFinite(due) || (alarmSettings.pausedUntil && due < alarmSettings.pausedUntil)) return;
        out.push({ id: `cal|${ev.id}|${type}|${dateKey}`, due, type: 'calendar', calType: type, graceMs: 12 * 3600 * 1000, min: 0, tone: s.tone, eventKey: 'calendar', dateKey,
          profileId: '', startMs: null, endMs: null, calEventId: ev.id, title, body: [ev.title, line, tail, ev.notes ? `📝 ${ev.notes}` : ''].filter(Boolean).join('\n'), what: ev.title, when: line });
      };
      for (const n of plan.before) if (addDays(occ.start, -n) === dateKey) push(`b${n}`, `تذكير ${dayWord(n)}: ${ev.title}`, isRange ? `تبدأ ${dayWord(n)} (${rangeText(occ)})` : `${dayWord(n)} — ${fmtDate(occ.start)}`);
      if (plan.onStart && occ.start === dateKey) push('start', isRange ? `تبدأ اليوم: ${ev.title}` : `اليوم: ${ev.title}`, isRange ? `حتى ${fmtDate(occ.end)} (${plainDays(daysBetween(occ.start, occ.end) + 1)})` : fmtDate(occ.start));
      if (isRange && plan.endBefore >= 0 && addDays(occ.end, -plan.endBefore) === dateKey && addDays(occ.end, -plan.endBefore) > occ.start) {
        push(`e${plan.endBefore}`, plan.endBefore === 0 ? `آخر يوم: ${ev.title}` : `تنتهي ${dayWord(plan.endBefore)}: ${ev.title}`, `تنتهي ${fmtDate(occ.end)}`);
      }
    }
  }
  return out;
}

/** الإجازات المؤكدة في التقويم (suspend) بصيغة إجازات المنبّه — توقف تنبيهات الحصص في أيامها */
export function calendarHolidays(cal) {
  if (!cal || !cal.settings.suspendClasses) return [];
  const out = [];
  for (const y of cal.years) {
    if (y.status === 'archived') continue;
    for (const ev of cal.events) {
      if (ev.yearId !== y.id || !ev.enabled || !ev.suspend) continue;
      const occ = occurrence(ev, y);
      if (occ) out.push({ id: `cal:${ev.id}`, name: ev.title, from: occ.start, to: occ.end, fromCalendar: true });
    }
  }
  return out;
}

// ---------- التعديل (دوال تعيد تقويمًا جديدًا) ----------
const stamp = (ev, what) => ({ ...ev, updatedAt: Date.now(), history: [...(ev.history || []), { at: Date.now(), what }].slice(-20) });
const FIELD_NAMES = { title: 'الاسم', desc: 'الوصف', category: 'التصنيف', kind: 'النوع', start: 'تاريخ البداية', end: 'تاريخ النهاية', grades: 'الصفوف', semester: 'الفصل', notes: 'الملاحظات', enabled: 'التفعيل', suspend: 'إيقاف الحصص', remind: 'التذكير', annual: 'التاريخ السنوي', rule: 'التوقيت', review: 'المراجعة' };
export function changedFields(a, b) {
  return Object.keys(FIELD_NAMES).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => FIELD_NAMES[k]);
}

export function saveEvent(cal, raw) {
  const prev = cal.events.find((e) => e.id === raw.id);
  const n = normalizeEvent({ ...(prev || {}), ...raw, history: prev ? prev.history : [] });
  if (!n) return cal;
  if (!n.yearId) n.yearId = cal.activeYearId;
  const ch = prev ? changedFields(prev, n) : null;
  const ev = prev ? (ch.length ? stamp(n, `تعديل: ${ch.join('، ')}`) : prev) : stamp({ ...n, createdAt: Date.now() }, 'إنشاء');
  return { ...cal, events: prev ? cal.events.map((e) => (e.id === ev.id ? ev : e)) : [...cal.events, ev] };
}
/** الحذف ينقل إلى «المحذوفات» (60 يومًا) بدل الحذف النهائي — حماية من الحذف غير المقصود */
export function deleteEvent(cal, id) {
  const ev = cal.events.find((e) => e.id === id);
  if (!ev) return cal;
  return { ...cal, events: cal.events.filter((e) => e.id !== id), trash: [...cal.trash, { ...stamp(ev, 'حذف'), deletedAt: Date.now() }] };
}
export function restoreEvent(cal, id) {
  const ev = cal.trash.find((e) => e.id === id);
  if (!ev) return cal;
  const { deletedAt, ...rest } = ev;
  const yearOk = cal.years.some((y) => y.id === rest.yearId);
  return { ...cal, trash: cal.trash.filter((e) => e.id !== id), events: [...cal.events, stamp({ ...rest, yearId: yearOk ? rest.yearId : cal.activeYearId }, 'استرجاع')] };
}
export const purgeEvent = (cal, id) => ({ ...cal, trash: cal.trash.filter((e) => e.id !== id) });

export function saveYear(cal, raw) {
  const prev = cal.years.find((y) => y.id === raw.id);
  const y = normalizeYear({ ...(prev || {}), ...raw, updatedAt: Date.now() });
  if (!y) return cal;
  if (!prev && cal.years.some((x) => x.name === y.name)) return cal;
  const years = prev ? cal.years.map((x) => (x.id === y.id ? y : x)) : [...cal.years, y];
  return { ...cal, years, activeYearId: cal.activeYearId || y.id };
}
export const setYearStatus = (cal, id, status) => ({ ...cal, years: cal.years.map((y) => (y.id === id ? { ...y, status, updatedAt: Date.now() } : y)) });
/** حذف عام: مواعيده تنتقل إلى المحذوفات (قابلة للاسترجاع إلى عام آخر) */
export function deleteYear(cal, id) {
  const years = cal.years.filter((y) => y.id !== id);
  if (years.length === cal.years.length || !years.length) return cal;
  const gone = cal.events.filter((e) => e.yearId === id).map((e) => ({ ...stamp(e, 'حذف مع العام'), deletedAt: Date.now() }));
  return { ...cal, years, events: cal.events.filter((e) => e.yearId !== id), trash: [...cal.trash, ...gone], activeYearId: cal.activeYearId === id ? years[0].id : cal.activeYearId };
}

/** مفتاح القالب لمنع التكرار عند النسخ: البيانات الأولية بمعرّفها، واليدوي بالاسم ونوع التوقيت */
export function templateKey(ev) {
  if (ev.seedId) return `seed:${ev.seedId}`;
  const a = ev.annual ? `${ev.annual.m}-${ev.annual.d}-${ev.annual.m2}-${ev.annual.d2}-${ev.annual.month ? 1 : 0}` : ev.hijri ? `h${ev.hijri.m}-${ev.hijri.d}` : '';
  return `t:${norm(ev.title)}|${ev.kind}|${a}`;
}

/**
 * نسخ المناسبات من عام إلى آخر دون تكرار:
 *  • السنوية الثابتة: تُنسخ ويُحسب تاريخها في العام الجديد تلقائيًا.
 *  • المتغيرة: تُنسخ بلا تاريخ (يحدده المعلم للعام الجديد).
 *  • المحددة والفترات (اختياري oneTime): تُنسخ بلا تاريخ وتُعلَّم «تحتاج تاريخ العام الجديد».
 */
export function copyYearEvents(cal, fromId, toId, { oneTime = false, categories = null } = {}) {
  if (fromId === toId || !cal.years.some((y) => y.id === toId)) return { cal, added: 0, skipped: 0 };
  const have = new Set(cal.events.filter((e) => e.yearId === toId).map(templateKey));
  const add = [];
  let skipped = 0;
  for (const ev of cal.events) {
    if (ev.yearId !== fromId) continue;
    if (categories && !categories.includes(ev.category)) continue;
    const one = ev.kind === 'day' || ev.kind === 'range';
    if (one && !oneTime) continue;
    const k = templateKey(ev);
    if (have.has(k)) { skipped++; continue; }
    have.add(k);
    const base = { ...ev, id: calId('e'), yearId: toId, history: [], createdAt: Date.now() };
    const fromName = (cal.years.find((y) => y.id === fromId) || {}).name || '';
    if (ev.kind === 'annual') add.push(stamp(base, `نسخ من عام ${fromName}`));
    else add.push(stamp({ ...base, start: '', end: '', kind: one ? 'variable' : ev.kind, rule: ev.rule || (one ? `كان في عام ${fromName}: ${ev.start === ev.end ? ev.start : `${ev.start} — ${ev.end}`}` : ''), review: { need: true, note: `حدّد تاريخ هذا العام (نُسخ من ${fromName}).` } }, `نسخ من عام ${fromName}`));
  }
  return { cal: { ...cal, events: [...cal.events, ...add] }, added: add.length, skipped };
}

/**
 * دمج حزمة بيانات أولية (calendarSeed.js) دون تكرار: يُنشأ عامها إن لم يوجد (بالاسم)، وتُضاف عناصرها غير الموجودة (بالمعرّف seedId).
 * ما حذفه المعلم (في المحذوفات) لا يُعاد إلا مع restoreDeleted.
 */
export function mergeSeed(cal0, pack, { restoreDeleted = false } = {}) {
  let cal = cal0 || emptyCalendar();
  let year = cal.years.find((y) => y.name === pack.year.name);
  if (!year) { cal = saveYear(cal, { ...pack.year, id: calId('y') }); year = cal.years.find((y) => y.name === pack.year.name); }
  const present = new Set(cal.events.map((e) => e.seedId).filter(Boolean));
  const deleted = new Set(cal.trash.map((e) => e.seedId).filter(Boolean));
  const add = [];
  for (const raw of pack.events) {
    if (present.has(raw.seedId) || (deleted.has(raw.seedId) && !restoreDeleted)) continue;
    const ev = normalizeEvent({ ...raw, id: calId('e'), yearId: year.id, createdAt: Date.now(), history: [{ at: Date.now(), what: 'استيراد من البيانات الأولية' }] });
    if (ev) add.push(ev);
  }
  const trash = restoreDeleted ? cal.trash.filter((e) => !e.seedId || !pack.events.some((r) => r.seedId === e.seedId)) : cal.trash;
  return { cal: { ...cal, trash, events: [...cal.events, ...add], seeds: { ...cal.seeds, [pack.id]: Date.now() }, activeYearId: cal.activeYearId || year.id }, added: add.length, yearId: year.id };
}

// ---------- ملف تقويم .ics (تنبيهات حقيقية في تقويم الهاتف حتى والمتصفح مغلق) ----------
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => { const out = []; let cur = ''; for (const ch of line) { if (new TextEncoder().encode(cur + ch).length > 73) { out.push(cur); cur = ` ${ch}`; } else cur += ch; } out.push(cur); return out.join('\r\n'); };
const ymd = (k) => k.replace(/-/g, '');
export function buildCalendarICS(cal, { yearId, onlyAlerted = false, now = Date.now() } = {}) {
  const year = cal.years.find((y) => y.id === yearId);
  if (!year) return '';
  const stampTxt = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MusiTeacher//Class Alarm Calendar//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', fold(`X-WR-CALNAME:${icsEsc(`التقويم المدرسي ${year.name}`)}`)];
  let count = 0;
  for (const ev of cal.events) {
    if (ev.yearId !== yearId || !ev.enabled) continue;
    const occ = occurrence(ev, year);
    if (!occ) continue;
    const plan = remindPlan(ev, cal.settings);
    if (onlyAlerted && !plan) continue;
    const [hh, mm] = ((plan && plan.time) || cal.settings.time).split(':').map(Number);
    L.push('BEGIN:VEVENT', `UID:${ev.id}@class-alarm.musiteacher`, `DTSTAMP:${stampTxt}`, `DTSTART;VALUE=DATE:${ymd(occ.start)}`, `DTEND;VALUE=DATE:${ymd(addDays(occ.end, 1))}`,
      fold(`SUMMARY:${icsEsc(ev.title)}`), fold(`DESCRIPTION:${icsEsc([ev.desc, ev.grades ? `الصفوف: ${ev.grades}` : '', `التصنيف: ${CAT[ev.category].label}`, `المصدر: ${ev.src.label}${ev.src.ref ? ` (${ev.src.ref})` : ''}`, ev.notes].filter(Boolean).join('\n'))}`),
      fold(`CATEGORIES:${icsEsc(CAT[ev.category].label)}`), 'TRANSP:TRANSPARENT');
    if (plan) {
      const trig = (daysBefore) => { const mins = daysBefore * 1440 - (hh * 60 + mm); return mins > 0 ? `-PT${mins}M` : `PT${-mins}M`; };
      const alarms = [...plan.before.map((n) => [n, `تذكير ${dayWord(n)}: ${ev.title}`]), ...(plan.onStart ? [[0, `اليوم: ${ev.title}`]] : [])];
      for (const [n, txt] of alarms) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${icsEsc(txt)}`), `TRIGGER:${trig(n)}`, 'END:VALARM');
    }
    L.push('END:VEVENT');
    count++;
  }
  L.push('END:VCALENDAR');
  return count ? `${L.join('\r\n')}\r\n` : '';
}
