'use client';
import { useParams, useRouter } from 'next/navigation';
import { gamesConfig } from '../../../../lib/gamesConfig';
import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function GamePlayerPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isSubscribed, loading } = useAuth();
  const game = gamesConfig.find(g => g.id === params.gameId);

  if (loading) {
    return <div className="text-white text-center mt-20 text-xl">جاري التحقق من الصلاحيات...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 text-white gap-6 bg-gray-900/90 p-8 rounded-2xl border border-gray-700 max-w-2xl mx-auto text-center shadow-2xl">
        <Lock size={64} className="text-yellow-500" />
        <h2 className="text-3xl font-bold text-white mb-2">عفواً، يجب تسجيل الدخول أولاً للمتابعة!</h2>
        <div className="flex flex-row gap-6 w-full mt-4 justify-center">
          <Link 
            href="/" 
            className="flex-1 bg-green-500 hover:bg-green-400 text-white text-lg font-bold py-3 px-4 rounded-xl transition-all shadow-[0_6px_0_#15803d] active:shadow-none active:translate-y-[6px] text-center flex flex-col justify-center items-center leading-tight"
          >
            <span>انتقل للرئيسية</span>
            <span className="text-sm font-normal">وسجل دخولك من الإعدادات</span>
          </Link>
          <button 
            onClick={() => router.back()} 
            className="flex-1 bg-red-500 hover:bg-red-400 text-white text-lg font-bold py-3 px-4 rounded-xl transition-all shadow-[0_6px_0_#b91c1c] active:shadow-none active:translate-y-[6px] text-center"
          >
            اضغط للعودة
          </button>
        </div>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 text-white gap-4 bg-gray-900/80 p-8 rounded-xl border border-yellow-500/30 max-w-lg mx-auto text-center">
        <Lock size={48} className="text-yellow-400 animate-bounce" />
        <h2 className="text-2xl font-bold text-yellow-400">محتوى خاص بالمشتركين</h2>
        <p className="text-gray-300">هذه اللعبة متاحة فقط للمشتركين في الباقة المدفوعة. يرجى الاشتراك لتتمكن من اللعب.</p>
        <Link href="/dashboard/resources" className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg transition mt-2">
          العودة للوسائل
        </Link>
      </div>
    );
  }

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