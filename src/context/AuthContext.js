'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // تم إزالة db لأننا سنستخدم MongoDB

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null); 
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

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              const userData = data.user;
              
              // معالجة تاريخ الانتهاء القادم من MongoDB
              let endDate = null;
              if (userData.subscriptionEndDate) {
                endDate = new Date(userData.subscriptionEndDate);
              }

              const now = new Date();
              
              // الاشتراك فعال إذا كان isSubscribed صحيح وتاريخ الانتهاء لم يأتِ بعد
              const isValidSubscription = userData.isSubscribed && endDate && endDate > now;
              
              setIsSubscribed(isValidSubscription);
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
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    // توفير بيانات الاشتراك المفصلة للمنصة لاستخدامها في واجهة الباقات
    <AuthContext.Provider value={{ user, isSubscribed, subscriptionData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);