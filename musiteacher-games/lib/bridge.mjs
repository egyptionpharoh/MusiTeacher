// الاتصال بمنصة MusiTeacher (خادم ↔ خادم فقط؛ المتصفح لا يرى عنوانها ولا السر المشترك أبدًا)
// MusiTeacher هي وحدها التي تعرف الرموز (مخزّنة مشفّرة في قاعدة بياناتها) واشتراك المعلم.
export function makeBridge(cfg, fetchImpl = globalThis.fetch) {
  async function call(pathname, body) {
    if (!cfg.musiteacherUrl || !cfg.bridgeSecret) return { ok: false, error: 'not-configured' };
    let res;
    try {
      res = await fetchImpl(cfg.musiteacherUrl + pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mtg-bridge': cfg.bridgeSecret },
        body: JSON.stringify({ ...body, release: cfg.release }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined,
      });
    } catch { return { ok: false, error: 'unreachable' }; }
    let data = null; try { data = await res.json(); } catch { /* */ }
    if (!data || typeof data.ok !== 'boolean') return { ok: false, error: 'unreachable' };
    return data;
  }
  return {
    /** هل هذا الرمز صالح لهذه اللعبة؟ → { ok, sid, exp } أو { ok:false, error } */
    verify: (gameId, code, client) => call('/api/student-games/verify', { gameId, code, client }),
    /** هل ما زالت المشاركة صالحة (لم تُلغَ ولم تنتهِ، والمعلم ما زال مشتركًا)؟ */
    check: (gameId, sid) => call('/api/student-games/check', { gameId, sid }),
  };
}
