// الاتصال بمنصة MusiTeacher (خادم ↔ خادم فقط؛ المتصفح لا يرى السر المشترك أبدًا)
// MusiTeacher هي وحدها التي تعرف الرموز (مخزّنة مشفّرة في قاعدة بياناتها) واشتراك المعلم.
//
// كل فشل يرجع بسبب دقيق في الحقل detail (يُكتب في سجلات Vercel ويظهر في /api/health)،
// أما الطالب فيرى دائمًا رسالة لطيفة بلا تفاصيل تقنية.
export const BRIDGE_DETAIL = {
  'games-env-missing': 'MUSITEACHER_URL أو STUDENT_GAMES_BRIDGE_SECRET غير مضبوط في مشروع musiteacher-games',
  'bridge-secret-short': 'STUDENT_GAMES_BRIDGE_SECRET أقصر من 24 حرفًا (MusiTeacher يرفضه)',
  'mt-url-invalid': 'MUSITEACHER_URL ليس رابطًا صحيحًا',
  'mt-url-local': 'MUSITEACHER_URL يشير إلى جهاز محلي (localhost) أو ليس https — خوادم Vercel لا تصل إلى جهازك',
  'mt-unreachable': 'تعذّر الاتصال بـ MusiTeacher (العنوان خطأ أو الموقع متوقف أو تأخر الرد)',
  'mt-endpoint-missing': 'MusiTeacher يرد 404 على /api/student-games/* — النسخة المنشورة من MusiTeacher لا تحتوي ميزة الألعاب الطلابية',
  'mt-bad-response': 'MusiTeacher رد بشيء غير متوقع (ليس JSON)',
  'bridge-secret-mismatch': 'STUDENT_GAMES_BRIDGE_SECRET مختلف بين المشروعين',
  'mt-env-missing': 'MusiTeacher المنشور ينقصه STUDENT_GAMES_SECRET أو STUDENT_GAMES_BRIDGE_SECRET (أو أحدهما أقصر من 24 حرفًا)',
  'mt-server-error': 'خطأ داخل MusiTeacher (غالبًا الاتصال بقاعدة البيانات) — راجع سجلات مشروع musi-teacher',
};

const isLocalHost = (h) => /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$|10\.|192\.168\.)/i.test(h);

export function makeBridge(cfg, fetchImpl = globalThis.fetch) {
  async function call(pathname, body) {
    if (!cfg.musiteacherUrl || !cfg.bridgeSecretRaw) return { ok: false, error: 'not-configured', detail: 'games-env-missing' };
    if (!cfg.bridgeSecret) return { ok: false, error: 'not-configured', detail: 'bridge-secret-short' };
    let url;
    try { url = new URL(cfg.musiteacherUrl); } catch { return { ok: false, error: 'not-configured', detail: 'mt-url-invalid' }; }
    if (cfg.secure && (url.protocol !== 'https:' || isLocalHost(url.hostname))) return { ok: false, error: 'not-configured', detail: 'mt-url-local' };
    let res;
    try {
      res = await fetchImpl(cfg.musiteacherUrl + pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mtg-bridge': cfg.bridgeSecret },
        body: JSON.stringify({ ...body, release: cfg.release }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined,
      });
    } catch { return { ok: false, error: 'unreachable', detail: 'mt-unreachable' }; }
    let data = null; try { data = await res.json(); } catch { /* */ }
    if (!data || typeof data.ok !== 'boolean') {
      return { ok: false, error: 'unreachable', detail: res.status === 404 ? 'mt-endpoint-missing' : 'mt-bad-response', status: res.status };
    }
    if (!data.ok) {
      if (res.status === 401 || data.error === 'forbidden') return { ...data, detail: 'bridge-secret-mismatch' };
      if (data.error === 'not-configured') return { ...data, detail: 'mt-env-missing' };
      if (data.error === 'server-error' || res.status >= 500) return { ...data, detail: 'mt-server-error' };
    }
    return data;
  }
  return {
    host: () => { try { return new URL(cfg.musiteacherUrl).host; } catch { return ''; } },
    /** هل هذا الرمز صالح لهذه اللعبة؟ → { ok, sid, exp } أو { ok:false, error, detail? } */
    verify: (gameId, code, client) => call('/api/student-games/verify', { gameId, code, client }),
    /** هل ما زالت المشاركة صالحة (لم تُلغَ ولم تنتهِ، والمعلم ما زال مشتركًا)؟ */
    check: (gameId, sid) => call('/api/student-games/check', { gameId, sid }),
  };
}
