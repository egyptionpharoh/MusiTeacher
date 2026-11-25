// حسابات «متابعة الكوبونات»: الأرصدة حسب الفترة، الملخص، ترتيب خاص بالمعلم، وتصدير CSV.
const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = (now = new Date()) => isoOf(now);
/** 2026-11-25 ← 25/11/2026 */
export const fmtDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export const inPeriod = (date, from, to) => !!date && (!from || date >= from) && (!to || date <= to);

export const PERIODS = [
  { id: 'all', label: 'كل الفترة' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'lastMonth', label: 'الشهر الماضي' },
  { id: 'custom', label: 'فترة أحددها' },
];
export function periodRange(id, now = new Date(), custom = {}) {
  const y = now.getFullYear(); const m = now.getMonth();
  if (id === 'month') return { from: isoOf(new Date(y, m, 1)), to: isoOf(new Date(y, m + 1, 0)) };
  if (id === 'lastMonth') return { from: isoOf(new Date(y, m - 1, 1)), to: isoOf(new Date(y, m, 0)) };
  if (id === 'custom') return { from: custom.from || '', to: custom.to || '' };
  return { from: '', to: '' };
}

/** رصيد كل طالب في الفترة، من الأعلى إلى الأقل (والتعادل بالاسم) */
export function totals(state, { from = '', to = '' } = {}, { includeArchived = false } = {}) {
  const count = new Map(); const last = new Map(); const reasons = new Map();
  for (const a of state.awards) {
    if (!inPeriod(a.date, from, to)) continue;
    count.set(a.studentId, (count.get(a.studentId) || 0) + 1);
    if (!last.has(a.studentId) || a.date > last.get(a.studentId)) last.set(a.studentId, a.date);
    if (a.criterion) { const r = reasons.get(a.studentId) || new Map(); r.set(a.criterion, (r.get(a.criterion) || 0) + 1); reasons.set(a.studentId, r); }
  }
  return state.students
    .filter((s) => includeArchived || !s.archived || count.get(s.id))
    .map((s) => {
      const r = reasons.get(s.id);
      const top = r ? [...r.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k) : [];
      return { student: s, count: count.get(s.id) || 0, last: last.get(s.id) || '', topReasons: top };
    })
    .sort((a, b) => b.count - a.count || a.student.name.localeCompare(b.student.name, 'ar'));
}

export function summary(state, range) {
  const rows = totals(state, range);
  const coupons = rows.reduce((n, r) => n + r.count, 0);
  return { students: state.students.filter((s) => !s.archived).length, participants: rows.filter((r) => r.count > 0).length, coupons };
}

/** أصحاب أعلى رصيد للتكريم: أول N، ويُضم من يتعادل مع آخرهم حتى لا يُظلم أحد */
export function honorees(rows, top) {
  const withAny = rows.filter((r) => r.count > 0);
  if (!withAny.length) return [];
  const n = Math.max(1, Math.min(top, withAny.length));
  const cut = withAny[n - 1].count;
  return withAny.filter((r, i) => i < n || r.count === cut);
}

const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** ملف CSV يفتح في Excel بالعربية (BOM) */
export function toCSV(state, range) {
  const rows = totals(state, range, { includeArchived: true });
  const head = ['الطالب', 'الصف', 'عدد الكوبونات', 'آخر كوبون', 'أبرز المعايير'];
  const lines = [head, ...rows.map((r) => [r.student.name, r.student.grade, r.count, fmtDate(r.last), r.topReasons.join(' + ')])];
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
}

/** تحويل قائمة أسماء ملصقة (سطر لكل طالب) إلى طلبة جدد بلا تكرار */
export function parseNames(text, existing = [], grade = '') {
  const seen = new Set(existing.map((s) => `${s.name.trim()}|${(s.grade || '').trim()}`));
  const out = [];
  for (const line of String(text || '').split(/\r?\n|،|,/)) {
    const name = line.replace(/^\s*\d+[\s.)\-–]+/, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!name || name.length < 2) continue;
    const k = `${name}|${String(grade || '').trim()}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(name);
  }
  return out;
}
