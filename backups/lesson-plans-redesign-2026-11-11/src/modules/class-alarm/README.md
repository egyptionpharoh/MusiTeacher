# ⏰ منبّه الحصص الذكي (Class Alarm) داخل MusiTeacher

الصفحة: `/dashboard/tools/class-alarm` — الخدمات الاختيارية: `/api/class-alarm/[action]`.

## البنية (قابلة للفصل لتطبيق مستقل)
```
src/modules/class-alarm/
├─ core/      منطق نقي بلا React (يُختبر في Node):
│             time (المنطقة الزمنية Asia/Muscat)، model (البيانات والتطبيع)، schedule (اليوم والتنبيهات)،
│             engine (قرار الإطلاق: لا تكرار ولا تأخير)، parse (استيراد Excel/Word/CSV/رد الذكاء الاصطناعي)،
│             ics (تقويم بتنبيهات)، sheet (الجدول المنسق HTML)، docx، pdf، zip
├─ ui/        واجهة React + runtime (Worker + Web Locks + الإشعارات) + audio (نغمات مُركّبة) + storage (IndexedDB)
│             + sheetCanvas (رسم الجدول PNG/PDF) + class-alarm.css بالبادئة .ca-
├─ server/    extract.js (قراءة الصور/PDF بالذكاء الاصطناعي) + http.js (معالج الطلبات)
└─ adapters/  الملفات الوحيدة المرتبطة بالمنصة: musiteacherClient.js (متصفح)، musiteacherAuth.js و syncStore.js (خادم)
```
ملفات المنصة الأخرى: `src/app/dashboard/tools/class-alarm/page.js` و `ClassAlarmPage.js`،
`src/app/api/class-alarm/[action]/route.js`، و `public/class-alarm-sw.js` و `public/class-alarm.webmanifest` و `public/class-alarm/*.png`.

## أين تُحفظ البيانات
- الجداول والإعدادات والنغمات الخاصة: **IndexedDB في متصفح المعلم** (قاعدة `musiteacher-class-alarm`).
- سجل التنبيهات المُطلقة (لمنع التكرار): `localStorage` (`mt-class-alarm:fired`).
- المزامنة مع الحساب **اختيارية** (يفعّلها المعلم): مجموعة MongoDB باسم `class_alarm_sync`، مستند واحد لكل uid، بدون نغمات.

## متغيرات البيئة (كلها اختيارية)
| المتغير | الغرض |
|---|---|
| `CA_AI_ENABLED=true` | تفعيل قراءة الصور وملفات PDF بالذكاء الاصطناعي (**معطلة افتراضيًا** حتى لا يُستهلك رصيد دون قرارك) |
| `GEMINI_API_KEY` | موجود أصلًا؛ يُستخدم للقراءة الذكية عند التفعيل (`CA_GEMINI_MODEL` افتراضيًا gemini-2.5-flash) |
| `ANTHROPIC_API_KEY` | بديل اختياري (`CA_AI_PROVIDER_ORDER` افتراضيًا `gemini,claude`) |
| `CA_EXTRACT_RATE_LIMIT` | حد القراءات لكل معلم كل 10 دقائق (افتراضي 12) |
| `CA_SYNC_ENABLED=false` | لإيقاف المزامنة (تعمل افتراضيًا إن وُجد `MONGODB_URI`) |

ملفات Excel وWord وCSV تُقرأ **محليًا في المتصفح** ولا تحتاج أي مفتاح.

## حدود المنبه (صفحة ويب)
- يعمل بدقة والأداة مفتوحة، وفي تبويب خلفي أو متصفح مصغّر (مؤقت Worker + إشعارات النظام عبر Service Worker).
- لا يرن إذا أُغلق التبويب/المتصفح أو نام الجهاز — الحل المدمج: تصدير **ملف تقويم .ics** بتنبيهات يرن بها تقويم الهاتف/Outlook.
- Web Push للإشعار والمتصفح مغلق يحتاج: مفاتيح VAPID + مكتبة web-push + مُجدول كل دقيقة (Vercel Cron للخطط المدفوعة أو خدمة خارجية) — غير منفّذ.

## الاختبارات
- `node --test tests/class-alarm.test.mjs` (النواة + الخادم + Word/PDF)
- واجهة خارج Next: `node tests/class-alarm/build-ui.cjs` (يتطلب esbuild أو Bun) ثم `node tests/class-alarm/serve.cjs` → http://127.0.0.1:5330
