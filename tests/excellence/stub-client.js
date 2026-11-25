// بديل اختبار لمعرّف الحساب: /?uid=teacherA
export async function getUserId() { const u = new URLSearchParams(location.search).get('uid'); return u === 'none' ? null : (u || 'teacherA'); }
export async function getIdToken() { return null; }
