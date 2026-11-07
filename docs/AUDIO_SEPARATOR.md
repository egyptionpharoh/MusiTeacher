# استوديو فصل الصوت بالذكاء الاصطناعي 🎧

أداة ضمن «أدوات المعلم» (`/dashboard/tools/audio-separator`): يرفع المعلم أغنية، ويختار **الصوت البشري فقط** أو **الموسيقى فقط**، ثم يستمع إلى النتيجة ويحمّلها (MP3 بمعدل 320 أو 192، أو WAV).

## كيف تعمل

```
المتصفح ──(1) طلب مهمة──▶ /api/audio-separator/jobs        (تحقق Firebase + الاشتراك + الحصص)
المتصفح ──(2) رفع مباشر─▶ Cloudflare R2  (رابط موقّع 15 دقيقة؛ لا يمر الملف عبر Vercel)
المتصفح ──(3) ابدأ──────▶ /api/audio-separator/jobs/:id     (الخادم يقرأ بايتات الملف: النوع الحقيقي والمدة)
الخادم  ──────────────▶ Replicate · Demucs v4 htdemucs_ft  (رابط قراءة مؤقت للملف)
المتصفح ──(4) متابعة كل 2.5 ث─▶ GET /jobs/:id  ◀── حالة حقيقية من Replicate (+ نسبة من سجل النموذج)
الخادم: عند الانتهاء يُنسخ المسار المطلوب إلى R2، ويُحذف الأصل فورًا
المتصفح ──(5) استماع/تنزيل ─▶ روابط R2 موقّعة لصاحب المهمة فقط (اسم الملف: Song_Instrumental.mp3)
```

- **لماذا ليس على Vercel؟** دوال Vercel لا تقبل أكثر من 4.5MB في الطلب ولا تملك GPU لتشغيل نموذج فصل.
- **النموذج:** [Demucs v4 – htdemucs_ft](https://github.com/facebookresearch/demucs) من Meta (رخصة MIT)، عبر [`ryan5453/demucs`](https://replicate.com/ryan5453/demucs) على Replicate.
  الإصدار **مثبّت** في `src/lib/audio-separator/config.js` لأن الإصدارات الأحدث من هذا النموذج غيّرت أسماء المدخلات.
- **بديل تجريبي:** `SEPARATOR_MODEL=bs-roformer` (نموذج BS-RoFormer أحدث وأدق في المقاييس، لكنه نموذج مجتمعي جديد بلا توثيق للرخصة).
  لا تفعّله قبل تشغيل الفحص الحي عليه ومراجعة شروطه.

## الملفات

| الملف | الدور |
|---|---|
| `src/app/dashboard/tools/audio-separator/page.js` | صفحة الأداة |
| `src/components/audio-separator/AudioSeparator.js` + `audio-separator.css` | الواجهة (أنماط مستقلة بالبادئة `as-`) |
| `src/app/api/audio-separator/{jobs,jobs/[jobId],limits,health}/route.js` | واجهات API |
| `src/lib/audio-separator/handlers.js` | منطق المهام والحصص والحماية (قابل للاختبار) |
| `src/lib/audio-separator/validate.js` | التحقق من الطلب وقراءة نوع الملف ومدته من بايتاته |
| `src/lib/audio-separator/provider-replicate.js` | الاتصال بـ Replicate |
| `src/lib/audio-separator/storage-r2.js` · `streams.js` | التخزين المؤقت في R2 |
| `src/lib/audio-separator/store-mongo.js` · `src/models/SeparationJob.js` | سجل المهام في MongoDB (بلا أي بيانات صوتية) |
| `src/app/dashboard/tools/page.js` | أُضيفت بطاقة الأداة فقط (سطران) |

## متغيرات البيئة

| المتغير | مطلوب؟ | الوصف |
|---|---|---|
| `REPLICATE_API_TOKEN` | **نعم** | مفتاح Replicate (يبدأ بـ `r8_`). بدونه تعرض الأداة «غير مفعّلة بعد» ولا تبدأ أي عملية. |
| `R2_ENDPOINT` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET_NAME` | موجودة | نفس متغيرات R2 الحالية في المشروع. |
| `SEPARATOR_R2_BUCKET` | اختياري | دلو مخصص للأداة بدل `R2_BUCKET_NAME` (مستحسن لعزل قواعد CORS والحذف). |
| `MONGODB_URI` `FIREBASE_PROJECT_ID` | موجودة | كما في بقية المنصة. |
| `SEPARATOR_MAX_MB` (120) · `SEPARATOR_MAX_MINUTES` (10) · `SEPARATOR_DAILY_LIMIT` (10) · `SEPARATOR_MAX_CONCURRENT` (4) · `SEPARATOR_RESULT_TTL_HOURS` (24) | اختياري | الحدود. |
| `SEPARATOR_MODEL` · `REPLICATE_DEMUCS_VERSION` | اختياري | تبديل النموذج أو إصداره. |

أضفها في Vercel ← Project ← Settings ← Environment Variables، ثم أعد النشر. لا تضع أي مفتاح بمتغير يبدأ بـ `NEXT_PUBLIC_`.

## الإعداد خطوة بخطوة (مرة واحدة)

1. **حساب Replicate:** أنشئ حسابًا في replicate.com، وأضف وسيلة دفع، وضع **حد إنفاق شهري** (Billing ← Spend limit)، ثم أنشئ مفتاح API.
2. **CORS لدلو R2** (Cloudflare ← R2 ← الدلو ← Settings ← CORS Policy) حتى يستطيع المتصفح الرفع مباشرة:
   ```json
   [
     {
       "AllowedOrigins": ["https://YOUR-DOMAIN.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. **قاعدة حذف تلقائي احتياطية** (R2 ← الدلو ← Settings ← Object lifecycle rules): Prefix = `audio-separator/` ، Delete objects after **1 day**.
   (الخادم يحذف الملفات بنفسه، وهذه القاعدة شبكة أمان لو تعذّر ذلك.)
4. **الفحص الحي** (يكلّف بضعة سنتات) على مقطع قصير تملكه:
   ```
   set REPLICATE_API_TOKEN=r8_xxxx
   node tests/audio-separator/live-check.mjs "D:\path\clip.mp3"
   ```
   استمع إلى الملفين في `live-check-output/`.
5. انشر، ثم افتح `/api/audio-separator/health` — يجب أن تكون `ok: true` (يعرض نعم/لا فقط بلا أي سر).

## الحدود وسياسة الاحتفاظ

- الصيغ: MP3, WAV, FLAC, M4A. يُفحص **محتوى** الملف على الخادم (لا الامتداد فقط)، وتُقرأ مدته من ترويسته قبل أي إرسال.
- 120MB و10 دقائق للملف، وعملية نشطة واحدة لكل مستخدم، و4 عمليات متزامنة للمنصة كلها، و10 عمليات يوميًا لكل معلم (الأدمن معفى). المحاولات المرفوضة قبل المعالجة لا تُحتسب.
- **الملف الأصلي:** يُحذف من R2 فور انتهاء المعالجة (نجاحًا أو فشلًا أو إلغاءً). Replicate يحذف نسخته ومخرجاته تلقائيًا بعد ساعة.
- **النتيجة:** تبقى 24 ساعة ثم تُحذف، أو فورًا بزر «حذف النتيجة الآن». روابطها موقّعة ومؤقتة (ساعة) وتُمنح لصاحب المهمة فقط.
- **سجل المهمة** في MongoDB (بلا صوت) يُحذف تلقائيًا بعد 7 أيام.
- يقر المعلم قبل كل عملية بأنه يملك حق معالجة التسجيل، ويوافق على إرساله لخدمة المعالجة.

## التكلفة التقديرية

- Replicate: Demucs يعمل على A100 بسعر نحو 0.0014$ للثانية، ويُحتسب وقت المعالجة الفعلي فقط.
  htdemucs_ft أبطأ بأربع مرات من النموذج الأساسي، فالتقدير **0.03–0.08$ لأغنية مدتها 4 دقائق** (الفحص الحي يطبع الثواني المدفوعة الفعلية).
  مثال: 100 معلم × 5 أغانٍ شهريًا ≈ 15–40$ شهريًا. الحصة اليومية وحد الإنفاق في Replicate يمنعان المفاجآت.
- R2: التخزين مؤقت وصغير، ولا رسوم على التنزيل — عمليًا ضمن الشريحة المجانية.

## الاختبارات

```
node --test tests/audio-separator.test.mjs                       # 43 اختبارًا: التحقق، الملفات الحقيقية، Replicate، API كاملة
node tests/audio-separator/build-ui.cjs && node tests/audio-separator/ui.cjs   # الواجهة في متصفح حقيقي (يتطلب playwright وesbuild)
```
اختبارات API والواجهة تستعمل معالجات الإنتاج الحقيقية، مع بدائل في الذاكرة للتخزين والمزوّد فقط (`tests/audio-separator/fakes.mjs`) — لا تُستورد في كود المنصة.

## مشكلات شائعة

| الرسالة | السبب والحل |
|---|---|
| «الأداة غير مفعّلة بعد» | `REPLICATE_API_TOKEN` أو متغيرات R2 غير مضبوطة في Vercel. |
| «تعذّر رفع الملف… (إعداد CORS للتخزين)» | قاعدة CORS في R2 لا تتضمن نطاق الموقع. |
| «مفتاح خدمة المعالجة غير صالح» / «رصيد غير كافٍ» | راجع المفتاح أو الفوترة في Replicate. |
| «إصدار نموذج الفصل غير متاح» | الإصدار المثبّت أُزيل؛ اضبط `REPLICATE_DEMUCS_VERSION` بإصدار يمر بالفحص الحي. |
| «نتيجة غير متوقعة» | تغيّر شكل مخرجات النموذج؛ شغّل الفحص الحي وأرسل سطر «مفاتيح المخرجات». |
