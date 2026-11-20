'use client';
// «مشاركة الألعاب مع الطلاب»: كل رموز المعلم النشطة في مكان واحد + (للمدير) الإصدارات الفصلية لمشروع MusiTeacher Games.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { VIRTUAL_GAMES } from '@/data/virtualGames';
import { shareApi, copyText, whatsappText, ShareDialog } from '@/components/student-games/ShareGameButton';
import '@/components/student-games/share.css';

const fmt = (d) => { try { return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };
const STATUS = { active: 'الحالي (تُبنى منه روابط المشاركة)', transition: 'انتقالي (يعمل حتى التاريخ المحدد)', stopped: 'موقوف' };
const CFG_ERR = { 'bad-id': 'معرّف الإصدار: حروف لاتينية وأرقام و - فقط (مثل 2026-S2).', 'dup-id': 'معرّف إصدار مكرر.', 'bad-url': 'العنوان يجب أن يبدأ بـ https://', 'one-active': 'يجب أن يكون إصدار واحد فقط «الحالي».', 'bad-status': 'حالة غير صحيحة.' };

async function configApi(method, body) {
  const cu = auth && auth.currentUser; if (!cu) throw Object.assign(new Error('x'), { code: 'unauthenticated' });
  const res = await fetch('/api/student-games/config', { method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await cu.getIdToken()}` }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({})); if (!res.ok || !d.ok) throw Object.assign(new Error('x'), { code: d.error || 'server-error' }); return d;
}

export default function StudentGamesPage() {
  const { user, isSubscribed, isAdmin, loading } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [dialog, setDialog] = useState(null);
  const [pick, setPick] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try { setErr(''); setData(await shareApi('GET')); }
    catch (e) { setErr(e.code === 'forbidden' ? 'المشاركة مع الطلاب متاحة للمشتركين فقط.' : 'تعذّر تحميل الرموز الآن. حدّث الصفحة.'); }
  }, []);
  useEffect(() => { if (!loading && user && (isSubscribed || isAdmin)) load(); }, [loading, user, isSubscribed, isAdmin, load]);

  if (loading) return <div className="sgp"><p className="muted">جارٍ التحميل…</p></div>;
  if (!user || (!isSubscribed && !isAdmin)) return <div className="sgp"><h1>مشاركة الألعاب مع الطلاب</h1><p className="lead">هذه الخدمة متاحة للمعلمين المشتركين.</p></div>;

  const games = VIRTUAL_GAMES.filter((g) => g.status === 'available');
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(''), 1800); };
  const revoke = async (s) => { if (!window.confirm(`إلغاء رمز «${s.title}»؟ لن يستطيع أي طالب الدخول به بعد الآن.`)) return; try { await shareApi('POST', { gameId: s.gameId, action: 'revoke' }); load(); } catch { say('تعذّر الإلغاء'); } };

  return (
    <div className="sgp" dir="rtl">
      <h1>مشاركة الألعاب مع الطلاب</h1>
      <p className="lead">اختر لعبة واحصل على رابطها الطلابي ورمز دخولها، ثم أرسلهما لطلابك. الطالب لا يحتاج إلى حساب: يفتح الرابط ويكتب الرمز فقط.</p>

      <section className="sgp-card">
        <h2>مشاركة لعبة جديدة</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: '1 1 260px' }} aria-label="اختر لعبة">
            <option value="">— اختر اللعبة —</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <button type="button" className="sgx-btn primary" disabled={!pick} onClick={() => setDialog(games.find((g) => g.id === pick))}>🔗 الرابط والرمز</button>
        </div>
      </section>

      <section className="sgp-card">
        <h2>رموزي النشطة {data && data.release ? <span className="muted">· الإصدار الحالي: <bdi dir="ltr">{data.release.id}</bdi></span> : null}</h2>
        {err && <p className="bad">{err}</p>}
        {!data && !err && <p className="muted">جارٍ التحميل…</p>}
        {data && !data.shares.length && <p className="muted">لا توجد رموز نشطة بعد.</p>}
        {data && data.shares.length > 0 && (
          <table><thead><tr><th>اللعبة</th><th>الرمز</th><th>صالح حتى</th><th>الاستخدام</th><th>إجراءات</th></tr></thead>
            <tbody>{data.shares.map((s) => (
              <tr key={s.id}>
                <td><b>{s.title}</b>{s.studentReady === false && <div className="bad" style={{ fontSize: '.8rem' }}>النسخة الطلابية غير منشورة بعد</div>}</td>
                <td className="code" dir="ltr">{s.code}</td>
                <td>{fmt(s.expiresAt)}</td>
                <td>{s.uses || 0} دخول</td>
                <td><div className="row-actions">
                  <button type="button" className="sgx-btn" disabled={!s.link} onClick={async () => say((await copyText(whatsappText(s.title, s.link, s.code))) ? 'نُسخت الرسالة ✓' : 'تعذّر النسخ')}>نسخ الرسالة</button>
                  <a className={`sgx-btn wa${s.link ? '' : ' off'}`} href={s.link ? `https://wa.me/?text=${encodeURIComponent(whatsappText(s.title, s.link, s.code))}` : undefined} target="_blank" rel="noopener noreferrer">واتساب</a>
                  <button type="button" className="sgx-btn" onClick={() => setDialog({ id: s.gameId, title: s.title })}>تجديد…</button>
                  <button type="button" className="sgx-btn danger" onClick={() => revoke(s)}>إلغاء</button>
                </div></td>
              </tr>))}</tbody></table>
        )}
        <p className="muted" role="status">{msg}</p>
      </section>

      {data && data.admin && <ReleasesAdmin catalog={data.catalog} onSaved={load} />}
      <p className="muted"><Link href="/dashboard/resources">← العودة إلى الألعاب</Link></p>
      {dialog && <ShareDialog game={dialog} onClose={() => { setDialog(null); load(); }} />}
    </div>
  );
}

/** المدير: عنوان MusiTeacher Games لكل فصل دراسي — يُغيَّر هنا وحده دون تعديل أي ملف */
function ReleasesAdmin({ catalog, onSaved }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => { configApi('GET').then((d) => setRows(d.config.releases.map((r) => ({ ...r, until: r.until ? String(r.until).slice(0, 10) : '' })))).catch(() => setErr('تعذّر تحميل الإعداد.')); }, []);
  if (!rows) return <section className="sgp-card"><h2>إصدارات MusiTeacher Games (للمدير)</h2><p className="muted">{err || 'جارٍ التحميل…'}</p></section>;
  const set = (i, k, v) => setRows(rows.map((r, j) => {
    if (j !== i) return (k === 'status' && v === 'active' && r.status === 'active') ? { ...r, status: 'transition' } : r;   // إصدار واحد «حالي»
    return { ...r, [k]: v };
  }));
  const save = async () => {
    setErr(''); setOk('');
    try {
      await configApi('POST', { releases: rows.map((r) => ({ ...r, until: r.until ? new Date(r.until + 'T23:59:59').toISOString() : null })) });
      setOk('حُفظ ✓ — روابط المشاركة الجديدة تستخدم الإصدار الحالي فورًا.'); onSaved && onSaved();
    } catch (e) { setErr(CFG_ERR[e.code] || 'تعذّر الحفظ.'); }
  };
  return (
    <section className="sgp-card">
      <h2>إصدارات MusiTeacher Games (للمدير)</h2>
      <p className="muted">مع بداية كل فصل: انشر المشروع على عنوان جديد، أضفه هنا واجعله «الحالي». الإصدار السابق يصبح «انتقاليًا» حتى تاريخ تختاره ثم «موقوفًا». الرموز نفسها تبقى صالحة؛ يتغيّر الرابط فقط.</p>
      <table><thead><tr><th>المعرّف (GAMES_RELEASE)</th><th>العنوان</th><th>الحالة</th><th>يعمل حتى</th><th /></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>
            <td><input type="text" dir="ltr" value={r.id} onChange={(e) => set(i, 'id', e.target.value.trim())} placeholder="2026-S2" /></td>
            <td><input type="url" dir="ltr" value={r.url} onChange={(e) => set(i, 'url', e.target.value.trim())} placeholder="https://musiteacher-games-2026-s2.vercel.app" /></td>
            <td><select value={r.status} onChange={(e) => set(i, 'status', e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td><input type="date" value={r.until || ''} disabled={r.status !== 'transition'} onChange={(e) => set(i, 'until', e.target.value)} /></td>
            <td><button type="button" className="sgx-btn danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>حذف</button></td>
          </tr>))}</tbody></table>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sgx-btn" onClick={() => setRows([...rows, { id: '', url: '', status: rows.some((r) => r.status === 'active') ? 'stopped' : 'active', until: '' }])}>+ إصدار جديد</button>
        <button type="button" className="sgx-btn primary" onClick={save}>حفظ</button>
        {ok && <span className="ok">{ok}</span>}{err && <span className="bad">{err}</span>}
      </div>
      {catalog && <p className="muted" style={{ marginTop: 10 }}>منشور في الإصدار الحالي: {catalog.length} لعبة.</p>}
    </section>
  );
}
