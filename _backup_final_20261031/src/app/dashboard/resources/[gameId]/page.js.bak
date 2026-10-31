'use client';
import { useParams } from 'next/navigation';
import { gamesConfig } from '../../../../lib/gamesConfig';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function GamePlayerPage() {
  const params = useParams();
  const game = gamesConfig.find(g => g.id === params.gameId);

  if (!game) {
    return <div className="text-white text-center mt-20 text-2xl">عفواً، هذه اللعبة غير موجودة!</div>;
  }

  return (
    <div className="flex flex-col h-[85vh]">
      {/* شريط التحكم العلوي */}
      <div className="flex justify-between items-center mb-4 bg-black/50 p-4 rounded-xl border border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-neonBlue">{game.title}</h2>
          <p className="text-gray-400 text-sm">{game.pedagogicalGoal}</p>
        </div>
        <Link href="/dashboard/resources" className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
          <ArrowRight size={20} />
          العودة للوسائل
        </Link>
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