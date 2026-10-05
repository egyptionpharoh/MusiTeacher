import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. حماية مسارات الـ API الحساسة (مثل الأدمين والبنك)
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/bank')) {
    
    // سحب الهيدر الخاص بالتصريح
    const authHeader = request.headers.get('authorization');

    // إذا لم يكن هناك توكن، أو كان غير صالح شكلياً، نرفض الطلب فوراً
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'غير مصرح: تم حظر الطلب من بوابة الحماية الأساسية. توكن مفقود. 🚫' 
        },
        { status: 401 }
      );
    }
    
    // لو التوكن موجود، الحارس بيسمح للطلب بالمرور للملف الأساسي (route.js) 
    // عشان يتأكد من صحة التوكن بصلاحيات Firebase أو MongoDB
  }

  // 2. حماية مسار الدردشة (Gemini AI) لمنع استنزاف الرصيد
  if (pathname.startsWith('/api/chat')) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح: يجب تسجيل الدخول لاستخدام المعلم الذكي. 🤖' },
        { status: 401 }
      );
    }
  }

  // تمرير باقي الطلبات العادية (مثل الصور والصفحات المفتوحة)
  return NextResponse.next();
}

// تحديد المسارات التي سيعمل عليها الـ Middleware فقط للحفاظ على سرعة المنصة
export const config = {
  matcher: [
    /*
     * تطبيق الحماية على المسارات التالية:
     * - /api/admin/* (إضافة الدروس، تعديل الاشتراكات)
     * - /api/bank/* (جلب الدروس)
     * - /api/chat (استهلاك الـ AI)
     */
    '/api/admin/:path*',
    '/api/bank/:path*',
    '/api/chat/:path*',
  ],
};