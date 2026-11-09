// منطق الكتاب المفتوح: أي صفحات تظهر معًا، وأين تقع، وما الذي يُقلَّب.
// اتجاه عربي (rtl): الصفحة الأولى من الزوج على اليمين، والتقدّم يقلب الورقة اليسرى نحو اليمين.

/** الصفحات الظاهرة في «منظر» معيّن. في وضع الصفحتين: الغلاف وحده، ثم أزواج (2،3) (4،5)… */
export function viewPages(view, total, mode) {
  if (mode === 'single') return view >= 1 && view <= total ? [view] : [];
  if (view === 0) return [1];
  const a = view * 2, b = a + 1;
  return [a, b].filter((p) => p <= total);
}

export function viewCount(total, mode) { return mode === 'single' ? total : Math.floor(total / 2) + 1; }
export function firstView(mode) { return mode === 'single' ? 1 : 0; }
export function lastView(total, mode) { return mode === 'single' ? total : Math.floor(total / 2); }

/** المنظر الذي يحتوي الصفحة */
export function viewOf(page, mode) { return mode === 'single' ? page : Math.floor(page / 2); }

/**
 * مكان كل صفحة في المنظر: 'first' (جهة البداية: يمين في العربي) أو 'second' أو 'center' (صفحة واحدة/الغلاف).
 * في وضع الصفحتين: الصفحة الزوجية في جهة البداية، والفردية بعدها.
 */
export function slotsOf(view, total, mode) {
  const pages = viewPages(view, total, mode);
  if (mode === 'single') return { center: pages[0] || null };
  if (view === 0) return { second: 1 }; // الغلاف في جهة «التالي» كما يُفتح الكتاب الحقيقي
  return { first: pages[0] || null, second: pages[1] || null };
}

/** الجهة الفعلية على الشاشة لكل خانة */
export function sideOf(slot, dir) {
  if (slot === 'center') return 'center';
  if (dir === 'rtl') return slot === 'first' ? 'right' : 'left';
  return slot === 'first' ? 'left' : 'right';
}

/**
 * وصف حركة التقليب بين منظرين متتاليين (وضع الصفحتين):
 *  - forward: الورقة في جهة «second» تنقلب نحو جهة «first»: وجهها = second الحالية، وظهرها = first التالية.
 *  - back:    الورقة في جهة «first» تنقلب نحو «second»: وجهها = first الحالية، وظهرها = second السابقة.
 *  under: ما يظهر تحت الورقة أثناء الحركة.
 */
export function flipPlan(view, target, total, mode) {
  const cur = slotsOf(view, total, mode);
  const nxt = slotsOf(target, total, mode);
  if (mode === 'single') {
    return { forward: target > view, front: cur.center, back: null, under: nxt.center, stay: null };
  }
  if (target > view) return { forward: true, front: cur.second || null, back: nxt.first || null, under: nxt.second || null, stay: cur.first || null };
  return { forward: false, front: cur.first || null, back: nxt.second || null, under: nxt.first || null, stay: cur.second || null };
}
