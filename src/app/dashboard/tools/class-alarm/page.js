import ClassAlarmPage from './ClassAlarmPage';

// منبّه الحصص الذكي — كل منطق الأداة في src/modules/class-alarm
export const metadata = {
  title: 'منبّه الحصص الذكي | MusiTeacher',
  description: 'مساعدك الذكي لتنظيم اليوم الدراسي والتنبيه بمواعيد الحصص.',
  manifest: '/class-alarm.webmanifest',
  appleWebApp: { capable: true, title: 'منبّه الحصص', statusBarStyle: 'black-translucent' },
  icons: { apple: '/class-alarm/icon-192.png' },
};
export const viewport = { themeColor: '#113f67' };

export default function Page() {
  return <ClassAlarmPage />;
}
