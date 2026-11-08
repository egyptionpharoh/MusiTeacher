// خادم اختبار: يقدّم الواجهة المبنية + مسارات /api/pd-workshops الحقيقية (handlers.js) مع ذكاء اصطناعي «محاكى».
// AI=0 يحاكي خادمًا بلا مفتاح Gemini. AI_DELAY=ms يحاكي زمن الاستجابة. لا يتصل بأي خدمة خارجية.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { makeHandlers } from '../../src/lib/pd-workshops/handlers.js';

const dir = path.dirname(fileURLToPath(import.meta.url)); const dist = path.join(dir, '_dist');
const port = +(process.env.PORT || 5330); const delay = +(process.env.AI_DELAY || 600);
let n = 0;
const POOL = ['مختبر الأسئلة السريعة: سؤال واحد يكشف الفهم', 'سوق الحلول المصغّر لمشكلات الصف', 'بطاقات التحدي المتبادلة بين التخصصات', 'ساعة الرمل: إدارة الانتقالات داخل الحصة',
  'خريطة الأخطاء الشائعة في مادتي', 'دفتر الحوار الصامت بين المعلمين', 'لوحة الأدلة: كيف نعرف أن الطلبة تعلموا؟', 'مسرح الدقيقة الواحدة للتعلم', 'رحلة صورة: التعلم البصري في كل المواد',
  'مقهى المعلمين التربوي', 'الطالب المعلّم ليوم واحد', 'مختبر الصوت والإيقاع للمواد الأخرى'];
export const fakeAI = {
  configured: () => process.env.AI !== '0',
  async generateJSON({ prompt }) {
    await new Promise((r) => setTimeout(r, delay));
    if (prompt.startsWith('اقترح')) {
      const k = ++n; const one = /اقترح 1 /.test(prompt);
      const mk = (j) => ({
        title: POOL[((k - 1) * 3 + j) % POOL.length],
        tag: 'فكرة مولدة للاختبار (ذكاء اصطناعي محاكى).', domain: ['questions', 'community', 'thinking'][j % 3], duration: 20, format: 'workshop', level: 'beginner',
        summary: 'وصف موجز للفكرة المولدة.', importance: 'أهمية الفكرة.', goal: 'هدف عام للفكرة.',
        objectives: ['يصوغ المعلم سؤالًا تشخيصيًا واحدًا.', 'يحلل إجابات الطلبة في دقيقتين.'],
        axes: [{ t: 'المحور الأول', p: ['نقطة أ', 'نقطة ب'], ex: 'مثال صفي' }, { t: 'المحور الثاني', p: ['نقطة ج'] }],
        materials: ['بطاقات'], strategies: ['التعلم النشط'], warmup: { t: 'تمهيد', s: ['خطوة'] },
        activity: { t: 'نشاط', g: 'أزواج', s: ['خطوة 1', 'خطوة 2'], out: 'منتج' }, discussion: ['سؤال؟'],
        evaluation: { m: 'بطاقة خروج', items: ['بند (نعم/لا)'] }, outcomes: ['نتيجة'], recs: ['توصية'], refs: ['Fabricated (2022). Should be removed.'],
      });
      return { model: 'fake', data: { ideas: one ? [mk(0)] : [mk(0), mk(1), mk(2)] } };
    }
    if (prompt.startsWith('أعدّ مشغلًا')) {
      return { model: 'fake', data: {
        title: 'من مستهلك للمحتوى إلى صانع للموارد التعليمية بالذكاء الاصطناعي', tagline: 'نسخة أعدها الذكاء الاصطناعي (محاكاة اختبار)',
        audienceText: 'معلمو جميع التخصصات', summary: 'ملخص مولد.', importance: 'أهمية مولدة.', goal: 'تمكين المعلمين من إنتاج مورد تعليمي ومراجعته.',
        objectives: ['يصوغ المعلم طلبًا فعالًا للأداة.', 'يقيّم مخرجات الأداة بقائمة تحقق.', 'ينتج موردًا تعليميًا لدرس قادم.'],
        materials: ['أجهزة'], strategies: ['النمذجة'], outcomes: ['مورد لكل مشارك'],
        opening: { welcome: 'مرحبًا بكم في مشغل اليوم.', agreements: ['الالتزام بالوقت'] },
        hook: { title: 'من صنع هذا؟', purpose: 'إثارة الاهتمام', steps: ['عرض نشاطين', 'تصويت'] },
        axes: [{ title: 'لماذا نصنع؟', explain: 'شرح الميسر للمحور الأول.', points: ['نقطة 1', 'نقطة 2'], example: 'مثال من حصة الموسيقى' },
          { title: 'كيف نكتب الطلب؟', explain: 'شرح المحور الثاني.', points: ['الدور', 'الهدف', 'الصيغة'], example: 'طلب نموذجي' },
          { title: 'كيف نراجع الناتج؟', explain: 'شرح المحور الثالث.', points: ['الدقة', 'الملاءمة'], example: 'قائمة تحقق' }],
        activity: { title: 'اصنع موردك', grouping: 'أزواج', steps: ['اختر درسًا', 'اكتب طلبًا', 'راجع وعدّل', 'اعرض'], output: 'مورد جاهز', tips: ['تجول بين الأزواج'] },
        discussion: { questions: ['ما الجزء الأصعب؟', 'متى لا نستخدم الأداة؟'] },
        closing: { takeaway: 'المعلم صانع لا مستهلك.', recs: ['مورد واحد أسبوعيًا'] },
        evaluation: { method: 'منتج + بطاقة خروج', items: ['أنتجت موردًا (نعم/لا)'], feedback: ['ما أهم فكرة؟', 'قيّم المشغل من 1 إلى 5'] },
        refs: ['Invented, A. (2024). Fake ref.'],
      } };
    }
    const sec = (prompt.match(/أعد كتابة قسم «([^»]+)»/) || [])[1] || '';
    if (sec === 'النشاط التطبيقي') return { model: 'fake', data: { activity: { title: 'نشاط معاد الصياغة', grouping: 'مجموعات ثلاثية', steps: ['خطوة جديدة أولى', 'خطوة جديدة ثانية'], output: 'منتج جديد' } } };
    if (sec === 'الأهداف') return { model: 'fake', data: { objectives: ['هدف جديد أول قابل للقياس.', 'هدف جديد ثانٍ.'] } };
    return { model: 'fake', data: {} };
  },
};
const handlers = makeHandlers({
  ai: fakeAI, log: () => {}, burstMax: 100, hourlyMax: 1000,
  verifyIdToken: async (t) => { if (String(t).startsWith('good-')) return { uid: t.slice(5) }; throw new Error('bad'); },
  findUser: async (uid) => (uid === 'expired' ? { isSubscribed: false } : { role: 'user', isSubscribed: true, subscriptionEndDate: new Date(Date.now() + 864e5) }),
});
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const m = url.pathname.match(/^\/api\/pd-workshops\/(\w+)$/);
  if (m) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : Buffer.concat(chunks) });
    const fn = req.method === 'GET' ? (m[1] === 'status' ? handlers.status : null) : handlers[m[1]];
    const r = fn ? await fn(request) : Response.json({ ok: false, error: 'not-found' }, { status: 404 });
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const f = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
  if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end('nf');
}).listen(port, '127.0.0.1', () => console.log(`pd harness on ${port} (AI ${process.env.AI === '0' ? 'off' : 'fake'})`));
