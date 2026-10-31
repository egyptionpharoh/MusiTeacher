'use client';
// قسم «مختبر الألعاب الافتراضية» داخل صفحة الموارد. البيانات من src/data/virtualGames.js فقط.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { VIRTUAL_GAMES, GAME_CATEGORIES, publicGameInfo } from '@/data/virtualGames';
import './virtual-lab.css';

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
);

function GameCard({ game, isAdmin }) {
  const cat = GAME_CATEGORIES[game.category];
  const playable = game.status === 'available' || (game.status === 'soon' && isAdmin);
  const label = game.status === 'available' ? 'ابدأ اللعب' : game.status === 'soon' ? (isAdmin ? 'تشغيل (مدير)' : 'قيد التطوير') : 'غير متاحة';
  const inner = (
    <>
      <div className="vl-cover">
        <div className="vl-cover-fallback" aria-hidden="true">{cat ? cat.icon : '🎮'}</div>
        {game.cover && <img src={game.cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
        <div className="vl-tags">
          <span>{game.threeD && <span className="vl-tag hl">3D</span>}</span>
          {game.grade && <span className="vl-tag">{game.grade}</span>}
        </div>
      </div>
      <div className="vl-body">
        <span className="vl-cat">{cat ? `${cat.icon} ${cat.label}` : ''}</span>
        <h3 className="vl-name">{game.title}</h3>
        <p className="vl-desc">{game.description}</p>
        <div className="vl-foot">
          <span className="vl-pill">{game.status === 'available' ? 'متاحة' : game.status === 'soon' ? 'قيد التطوير' : 'غير متاحة'}</span>
          <span className={`vl-play${playable ? '' : ' off'}`}>{label}{playable && <PlayIcon />}</span>
        </div>
      </div>
    </>
  );
  return playable
    ? <Link href={`/dashboard/resources/lab/${game.id}`} className="vl-card" prefetch={false}>{inner}</Link>
    : <div className="vl-card" aria-disabled="true">{inner}</div>;
}

export default function VirtualLab() {
  const { isAdmin } = useAuth();
  const games = useMemo(() => VIRTUAL_GAMES.filter((g) => g.status !== 'unavailable' && g.listInLab !== false).map(publicGameInfo), []);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c = { all: games.length };
    for (const g of games) c[g.category] = (c[g.category] || 0) + 1;
    return c;
  }, [games]);

  const shown = useMemo(() => {
    const t = q.trim();
    return games.filter((g) => (cat === 'all' || g.category === cat)
      && (!t || g.title.includes(t) || g.description.includes(t) || g.tags.some((x) => x.includes(t)) || (g.grade || '').includes(t)));
  }, [games, cat, q]);

  return (
    <section id="virtual-lab" className="vl" aria-labelledby="vl-h">
      <div className="vl-hero">
        <span className="vl-badge">🧪 VIRTUAL MUSIC LAB</span>
        <h2 id="vl-h" className="vl-title">مختبر الألعاب الافتراضية<small>ثلاثية الأبعاد · تفاعلية · بصوت حقيقي</small></h2>
        <p className="vl-sub">عوالم موسيقية ثلاثية الأبعاد تُشغَّل داخل المنصة: آلات تفاعلية وسلالم ومقامات وعازفة كمان افتراضية، مصمَّمة لتقريب المفاهيم الموسيقية لطلابك.</p>
      </div>

      <div className="vl-bar">
        <div className="vl-chips" role="group" aria-label="تصنيف الألعاب">
          <button type="button" className="vl-chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>الكل<span>{counts.all}</span></button>
          {Object.entries(GAME_CATEGORIES).filter(([k]) => counts[k]).map(([k, v]) => (
            <button key={k} type="button" className="vl-chip" aria-pressed={cat === k} onClick={() => setCat(k)}>{v.icon} {v.label}<span>{counts[k]}</span></button>
          ))}
        </div>
        <input className="vl-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن لعبة أو آلة…" aria-label="بحث في الألعاب" />
      </div>

      {shown.length ? (
        <div className="vl-grid">{shown.map((g) => <GameCard key={g.id} game={g} isAdmin={isAdmin} />)}</div>
      ) : (
        <p className="vl-empty">لا توجد ألعاب مطابقة لبحثك.</p>
      )}
      <p className="vl-ip">© MusiTeacher – All Rights Reserved – 2026</p>
    </section>
  );
}
