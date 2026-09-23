/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        amiri: ['Amiri', 'serif'],
        cairo: ['Cairo', 'sans-serif'],
      },
      colors: {
        brand: {
          light: '#87c0cd',
          DEFAULT: '#226597',
          dark: '#113f67',
        }
      }
    },
  },
  plugins: [],
}