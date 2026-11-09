# الكتاب التفاعلي الذكي 📖

يحوّل ملف PDF إلى كتاب رقمي تُقلَّب صفحاته ويشرح عليه المعلم أمام طلابه.

- الصفحة: `src/app/dashboard/tools/interactive-book/page.js`
- محرك العرض: PDF.js 6.2.108 (Mozilla، رخصة Apache‑2.0) كملفات ثابتة في `public/vendor/pdfjs` — لا يحتاج `npm install`.
- التقليب ثلاثي الأبعاد مكتوب داخل الأداة (`ui/BookReader.js` + `core/layout.js`) دون مكتبات خارجية.
- التخزين: IndexedDB في متصفح المعلم، قاعدة مستقلة لكل حساب `musiteacher-interactive-book:<uid>`:
  ملف PDF الأصلي كما هو، صور مصغّرة، نص الصفحات للبحث، الرسومات، الملاحظات، العلامات، وآخر صفحة.
  لا يُرفع أي شيء إلى خادم.

## الملفات
- `core/pdf.js` تحميل PDF.js، فتح الملفات، استخراج النص، رسائل الأخطاء.
- `core/process.js` تجهيز الملف (تحقق، بصمة لمنع التكرار، نصوص، صور مصغّرة، تقدم حقيقي).
- `core/renderer.js` رسم الصفحات عند الحاجة مع ذاكرة مؤقتة (LRU).
- `core/layout.js` منطق الصفحتين المتقابلتين واتجاه التقليب.
- `core/annotations.js` الرسم والممحاة والتراجع.
- `core/search.js` بحث عربي يتجاهل التشكيل والهمزات.
- `core/storage.js` مكتبتي الرقمية.
- `ui/*` الواجهة.

## الاختبار
- `node --test tests/interactive-book.test.mjs`
- واجهة كاملة خارج Next: `bun tests/interactive-book/build-ui.cjs` ثم `node tests/interactive-book/serve.cjs` وافتح `http://localhost:5350/?uid=teacherA`
