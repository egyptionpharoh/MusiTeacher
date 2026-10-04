// ده السقف والحيطان الخارجية للموقع كله
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';

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
      <head>
        {/* 🚨 Police Patch: تدمير ذاتي للنسخ المحفوظة محلياً (Save Page As) 🚨 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (window.location.protocol === 'file:') {
                document.documentElement.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:red;font-family:sans-serif;font-size:24px;font-weight:bold;text-align:center;padding:20px;">🚫 تم تدمير المحتوى. هذه النسخة غير قانونية ولا يمكن تصفحها محلياً خارج منصة MusiTeacher.</div>';
              }
            `,
          }}
        />
      </head>
      <body className="transition-colors duration-500">
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}