# مشاركة الألعاب مع الطلاب — MusiTeacher Games

نسختان من كل لعبة:
1. **الأصلية المدفوعة**: `private-games/<id>` داخل MusiTeacher — كما هي، بتسجيل الدخول والاشتراك، **لم يُعدَّل فيها أي ملف**.
2. **الطلابية المستنسخة**: `musiteacher-games/games/<id>` — مشروع مستقل يُنشر وحده، والدخول برمز من 6 أرقام.

الدليل التقني الكامل (النشر، تغيير الرابط كل فصل، الحماية): `musiteacher-games/README-ar.md`.

## ما أُضيف إلى MusiTeacher (إضافة فقط، لا يغيّر سلوك أي أداة قائمة)

| الملف | الدور |
|---|---|
| `src/app/dashboard/resources/lab/[labId]/page.js` | **تعديل من سطرين**: زر «مشاركة اللعبة مع الطلاب» بجوار «إعادة تحميل» (للمشتركين والمدير) |
| `src/components/student-games/ShareGameButton.jsx` + `share.css` | النافذة: الرابط، الرمز، نسخ، واتساب، معاينة، تجديد، إلغاء |
| `src/app/dashboard/student-games/page.js` | الإدارة المركزية: كل رموز المعلم + (للمدير) الإصدارات الفصلية |
| `src/app/api/student-games/share` | المعلم: الحصول على الرمز/إنشاؤه/تجديده/إلغاؤه (Firebase + اشتراك) |
| `src/app/api/student-games/verify` و`check` | لخادم MusiTeacher Games فقط (سرّ مشترك) |
| `src/app/api/student-games/config` | المدير: عنوان كل إصدار وحالته |
| `src/lib/student-games/*` | المنطق + الاعتماديات |
| `src/models/StudentGameShare.js`، `StudentGameAttempt.js`، `StudentGamesConfig.js` | مجموعات MongoDB جديدة (لا تمس `users`) |
| `tests/student-games.test.mjs` | 12 اختبارًا |

### متغيرات البيئة (مشروع MusiTeacher)
- `STUDENT_GAMES_SECRET`: نص عشوائي ≥ 24 حرفًا (تشفير الرموز وبصمتها). **لا تغيّره بعد الإطلاق** وإلا بطلت الرموز الحالية.
- `STUDENT_GAMES_BRIDGE_SECRET`: نص عشوائي ≥ 24 حرفًا، **ونفسه** في مشروع MusiTeacher Games.
- اختياري قبل ضبط الإصدارات من الصفحة: `STUDENT_GAMES_URL` و`STUDENT_GAMES_RELEASE`.

## حصر الألعاب (نوفمبر 2026)

| اللعبة | المسار الأصلي | التقنية | الأصول | قابلية الاستنساخ |
|---|---|---|---|---|
| accordion-3d | private-games/accordion-3d | وحدات JS + Three.js + شخصية ثلاثية الأبعاد | `_shared/3d` (FBX/JSON) + `_shared/samples/accordion` | ✔ |
| organ-3d | private-games/organ-3d | وحدات JS + Three.js + شخصية | `_shared/3d` | ✔ |
| violinist-3d | private-games/violinist-3d | وحدات JS + Three.js (نسخة خاصة) | Violinist.fbx، عينات كمان MP3 | ✔ |
| virtual-violin | private-games/virtual-violin | ملف HTML واحد (أصول مضمّنة) | — | ✔ (مُختبرة) |
| violin-scales | private-games/violin-scales | ملف HTML واحد | مضمّنة | ✔ |
| oudist-3d | private-games/oudist-3d | وحدات JS + Three.js + شخصية | `_shared/3d` | ✔ |
| virtual-oud | private-games/virtual-oud | ملف HTML واحد | — | ✔ |
| oud-3d | private-games/oud-3d | ملف HTML واحد (ثلاثي الأبعاد) | — | ✔ |
| oud-maqamat | private-games/oud-maqamat | ملف HTML واحد | مضمّنة | ✔ |
| virtual-qanun | private-games/virtual-qanun | ملف HTML واحد | — | ✔ |
| qanun-3d | private-games/qanun-3d | ملف HTML واحد (ثلاثي الأبعاد) | مضمّنة | ✔ |
| guitar-3d | private-games/guitar-3d | ملف HTML واحد (ثلاثي الأبعاد) | — | ✔ |
| piano-scales | private-games/piano-scales | ملف HTML واحد | مضمّنة | ✔ |
| accordion-scales | private-games/accordion-scales | ملف HTML واحد | مضمّنة | ✔ |
| xylophone | private-games/xylophone | ملف HTML واحد | مضمّنة | ✔ |
| percussion-3d | private-games/percussion-3d | وحدات JS + Three.js | 40 عينة MP3 | ✔ |
| band-3d | private-games/band-3d | وحدات JS + Three.js | 52 عينة MP3 | ✔ |
| omani-rhythms | private-games/omani-rhythms | وحدات JS + Three.js | 23 MP3 + 11 PNG | ✔ (مُختبرة) |
| oriental-organ-piano | private-games/oriental-organ-piano | وحدات JS (Web Audio) | ≈170 عينة MP3 | ✔ |
| melodic-dictation | private-games/melodic-dictation | وحدات JS + SVG | 10 MP3 | ✔ |
| rhythm-dictation | private-games/rhythm-dictation | وحدات JS + SVG | 27 MP3 | ✔ |
| time-signatures | private-games/time-signatures | وحدات JS + ثلاثي الأبعاد | 4 MP3 | ✔ (مُختبرة) |
| musiteacher-randomizer | public/games/musiteacher-randomizer | تطبيق مبني (Vite) | صوت + pdf.js | ✖ لا يُستنسخ: أداة صفية للمعلم وليست لعبة للطالب، وهي عامة أصلًا |

لا تستدعي أي لعبة من الألعاب المفحوصة خدمات MusiTeacher (`/api`، Firebase، كوكي الجلسة). أداة النسخ تعيد هذا الفحص في كل مرة وتسجّل أي إشارة في `data/sync-report.md`.
