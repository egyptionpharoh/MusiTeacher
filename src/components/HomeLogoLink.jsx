// 🏠 شعار MusiTeacher القابل للضغط: يعيد المستخدم إلى الصفحة الرئيسية للمنصة من أي هيدر.
// مكوّن واحد تستخدمه كل الهيدرات (AppHeader، شريط صفحة اللعبة…) حتى يبقى السلوك موحّدًا.
// يعتمد على Link من Next فيتم الانتقال داخليًا دون إعادة تحميل الصفحة بالكامل.
import Link from 'next/link';

/** المسار الرئيسي للمنصة (بوابة MusiTeacher الذكية) — يُغيَّر هنا وحده إن تغيّر مستقبلًا */
export const HOME_PATH = '/';

export default function HomeLogoLink({ children, className = '', label = 'MusiTeacher — العودة إلى الصفحة الرئيسية', ...rest }) {
  return (
    <Link href={HOME_PATH} aria-label={label} title="الصفحة الرئيسية" className={className} {...rest}>
      {children}
    </Link>
  );
}
