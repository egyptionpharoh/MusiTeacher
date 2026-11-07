// بديل اختبار لـ AuthContext: مستخدم مشترك ثابت.
export const useAuth = () => ({ user: { uid: 'sub', email: 'teacher@test' }, isSubscribed: true, isAdmin: false, loading: false });
