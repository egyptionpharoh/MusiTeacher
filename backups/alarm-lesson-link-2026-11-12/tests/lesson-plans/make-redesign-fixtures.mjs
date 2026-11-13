// ينشئ ملفات الاختبار في /tmp/lpfx (خطط Excel للصفين 5 و6، خطة مقترحة، جدول منبّه تجريبي):  node tests/lesson-plans/make-redesign-fixtures.mjs  (ملف Word: انظر e2e-redesign.py)
import * as XLSX from '/home/claude/mt/node_modules/xlsx/xlsx.mjs';
import fs from 'fs';
import { emptyProfile, normalizeProfile, normalizeStore, defaultSettings } from '/home/claude/mt/src/modules/class-alarm/core/model.js';
const H = ['العام الدراسي', 'الفصل الدراسي', 'الصف', 'الوحدة', 'اسم الدرس', 'بداية الفترة الزمنية', 'نهاية الفترة الزمنية', 'عدد الحصص المخصصة للدرس'];
const x = (rows, f) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'الخطة'); fs.writeFileSync(f, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
x([H,
  ['2026/2027', 'الأول', 'الخامس', 'الثانية', 'الميزان الثنائي', '2026-11-08', '2026-11-12', 3],
  ['2026/2027', 'الأول', 'الخامس', 'الثانية', 'الإيقاع المركب', '2026-11-15', '2026-11-26', ''],
  ['2026/2027', 'الأول', 'الخامس', 'الثانية', 'النشيد الوطني', '2026-11-22', '2026-11-26', ''],
], '/tmp/lpfx/grade5.xlsx');
x([H, ['2026/2027', 'الأول', 'السادس', 'الأولى', 'الأزمنة الأساسية', '2026-11-08', '2026-11-19', '']], '/tmp/lpfx/grade6.xlsx');
x([H, ['2026/2027', 'الأول', 'الخامس', 'الأولى', 'نشيد مقترح', '2026-09-06', '2026-09-17', 2], ['2026/2027', 'الأول', 'الخامس', 'الأولى', 'الميزان الرباعي المقترح', '2026-09-20', '2026-10-01', 2]], '/tmp/lpfx/suggested5.xlsx');
const p = emptyProfile({ teacher: 'أ. حسين', school: 'مدرسة الاختبار', subject: 'المهارات الموسيقية' }, new Date('2026-11-08T03:00:00Z'));
p.lessons = { 0: { p1: { grade: 'الصف الخامس', section: '1' } }, 1: { p2: { grade: 'الصف الخامس', section: '1' }, p3: { grade: 'الصف السابع', section: '1' } }, 2: { p2: { grade: 'الصف السادس', section: '1' } }, 3: { p3: { grade: 'الصف الخامس', section: '1' }, p1: { grade: 'الصف السادس', section: '1' } }, 4: { p1: { grade: 'الصف الخامس', section: '1' } } };
const prof = normalizeProfile(p);
fs.writeFileSync('/tmp/lpfx/alarm-store.json', JSON.stringify(normalizeStore({ version: 1, activeId: prof.id, profiles: [prof], settings: defaultSettings() })));
console.log(prof.days, prof.periods.slice(0,4).map(x=>x.id+' '+x.start));
