/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'Verdana', 'sans-serif'],
      },
      colors: {
        travian: {
          green: '#498843',
          'green-dark': '#3a6e35',
          'green-light': '#99C01A',
          orange: '#F88C1F',
          red: '#DE0000',
          body: '#A1BB79',
        },
        wood: {
          50: '#f5f0e8',
          100: '#e8dcc8',
          200: '#d4c4a0',
          300: '#bfa878',
          400: '#a88c50',
          500: '#8b7040',
          600: '#6e5830',
          700: '#524020',
          800: '#3a2c14',
          900: '#241a0a',
        },
        parchment: {
          50: '#fffdf7',
          100: '#faf3e2',
          200: '#f1e4c6',
          300: '#e4cf9e',
        },
        ink: {
          900: '#252525',
          800: '#333333',
          700: '#555555',
          600: '#777777',
          500: '#999999',
        },
        brand: {
          50: '#f4faf1',
          100: '#e4f2db',
          200: '#c7e4b6',
          300: '#9fce85',
          400: '#72b258',
          500: '#4f9236',
          600: '#3c7527',
          700: '#305c21',
        },
        gold: {
          50: '#fff9e8',
          100: '#fff2c9',
          200: '#ffe7a3',
          300: '#ffe08a',
          400: '#ffcc4d',
          500: '#f5b638',
          600: '#d9942a',
          700: '#b3721f',
        },
      },
      boxShadow: {
        soft: '0 2px 4px rgba(0,0,0,0.15)',
        card: '0 2px 8px rgba(0,0,0,0.2)',
        glow: '0 0 0 3px rgba(245,182,56,0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
