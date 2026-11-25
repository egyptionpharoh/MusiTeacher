// اختبارات وحدات «كوبون التميز»: تخطيط A4، التخزين لكل حساب، الأرصدة والتكريم، صيغ الطالب/الطالبة، وعدم وجود بيانات شخصية ثابتة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LAYOUTS, layoutFor, paginate, shapeOf, unitOf, headlineScale, A4 } from '../src/modules/excellence-cards/core/layout.js';
import { normalize, emptyState, load, save, keyFor, exportBackup, importBackup, LIMITS } from '../src/modules/excellence-cards/core/store.js';
import { totals, summary, honorees, toCSV, parseNames, periodRange, inPeriod, fmtDate } from '../src/modules/excellence-cards/core/tracker.js';
import { PHRASES, phraseText, toLabel, signLabel } from '../src/modules/excellence-cards/data/phrases.js';
import { TEMPLATES } from '../src/modules/excellence-cards/data/templates.js';
import { INITIATIVE } from '../src/modules/excellence-cards/data/content.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

test('تخطيطات A4: 1/2/4/6/8/10 كروت تبقى داخل الصفحة بهوامش 10 مم', () => {
  assert.deepEqual(LAYOUTS.map((l) => l.n), [1, 2, 4, 6, 8, 10]);
  for (const l of LAYOUTS) {
    assert.ok(l.cols * l.w <= A4.w - 2 * A4.margin + 0.01, `عرض ${l.n}`);
    assert.ok(l.rows * l.h <= A4.h - 2 * A4.margin + 0.01, `ارتفاع ${l.n}`);
    assert.ok(unitOf(l.w, l.h) >= 0.9, `الخط لا يصغر كثيرًا في ${l.n}`);
  }
  assert.equal(layoutFor(10).w, 95); assert.equal(layoutFor(999).n, 10);
  assert.equal(shapeOf(95, 55.4), 'wide'); assert.equal(shapeOf(95, 69.25), 'mid'); assert.equal(shapeOf(95, 92.33), 'tall');
  const pages = paginate(Array.from({ length: 23 }, (_, i) => i), 10);
  assert.deepEqual(pages.map((p) => p.length), [10, 10, 3]);
  assert.equal(headlineScale('قصيرة'), 1); assert.ok(headlineScale('x'.repeat(120)) >= 0.62);
});

test('كل عبارة لها صيغتا الطالب والطالبة، و«إلى الطالب/الطالبة المبدع/ة»', () => {
  const ids = new Set();
  for (const p of PHRASES) {
    assert.ok(p.m && p.f, p.id); assert.ok(!ids.has(p.id)); ids.add(p.id);
    assert.ok(p.m.length <= 80 && p.f.length <= 80, `طول ${p.id}`);
  }
  assert.ok(PHRASES.length >= 20);
  assert.match(phraseText({ phraseId: 'p01', gender: 'f' }), /أبدعتِ يا بطلة/);
  assert.match(phraseText({ phraseId: 'p01', gender: 'm' }), /أبدعت يا بطل/);
  assert.equal(phraseText({ phraseId: 'p01', custom: '  عبارتي الخاصة  ', gender: 'f' }), 'عبارتي الخاصة');
  assert.equal(toLabel('f'), 'إلى الطالبة المبدعة:'); assert.equal(toLabel('m'), 'إلى الطالب المبدع:');
  assert.equal(signLabel('f'), 'توقيع المعلمة'); assert.equal(signLabel('m'), 'توقيع المعلم');
  assert.ok(PHRASES.some((p) => p.tag !== 'music'), 'عبارات لكل المواد وليس الموسيقى فقط');
});

test('التخزين: مفتاح منفصل لكل حساب، وتنظيف المدخلات، ونسخة احتياطية', () => {
  const st = memStore();
  assert.notEqual(keyFor('A'), keyFor('B'));
  const a = emptyState(); a.settings.school = 'مدرسة أ'; a.tracking = true;
  a.students = [{ id: 's1', name: 'سالم', grade: '5', gender: 'm' }];
  a.awards = [{ id: 'w1', studentId: 's1', date: '2026-11-20', criterion: 'الإبداع' }, { id: 'w2', studentId: 'ghost', date: '2026-11-20' }, { id: 'w3', studentId: 's1', date: 'bad' }];
  save(st, 'A', normalize(a));
  assert.equal(load(st, 'A').settings.school, 'مدرسة أ');
  assert.equal(load(st, 'B').settings.school, '', 'حساب آخر لا يرى بيانات الأول');
  assert.equal(load(st, 'A').awards.length, 1, 'تُحذف الكوبونات اليتيمة أو بتاريخ غير صالح');
  const n = normalize({ settings: { teacher: 'x'.repeat(500), teacherGender: 'zz' }, card: { template: 'nope', phraseId: 'nope', gender: 'q' }, print: { perPage: 7, copies: 99999 } });
  assert.equal(n.settings.teacher.length, 60); assert.equal(n.settings.teacherGender, 'm');
  assert.equal(n.card.template, TEMPLATES[0].id); assert.equal(n.card.phraseId, 'p01'); assert.equal(n.card.gender, 'm');
  assert.equal(n.print.perPage, 10); assert.equal(n.print.copies, 200);
  assert.equal(normalize({}).settings.initiativeName, INITIATIVE.name);
  const back = importBackup(exportBackup(load(st, 'A')));
  assert.equal(back.students[0].name, 'سالم');
  assert.throws(() => importBackup('{"kind":"other"}'), /ليس نسخة/);
  assert.throws(() => importBackup('not json'), /ليس نسخة/);
  assert.equal(load({ getItem: () => '{broken' }, 'A').v, 1, 'ملف تالف لا يكسر الأداة');
  const many = normalize({ students: Array.from({ length: LIMITS.students + 50 }, (_, i) => ({ id: `s${i}`, name: `طالب ${i}` })) });
  assert.equal(many.students.length, LIMITS.students);
});

test('الأرصدة حسب الفترة، والتكريم يضم المتعادلين، وCSV', () => {
  const s = normalize({ tracking: true,
    students: [{ id: 'a', name: 'أحمد', grade: '5' }, { id: 'b', name: 'بدر', grade: '5' }, { id: 'c', name: 'جود', grade: '6', gender: 'f' }, { id: 'd', name: 'دانة', grade: '6', gender: 'f' }],
    awards: [
      { id: '1', studentId: 'a', date: '2026-11-02', criterion: 'الإبداع' }, { id: '2', studentId: 'a', date: '2026-11-05', criterion: 'الإبداع' }, { id: '3', studentId: 'a', date: '2026-10-30', criterion: 'التقدم' },
      { id: '4', studentId: 'b', date: '2026-11-10' }, { id: '5', studentId: 'b', date: '2026-11-11' },
      { id: '6', studentId: 'c', date: '2026-11-12', criterion: 'المشاركة' }, { id: '7', studentId: 'c', date: '2026-11-13' },
    ] });
  const nov = { from: '2026-11-01', to: '2026-11-30' };
  const rows = totals(s, nov);
  assert.deepEqual(rows.map((r) => [r.student.name, r.count]), [['أحمد', 2], ['بدر', 2], ['جود', 2], ['دانة', 0]]);
  assert.equal(totals(s, {})[0].count, 3, 'كل الفترة');
  assert.deepEqual(summary(s, nov), { students: 4, participants: 3, coupons: 6 });
  assert.equal(honorees(rows, 1).length, 3, 'المتعادلون مع الأول يُكرمون جميعًا');
  assert.equal(honorees(totals(s, {}), 1).length, 1);
  assert.equal(honorees(totals(normalize({}), {}), 3).length, 0);
  assert.deepEqual(rows[0].topReasons, ['الإبداع']);
  const csv = toCSV(s, nov);
  assert.ok(csv.startsWith('﻿')); assert.match(csv, /أحمد,5,2,05\/11\/2026,الإبداع/);
  assert.equal(fmtDate('2026-11-05'), '05/11/2026');
  assert.ok(inPeriod('2026-11-30', '2026-11-01', '2026-11-30')); assert.ok(!inPeriod('2026-12-01', '', '2026-11-30'));
  assert.deepEqual(periodRange('month', new Date(2026, 1, 10)), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(periodRange('lastMonth', new Date(2026, 0, 10)), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(parseNames('1. سالم\n2) مريم\nسالم\n\n x \nخالد، ليلى', [{ name: 'خالد', grade: '' }]), ['سالم', 'مريم', 'ليلى']);
});

test('لا توجد بيانات شخصية أو مدرسية ثابتة داخل المبادرة', () => {
  const dir = new URL('../src/modules/excellence-cards/', import.meta.url).pathname;
  const files = []; const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); });
  walk(dir);
  const banned = ['حسين', 'الملك', 'عبدالعال', 'طلحة', 'عبيدالله', 'egyptionpharoh', 'hussien'];
  for (const f of files) { const txt = readFileSync(f, 'utf8'); for (const b of banned) assert.ok(!txt.includes(b), `${b} في ${f}`); }
  const e = emptyState(); assert.equal(e.settings.school, ''); assert.equal(e.settings.teacher, '');
});
