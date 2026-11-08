'use client';
// 🔐 البيانات والخصوصية: أين تُحفظ البيانات، النسخ الاحتياطي، المزامنة الاختيارية مع الحساب، والحذف.
import { useEffect, useState } from 'react';
import { Icon, Toggle } from './parts';
import { estimate } from './storage';
import { downloadBlob } from './files';

export default function DataView({ store, settings, onSettings, onRestore, onWipe, sync, notify, tonesCount }) {
  const [est, setEst] = useState(null);
  useEffect(() => { estimate().then(setEst); }, []);
  const backup = () => {
    const blob = new Blob([JSON.stringify({ app: 'musiteacher-class-alarm', exportedAt: new Date().toISOString(), store }, null, 1)], { type: 'application/json' });
    downloadBlob(blob, `نسخة-منبه-الحصص-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const restore = async (file) => {
    try {
      const j = JSON.parse(await file.text());
      const s = j && j.app === 'musiteacher-class-alarm' ? j.store : j && j.profiles ? j : null;
      if (!s) throw new Error('bad');
      if (!window.confirm('سيُستبدل كل ما في هذه الأداة على هذا الجهاز بمحتوى النسخة. متابعة؟')) return;
      onRestore(s);
      notify('تمت استعادة النسخة الاحتياطية.');
    } catch { notify('الملف ليس نسخة احتياطية صالحة من منبّه الحصص.', 'err'); }
  };
  return (
    <div className="ca-stack">
      <section className="ca-card">
        <div className="ca-card-head"><div><h3>أين تُحفظ بياناتك؟</h3></div></div>
        <ul className="ca-limits">
          <li className="is-ok"><b>على هذا الجهاز وفي هذا المتصفح فقط</b> (قاعدة بيانات المتصفح IndexedDB): الجداول ({store.profiles.length})، الإعدادات، والنغمات الخاصة ({tonesCount}).</li>
          <li>لا يراها أي مستخدم آخر، ولا تُرسل لأي خادم إلا إذا فعّلت المزامنة أدناه بنفسك.</li>
          <li className="is-warn">مسح بيانات المتصفح أو استخدام «التصفح الخاص» يحذفها؛ احتفظ بنسخة احتياطية.</li>
          {est && est.quota ? <li className="ca-muted">المساحة المستخدمة لهذا الموقع: {(est.usage / 1048576).toFixed(1)} ميجابايت.</li> : null}
        </ul>
      </section>

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>المزامنة مع حسابي (اختياري)</h3><p className="ca-muted">لاستخدام نفس الجدول على الكمبيوتر والهاتف</p></div></div>
        {sync.available ? (
          <>
            <Toggle checked={settings.sync} onChange={(v) => onSettings({ sync: v })} label="حفظ نسخة من جداولي في حسابي على MusiTeacher" hint="تُحفظ الجداول والإعدادات فقط (بدون النغمات الخاصة) ولا يصل إليها غيرك" />
            {settings.sync && <p className="ca-muted ca-small">{sync.state === 'saving' ? 'جارٍ الحفظ...' : sync.state === 'error' ? `تعذرت المزامنة: ${sync.error}` : sync.at ? `آخر مزامنة: ${new Date(sync.at).toLocaleString('ar-OM')}` : 'لم تتم مزامنة بعد'}</p>}
            <div className="ca-row ca-wrap">
              <button type="button" className="ca-btn is-ghost" onClick={sync.pull}><Icon n="cloud" />استرجاع من حسابي</button>
              {settings.sync && <button type="button" className="ca-btn is-ghost" onClick={sync.push}><Icon n="upload" />حفظ في حسابي الآن</button>}
              <button type="button" className="ca-btn is-ghost" onClick={sync.remove}><Icon n="trash" />حذف النسخة من حسابي</button>
            </div>
          </>
        ) : <p className="ca-muted">{sync.reason || 'المزامنة غير متاحة حاليًا.'} تستطيع نقل جداولك بين أجهزتك عبر النسخة الاحتياطية.</p>}
      </section>

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>نسخة احتياطية</h3><p className="ca-muted">ملف واحد يحتوي جداولك وإعداداتك (بدون النغمات الخاصة)</p></div></div>
        <div className="ca-row ca-wrap">
          <button type="button" className="ca-btn" onClick={backup}><Icon n="download" />تحميل نسخة احتياطية</button>
          <label className="ca-btn is-ghost ca-file"><Icon n="upload" />استعادة من ملف<input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); }} /></label>
        </div>
      </section>

      <section className="ca-card is-danger-zone">
        <div className="ca-card-head"><div><h3>حذف كل بيانات الأداة</h3><p className="ca-muted">يحذف الجداول والإعدادات والنغمات من هذا الجهاز نهائيًا</p></div></div>
        <button type="button" className="ca-btn is-danger" onClick={() => { if (window.confirm('حذف كل الجداول والنغمات والإعدادات من هذا الجهاز نهائيًا؟ لا يمكن التراجع.')) onWipe(); }}><Icon n="trash" />حذف كل البيانات</button>
      </section>
    </div>
  );
}
