'use client';

import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useState } from 'react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    // تخطي فايربيس تماماً والدخول مباشرة لتجربة المنصة
    setTimeout(() => {
      console.log("تم الدخول بنجاح (وضع التجربة)");
      window.location.href = '/factory'; // التحويل المباشر لصفحة المصنع
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">مرحباً بك في MusiTeacher</h1>
        <p className="text-gray-600 mb-8">منصة معلمي المهارات الموسيقية</p>
        
        <button 
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition duration-200"
        >
          {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول بحساب جوجل'}
        </button>
      </div>
    </div>
  );
}