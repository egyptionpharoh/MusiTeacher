// 🔎 التعرف على جدول المدرسة من جدول خلايا (Excel / Word / CSV) أو من رد الذكاء الاصطناعي (صورة / PDF).
// المخرجات مسودة فقط: تُعرض على المعلم للمراجعة والتصحيح قبل الاعتماد، وما لم نتأكد منه يُعلَّم بوضوح.
import { toLatinDigits, normHHMM, parseHHMM, toHHMM } from './time.js';
import { ORDINALS } from './model.js';

const clean = (s) => toLatinDigits(String(s == null ? '' : s)).replace(/[‏‎ ]/g, ' ').replace(/\s+/g, ' ').trim();
const bare = (s) => clean(s).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْـ]/g, '').toLowerCase();

const DAY_WORDS = [
  ['الاحد', 'احد', 'sunday', 'sun'],
  ['الاثنين', 'اثنين', 'الاتنين', 'monday', 'mon'],
  ['الثلاثاء', 'ثلاثاء', 'الثلاثا', 'tuesday', 'tue'],
  ['الاربعاء', 'اربعاء', 'الاربعا', 'wednesday', 'wed'],
  ['الخميس', 'خميس', 'thursday', 'thu'],
  ['الجمعه', 'جمعه', 'friday', 'fri'],
  ['السبت', 'سبت', 'saturday', 'sat'],
].map((a) => a.map(bare));

export function dayIndex(cell) {
  const b = bare(cell).replace(/^يوم\s+/, '');
  if (!b || b.length > 14) return -1;
  for (let i = 0; i < 7; i++) if (DAY_WORDS[i].includes(b)) return i;
  return -1;
}

const ORD_BARE = ORDINALS.map(bare);
const ORD_M = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'].map(bare);

/** رقم الحصة من نص الرأس: «الأولى»، «الحصة 3»، «3» */
export function periodNo(cell) {
  const b = bare(cell).replace(/الحصه|حصه|period|p\.?/g, '').replace(/[()]/g, '').trim();
  const t = b.replace(/\d{1,2}\s*[:.]\s*\d{2}.*$/, '').trim();
  if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 12) return +t;
  for (let i = ORD_BARE.length - 1; i >= 0; i--) if (t === ORD_BARE[i] || t === ORD_M[i] || t.startsWith(ORD_BARE[i] + ' ') || t === bare(ORDINALS[i]).replace(/^ال/, '')) return i + 1;
  return 0;
}

/** «7:30 - 8:10» | «من 7:30 إلى 8:10» | «8:10 - 7:30» (يُصحَّح الترتيب) */
export function timeRange(cell) {
  const s = clean(cell);
  const all = [...s.matchAll(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(ص|م|am|pm)?/gi)].map((m) => parseHHMM(`${m[1]}:${m[2]} ${m[3] || ''}`)).filter((x) => x != null);
  if (!all.length) return null;
  let [a, b] = all;
  // أوقات المدرسة بين 6 صباحًا و6 مساءً: «1:10» تعني 13:10 غالبًا
  const fix = (x) => (x != null && x < 6 * 60 ? x + 12 * 60 : x);
  a = fix(a); b = fix(b);
  if (b != null && b < a) [a, b] = [b, a];
  return { start: toHHMM(a), end: b != null ? toHHMM(b) : '' };
}

const BREAK_RE = /(فسحه|الفسحه|استراحه|راحه|break|recess|صلاه)/;
export const isBreakWord = (cell) => BREAK_RE.test(bare(cell));

const GRADE_WORDS = [['الاول', 'اول'], ['الثاني', 'ثاني'], ['الثالث', 'ثالث'], ['الرابع', 'رابع'], ['الخامس', 'خامس'], ['السادس', 'سادس'], ['السابع', 'سابع'], ['الثامن', 'ثامن'], ['التاسع', 'تاسع'], ['العاشر', 'عاشر'], ['الحادي عشر', 'حادي عشر'], ['الثاني عشر', 'ثاني عشر']];

/** نص خانة الحصة → { subject, grade, section, room, uncertain } */
export function parseLessonText(text) {
  const t = clean(text);
  if (!t || /^[-–—_.\s]+$/.test(t)) return null;
  if (isBreakWord(t) && t.length < 14) return null;
  let rest = t, grade = '', section = '', room = '';
  const roomM = rest.match(/(قاعه|قاعة|معمل|مختبر|غرفه|غرفة)\s*[^\s/،,]*(\s*\d+)?/);
  if (roomM) { room = roomM[0].trim(); rest = rest.replace(roomM[0], ' '); }
  const num = rest.match(/(?:^|[^\d])(\d{1,2})\s*[/\\\-_]\s*([0-9]{1,2}|[أ-ي]|[a-z])(?![\d])/i);
  if (num && +num[1] >= 1 && +num[1] <= 12) {
    grade = `الصف ${num[1]}`; section = num[2]; rest = rest.replace(num[0].replace(/^[^\d]/, ''), ' ');
  } else {
    const b = bare(rest);
    for (let i = GRADE_WORDS.length - 1; i >= 0; i--) {
      const [full, short] = GRADE_WORDS[i].map(bare);
      const re = new RegExp(`(?:^|\\s)(?:الصف\\s*)?(${full}|${short})(?:\\s*(?:الاساسي|اساسي))?(?:\\s*[/\\-\\s]\\s*([0-9]{1,2}|[ا-ي]))?(?![ا-ي])`);
      const m = b.match(re);
      if (m) {
        grade = `الصف ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'][i]}`;
        section = m[2] || '';
        rest = '';
        break;
      }
    }
    if (!grade) {
      const g = rest.match(/(?:^|\s)(\d{1,2})\s*([أ-ي]|[a-z])?(?:\s|$)/i);
      if (g && +g[1] >= 1 && +g[1] <= 12) { grade = `الصف ${g[1]}`; section = g[2] || ''; rest = rest.replace(g[0], ' '); }
    }
  }
  rest = rest.replace(/(الصف|صف|الشعبه|الشعبة|شعبه|شعبة)/g, ' ').replace(/[/\\\-–_،,:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const subject = rest.length >= 2 ? rest.slice(0, 80) : '';
  const uncertain = !grade && !!subject && !/[ء-ي]{3,}/.test(subject);
  if (!grade && !subject && !room) return { subject: t.slice(0, 80), grade: '', section: '', room: '', uncertain: true };
  return { subject, grade, section, room, ...(uncertain || (!grade && subject.length < 3) ? { uncertain: true } : {}) };
}

/** مصفوفة خلايا → مسودة جدول */
export function parseGrid(gridIn) {
  const grid = (gridIn || []).map((r) => (Array.isArray(r) ? r : []).map(clean));
  const issues = [];
  const R = grid.length, C = Math.max(0, ...grid.map((r) => r.length));
  const cell = (r, c) => (grid[r] && grid[r][c]) || '';
  if (!R || !C) return failed('الملف لا يحتوي على جدول يمكن قراءته.');

  // صيغة القائمة (صف لكل حصة) لها رؤوس أعمدة صريحة: نجربها أولًا
  const listed = parseList(grid);
  if (listed) return listed;

  // 1) أين أسماء الأيام؟
  let best = { n: 0 };
  for (let c = 0; c < Math.min(C, 4); c++) {
    const rows = []; for (let r = 0; r < R; r++) { const d = dayIndex(cell(r, c)); if (d >= 0) rows.push([r, d]); }
    if (rows.length > best.n) best = { n: rows.length, axis: 'rows', at: c, list: rows };
  }
  for (let r = 0; r < Math.min(R, 6); r++) {
    const cols = []; for (let c = 0; c < C; c++) { const d = dayIndex(cell(r, c)); if (d >= 0) cols.push([c, d]); }
    if (cols.length > best.n) best = { n: cols.length, axis: 'cols', at: r, list: cols };
  }
  if (best.n < 2) {
    return failed('لم نجد أسماء أيام الأسبوع في الملف. جرّب ملفًا يحتوي على الأيام (الأحد، الاثنين...) أو أدخل الجدول يدويًا.');
  }

  // نحوّل دائمًا إلى: صفوف = أيام، أعمدة = حصص
  const T = best.axis === 'rows' ? grid : Array.from({ length: C }, (_, c) => Array.from({ length: R }, (_, r) => cell(r, c)));
  const dayCol = best.at;
  const dayRows = best.list.map(([i, d]) => ({ r: i, d }));
  const dayRowSet = new Set(dayRows.map((x) => x.r));
  const W = Math.max(0, ...T.map((r) => r.length));
  const at = (r, c) => (T[r] && T[r][c]) || '';

  // 2) الأعمدة: رقم الحصة والوقت من الصفوف التي ليست أيامًا
  const cols = [];
  for (let c = 0; c < W; c++) {
    if (c === dayCol) continue;
    let no = 0, tr = null, brk = false, hasLesson = false, head = '';
    for (let r = 0; r < T.length; r++) {
      const v = at(r, c);
      if (!v) continue;
      if (dayRowSet.has(r)) { if (parseLessonText(v)) hasLesson = true; if (isBreakWord(v) && v.length < 14) brk = true; continue; }
      if (!no) no = periodNo(v);
      if (!tr) tr = timeRange(v);
      if (isBreakWord(v)) brk = true;
      head = head || v;
    }
    if (!no && !tr && !brk && !hasLesson) continue;
    cols.push({ c, no, tr, brk, hasLesson, head });
  }
  if (!cols.length) return failed('تعرّفنا على الأيام لكن لم نجد أعمدة الحصص.');

  // ترقيم الحصص الناقص بالتسلسل
  let n = 0;
  const periods = [], colPid = new Map();
  for (const k of cols) {
    if (k.brk && !k.hasLesson) {
      periods.push({ id: `b${periods.length + 1}`, kind: 'break', name: 'الفسحة', start: k.tr ? k.tr.start : '', end: k.tr ? k.tr.end : '', no: 0, label: '' });
      continue;
    }
    n = k.no || n + 1;
    const id = `p${n}`;
    if (periods.some((p) => p.id === id)) { issues.push(`رقم الحصة ${n} مكرر في الملف؛ راجع الأعمدة.`); continue; }
    periods.push({ id, kind: 'lesson', no: n, label: ORDINALS[n - 1] || String(n), start: k.tr ? k.tr.start : '', end: k.tr ? k.tr.end : '', name: '', uncertain: !k.tr });
    colPid.set(k.c, id);
  }
  const missing = periods.filter((p) => p.kind === 'lesson' && (!p.start || !p.end));
  if (missing.length) issues.push(`لم نجد توقيت ${missing.length === periods.filter((p) => p.kind === 'lesson').length ? 'الحصص' : `${missing.length} حصة`} في الملف. أدخِل الأوقات قبل الاعتماد (يمكن استخدام «توليد التوقيت»).`);

  const lessons = {}; let count = 0, unsure = 0;
  for (const { r, d } of dayRows) {
    for (const [c, pid] of colPid) {
      const l = parseLessonText(at(r, c));
      if (!l) continue;
      (lessons[d] ||= {})[pid] = l; count++; if (l.uncertain) unsure++;
    }
  }
  if (unsure) issues.push(`${unsure} خانة لم نتأكد من قراءتها، وهي مميزة باللون البرتقالي.`);
  const days = [...new Set(dayRows.map((x) => x.d))].sort((a, b) => a - b);
  return { ok: true, draft: { days, periods: fillTimes(periods), lessons }, issues, stats: { days: days.length, periods: periods.filter((p) => p.kind === 'lesson').length, lessons: count, uncertain: unsure } };
}

/** صيغة القائمة: كل صف = حصة (اليوم | الحصة | من | إلى | الصف | الشعبة | المادة | القاعة) */
function parseList(grid) {
  const H = { day: /^(اليوم|يوم|day)$/, no: /^(الحصه|رقم الحصه|حصه|period|no)$/, from: /^(من|البدايه|بدايه|start|from|الوقت|التوقيت|time)$/, to: /^(الي|النهايه|نهايه|end|to)$/, grade: /^(الصف|صف|grade|class)$/, section: /^(الشعبه|شعبه|section)$/, subject: /^(الماده|ماده|subject)$/, room: /^(القاعه|قاعه|room|المكان)$/ };
  for (let r = 0; r < Math.min(grid.length, 8); r++) {
    const map = {};
    grid[r].forEach((v, c) => { const b = bare(v); for (const [k, re] of Object.entries(H)) if (!(k in map) && re.test(b)) map[k] = c; });
    if (!('day' in map) || !('no' in map || 'from' in map)) continue;
    const periods = new Map(), lessons = {}; let count = 0;
    for (let i = r + 1; i < grid.length; i++) {
      const row = grid[i]; const d = dayIndex(row[map.day]);
      if (d < 0) continue;
      const tr = 'from' in map ? timeRange(`${row[map.from] || ''} ${'to' in map ? row[map.to] || '' : ''}`) : null;
      const no = 'no' in map ? periodNo(row[map.no]) : 0;
      const key = no ? `p${no}` : tr ? `t${tr.start}` : null;
      if (!key) continue;
      if (!periods.has(key)) periods.set(key, { id: key, kind: 'lesson', no, label: no ? ORDINALS[no - 1] : '', start: tr ? tr.start : '', end: tr ? tr.end : '', name: '' });
      const l = { subject: row[map.subject] || '', grade: row[map.grade] ? (/^\d+$/.test(row[map.grade]) ? `الصف ${row[map.grade]}` : row[map.grade]) : '', section: row[map.section] || '', room: row[map.room] || '' };
      if (l.subject || l.grade || l.section) { (lessons[d] ||= {})[key] = l; count++; }
    }
    if (!count) continue;
    const ps = [...periods.values()].sort((a, b) => (parseHHMM(a.start) ?? a.no * 60) - (parseHHMM(b.start) ?? b.no * 60));
    let k = 0; for (const p of ps) { k++; if (!p.no) { p.no = k; p.label = ORDINALS[k - 1]; } }
    const days = Object.keys(lessons).map(Number).sort((a, b) => a - b);
    const issues = ps.some((p) => !p.start) ? ['بعض الحصص بلا توقيت؛ أكمل الأوقات قبل الاعتماد.'] : [];
    return { ok: true, draft: { days, periods: fillTimes(ps), lessons }, issues, stats: { days: days.length, periods: ps.length, lessons: count, uncertain: 0 } };
  }
  return null;
}

/** إن وُجد توقيت بعض الحصص فقط نترك الباقي فارغًا ليكمله المعلم (لا نخترع أوقاتًا) */
function fillTimes(periods) { return periods.map((p) => ({ ...p, start: normHHMM(p.start) || '', end: normHHMM(p.end) || '' })); }

function failed(msg) { return { ok: false, error: msg, issues: [msg] }; }

/** رد الذكاء الاصطناعي (مخطط ثابت) → مسودة بنفس الشكل */
export function fromAI(ai) {
  const issues = [];
  if (!ai || typeof ai !== 'object') return failed('لم نتمكن من قراءة الجدول من الملف.');
  const periods = [];
  const seen = new Set();
  for (const p of Array.isArray(ai.periods) ? ai.periods : []) {
    const kind = p && p.kind === 'break' ? 'break' : 'lesson';
    const no = kind === 'lesson' ? Math.round(+p.no) || 0 : 0;
    if (kind === 'lesson' && (!no || no > 12 || seen.has(no))) continue;
    if (kind === 'lesson') seen.add(no);
    const st = normHHMM(p.start) || '', en = normHHMM(p.end) || '';
    periods.push({ id: kind === 'lesson' ? `p${no}` : `b${periods.length + 1}`, kind, no, label: kind === 'lesson' ? ORDINALS[no - 1] : '', name: kind === 'break' ? clean(p.name) || 'الفسحة' : '', start: st, end: en, uncertain: !!p.uncertain || !st || !en });
  }
  // أي حصة مذكورة في الخانات وليست في قائمة الحصص
  for (const l of Array.isArray(ai.lessons) ? ai.lessons : []) {
    const no = Math.round(+(l && l.period)) || 0;
    if (no >= 1 && no <= 12 && !seen.has(no)) { seen.add(no); periods.push({ id: `p${no}`, kind: 'lesson', no, label: ORDINALS[no - 1], name: '', start: '', end: '', uncertain: true }); }
  }
  periods.sort((a, b) => (parseHHMM(a.start) ?? (a.no || 99) * 60) - (parseHHMM(b.start) ?? (b.no || 99) * 60));
  const lessons = {}; let count = 0, unsure = 0;
  for (const l of Array.isArray(ai.lessons) ? ai.lessons : []) {
    const d = typeof l.day === 'number' ? l.day : dayIndex(l.day);
    const no = Math.round(+l.period) || 0;
    if (d < 0 || d > 6 || !no) continue;
    const text = [l.grade, l.section].filter(Boolean).join('/');
    const parsed = l.grade || l.section ? null : parseLessonText(l.raw || '');
    const o = {
      subject: clean(l.subject).slice(0, 80),
      grade: l.grade ? (/^\d+$/.test(clean(l.grade)) ? `الصف ${clean(l.grade)}` : clean(l.grade)) : parsed ? parsed.grade : '',
      section: clean(l.section) || (parsed ? parsed.section : ''),
      room: clean(l.room),
    };
    if (!o.subject && !o.grade && parsed) o.subject = parsed.subject;
    if (!o.subject && !o.grade && !o.section && !text) continue;
    if (l.uncertain) { o.uncertain = true; unsure++; }
    (lessons[d] ||= {})[`p${no}`] = o; count++;
  }
  const days = [...new Set([...(Array.isArray(ai.days) ? ai.days.map((x) => (typeof x === 'number' ? x : dayIndex(x))) : []), ...Object.keys(lessons).map(Number)])].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (!count && !periods.length) return failed('لم نتمكن من التعرف على الحصص في الملف. تأكد من وضوح الصورة أو أدخل الجدول يدويًا.');
  if (periods.some((p) => p.kind === 'lesson' && (!p.start || !p.end))) issues.push('بعض أوقات الحصص لم تظهر بوضوح؛ راجعها وأكملها قبل الاعتماد.');
  if (unsure) issues.push(`${unsure} خانة غير مؤكدة القراءة، وهي مميزة باللون البرتقالي.`);
  for (const w of Array.isArray(ai.warnings) ? ai.warnings.slice(0, 5) : []) if (typeof w === 'string' && w.trim()) issues.push(clean(w).slice(0, 200));
  return {
    ok: true, issues,
    draft: { days, periods, lessons, teacher: clean(ai.teacher).slice(0, 80), school: clean(ai.school).slice(0, 120), subject: clean(ai.subject).slice(0, 80) },
    stats: { days: days.length, periods: periods.filter((p) => p.kind === 'lesson').length, lessons: count, uncertain: unsure },
  };
}

/** CSV بسيط (فاصلة أو فاصلة منقوطة أو Tab) → مصفوفة خلايا */
export function csvToGrid(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const first = s.split(/\r?\n/)[0] || '';
  const sep = (first.match(/\t/g) || []).length > 0 ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** جداول document.xml في ملف Word → مصفوفات خلايا (أكبر جدول أولًا) */
export function docxTables(xml) {
  const tables = [];
  const decode = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  for (const tm of String(xml).matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)) {
    const rows = [];
    for (const rm of tm[1].matchAll(/<w:tr[ >]([\s\S]*?)<\/w:tr>/g)) {
      const cells = [];
      for (const cm of rm[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)) {
        const span = +((cm[1].match(/<w:gridSpan w:val="(\d+)"/) || [])[1] || 1);
        const text = [...cm[1].matchAll(/<w:p[ >]([\s\S]*?)<\/w:p>/g)].map((p) => [...p[1].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((x) => decode(x[1])).join('')).filter(Boolean).join(' ');
        cells.push(text);
        for (let k = 1; k < span; k++) cells.push(text);
      }
      rows.push(cells);
    }
    tables.push(rows);
  }
  return tables.sort((a, b) => b.length * (b[0] || []).length - a.length * (a[0] || []).length);
}

/** دمج المسودة المعتمدة في جدول (جديد أو قائم) */
export function applyDraft(profile, draft) {
  const p = JSON.parse(JSON.stringify(profile));
  p.days = draft.days.length ? draft.days : p.days;
  p.periods = draft.periods.map(({ uncertain, ...x }) => x);
  p.lessons = {};
  for (const [d, row] of Object.entries(draft.lessons || {})) for (const [pid, l] of Object.entries(row)) { const { uncertain, ...rest } = l; (p.lessons[d] ||= {})[pid] = rest; }
  p.dayTimes = {};
  for (const k of ['teacher', 'school', 'subject']) if (draft[k] && !p[k]) p[k] = draft[k];
  return p;
}
