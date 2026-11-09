'use client';
// 🔔 إعدادات التنبيه: خطة التنبيه، النغمات (المكتبة + نغماتي)، طرق التنبيه، الإيقاف المؤقت، الاختبار، وجاهزية المنبه.
import { useState } from 'react';
import { Icon, Toggle } from './parts';
import PlanEditor from './PlanEditor';
import { TONES, TONE_ACCEPT, MAX_TONE_SECONDS, CUSTOM_PREFIX } from './audio';
import { fmtTime, zonedParts } from '../core/time.js';

export default function AlertsView({ profile, settings, onProfile, onSettings, tones, onPreview, onAddTone, onDeleteTone, onRenameTone, readiness, onAskNotify, onUnlock, onTest, now, onInstall, canInstall, onGoto }) {
  const [busy, setBusy] = useState(false);
  const [toneErr, setToneErr] = useState('');
  const paused = settings.pausedUntil > now;
  const pauseFor = (min) => onSettings({ pausedUntil: now + min * 60000 });
  const pauseToday = () => { const z = zonedParts(now, profile.tz); onSettings({ pausedUntil: now + ((24 * 60 - z.minutes) * 60 - z.ss) * 1000 }); };

  return (
    <div className="ca-stack">
      <Readiness r={readiness} settings={settings} onAskNotify={onAskNotify} onUnlock={onUnlock} onTest={onTest} onInstall={onInstall} canInstall={canInstall} onGoto={onGoto} />

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>تشغيل المنبه</h3><p className="ca-muted">{settings.enabled ? (paused ? `متوقف مؤقتًا حتى ${fmtTime(zonedParts(settings.pausedUntil, profile.tz).minutes, settings.h24)}` : 'يعمل ويتابع جدولك النشط') : 'متوقف بالكامل'}</p></div></div>
        <Toggle checked={settings.enabled} onChange={(v) => onSettings({ enabled: v })} label="تفعيل منبّه الحصص" hint="عند الإيقاف لا تصدر أي تنبيهات" />
        <div className="ca-row ca-wrap ca-mt">
          <span className="ca-muted">إيقاف مؤقت:</span>
          {[30, 60, 120].map((m) => <button type="button" key={m} className="ca-chip ca-chip-btn" onClick={() => pauseFor(m)} disabled={!settings.enabled}>{m === 30 ? 'نصف ساعة' : m === 60 ? 'ساعة' : 'ساعتان'}</button>)}
          <button type="button" className="ca-chip ca-chip-btn" onClick={pauseToday} disabled={!settings.enabled}>بقية اليوم</button>
          {paused && <button type="button" className="ca-btn is-warn is-sm" onClick={() => onSettings({ pausedUntil: 0 })}><Icon n="play" size={15} />استئناف الآن</button>}
        </div>
      </section>

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>توقيت التنبيهات لهذا الجدول</h3><p className="ca-muted">تنطبق على كل الحصص، ويمكن تخصيص حصة بعينها من تبويب «الجدول»</p></div></div>
        <PlanEditor plan={profile.plan} onChange={(plan) => onProfile((p) => ({ ...p, plan }))} tones={tones} onPreview={onPreview} />
      </section>

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>طريقة التنبيه</h3></div></div>
        <Toggle checked={settings.sound} onChange={(v) => onSettings({ sound: v })} label="صوت التنبيه" hint="عند إيقافه يبقى الإشعار المرئي" />
        <div className={`ca-volume${settings.sound ? '' : ' is-disabled'}`}>
          <span>مستوى الصوت</span>
          <input type="range" min="0" max="1" step="0.05" value={settings.volume} disabled={!settings.sound} onChange={(e) => onSettings({ volume: +e.target.value })} aria-label="مستوى الصوت" />
          <b>{Math.round(settings.volume * 100)}%</b>
          <button type="button" className="ca-icon-btn" onClick={() => onPreview(profile.plan.before[0] ? profile.plan.before[0].tone : 'chime')} aria-label="تجربة المستوى"><Icon n="play" size={16} /></button>
        </div>
        <p className="ca-muted ca-small">المستوى نسبة من صوت الجهاز؛ تأكد أن صوت الجهاز نفسه ليس صامتًا.</p>
        <Toggle checked={settings.visual} onChange={(v) => onSettings({ visual: v })} label="نافذة تنبيه داخل الأداة" hint="بطاقة كبيرة بتفاصيل الحصة وأزرار «تم» و«ذكّرني بعد قليل»" />
        <Toggle checked={settings.system} onChange={(v) => onSettings({ system: v })} label="إشعار النظام" hint="يظهر حتى لو كنت في تبويب أو برنامج آخر (يتطلب إذن المتصفح)" />
        <Toggle checked={settings.repeat.on} onChange={(v) => onSettings({ repeat: { ...settings.repeat, on: v } })} label="تكرار الصوت إن لم أتفاعل" />
        {settings.repeat.on && (
          <div className="ca-row ca-wrap ca-indent">
            <span>كل</span><select className="ca-input ca-num" value={settings.repeat.every} onChange={(e) => onSettings({ repeat: { ...settings.repeat, every: +e.target.value } })}>{[15, 30, 60, 120].map((s) => <option key={s} value={s}>{s < 60 ? `${s} ثانية` : s === 60 ? 'دقيقة' : 'دقيقتين'}</option>)}</select>
            <span>حتى</span><select className="ca-input ca-num" value={settings.repeat.count} onChange={(e) => onSettings({ repeat: { ...settings.repeat, count: +e.target.value } })}>{[1, 2, 3, 5].map((s) => <option key={s} value={s}>{s} {s <= 2 ? (s === 1 ? 'مرة' : 'مرتين') : 'مرات'}</option>)}</select>
          </div>
        )}
        <Toggle checked={settings.quiet.on} onChange={(v) => onSettings({ quiet: { ...settings.quiet, on: v } })} label="منع التنبيهات خارج الدوام" hint="لا تصدر تنبيهات إلا داخل الفترة المحددة" />
        {settings.quiet.on && (
          <div className="ca-row ca-wrap ca-indent">
            <label className="ca-time"><span>من</span><input className="ca-input" type="time" value={settings.quiet.from} onChange={(e) => onSettings({ quiet: { ...settings.quiet, from: e.target.value } })} /></label>
            <label className="ca-time"><span>إلى</span><input className="ca-input" type="time" value={settings.quiet.to} onChange={(e) => onSettings({ quiet: { ...settings.quiet, to: e.target.value } })} /></label>
          </div>
        )}
        <Toggle checked={settings.h24} onChange={(v) => onSettings({ h24: v })} label="عرض الوقت بنظام 24 ساعة" />
        <Toggle checked={settings.motivation} onChange={(v) => onSettings({ motivation: v })} label="عبارة تحفيزية قصيرة في لوحة اليوم" />
      </section>

      <section className="ca-card">
        <div className="ca-card-head"><div><h3>مكتبة النغمات</h3><p className="ca-muted">نغمات أصلية مولّدة داخل المنصة، ويمكنك إضافة نغماتك</p></div></div>
        <ul className="ca-tones">
          {TONES.map((t) => <li key={t.id}><button type="button" className="ca-play" onClick={() => onPreview(t.id)} aria-label={`تجربة ${t.name}`}><Icon n="play" size={16} /></button><div><strong>{t.name}</strong><span className="ca-muted">{t.desc}</span></div></li>)}
        </ul>
        <h4 className="ca-h4">نغماتي</h4>
        <ul className="ca-tones">
          {tones.custom.map((t) => (
            <li key={t.id}>
              <button type="button" className="ca-play" onClick={() => onPreview(t.id)} aria-label={`تجربة ${t.name}`}><Icon n="play" size={16} /></button>
              <div className="ca-grow"><input className="ca-input ca-inline" value={t.name} onChange={(e) => onRenameTone(t.id.slice(CUSTOM_PREFIX.length), e.target.value)} aria-label="اسم النغمة" /><span className="ca-muted">{t.duration ? `${Math.min(MAX_TONE_SECONDS, t.duration).toFixed(1)} ث` : ''} • {(t.size / 1024).toFixed(0)} ك.ب{t.duration > MAX_TONE_SECONDS ? ` • يُشغَّل أول ${MAX_TONE_SECONDS} ثانية فقط` : ''}</span></div>
              <label className="ca-icon-btn ca-file" title="استبدال الملف" aria-label="استبدال الملف"><Icon n="upload" size={16} /><input type="file" accept={TONE_ACCEPT} onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setToneErr(''); try { await onAddTone(f, t.id.slice(CUSTOM_PREFIX.length)); } catch (er) { setToneErr(er.message); } }} /></label>
              <button type="button" className="ca-icon-btn" onClick={() => { if (window.confirm(`حذف «${t.name}»؟ ستُستبدل بالنغمة الهادئة حيثما استُخدمت.`)) onDeleteTone(t.id); }} aria-label="حذف النغمة"><Icon n="trash" size={16} /></button>
            </li>
          ))}
          {!tones.custom.length && <li className="ca-muted">لم تضف نغمات بعد.</li>}
        </ul>
        <label className={`ca-btn is-ghost ca-file${busy ? ' is-busy' : ''}`}>
          <Icon n="music" />{busy ? 'نفحص الملف...' : 'رفع نغمة من جهازي'}
          <input type="file" accept={TONE_ACCEPT} disabled={busy} onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setToneErr(''); setBusy(true); try { await onAddTone(f); } catch (er) { setToneErr(er.message); } finally { setBusy(false); } }} />
        </label>
        <p className="ca-muted ca-small">MP3 أو WAV أو OGG أو M4A، حتى 2 ميجابايت و{MAX_TONE_SECONDS} ثانية. تُحفظ النغمة في هذا المتصفح فقط ولا تُرفع لأي خادم. استخدم مقاطع تملك حق استخدامها.</p>
        {toneErr && <p className="ca-error" role="alert">{toneErr}</p>}
      </section>
    </div>
  );
}

function Readiness({ r, settings, onAskNotify, onUnlock, onTest, onInstall, canInstall, onGoto }) {
  const items = [
    { ok: settings.enabled, label: 'المنبه مفعّل', fix: null },
    { ok: r.audio === 'running' || !settings.sound, label: r.audio === 'running' ? 'الصوت جاهز' : 'الصوت يحتاج نقرة لتفعيله (قيد المتصفح)', fix: settings.sound && r.audio !== 'running' ? { t: 'تفعيل الصوت', f: onUnlock } : null },
    { ok: r.perm === 'granted' || !settings.system, warn: r.perm === 'unsupported', label: r.perm === 'granted' ? 'إشعارات النظام مسموحة' : r.perm === 'denied' ? 'إشعارات النظام محظورة من إعدادات المتصفح (انقر القفل 🔒 بجوار عنوان الموقع واسمح بالإشعارات)' : r.perm === 'unsupported' ? 'هذا المتصفح لا يدعم إشعارات النظام' : 'لم يُطلب إذن إشعارات النظام بعد', fix: settings.system && r.perm === 'default' ? { t: 'السماح بالإشعارات', f: onAskNotify } : null },
    { ok: r.leader, label: r.leader ? 'هذا التبويب هو المسؤول عن التنبيه' : 'التنبيه يعمل من تبويب آخر مفتوح', fix: null, info: !r.leader },
    { ok: r.worker, warn: !r.worker, label: r.worker ? 'مؤقت الخلفية يعمل (دقة جيدة حتى في التبويبات الخلفية)' : 'مؤقت الخلفية غير متاح؛ قد يتأخر التنبيه في التبويبات الخلفية', fix: null },
  ];
  return (
    <section className="ca-card ca-ready">
      <div className="ca-card-head">
        <div><h3>هل المنبه جاهز؟</h3><p className="ca-muted">اختبر النظام قبل الاعتماد عليه</p></div>
        <div className="ca-row ca-wrap">
          <button type="button" className="ca-btn" onClick={() => onTest(0)}><Icon n="bell" />اختبار الآن</button>
          <button type="button" className="ca-btn is-ghost" onClick={() => onTest(30)}><Icon n="clock" />اختبار بعد 30 ثانية</button>
        </div>
      </div>
      <ul className="ca-checks">
        {items.map((it, i) => (
          <li key={i} className={it.ok ? 'is-ok' : it.info ? 'is-info' : it.warn ? 'is-warn' : 'is-bad'}>
            <Icon n={it.ok ? 'check' : it.info ? 'info' : 'warn'} size={16} /><span>{it.label}</span>
            {it.fix && <button type="button" className="ca-btn is-sm" onClick={it.fix.f}>{it.fix.t}</button>}
          </li>
        ))}
      </ul>
      <details className="ca-details">
        <summary>متى يعمل المنبه؟ (مهم)</summary>
        <ul className="ca-limits">
          <li className="is-ok"><b>الأداة مفتوحة:</b> تنبيه دقيق بالصوت والنافذة والإشعار.</li>
          <li className="is-ok"><b>في تبويب آخر أو المتصفح مصغّر:</b> يعمل بالصوت وإشعار النظام، ما دام تبويب الأداة مفتوحًا والجهاز مستيقظًا. اختبره بزر «بعد 30 ثانية» ثم انتقل لتبويب آخر.</li>
          <li className="is-warn"><b>الهاتف:</b> أنظمة الهواتف توقف الصفحات في الخلفية أو عند قفل الشاشة؛ لا يمكن الاعتماد على صفحة الويب وحدها. استخدم «وضع العرض» والشاشة مفتوحة، أو أضف الجدول إلى تقويم هاتفك.</li>
          <li className="is-bad"><b>تبويب الأداة مغلق أو المتصفح مغلق أو الجهاز نائم/مطفأ:</b> لا يمكن لصفحة ويب أن ترن. الحل الموثوق هنا: <button type="button" className="ca-link" onClick={() => onGoto('export')}>إضافة الجدول إلى تقويم الهاتف/Outlook</button> بتنبيهات مدمجة يرن بها التقويم نفسه.</li>
          <li><b>تجنب إيقاف التبويب تلقائيًا:</b> في Chrome وEdge قد تُجمَّد التبويبات غير النشطة لتوفير الذاكرة. أضف الموقع إلى «المواقع النشطة دائمًا» في إعدادات الأداء، أو ثبّت الأداة كتطبيق.</li>
        </ul>
        {canInstall && <button type="button" className="ca-btn is-ghost" onClick={onInstall}><Icon n="download" />تثبيت المنبه كتطبيق على هذا الجهاز</button>}
      </details>
    </section>
  );
}

