'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // تم إزالة db لأننا سنستخدم MongoDB

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // استدعاء بيانات المستخدم من MongoDB للتحقق من حالة الاشتراك
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
            }),
          });

          // 🔍 [كشاف أستاذ حسين] - طباعة حالة استجابة السيرفر
          console.log("🔍 API /auth/sync Status:", res.status);

          if (res.ok) {
            const data = await res.json();
            
            // 🔍 [كشاف أستاذ حسين] - طباعة هويتك كما يراها النظام
            console.log("🔥 Firebase User:", { uid: currentUser.uid, email: currentUser.email });
            console.log("🔥 Mongo Server Response:", data);

            if (data.success && data.user) {
              const userData = data.user;

              // 🔍 [كشاف أستاذ حسين] - طباعة الصلاحية الفعلية وقيمة الأدمن
              console.log("👑 User Role from DB:", userData.role);
              console.log("🛡️ Is Admin Value:", userData.role === 'admin');
              
              // معالجة تاريخ الانتهاء القادم من MongoDB
              let endDate = null;
              if (userData.subscriptionEndDate) {
                endDate = new Date(userData.subscriptionEndDate);
              }

              const now = new Date();
              
              // الاشتراك فعال إذا كان isSubscribed صحيح وتاريخ الانتهاء لم يأتِ بعد
              const isValidSubscription = userData.isSubscribed && endDate && endDate > now;
              
              setIsSubscribed(isValidSubscription);
              setIsAdmin(userData.role === 'admin');
              setSubscriptionData({
                isSubscribed: userData.isSubscribed,
                endDate: endDate
              });
            } else {
              setIsSubscribed(false);
              setSubscriptionData(null);
            }
          } else {
            setIsSubscribed(false);
            setSubscriptionData(null);
          }
        } catch (error) {
          console.error("خطأ في جلب بيانات الاشتراك من MongoDB:", error);
          setIsSubscribed(false);
          setSubscriptionData(null);
        }
      } else {
        setIsSubscribed(false);
        setSubscriptionData(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    // توفير بيانات الاشتراك المفصلة للمنصة لاستخدامها في واجهة الباقات
    <AuthContext.Provider value={{ user, isSubscribed, subscriptionData, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);