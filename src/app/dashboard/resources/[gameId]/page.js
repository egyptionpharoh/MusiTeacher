'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { gamesConfig } from '../../../../lib/gamesConfig';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function GamePlayerPage() {
  const params = useParams();
  const router = useRouter();
  const game = gamesConfig.find(g => g.id === params.gameId);

  // زر ملء الشاشة / تصغير الشاشة (مثل مشغّل ألعاب المختبر)
  const stageRef = useRef(null);
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    // الحالة تتبع الحدث الحقيقي: تشمل الخروج بزر Esc أو التكبير من داخل اللعبة نفسها
    const on = () => setIsFull(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    on();
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);
  const toggleFullscreen = () => {
    const el = stageRef.current; if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };

  // الألعاب المحمية (labId) تُفتح عبر مشغّل الجلسات الموقّعة؛ أي رابط قديم يُحوَّل إليه
  useEffect(() => {
    if (game && game.labId) router.replace(`/dashboard/resources/lab/${game.labId}`);
  }, [game, router]);

  if (!game) {
    return <div className="text-white text-center mt-20 text-2xl">عفواً، هذه اللعبة غير موجودة!</div>;
  }
  if (game.labId) {
    return <div className="text-white text-center mt-20 text-xl">جارٍ فتح اللعبة…</div>;
  }

  return (
    // عند ملء الشاشة نكبّر الصفحة كلها (الشريط + اللعبة) حتى يبقى زر «تصغير الشاشة» ظاهرًا ويمكن الضغط عليه
    <div ref={stageRef} className={isFull ? 'flex flex-col h-screen bg-slate-900 p-3' : 'flex flex-col h-[85vh]'}>
      {/* شريط التحكم العلوي */}
      <div className="flex justify-between items-center mb-4 bg-black/50 p-4 rounded-xl border border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-neonBlue">{game.title}</h2>
          <p className="text-gray-400 text-sm">{game.pedagogicalGoal}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-pressed={isFull}
            title={isFull ? 'العودة إلى الحجم العادي (Esc)' : 'تكبير اللعبة إلى ملء الشاشة'}
            className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition ${isFull ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            {isFull ? '🗗 تصغير الشاشة' : '⛶ ملء الشاشة'}
          </button>
          <Link href="/dashboard/resources" className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
            <ArrowRight size={20} />
            العودة للوسائل
          </Link>
        </div>
      </div>

      {/* مشغل اللعبة (iframe) */}
      <div className="flex-grow bg-black rounded-xl border border-gray-700 overflow-hidden shadow-[0_0_20px_rgba(0,210,255,0.1)]">
        <iframe 
          src={game.path} 
          className="w-full h-full border-none"
          title={game.title}
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
    </div>
  );
}
