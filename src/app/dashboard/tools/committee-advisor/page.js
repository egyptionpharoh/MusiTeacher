import CommitteeAdvisorPage from './CommitteeAdvisorPage';

// مستشار المعلم في اللجان والامتحانات — كل منطق الأداة في src/modules/committee-advisor
// يجيب من قاعدة معرفة مكتوبة، ويستعين بـ Gemini (على الخادم فقط) عند الحاجة — انظر src/app/api/committee-advisor
export const metadata = {
  title: 'مستشار المعلم في اللجان والامتحانات | MusiTeacher',
  description: 'اسأل عن مهامك وحقوقك ومسؤولياتك، وتعرّف على ما ينتظرك داخل اللجان والامتحانات.',
};

export default function Page() {
  return <CommitteeAdvisorPage />;
}
