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
      }
    },
  },
  plugins: [],
}