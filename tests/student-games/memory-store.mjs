// مخزن في الذاكرة يحاكي نماذج MongoDB الثلاثة (للاختبارات وخادم التجربة المحلي فقط)
import crypto from 'node:crypto';
export function memoryStore() {
  const shares = new Map(), attempts = new Map(); let config = null;
  const clone = (o) => (o ? structuredClone(o) : null);
  return {
    _shares: shares, _attempts: attempts,
    shares: {
      async active(uid, gameId, now) { return clone([...shares.values()].filter((d) => d.teacherUid === uid && d.gameId === gameId && !d.revokedAt && d.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt)[0]); },
      async revokeActive(uid, gameId, now) { for (const d of shares.values()) if (d.teacherUid === uid && d.gameId === gameId && !d.revokedAt) d.revokedAt = now; },
      async insert(doc) { if ([...shares.values()].some((d) => d.lookup === doc.lookup)) return null; const _id = crypto.randomBytes(12).toString('hex'); shares.set(_id, { ...doc, _id }); return clone(shares.get(_id)); },
      async revoke(id, uid, now) { const d = shares.get(String(id)); if (d && d.teacherUid === uid) d.revokedAt = now; },
      async byLookup(lookup) { return clone([...shares.values()].find((d) => d.lookup === lookup)); },
      async byId(id) { return clone(shares.get(String(id))); },
      async touch(id, now) { const d = shares.get(String(id)); if (d) { d.uses = (d.uses || 0) + 1; d.lastUsedAt = now; } },
      async list(uid, now) { return [...shares.values()].filter((d) => d.teacherUid === uid && !d.revokedAt && d.expiresAt > now).map(clone); },
    },
    attempts: {
      async fails(key, now, w) { const a = attempts.get(key); return a && now - a.windowStart < w ? a.fails : 0; },
      async fail(key, now, w) { const a = attempts.get(key); if (!a || now - a.windowStart >= w) attempts.set(key, { fails: 1, windowStart: now }); else a.fails += 1; },
    },
    config: { async get() { return clone(config); }, async set(c) { config = clone(c); } },
  };
}
