import NoorMarkClient from './NoorMarkClient';

export const metadata = {
  title: 'By NoorMark',
  description: 'نظام رصد وطباعة كشوف التقويم المستمر',
};

export default function NoorMarkPage() {
  return (
    <div className="container mx-auto p-4">
      <NoorMarkClient />
    </div>
  );
}