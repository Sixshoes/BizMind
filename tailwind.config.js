/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '2xs': '0 1px 1px 0 rgb(0 0 0 / 0.05)',
      },
      borderRadius: {
        'xs': '0.125rem',
      },
      backdropBlur: {
        'xs': '2px',
      },
      spacing: {
        '0.2': '0.05rem',
      },
    },
  },
  plugins: [],
};
