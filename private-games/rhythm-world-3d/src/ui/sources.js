// قائمة المصادر والتراخيص (لوحة جانبية تُفتح وتُغلق، لا تغطي المسرح كاملًا)
import { speechInfo } from '../audio/speech.js';
import { dictionarySize } from '../data/names.js';

export function showSources(app) {
  const box = app.$('#sources');
  if (!box.hidden) { box.hidden = true; return; }
  const v = speechInfo();
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:1.2rem">المصادر والتراخيص</h2><button id="src-x">✕ إغلاق</button></div>
  <h3>المحتوى التعليمي</h3>
  <div class="it">ترتيب ظهور العلامات والسكتات والأشكال حسب الصف منقول من مستويات لعبة MusiTeacher «مسابقة التدوين والإملاء الإيقاعي»، وهي مبنية على تسلسل دروس الإيقاع في أدلة المعلم (سلطنة عُمان) كما في بنك دروس MusiTeacher. الصفوف 9–12 ليس لها توزيع خاص هناك، فتُفتح لها كل العلامات.</div>
  <div class="it">نصوص الشخصيات، والقاموس المشكَّل لـ${dictionarySize} اسمًا، وطريقة ربط المقاطع بالإيقاع: من إعداد MusiTeacher لأغراض تعليمية، وليست تحليلًا لغويًا أو عروضيًا رسميًا.</div>
  <h3>رموز التدوين</h3>
  <div class="it"><b>Bravura</b> — خط الرموز الموسيقية القياسي SMuFL من Steinberg Media Technologies. الرموز مجسّمة ثلاثيًا ومطبوعة من مخططاته الدقيقة.<br><a href="https://github.com/steinbergmedia/bravura" target="_blank" rel="noopener noreferrer">github.com/steinbergmedia/bravura</a><br>الترخيص: SIL Open Font License 1.1</div>
  <h3>الخط العربي</h3>
  <div class="it"><b>Cairo</b> — Mohamed Gaber وGoogle Fonts (نسخة مصغّرة مضمّنة في اللعبة لتعمل الطباعة دون إنترنت).<br><a href="https://github.com/google/fonts/tree/main/ofl/cairo" target="_blank" rel="noopener noreferrer">github.com/google/fonts/tree/main/ofl/cairo</a><br>الترخيص: SIL Open Font License 1.1</div>
  <h3>الأصوات (تسجيلات حقيقية)</h3>
  <div class="it"><b>Versilian Community Sample Library (VCSL)</b> — التصفيق والكلافس والبلوك الخشبي (نفس تسجيلات لعبة الإملاء الإيقاعي).<br><a href="https://github.com/sgossner/VCSL" target="_blank" rel="noopener noreferrer">github.com/sgossner/VCSL</a><br>الترخيص: CC0 1.0 (ملك عام)</div>
  <div class="it"><b>VSCO 2 Community Edition</b> — نغمة الكمان الممتدة (من الموارد المشتركة في MusiTeacher).<br><a href="https://github.com/sgossner/VSCO-2-CE" target="_blank" rel="noopener noreferrer">github.com/sgossner/VSCO-2-CE</a><br>الترخيص: CC0 1.0</div>
  <div class="it"><b>نطق الشخصيات</b> — صوت عربي من المتصفح نفسه (Web Speech API)، لا يُرسل أي نص إلى خدمة من اللعبة.<br>الصوت المستخدم الآن: ${v.voice ? v.voice : 'لا يوجد صوت عربي في هذا المتصفح؛ تظهر الكلمات مكتوبة. يُنصح بمتصفح Microsoft Edge لأصواته العربية الطبيعية.'}</div>
  <h3>المحرك</h3>
  <div class="it">Three.js — رخصة MIT. النماذج ثلاثية الأبعاد والاستوديو مبنية برمجيًا داخل MusiTeacher.</div>`;
  box.hidden = false; box.querySelector('#src-x').addEventListener('click', () => { box.hidden = true; });
}
