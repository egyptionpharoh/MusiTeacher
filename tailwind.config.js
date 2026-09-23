/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 1. الخطوط المعتمدة
      fontFamily: {
        amiri: ['Amiri', 'serif'],
        cairo: ['Cairo', 'sans-serif'],
      },
      // 2. لوحة الألوان الموحدة
      colors: {
        brand: {
          light: '#87c0cd',
          DEFAULT: '#226597', // الأزرق الأساسي
          dark: '#113f67',   // الأزرق الغامق للهيدر
        },
        neonBlue: '#3B82F6', // اللون المفقود لصفحة الألعاب
      },
      // 3. تعريف حركات الـ Keyframes المخصصة
      keyframes: {
        buttonShine: {
          '100%': { left: '125%' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
      },
      // 4. ربط الـ Keyframes بكلاسات حركية جاهزة للاستخدام
      animation: {
        shine: 'buttonShine 0.8s ease-in-out forwards',
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
};
