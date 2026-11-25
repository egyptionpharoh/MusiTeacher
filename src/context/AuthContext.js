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
      // 🚨 تم إزالة setUser من هنا لمنع حالة السباق وتأخير إعلان دخول المستخدم حتى تجهز بيانات اشتراكه
      
      if (currentUser) {
        try {
          // استدعاء بيانات المستخدم من MongoDB للتحقق من حالة الاشتراك.
          // 🔐 الهوية تُرسل كتوكن Firebase موقّع في الترويسة، والخادم يتحقق منه ويستخرج uid والبريد بنفسه
          // (لم نعد نرسل uid أو البريد في جسم الطلب لأن الخادم لا يثق بهما).
          const idToken = await currentUser.getIdToken();
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ displayName: currentUser.displayName || '' }),
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
              
              // 1. استخراج حالة الأدمن من قاعدة البيانات (مع الاعتماد المزدوج على تأكيد السيرفر المباشر)
              const isAdminUser = data.isAdmin || userData.role === 'admin';
              
              // 2. الاشتراك يكون فعالاً (true) بشكل دائم للأدمن، 
              // أو للمستخدم العادي إذا كان مشتركاً وتاريخ انتهائه لم يأتِ بعد
              const isValidSubscription = isAdminUser || (userData.isSubscribed && endDate && endDate > now);
              
              setIsSubscribed(isValidSubscription);
              setIsAdmin(isAdminUser);
              setSubscriptionData({
                // دمج حالة الصلاحية الدائمة للأدمن مع بيانات الاشتراك
                isSubscribed: isValidSubscription,
                endDate: endDate
              });
              setUser(currentUser); // 🛡️ الآن نخبر المنصة بدخول المستخدم وهو يحمل درع الاشتراك
            } else {
              setIsSubscribed(false);
              setSubscriptionData(null);
              setUser(currentUser);
            }
          } else {
            setIsSubscribed(false);
            setSubscriptionData(null);
            setUser(currentUser);
          }
        } catch (error) {
          console.error("خطأ في جلب بيانات الاشتراك من MongoDB:", error);
          setIsSubscribed(false);
          setSubscriptionData(null);
          setUser(currentUser);
        }
      } else {
        setIsSubscribed(false);
        setSubscriptionData(null);
        setIsAdmin(false);
        setUser(null); // 🛡️ تفريغ المستخدم عند تسجيل الخروج
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