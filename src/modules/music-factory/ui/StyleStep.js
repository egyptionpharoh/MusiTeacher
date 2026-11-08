'use client';
// 🎨 الخطوة 2: الطابع والتوزيع. الأساسيات ظاهرة، والتفاصيل في «إعدادات متقدمة».
// اقتراحات المايسترو لا تُطبَّق إلا بعد أن يختار المعلم ما يريده منها.
import { useState } from 'react';
import {
  GENRES, LANGUAGES, MOODS, RHYTHMS, MAQAMS, VOCALS, TEMPOS, INTROS, OUTROS, INSTRUMENT_GROUPS, INSTRUMENT_AR, ARRANGEMENT_PARTS,
  GENRE_BY_ID, MOOD_BY_ID, RHYTHM_BY_ID, MAQAM_BY_ID, VOCAL_BY_ID, TEMPO_BY_ID, INTRO_BY_ID, OUTRO_BY_ID,
} from '../core/catalog.js';
import { ChoiceGroup, Chip, Notice, Spinner } from './parts.js';

const SUG_FIELDS = [
  ['genre', 'النمط', GENRE_BY_ID], ['mood', 'المزاج', MOOD_BY_ID], ['rhythm', 'الإيقاع', RHYTHM_BY_ID], ['maqam', 'المقام', MAQAM_BY_ID],
  ['vocals', 'الصوت', VOCAL_BY_ID], ['tempo', 'السرعة', TEMPO_BY_ID], ['bpm', 'BPM', null], ['intro', 'المقدمة', INTRO_BY_ID], ['outro', 'الخاتمة', OUTRO_BY_ID],
];
const CONF = { high: 'ثقة عالية', medium: 'ثقة متوسطة', low: 'تقديري' };

export default function StyleStep({ project, update, api, analysis, setAnalysis }) {
  const c = project.choices;
  const song = project.mode === 'song';
  const [part, setPart] = useState('verse');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [picked, setPicked] = useState({});
  const set = (k, v) => update((p) => ({ ...p, choices: { ...p.choices, [k]: v } }));

  const toggleInst = (en) => update((p) => {
    const cur = p.choices.instruments[part] || [];
    const next = cur.includes(en) ? cur.filter((x) => x !== en) : cur.length >= 8 ? cur : [...cur, en];
    return { ...p, choices: { ...p.choices, instruments: { ...p.choices.instruments, [part]: next } } };
  });

  async function ask() {
    setBusy(true); setErr(null);
    try {
      const r = await api.analyze(project);
      setAnalysis({ ...r.analysis, provider: r.provider, model: r.model, warning: r.warning });
      const s = r.analysis.suggestions || {};
      // نحدد مسبقًا فقط الحقول التي ما زالت «تلقائي»؛ اختيارات المعلم لا تُلمس
      const pre = {};
      for (const [k] of SUG_FIELDS) if (s[k] && (k === 'bpm' ? !c.bpm : c[k] === 'auto')) pre[k] = true;
      if (s.instruments && Object.values(c.instruments).every((a) => !a.length)) pre.instruments = true;
      setPicked(pre);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  function apply() {
    const s = analysis.suggestions;
    update((p) => {
      const ch = { ...p.choices };
      for (const [k] of SUG_FIELDS) if (picked[k] && s[k]) ch[k] = s[k].value;
      if (picked.instruments && s.instruments) ch.instruments = { ...ch.instruments, ...Object.fromEntries(Object.entries(s.instruments).map(([k, v]) => [k, v.slice(0, 8)])) };
      return { ...p, choices: ch };
    });
    setPicked({});
  }

  const s = analysis && analysis.suggestions;
  const anyPicked = Object.values(picked).some(Boolean);

  return (
    <div className="mf-step">
      <div className="mf-card mf-maestro">
        <div className="mf-row mf-row-between">
          <div>
            <div className="mf-label">🧠 المايسترو</div>
            <p className="mf-help">يحلل {song ? 'كلماتك' : 'فكرتك'} ويقترح الإعدادات مع السبب. أنت من يقرر ما يُطبَّق.</p>
          </div>
          <button type="button" className="mf-btn" onClick={ask} disabled={busy}>{busy ? <><Spinner /> يحلل…</> : analysis ? 'إعادة التحليل' : 'اقترح عليّ'}</button>
        </div>
        <Notice kind="error" onClose={() => setErr(null)}>{err}</Notice>
        {analysis ? (
          <div className="mf-analysis">
            {analysis.warning ? <Notice kind="warn">{analysis.warning}</Notice> : null}
            {analysis.summary_ar ? <p className="mf-summary">{analysis.summary_ar}</p> : null}
            {analysis.themes_ar?.length ? <div className="mf-chips">{analysis.themes_ar.map((t) => <span key={t} className="mf-pill">{t}</span>)}</div> : null}
            {s ? (
              <ul className="mf-sugs">
                {SUG_FIELDS.filter(([k]) => s[k]).map(([k, label, map]) => (
                  <li key={k}>
                    <label className="mf-sug">
                      <input type="checkbox" checked={!!picked[k]} onChange={(e) => setPicked((x) => ({ ...x, [k]: e.target.checked }))} />
                      <b>{label}:</b> {map ? (map[s[k].value]?.ar || s[k].value) : s[k].value}
                      {s[k].confidence ? <span className="mf-pill mf-pill-soft">{CONF[s[k].confidence]}</span> : null}
                      {s[k].reason_ar ? <span className="mf-sug-why">{s[k].reason_ar}</span> : null}
                    </label>
                  </li>
                ))}
                {s.instruments && Object.values(s.instruments).some((a) => a.length) ? (
                  <li>
                    <label className="mf-sug">
                      <input type="checkbox" checked={!!picked.instruments} onChange={(e) => setPicked((x) => ({ ...x, instruments: e.target.checked }))} />
                      <b>الآلات:</b>{' '}
                      {ARRANGEMENT_PARTS.filter((pp) => s.instruments[pp.id]?.length).map((pp) => `${pp.ar}: ${s.instruments[pp.id].map((x) => INSTRUMENT_AR[x] || x).join('، ')}`).join(' · ')}
                    </label>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {s ? <div className="mf-row"><button type="button" className="mf-btn" onClick={apply} disabled={!anyPicked}>✔ تطبيق المحدد</button><span className="mf-help">الاقتراحات المحددة مسبقًا هي التي تركتها «تلقائي» فقط.</span></div> : null}
            {analysis.arrangement_ar?.length ? (
              <details className="mf-details"><summary>أفكار توزيع مقترحة</summary><ul>{analysis.arrangement_ar.map((a, i) => <li key={i}><b>{a.part}:</b> {a.idea}</li>)}</ul></details>
            ) : null}
            {analysis.lyric_notes?.length ? (
              <details className="mf-details"><summary>ملاحظات اختيارية على الكلمات (لن نغيّر كلماتك)</summary><ul>{analysis.lyric_notes.map((n, i) => <li key={i}><q dir="auto">{n.line}</q> — {n.note_ar}{n.suggestion ? <> <span className="mf-hint">اقتراح: <span dir="auto">{n.suggestion}</span></span></> : null}</li>)}</ul></details>
            ) : null}
            {analysis.provider ? <p className="mf-meta">التحليل بواسطة: {analysis.provider === 'local' ? 'تحليل محلي مبسط' : `${analysis.provider} (${analysis.model || ''})`}</p> : null}
          </div>
        ) : null}
      </div>

      <ChoiceGroup label="النمط الموسيقي" value={c.genre} onChange={(v) => set('genre', v)} options={GENRES} grouped />
      {song ? <ChoiceGroup label="لهجة الغناء" value={c.language} onChange={(v) => set('language', v)} options={LANGUAGES} /> : null}
      <ChoiceGroup label="المزاج" value={c.mood} onChange={(v) => set('mood', v)} options={MOODS} />
      {song ? <ChoiceGroup label="الصوت" value={c.vocals} onChange={(v) => set('vocals', v)} options={VOCALS} /> : null}

      <div className="mf-field">
        <div className="mf-label">السرعة</div>
        <div className="mf-chips">
          <Chip on={c.tempo === 'auto' && !c.bpm} onClick={() => update((p) => ({ ...p, choices: { ...p.choices, tempo: 'auto', bpm: null } }))}>✨ تلقائي</Chip>
          {TEMPOS.map((t) => <Chip key={t.id} on={c.tempo === t.id} onClick={() => set('tempo', t.id)}>{t.ar} (~{t.bpm})</Chip>)}
          <label className="mf-bpm">BPM
            <input type="number" min={40} max={220} className="mf-input mf-input-sm" value={c.bpm || ''} placeholder="—"
              onChange={(e) => { const v = parseInt(e.target.value, 10); set('bpm', Number.isFinite(v) && v >= 40 && v <= 220 ? v : null); }} />
          </label>
        </div>
      </div>

      <div className="mf-grid-2">
        <div className="mf-field">
          <label className="mf-label" htmlFor="mf-intro">المقدمة</label>
          <select id="mf-intro" className="mf-select mf-select-wide" value={c.intro} onChange={(e) => set('intro', e.target.value)}>
            {INTROS.map((o) => <option key={o.id} value={o.id}>{o.ar}</option>)}
          </select>
        </div>
        <div className="mf-field">
          <label className="mf-label" htmlFor="mf-outro">الخاتمة</label>
          <select id="mf-outro" className="mf-select mf-select-wide" value={c.outro} onChange={(e) => set('outro', e.target.value)}>
            {OUTROS.map((o) => <option key={o.id} value={o.id}>{o.ar}</option>)}
          </select>
        </div>
      </div>

      {!song ? (
        <div className="mf-field">
          <label className="mf-label" htmlFor="mf-dur">المدة المطلوبة: {Math.floor(c.durationSec / 60)}:{String(c.durationSec % 60).padStart(2, '0')}</label>
          <input id="mf-dur" type="range" min={15} max={240} step={15} value={Math.min(240, c.durationSec)} onChange={(e) => set('durationSec', +e.target.value)} className="mf-range" />
        </div>
      ) : null}

      <details className="mf-details mf-advanced">
        <summary>⚙️ إعدادات متقدمة: الإيقاع، المقام، آلات كل جزء{song ? '، ملاحظات إضافية' : ''}</summary>
        <ChoiceGroup label="الإيقاع" value={c.rhythm} onChange={(v) => set('rhythm', v)} options={RHYTHMS} grouped />
        <ChoiceGroup label="المقام" value={c.maqam} onChange={(v) => set('maqam', v)} options={MAQAMS} render={(o) => o.ar} />
        {c.maqam !== 'auto' ? <p className="mf-help">طابع {MAQAM_BY_ID[c.maqam].ar}: {MAQAM_BY_ID[c.maqam].feel}. (المحركات تقترب من روح المقام ولا تضمن الأرباع الصوتية بدقة.)</p> : null}

        <div className="mf-field">
          <div className="mf-label">الآلات حسب جزء التوزيع</div>
          <div className="mf-tabs" role="tablist">
            {ARRANGEMENT_PARTS.map((pp) => (
              <button key={pp.id} type="button" role="tab" aria-selected={part === pp.id} className={`mf-tab${part === pp.id ? ' is-on' : ''}`} onClick={() => setPart(pp.id)}>
                {pp.ar}{c.instruments[pp.id]?.length ? ` (${c.instruments[pp.id].length})` : ''}
              </button>
            ))}
          </div>
          {INSTRUMENT_GROUPS.map((g) => (
            <div key={g.id} className="mf-chips">
              <span className="mf-chips-group">{g.ar}</span>
              {g.items.map(([en, ar]) => <Chip key={en} on={c.instruments[part]?.includes(en)} onClick={() => toggleInst(en)}>{ar}</Chip>)}
            </div>
          ))}
          <p className="mf-help">بدون اختيار = يقرر المحرك. حتى 8 آلات لكل جزء.</p>
        </div>

        {song ? (
          <div className="mf-field">
            <label className="mf-label" htmlFor="mf-extra">ملاحظات فنية إضافية <span className="mf-hint">(اختياري)</span></label>
            <textarea id="mf-extra" className="mf-textarea" dir="auto" rows={2} maxLength={400} value={c.extra}
              placeholder="مثال: كورال أطفال يرد على المطرب في المذهب، وقفلة بالتصفيق."
              onChange={(e) => set('extra', e.target.value)} />
          </div>
        ) : null}
      </details>
    </div>
  );
}
