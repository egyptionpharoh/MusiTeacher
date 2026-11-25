// صفحة «صندوق الاقتراحات السرية»: مفتوحة دون تسجيل دخول، ولا تطلب أي بيانات شخصية.
import SuggestionBox from '@/components/suggestions/SuggestionBox';

export const metadata = {
  title: 'صندوق الاقتراحات السرية – MusiTeacher',
  description: 'مساحتك للتعبير بحرية: أرسل اقتراحك أو ملاحظتك أو مشكلتك إلى إدارة MusiTeacher دون ذكر اسمك.',
  robots: { index: false, follow: false },
};

export default function SuggestionsPage() {
  return <SuggestionBox />;
}
