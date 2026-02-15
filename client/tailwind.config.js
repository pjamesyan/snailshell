/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        accent: '#3b82f6',
      }
    },
  },
  plugins: [],
}
