'use client';
import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. إنشاء الحساب في فايربيز
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. تحديث اسم المستخدم في فايربيز
      await updateProfile(user, { displayName: name });

      // 3. إرسال البيانات للـ API بتاعنا عشان تتحفظ في MongoDB
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: name,
          photoURL: user.photoURL,
        }),
      });

      if (!res.ok) {
        throw new Error('حدث خطأ في حفظ بيانات الحساب بقاعدة البيانات.');
      }

      // 4. توجيه المستخدم للصفحة الرئيسية بعد نجاح التسجيل
      router.push('/');
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء التسجيل. تأكد من البيانات وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6">إنشاء حساب جديد</h2>
        
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">الاسم</label>
            <input 
              type="text" 
              required 
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
            <label className="block text-sm font-medium text-gray-700">كلمة المرور (6 أحرف على الأقل)</label>
            <input 
              type="password" 
              required 
              minLength="6"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md text-left"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'جاري التسجيل...' : 'تسجيل حساب جديد'}
          </button>
        </form>
        
        <p className="mt-4 text-center text-sm text-gray-600">
          لديك حساب بالفعل؟ <Link href="/login" className="text-blue-600 hover:underline">سجل دخولك هنا</Link>
        </p>
      </div>
    </div>
  );
}