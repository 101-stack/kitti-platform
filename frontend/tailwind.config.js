/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Crimson Pro', 'Georgia', 'serif'],
      },
      colors: {
        felt: { DEFAULT: '#1a3a1f', light: '#22502a', dark: '#0f2213' },
        gold: { DEFAULT: '#c9993a', light: '#f0c060', dark: '#8b6914' },
      },
    },
  },
  plugins: [],
};
