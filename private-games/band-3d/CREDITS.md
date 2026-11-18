# آلات الباند – MusiTeacher · المصادر والتراخيص

## المرجع التعليمي
- وزارة التربية والتعليم (2024). سلطنة عمان. دليل المعلم – المهارات الموسيقية، الصف الأول.
  مصدر التعريفات وطرق العزف للآلات السبع (الكاستنيت، المثلث، الجلاجل، الإكسيليفون المعدني، الطبل الكبير، الدف ذو الجلاجل، الصنوج) ومدوّنة «If You Are Happy and You Know It».
- الآلات المضافة (الطبل الصغير، الكلافس، القالب الخشبي، الماراكاس): تعريفات موجزة مكتوبة للمنصة اعتمادًا على
  Britannica (snare drum · percussion instrument) و Wikipedia (Wood block · Maraca).

## التسجيلات الصوتية (assets/audio)
| الآلة | الملفات | المصدر | الترخيص |
|---|---|---|---|
| المثلث | triangle_* | VCSL › Idiophones/Struck Idiophones/Triangles (Triangle3: Hit, HitM, Roll) | CC0 1.0 |
| الجلاجل | jingles_* | VCSL › Sleigh Bells | CC0 1.0 |
| الإكسيليفون المعدني | glock_* | VCSL › Glockenspiel (G4 C5 G5 C6 G6/G♯6 C7 × medium/loud) — القضبان بين النغمات المسجّلة تُزاح بما لا يتجاوز 3 أنصاف أصوات | CC0 1.0 |
| الطبل الكبير | bass_* | VCSL › Bass Drum 1 | CC0 1.0 |
| الدف ذو الجلاجل | tamb_* | VCSL › Tambourine 1 (Hit, Shake, Roll) | CC0 1.0 |
| الصنوج | cymbals_* | VCSL › Clash Cymbals 1 | CC0 1.0 |
| الطبل الصغير | snare_* | VCSL › Snare Drum, Modern 1 (HitSN, stick, rollSN) | CC0 1.0 |
| الكلافس | claves_* | VCSL › Claves | CC0 1.0 |
| القالب الخشبي | wood_* | VCSL › Woodblock | CC0 1.0 |
| الكاستنيت · الماراكاس | cast_hit1 · maracas_hit1 | MuseScore General SoundFont (عيّنتا Castanet و Maracas، أصلهما FluidR3) | MIT |

- VCSL = Versilian Community Sample Library — https://github.com/sgossner/VCSL — CC0 1.0 (ملكية عامة، لا يُشترط الإسناد).
- MuseScore General — https://github.com/musescore/MuseScore/tree/master/share/sound — رخصة MIT، وإشعارها أدناه (يجب إبقاؤه مع الملفين).
- المعالجة: تحويل إلى mono MP3، قصّ الصمت في البداية، تلاشٍ في النهاية، وضبط المستوى. لم تُولَّد أي أصوات إلكترونيًا.
- قيد: للكاستنيت والماراكاس لقطة واحدة قصيرة لكل منهما؛ إن توفر تسجيل أغنى فاستبدل الملف بالاسم نفسه.

## النماذج ثلاثية الأبعاد
كل الآلات مبنية برمجيًا في `src/models.js` بخامات مرسومة برمجيًا في `src/textures.js`؛ لا توجد نماذج أو صور خارجية. محرّك العرض Three.js (MIT).

## إشعار رخصة MuseScore General (MIT)
FluidR3 (original version) by Frank Wen Copyright (c) 2000-02

Mono conversion (FluidR3Mono) by Michael Cowgill Copyright (c) 2014-17

Adaptation for MuseScore_General.sf2 by S. Christian Collins Copyright (c) 2018-19

Temple Blocks instrument provided by Ethan Winer Copyright (c) 2002

Drumline Cymbals provided by Michael Schorsch Copyright (c) 2016

MuseScore_General.sf2 is shared under the MIT license as described in COPYING, as was FluidR3Mono and FluidR3 before it.

The COPYING and README files from the original FluidR3GM file are now displayed here for reference.

The acknowledgements and copyright notices above must be included in any derivative work.


README
---

Fluid (R3) SoundFont

Copyright (c) 2000-2002, 2008 Frank Wen <getfrank@gmail.com>

I hereby release Fluid under the MIT license, as described in COPYING.


Thanks to Toby Smithe for helping to get Fluid included in Ubuntu.

This package, of course, is the original Release 3 of Fluid.  


Fluid was constructed in part from samples found in the public domain that I
edited/cleaned/remixed/programmed and largely from recordings of my own and
in conjunction with the people below who helped along the way:

Suren M. Seron
Scott Hanan
Steve Aupperle
Chris Gillman
Alex Taubr
Chris Prola
Andrew Klenk
Winfried Hubbe 
Dylan
Tim
Gort
Uros Katic 
Ethan Winer (http://www.ethanwiner.com) 


It's obviously been a few years since the project, but its nice to see that
people are still enjoying my work and getting good use out of it.  As always,
I'd like to hear some work done with Fluid so email me, or just email me to
say hello and tell me what is going on in the computer musician world.
Who knows, maybe I'll kick start this project again? ;)


COPYING
---

Mono version:  Copyright (c) 2014-16 Michael Cowgill 
Copyright (c) 2000-2002, 2008 Frank Wen <getfrank@gmail.com>

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

