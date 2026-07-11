/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Vazirmatn"', 'Tahoma', 'sans-serif'],
      },
      colors: {
        // پالت اصلی برند - سبز جنگلی + کهربایی گرم
        brand: {
          50:  '#f4faf1',
          100: '#e4f2db',
          200: '#c7e4b6',
          300: '#9fce85',
          400: '#72b258',
          500: '#4f9236',
          600: '#3c7527',
          700: '#305c21',
          800: '#294a1e',
          900: '#233f1c',
        },
        gold: {
          300: '#ffe08a',
          400: '#ffcc4d',
          500: '#f5b638',
          600: '#d9942a',
          700: '#b3721f',
        },
        ink: {
          900: '#1c1710',
          800: '#2b2318',
          700: '#3d3222',
          600: '#5a4a33',
          500: '#7a6647',
        },
        parchment: {
          50:  '#fffdf7',
          100: '#faf3e2',
          200: '#f1e4c6',
          300: '#e4cf9e',
        },
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(28,23,16,0.15)',
        card: '0 8px 24px -8px rgba(28,23,16,0.35)',
        glow: '0 0 0 3px rgba(245,182,56,0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}