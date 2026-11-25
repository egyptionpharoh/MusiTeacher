// اختبارات خريطة التنقل في «أدوات المعلم»: مسار صريح لكل صفحة، ولا شيء خارج الأدوات العشر.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { navFor, TOOL_TITLES, HOME_PATH, TOOLS_PATH } from '../src/components/tools-nav/routes.js';

const TEN = ['music-factory', 'interactive-book', 'covers', 'audio-separator', 'workshops', 'plans', 'anthem', 'initiatives', 'class-alarm', 'committee-advisor'];

test('صفحة الأدوات: الرجوع إلى الرئيسية بمسار صريح', () => {
  for (const p of ['/dashboard/tools', '/dashboard/tools/', '/dashboard/tools?x=1', '/dashboard/tools#a']) {
    const n = navFor(p);
    assert.equal(n.kind, 'tools'); assert.equal(n.up.href, HOME_PATH); assert.equal(n.up.label, 'العودة للرئيسية');
  }
});

test('كل أداة من التسع: «الأدوات» ← /dashboard/tools، حتى في الصفحات الفرعية', () => {
  assert.deepEqual(Object.keys(TOOL_TITLES).sort(), [...TEN].sort());
  for (const slug of TEN) {
    for (const p of [`/dashboard/tools/${slug}`, `/dashboard/tools/${slug}/`, `/dashboard/tools/${slug}/sub/page?q=1`]) {
      const n = navFor(p);
      assert.equal(n.kind, 'tool', p); assert.equal(n.slug, slug); assert.equal(n.up.href, TOOLS_PATH); assert.equal(n.up.label, 'الأدوات');
      assert.ok(n.title.length > 3);
    }
  }
});

test('خارج النطاق: لا شريط (الموارد والألعاب وبقية الأدوات والرئيسية)', () => {
  for (const p of ['/', '/dashboard', '/dashboard/resources', '/dashboard/resources/lab/x', '/dashboard/tools/radio', '/dashboard/tools/guides',
    '/dashboard/tools/grading-forms', '/dashboard/tools/performance', '/dashboard/toolsX', '/dashboard/tools/__proto__', '/dashboard/tools/constructor', '/play/x', null, undefined, 5]) {
    assert.equal(navFor(p), null, String(p));
  }
});

test('لا router.back ولا history.back في شريط التنقل أو صفحة الأدوات', () => {
  for (const f of ['../src/components/tools-nav/ToolsNavBar.jsx', '../src/app/dashboard/tools/page.js', '../src/app/dashboard/tools/layout.js']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\/.*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/router\.back\(|history\.back\(/.test(s), f);
  }
});
