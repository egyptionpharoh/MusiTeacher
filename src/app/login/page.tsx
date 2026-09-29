'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // دالة مشتركة عشان تحفظ وتزامن بيانات المستخدم في MongoDB بعد ما يسجل دخوله
  const syncWithMongoDB = async (user) => {
    const res = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
      }),
    });

    if (!res.ok) {
      console.error('فشلت مزامنة بيانات المستخدم مع قاعدة البيانات');
    }
  };

  // الدخول بالإيميل والباسورد
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await syncWithMongoDB(userCredential.user);
      router.push('/'); // توجيه للصفحة الرئيسية
    } catch (err) {
      console.error(err);
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    } finally {
      setLoading(false);
    }
  };

  // الدخول السريع بحساب جوجل
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await syncWithMongoDB(userCredential.user);
      router.push('/'); // توجيه للصفحة الرئيسية
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء تسجيل الدخول بجوجل.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">تسجيل الدخول</h2>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        
        {/* زر الدخول بجوجل */}
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full mb-4 bg-white border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded hover:bg-gray-50 transition duration-200 flex items-center justify-center gap-2"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
          تسجيل الدخول بحساب جوجل
        </button>

        <div className="flex items-center my-4">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="px-3 text-gray-500 text-sm">أو</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>
        
        {/* فورم الدخول بالإيميل */}
        <form onSubmit={handleEmailLogin} className="space-y-4 text-right">
          <div>
            <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
            <input 
              type="email" 
              required 
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-left"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">كلمة المرور</label>
            <input 
              type="password" 
              required 
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-left"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'دخول بالإيميل'}
          </button>
        </form>
        
        <p className="mt-6 text-sm text-gray-600">
          ليس لديك حساب؟ <Link href="/register" className="text-blue-600 hover:underline">أنشئ حساباً جديداً</Link>
        </p>
      </div>
    </div>
  );
}