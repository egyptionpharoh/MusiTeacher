// تعليمات الذكاء الاصطناعي لمساعد الإنماء المهني. منفصلة عن المنطق حتى يسهل تحسينها.
import { DOMAINS, SPECS, AUDIENCES, FORMATS, LEVELS, STYLES, DEPTHS, STAGES, label } from './taxonomy.js';

export const SYSTEM = `أنت خبير في تصميم برامج الإنماء المهني للمعلمين في مدارس سلطنة عُمان، وتكتب بالعربية الفصحى الواضحة.
قواعد ملزمة:
1. اكتب محتوى عمليًا قابلًا للتنفيذ في مدرسة حقيقية خلال الزمن المحدد، بأمثلة صفية واقعية.
2. صُغ الأهداف إجرائية قابلة للقياس تبدأ بفعل مضارع (يصوغ، يصمم، يميز، يطبق...) ولا تستخدم أفعالًا غامضة (يفهم، يعرف، يدرك).
3. لا تختلق مراجع أو دراسات أو نسبًا مئوية أو إحصاءات أو أسماء باحثين أو نتائج أبحاث. لا تذكر أي رقم إحصائي إطلاقًا.
4. لا تنسب أي سياسة أو قرار أو تعميم أو إجراء إلى وزارة التعليم في سلطنة عُمان أو أي جهة رسمية.
5. استخدم كلمة «الطلبة» و«المشاركين» و«الميسّر». لا تذكر أسماء أشخاص حقيقيين أو بيانات طلبة.
6. تجنب الحشو والعبارات العامة المكررة؛ كل جملة يجب أن تفيد الميسّر أو المشارك.
7. أعد JSON صالحًا فقط مطابقًا للبنية المطلوبة، دون Markdown ودون أي نص خارجه.`;

const enumLine = (name, list) => `${name}: ${list.map((x) => `"${x.id}" (${x.label})`).join('، ')}`;

export const IDEA_SHAPE = `{
 "title": "عنوان جذاب ومحدد (لا يتجاوز 12 كلمة)",
 "tag": "جملة قصيرة تلخص القيمة العملية",
 "domain": "معرّف المجال",
 "specs": ["معرّفات التخصصات"], "audience": ["معرّفات الفئات"],
 "duration": 45, "format": "معرّف الشكل", "level": "معرّف المستوى",
 "summary": "وصف الفكرة في 2–3 جمل", "importance": "لماذا هي مهمة للمعلمين الآن (جملتان)",
 "goal": "الهدف العام في جملة",
 "objectives": ["3–4 أهداف إجرائية قابلة للقياس"],
 "axes": [{"t": "عنوان المحور", "p": ["نقطتان أو ثلاث"], "ex": "مثال صفي واقعي"}],
 "materials": ["المواد والأدوات"], "strategies": ["استراتيجيات التدريب"],
 "warmup": {"t": "اسم النشاط التمهيدي", "s": ["خطوات قصيرة"]},
 "activity": {"t": "اسم النشاط التطبيقي", "g": "طريقة التجميع", "s": ["خطوات مرقمة ضمنًا"], "out": "المنتج الذي يخرج به المشارك"},
 "discussion": ["سؤالان للنقاش"],
 "evaluation": {"m": "طريقة قياس الأثر", "items": ["بنود قياس قصيرة مع مقياسها مثل (نعم/لا) أو (1–4)"]},
 "outcomes": ["المخرجات المتوقعة"], "recs": ["توصيات للتطبيق بعد المشغل"]
}`;

function enums() {
  return [enumLine('المجالات domain', DOMAINS), enumLine('التخصصات specs', SPECS), enumLine('الفئات audience', AUDIENCES),
    enumLine('الأشكال format', FORMATS), enumLine('المستويات level', LEVELS)].join('\n');
}

/** توليد أفكار جديدة غير مكررة. */
export function ideasPrompt({ filters = {}, topic = '', exclude = [], count = 3 }) {
  const want = [];
  if (filters.domain) want.push(`المجال: ${label(DOMAINS, filters.domain)}`);
  if (filters.spec && filters.spec !== 'all') want.push(`التخصص: ${label(SPECS, filters.spec)}`);
  if (filters.audience && filters.audience !== 'all') want.push(`الفئة: ${label(AUDIENCES, filters.audience)}`);
  if (filters.format) want.push(`الشكل: ${label(FORMATS, filters.format)}`);
  if (filters.level) want.push(`المستوى: ${label(LEVELS, filters.level)}`);
  if (filters.duration) want.push(`المدة التقريبية: ${filters.duration} دقيقة`);
  return `اقترح ${count} ${count === 1 ? 'فكرة' : 'أفكار'} لمشاغل إنماء مهني للمعلمين، مختلفة جذريًا في زاويتها عن بعضها وعن الأفكار المستبعدة أدناه.
${topic ? `موضوع أو احتياج يذكره المعلم: «${topic}»\n` : ''}${want.length ? `المطلوب: ${want.join('، ')}\n` : 'نوّع المجالات والأشكال بين الأفكار.\n'}
اجعل كل فكرة محددة (ليست عنوانًا عامًا مثل «التعلم النشط»)، وفيها نشاط تطبيقي يخرج منه المعلم بمنتج يستخدمه في صفه.
الأفكار المستبعدة (لا تكررها ولا تعِد صياغتها): ${exclude.slice(0, 60).map((t) => `«${t}»`).join('، ') || 'لا يوجد'}

المعرّفات المسموح بها:
${enums()}

أعد: {"ideas": [${IDEA_SHAPE}]}`;
}

export const WORKSHOP_SHAPE = `{
 "title": "", "tagline": "", "audienceText": "الفئة المستهدفة بجملة",
 "summary": "", "importance": "", "goal": "",
 "objectives": ["أهداف إجرائية قابلة للقياس"],
 "materials": [""], "strategies": [""], "outcomes": [""],
 "opening": {"welcome": "نص ترحيب يقوله الميسّر (2–3 جمل)", "agreements": ["اتفاقيات المشغل"]},
 "hook": {"title": "", "purpose": "", "steps": [""]},
 "axes": [{"title": "", "explain": "شرح يقدمه الميسّر (فقرة)", "points": ["نقاط العرض"], "example": "مثال من الواقع المدرسي"}],
 "activity": {"title": "", "grouping": "", "steps": [""], "output": "", "tips": ["نصائح للميسّر"]},
 "discussion": {"questions": [""]},
 "closing": {"takeaway": "الفكرة الرئيسة التي يخرج بها المشارك", "recs": ["توصيات ختامية للتطبيق"]},
 "evaluation": {"method": "", "items": ["بنود قياس الأثر"], "feedback": ["أسئلة بطاقة التغذية الراجعة"]},
 "notes": "ملاحظات للميسّر"
}`;

function settingsLines(s) {
  return [
    `المدة الكلية: ${s.duration} دقيقة`,
    `عدد المشاركين: ${s.participants}`,
    `التخصص: ${label(SPECS, s.spec, 'جميع التخصصات')}`,
    `المرحلة: ${label(STAGES, s.stage, 'جميع المراحل')}`,
    `مستوى التفصيل: ${label(DEPTHS, s.depth)}`,
    `أسلوب التقديم: ${label(STYLES, s.style)}`,
  ].join('\n');
}

const ideaBrief = (i) => JSON.stringify({
  title: i.title, summary: i.summary, goal: i.goal, objectives: i.objectives, axes: i.axes,
  warmup: i.warmup, activity: i.activity, discussion: i.discussion, evaluation: i.evaluation, outcomes: i.outcomes, recs: i.recs,
});

/** إعداد مشغل كامل من فكرة. */
export function buildPrompt({ idea, settings }) {
  const nAxes = settings.duration <= 20 ? 2 : settings.duration <= 45 ? 3 : 4;
  return `أعدّ مشغلًا تدريبيًا كاملًا جاهزًا للتقديم انطلاقًا من الفكرة التالية، مع مراعاة الإعدادات.
الفكرة:
${ideaBrief(idea)}

الإعدادات:
${settingsLines(settings)}

متطلبات:
- ${nAxes} محاور مرتبة منطقيًا، لكل محور شرح يقوله الميسّر ومثال من مدرسة حقيقية${settings.spec !== 'all' ? ` في ${label(SPECS, settings.spec)}` : ''}.
- النشاط التطبيقي يناسب ${settings.participants} مشاركًا ويخرج منه المشارك بمنتج ملموس.
- مستوى التفصيل «${label(DEPTHS, settings.depth)}»: ${settings.depth === 'brief' ? 'نقاط مختصرة' : settings.depth === 'detailed' ? 'شرح وافٍ ونصائح تنفيذ للميسّر' : 'توازن بين الإيجاز والوضوح'}.
- لا تكتب الدقائق؛ الأداة توزع الزمن تلقائيًا.
- لا تضف مراجع.

أعد: ${WORKSHOP_SHAPE}`;
}

export const SECTIONS = {
  objectives: { label: 'الأهداف', shape: '{"objectives": ["3–5 أهداف إجرائية قابلة للقياس"]}' },
  hook: { label: 'النشاط التمهيدي', shape: '{"hook": {"title": "", "purpose": "", "steps": [""]}}' },
  axes: { label: 'المحاور', shape: '{"axes": [{"title": "", "explain": "", "points": [""], "example": ""}]}' },
  activity: { label: 'النشاط التطبيقي', shape: '{"activity": {"title": "", "grouping": "", "steps": [""], "output": "", "tips": [""]}}' },
  discussion: { label: 'أسئلة النقاش', shape: '{"discussion": {"questions": [""]}}' },
  closing: { label: 'الخاتمة والتوصيات', shape: '{"closing": {"takeaway": "", "recs": [""]}}' },
  evaluation: { label: 'التقويم والتغذية الراجعة', shape: '{"evaluation": {"method": "", "items": [""], "feedback": [""]}}' },
};

/** إعادة توليد جزء واحد من المشغل مع إبقاء البقية. */
export function sectionPrompt({ workshop, section, instruction = '' }) {
  const spec = SECTIONS[section];
  const ctx = {
    title: workshop.title, goal: workshop.goal, objectives: workshop.objectives,
    axes: workshop.axes.map((a) => a.title), activity: workshop.activity.title,
  };
  const current = section === 'objectives' ? workshop.objectives : workshop[section];
  return `هذا مشغل تدريبي قائم:
${JSON.stringify(ctx)}
الإعدادات:
${settingsLines(workshop.settings)}

أعد كتابة قسم «${spec.label}» فقط بصياغة جديدة أفضل ومختلفة عن الحالية، متسقة مع بقية المشغل.
${instruction ? `طلب الميسّر: «${instruction}»\n` : ''}النسخة الحالية (لا تكررها):
${JSON.stringify(current)}

أعد: ${spec.shape}`;
}
