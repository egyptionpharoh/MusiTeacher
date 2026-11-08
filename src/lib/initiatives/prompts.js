// تعليمات الذكاء الاصطناعي لمساعد المبادرات. منفصلة عن المنطق حتى يسهل تحسينها.
import { DOMAINS, LEADS, COSTS, SIZES, STAGES, NATURES, label } from './taxonomy.js';

export const SYSTEM = `أنت خبير في تصميم المبادرات والمشروعات المدرسية في مدارس سلطنة عُمان، وتكتب بالعربية الفصحى الواضحة.
قواعد ملزمة:
1. كل مبادرة قابلة للتنفيذ في مدرسة حقيقية بإمكاناتها المعتادة، ولها احتياج واضح، وتناسب المرحلة العمرية.
2. إذا احتاجت المبادرة موارد مكلفة فاقترح بديلًا بسيطًا في الحقل alt.
3. الأهداف إجرائية قابلة للقياس. المؤشرات تصف ما يُقاس وأداة قياسه، ولا تضع أي نسبة أو رقم مستهدف (الفريق يحدده بعد القياس القبلي).
4. لا تختلق إحصاءات أو دراسات أو مراجع أو أسماء جهات أو أشخاص، ولا تنسب أي مبادرة أو سياسة أو إجراء إلى وزارة التعليم في سلطنة عُمان أو أي جهة رسمية، ولا تنسب الفكرة إلى تجربة عالمية بعينها.
5. لا تفترض موافقات أو شراكات حاصلة: اذكر الشركاء بصيغة «محتمل/بعد التنسيق»، واذكر في approvals كل ما يحتاج موافقة الإدارة أو أولياء الأمور أو جهة خارجية.
6. لا تطلب بيانات شخصية للطلبة إلا للضرورة، ولا تقترح نشر صورهم دون موافقة.
7. استخدم «الطلبة» و«المعلمين» و«أولياء الأمور». تجنب العبارات الإنشائية العامة مثل «تحقيق التميز» أو «رفع المستوى».
8. أعد JSON صالحًا فقط مطابقًا للبنية المطلوبة، دون Markdown ودون أي نص خارجه.`;

const enumLine = (name, list) => `${name}: ${list.map((x) => `"${x.id}" (${x.label})`).join('، ')}`;
const enums = () => [enumLine('domain', DOMAINS), enumLine('lead', LEADS), enumLine('cost', COSTS), enumLine('size', SIZES), enumLine('stages', STAGES)].join('\n');

export const BRIEF_SHAPE = `{
 "title": "اسم مميز ومحدد (لا يتجاوز 10 كلمات)", "slogan": "عبارة تعريفية قصيرة",
 "domain": "", "topic": "الموضوع الفرعي", "lead": "", "cost": "", "size": "", "stages": [""], "weeks": 4,
 "summary": "وصف الفكرة وآلية تنفيذها في 2–3 جمل", "problem": "الاحتياج أو المشكلة التي تعالجها",
 "why": "ما الجديد في هذه الفكرة مقارنة بالمبادرات المعتادة (جملة)", "goal": "الهدف العام",
 "objectives": ["3 أهداف قابلة للقياس"], "audience": "الفئة المستهدفة", "join": "كيف يشارك الطلبة أو المعلمون (جملة)"
}`;

export const FULL_SHAPE = `{
 "title": "", "slogan": "", "domain": "", "topic": "", "lead": "", "cost": "", "size": "", "stages": [""], "weeks": 6,
 "summary": "وصف المبادرة", "problem": "المشكلة أو الاحتياج", "rationale": ["مبررات اختيارها"],
 "goal": "الهدف العام", "objectives": ["أهداف تفصيلية قابلة للقياس"],
 "audience": "الفئة المستهدفة", "beneficiaries": "تقدير تقريبي لعدد المستفيدين أو نطاقهم",
 "team": [{"r": "الدور", "tasks": "المهام"}], "partners": ["شريك محتمل (بعد التنسيق)"],
 "resources": [{"i": "المورد", "c": "free|low|partner", "alt": "بديل بسيط إن كان مكلفًا"}],
 "phases": [{"t": "اسم المرحلة", "w": 2, "by": "المسؤول", "steps": ["خطوات وأنشطة مرتبة"]}],
 "kpis": [{"k": "مؤشر قابل للقياس دون نسبة مستهدفة", "tool": "أداة القياس"}],
 "evaluation": ["أساليب التقييم"], "outputs": ["المخرجات المتوقعة"], "sustain": ["فرص الاستدامة والتطوير والتعميم"],
 "approvals": ["الموافقات المطلوبة"], "join": "طريقة المشاركة", "survey": ["3 بنود لاستبانة قياس الأثر يجيب عنها المستفيدون"]
}`;

function optionsLines(o = {}) {
  const L = [];
  if (o.domain) L.push(`المجال: ${label(DOMAINS, o.domain)}`);
  if (o.stage) L.push(`المرحلة: ${label(STAGES, o.stage)}`);
  if (o.audience) L.push(`الفئة المستهدفة: ${o.audience}`);
  if (o.size) L.push(`الحجم: ${label(SIZES, o.size)}`);
  if (o.weeks) L.push(`مدة التنفيذ: ${o.weeks} ${o.weeks <= 2 ? 'أسبوع' : 'أسابيع'} تقريبًا`);
  if (o.cost) L.push(`الإمكانات: ${label(COSTS, o.cost)}`);
  if (o.participants) L.push(`عدد المشاركين التقريبي: ${o.participants}`);
  if (o.nature) L.push(`طبيعة المبادرة: ${label(NATURES, o.nature)}`);
  return L;
}

/** ابتكار أفكار جديدة مختلفة في جوهرها. */
export function ideasPrompt({ request = '', options = {}, exclude = [], count = 3 }) {
  const opts = optionsLines(options);
  return `ابتكر ${count} ${count === 1 ? 'مبادرة مدرسية' : 'مبادرات مدرسية'} جديدة.
${request ? `طلب المعلم: «${request}»\n` : ''}${opts.length ? `الخيارات المحددة:\n${opts.join('\n')}\n` : 'نوّع المجالات ومن يقود المبادرة بين الأفكار.\n'}
شروط التنوع: يجب أن تختلف الأفكار فيما بينها في آلية التنفيذ وليس في الاسم فقط (مثلًا: تحدٍّ، معرض، فريق طلابي، شراكة أسرية، رصد وبيانات، إنتاج إعلامي)، وألا تكون إعادة صياغة لأي من المبادرات المستبعدة أدناه.
المبادرات المستبعدة: ${exclude.slice(0, 80).map((t) => `«${t}»`).join('، ') || 'لا يوجد'}

القيم المسموح بها:
${enums()}

أعد: {"ideas": [${BRIEF_SHAPE}]}`;
}

const planBrief = (i) => JSON.stringify({
  title: i.title, slogan: i.slogan, domain: i.domain, lead: i.lead, cost: i.cost, size: i.size, stages: i.stages, weeks: i.weeks,
  summary: i.summary, problem: i.problem, goal: i.goal, objectives: i.objectives, audience: i.audience,
  ...(i.phases && i.phases.length ? { team: i.team, resources: i.resources, phases: i.phases, kpis: i.kpis, partners: i.partners } : {}),
});

/** تطوير فكرة إلى خطة تنفيذية كاملة مع تعديلات المعلم. */
export function developPrompt({ initiative, options = {}, tweaks = [], instruction = '' }) {
  const opts = optionsLines(options);
  const asks = [...tweaks, instruction].filter(Boolean);
  return `طوّر المبادرة التالية إلى خطة تنفيذية متكاملة جاهزة لتقديمها لإدارة المدرسة.
المبادرة:
${planBrief(initiative)}
${opts.length ? `\nإعدادات المعلم:\n${opts.join('\n')}\n` : ''}${asks.length ? `\nتعديلات مطلوبة (التزم بها كلها):\n- ${asks.join('\n- ')}\n` : ''}
متطلبات:
- 3 إلى 5 مراحل متتابعة، مجموع أسابيعها يساوي weeks، ولكل مرحلة مسؤول وخطوات عملية.
- فريق عمل بأدوار ومهام واضحة، وموارد مع بدائل بسيطة لما يحتاج تكلفة.
- مؤشرات قابلة للقياس مع أداة قياس لكل مؤشر، دون نسب مستهدفة.
- اجعل التفاصيل مناسبة لطبيعة هذه المبادرة تحديدًا.

أعد: ${FULL_SHAPE}`;
}

export const SECTIONS = {
  objectives: { label: 'الأهداف', shape: '{"goal": "", "objectives": [""]}', keys: ['goal', 'objectives'] },
  phases: { label: 'خطوات التنفيذ والجدول الزمني', shape: '{"phases": [{"t": "", "w": 1, "by": "", "steps": [""]}]}', keys: ['phases'] },
  team: { label: 'فريق العمل والمسؤوليات', shape: '{"team": [{"r": "", "tasks": ""}]}', keys: ['team'] },
  resources: { label: 'الموارد والشركاء', shape: '{"resources": [{"i": "", "c": "free|low|partner", "alt": ""}], "partners": [""]}', keys: ['resources', 'partners'] },
  kpis: { label: 'مؤشرات الأداء وأساليب التقييم', shape: '{"kpis": [{"k": "", "tool": ""}], "evaluation": [""]}', keys: ['kpis', 'evaluation'] },
  sustain: { label: 'المخرجات والاستدامة', shape: '{"outputs": [""], "sustain": [""]}', keys: ['outputs', 'sustain'] },
  activities: { label: 'أنشطة إبداعية إضافية', shape: '{"phases": [{"t": "", "w": 1, "by": "", "steps": [""]}]}', keys: ['phases'] },
};

/** إعادة توليد جزء واحد مع إبقاء البقية. */
export function sectionPrompt({ initiative, section, instruction = '' }) {
  const spec = SECTIONS[section];
  const current = Object.fromEntries(spec.keys.map((k) => [k, initiative[k]]));
  return `هذه مبادرة مدرسية قائمة:
${planBrief(initiative)}

أعد كتابة قسم «${spec.label}» فقط بصياغة جديدة أفضل ومتسقة مع بقية المبادرة${section === 'phases' || section === 'activities' ? `، مع إبقاء مجموع الأسابيع ${initiative.weeks}` : ''}.
${section === 'activities' ? 'أضف إلى خطوات المراحل أنشطة إبداعية مناسبة للفئة المستهدفة دون حذف الخطوات الأساسية.\n' : ''}${instruction ? `طلب المعلم: «${instruction}»\n` : ''}النسخة الحالية:
${JSON.stringify(current)}

أعد: ${spec.shape}`;
}
