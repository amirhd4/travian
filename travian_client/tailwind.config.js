/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'travian-green': '#5c8a00',
        'travian-gold': '#ffcc00',
        'wood-dark': '#3d2b1a',
        'wood': '#5c3a21',
        'wood-light': '#7a5230',
        'parchment': '#f4ebd0',
        'parchment-dark': '#e5d9b6',
      },
    },
  },
  plugins: [],
}