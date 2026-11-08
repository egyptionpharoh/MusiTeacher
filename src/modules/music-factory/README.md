# 🎼 مصنع الألحان (Music Factory) داخل MusiTeacher

أداة المعلم لتحويل الكلمات إلى **أغنية مغناة** أو **موسيقى تصويرية**، مع برومبت احترافي متوافق مع Suno.
الصفحة: `/dashboard/tools/music-factory` — المسار البرمجي: `/api/music-factory/[action]`.

## البنية (قابلة للفصل)
```
src/modules/music-factory/
├─ core/        منطق نقي بلا React ولا Next (الكتالوج، المشروع، البرومبت المحلي، قارئ الوسوم)
├─ server/      الخادم فقط: brain.js (تحليل/برومبت عبر Claude ثم Gemini ثم محلي)، http.js (معالج الطلبات)،
│               engines/ (محرك لكل ملف: elevenlabs, lyria, replicate, sunoSelfHosted + index للاختيار والبديل)
├─ ui/          واجهة React (4 مراحل) + api.js + library.js (مكتبة IndexedDB على جهاز المعلم) + CSS بالبادئة .mf
└─ adapters/    الملفان الوحيدان المرتبطان بـ MusiTeacher: musiteacherAuth.js (خادم) و musiteacherClient.js (متصفح)
```
ملفات المنصة الأخرى: `src/app/dashboard/tools/music-factory/page.js` و `src/app/api/music-factory/[action]/route.js`.
**للفصل لاحقًا:** انقل المجلد كما هو، واستبدل ملفي `adapters/` بطريقة الدخول في المشروع الجديد.

## متغيرات البيئة (Vercel → Settings → Environment Variables) — كلها على الخادم فقط
| المتغير | الغرض |
|---|---|
| `ELEVENLABS_API_KEY` | محرك ElevenLabs Music الرسمي (أغانٍ بكلمات + موسيقى). يحتاج خطة مدفوعة. **الأفضل حاليًا.** |
| `GEMINI_API_KEY` | موجود أصلًا (المايسترو عبر Gemini). محرك Google Lyria يحتاج **أيضًا** `MF_LYRIA_ENABLED=true` حتى لا يُصرف من رصيد Gemini دون قرارك |
| `ANTHROPIC_API_KEY` | اختياري: المايسترو عبر Claude (تحليل الكلمات وكتابة البرومبت). بدونه يُستخدم Gemini ثم التحليل المحلي |
| `REPLICATE_API_TOKEN` + `MF_MUSICGEN_ENABLED=true` | MusicGen (موسيقى بلا غناء حتى 30 ثانية). التوكن مشترك مع استوديو فصل الصوت، لذلك يحتاج تفعيلًا صريحًا |
| `MF_AUDIO_ENGINE_ORDER` | ترتيب «تلقائي» (الافتراضي `elevenlabs,lyria,replicate`) |
| `MF_MAX_AUDIO_SECONDS` | أقصى مدة للنسخة الكاملة (افتراضي 240) |
| `MF_AUDIO_RATE_LIMIT` / `MF_BRAIN_RATE_LIMIT` | حد الطلبات لكل معلم كل 10 دقائق (افتراضي 6 / 30) |
| `MF_SUNO_SELFHOSTED_URL` + `MF_SUNO_UNOFFICIAL_ACK=I_ACCEPT_THE_RISK` | ⚠️ Suno غير رسمي عبر خادم suno-api. معطل افتراضيًا ولا يُستخدم تلقائيًا أبدًا |

لا تضع أي مفتاح في متغير يبدأ بـ `NEXT_PUBLIC_`.

## ملاحظات تشغيل
- التوليد قد يستغرق دقائق: المسار يضبط `maxDuration = 300` (يتطلب Fluid compute أو خطة Pro في Vercel).
- الصوت يُمرَّر مباشرة للمتصفح ولا يُخزن على الخادم؛ مكتبة الأعمال محفوظة في متصفح المعلم (IndexedDB).
- لا يوجد أي صوت تجريبي/وهمي: بدون مفتاح محرك تعرض الأداة رسالة واضحة ويبقى البرومبت متاحًا للنسخ.

## الاختبارات
`node --test tests/music-factory/server.test.mjs`
