// ده السقف والحيطان الخارجية للموقع كله
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';

export const metadata = {
  title: 'MusiTeacher - منصة معلمي المهارات الموسيقية',
  description: 'المنصة الذكية الأولى لمعلمي الموسيقى في سلطنة عمان',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="transition-colors duration-500">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}