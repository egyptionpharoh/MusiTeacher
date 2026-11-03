# إضافة لعبة جديدة إلى «مختبر الألعاب الافتراضية»

1. أنشئ مجلدًا: `private-games/<game-id>/` (حروف إنجليزية صغيرة وأرقام وشرطة فقط) وضع فيه `index.html` وأي ملفات تخصه.
   **لا تضعه أبدًا داخل `public/`** — المجلد `private-games` لا يُخدم إلا عبر `/play/<id>/` بعد التحقق من الجلسة.
2. ضع غلافًا (JPG ~1280×720) في `public/lab-covers/<game-id>.jpg`.
3. أضف عنصرًا في `src/data/virtualGames.js` داخل `VIRTUAL_GAMES`:
```js
{
  id: 'my-game', title: 'اسم اللعبة', description: 'وصف قصير',
  category: 'strings',            // strings | keys | percussion | scales | notation
  grade: 'الصف الرابع',            // أو null
  status: 'available',            // available | soon (للمدير فقط) | unavailable (مخفية)
  entry: 'index.html', cover: '/lab-covers/my-game.jpg', tags: ['كلمة'],
  listInLab: true,                // false = لا تظهر في شبكة المختبر (تُفتح من بطاقتها في «الألعاب الموسيقية» فقط)
  settings: { threeD: true, needsAudio: true, markCorner: 'bottom-left', allowDownloads: false, allowPrint: false },
}
```
- `allowDownloads: true` يسمح للعبة بتنزيل ملفات (مثل «تصدير ملف» النوتة).
- `allowPrint: true` لا يُخفي الصفحة عند الطباعة ولا يمنع Ctrl+P (للألعاب التي فيها زر «طباعة» مقصود).
- لعبة تظهر كبطاقة في «الألعاب الموسيقية» (`src/lib/gamesConfig.js`) وتُخدم محميًة: أعطها `labId: '<game-id>'` بدل `path`،
  فتفتح البطاقة `/dashboard/resources/lab/<game-id>`، ويُحوَّل الرابط القديم `/dashboard/resources/<id>` إليها تلقائيًا.
  مثال: `melodic-dictation` (مسابقة التدوين والإملاء اللحني).
4. لا شيء آخر: البطاقة وصفحة التشغيل والحماية تعمل تلقائيًا. لتصنيف جديد أضفه في `GAME_CATEGORIES`.

## ملاحظات
- المكتبات الخارجية (CDN) يجب أن تكون مسموحة بالرابط؛ الأفضل وضع نسخة محلية داخل مجلد اللعبة.
- متغير البيئة `GAME_SESSION_SECRET` (نص عشوائي طويل) يُنصح بضبطه في الإنتاج؛ وإلا يُشتق من `FIREBASE_PRIVATE_KEY`.
- التحقق من هوية المستخدم لا يستعمل `firebase-admin` (كان يُسقط المسار على Vercel): `src/lib/virtual-games/firebase-token.js`
  يتحقق من توقيع رمز Firebase بمفاتيح Google العامة. يحتاج `FIREBASE_PROJECT_ID` أو `NEXT_PUBLIC_FIREBASE_PROJECT_ID`، و`MONGODB_URI`.
- فحص الإعداد في الإنتاج: افتح `/api/virtual-games/health` — يعرض نعم/لا لكل متطلب (السر، معرف المشروع، قاعدة البيانات،
  مجلد الألعاب، مفاتيح Google) دون كشف أي قيمة.
- الاختبار: `node --test tests/virtual-games.test.mjs tests/firebase-token.test.mjs`.

---

# إضافة آلة أو تغيير عينات الصوت (محرك MTAudio المشترك)

المحرك في `private-games/_shared/mt-sampler.js` والعينات في `private-games/_shared/samples/<set>/`.
الوصول إليها يتم عبر `/play/<أي-لعبة>/_shared/...` وبنفس كوكي الجلسة، فهي محمية كباقي الملفات.

## 1) جهّز مجموعة العينات
- ملفات `mp3` باسم النغمة: `C4.mp3` و`Fs4.mp3` (للدييز `s`) و`Bb3.mp3` (للبيمول `b`).
- يُفضَّل عيّنة كل 3 أنصاف نغمات (تقل الإزاحة فتبقى الجودة) وأحادية القناة وبطول مناسب:
  آلات الاستمرار (كمان/أكورديون) 3–8 ثوانٍ، آلات الضرب (إكسيليفون) حسب رنينها، البيانو 6–7 ثوانٍ.
- `manifest.json` بجانبها:
```json
{ "set": "my-instrument", "ext": "mp3", "kind": "sustained",
  "notes": { "C4": 60, "E4": 64 }, "gains": { "C4": 1.0, "E4": 0.95 } }
```
  `kind`: `sustained` (قوس/نفخ) · `sustained-loop` (تكرار متقاطع للنغمات الأطول من العينة) · `decaying` (بيانو) · `struck` (إكسيليفون).
  `gains` اختياري لمعايرة مستوى كل عينة.
- **الترخيص أولًا**: أضف المجموعة في `_shared/credits.json` وفي `AUDIO_CREDITS.md`. لا تستخدم عينة لا يمكن التحقق من رخصتها.

## 2) اربطها بكائن الصوت في اللعبة
```html
<script src="./_shared/mt-sampler.js"></script>
```
```js
MTAudio.attach(audioObject, {          // لأي كائن له ctx و dry و play(midi, when, dur, ...)
  set: 'my-instrument',
  attack: 0.01, release: 0.15, minHold: 0.1, // غلاف الصوت
  maxShift: 3,                         // أقصى إزاحة طبقة (نصف نغمة) عن أقرب عينة
  variation: 1,                        // 0 = بلا تنويع عشوائي
  args: (a, b) => ({ vel: a }),        // يترجم وسائط play الإضافية إلى { vel, gain, cents, out }
  onstate: (state) => {}               // 'ready' | 'failed'
});
```
إن فشل التحميل تستمر اللعبة بصوتها المولَّد القديم تلقائيًا.

## 3) اختبر
`python3 tests/audio_check.py <game-id> 60 64 67` يقيس الصوت الفعلي ويطبع الطبقة المسموعة مقابل المتوقعة.


## ألعاب ثلاثية الأبعاد بعازفة
الأساس المشترك في `private-games/_shared/3d/` (three.js، Rig، SeatedPlayer). مثال كامل: `docs/ACCORDION_3D.md`.
