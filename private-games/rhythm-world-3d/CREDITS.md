# عالم الإيقاع ثلاثي الأبعاد (Rhythm World 3D) — المصادر والتراخيص

## المحتوى التعليمي
- ترتيب العلامات والسكتات والأشكال حسب الصفوف 1–8: منقول من مستويات لعبة MusiTeacher «مسابقة التدوين والإملاء الإيقاعي»
  (`private-games/rhythm-dictation/js/content.js`) المبنية على تسلسل دروس الإيقاع في أدلة المعلم — سلطنة عُمان.
  الصفوف 9–12: لا توزيع خاص لها هناك، فتُفتح لها كل العلامات.
- نصوص الشخصيات، وقاموس الأسماء المشكَّلة (113 اسمًا)، وقواعد ربط المقاطع بالإيقاع، وقوالب الوسائل المطبوعة: من إعداد MusiTeacher.

## رموز التدوين
- **Bravura** (SMuFL) — Steinberg Media Technologies GmbH — https://github.com/steinbergmedia/bravura
  الترخيص: SIL Open Font License 1.1 (النص في `assets/fonts/Bravura-OFL.txt`). مخططات الرموز مستخرجة إلى `src/notation/smufl.js`
  وتُرسم منها البطاقات (SVG) والمجسمات (بثق ثلاثي الأبعاد).

## الخط العربي
- **Cairo** — Mohamed Gaber / Google Fonts — https://github.com/google/fonts/tree/main/ofl/cairo
  الترخيص: SIL Open Font License 1.1 (النص في `assets/fonts/Cairo-OFL.txt`). نسخة مصغّرة (عربي ولاتيني) بصيغة WOFF.

## الأصوات (تسجيلات حقيقية فقط)
| الملف | المصدر | الترخيص |
|---|---|---|
| assets/audio/clap-*, claves-*, wood-* | Versilian Community Sample Library (VCSL) — نفس ملفات rhythm-dictation | CC0 1.0 |
| _shared/samples/violin/A4.mp3 (الصوت الممتد) | VSCO 2 Community Edition (الموارد المشتركة في MusiTeacher) | CC0 1.0 |
- نطق الشخصيات: أصوات المتصفح نفسه عبر Web Speech API (لا خدمة خارجية). بلا صوت عربي تظهر الجمل مكتوبة.

## المحرك
- Three.js (MIT) من `_shared/3d/vendor/three` · fflate (MIT) لقراءة ملفات Excel.
