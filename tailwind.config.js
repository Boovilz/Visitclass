/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.html', './public/js/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sarabun', 'Noto Sans Thai', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#FFF1F8',
          100: '#FFE3F0',
          200: '#FFC7E1',
          300: '#F97AB6',
          400: '#F55BA5',
          500: '#F13596',
          600: '#D91F7E',
          700: '#B01464',
          800: '#7E0E48',
          900: '#4A2C6D',
        },
        teal: { DEFAULT: '#26A69A', 500: '#26A69A', 600: '#1E8E82' },
        lime: { DEFAULT: '#AED581', 500: '#AED581' },
        amber2: { DEFAULT: '#FFCA28', 500: '#FFCA28', 600: '#FBC02D' },
        peach: { DEFAULT: '#FF8A65', 500: '#FF8A65' },
        danger: { DEFAULT: '#EF5350', 500: '#EF5350', 600: '#D32F2F' },
        plum: { DEFAULT: '#4A2C6D', 500: '#4A2C6D' },
        orange2: { DEFAULT: '#F57C00' },
        sky2: { DEFAULT: '#0288D1' },
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(74,44,109,.10), 0 6px 24px -8px rgba(241,53,150,.12)',
        card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(74,44,109,.18)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        pop: { '0%': { transform: 'scale(.94)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-in': 'fade-in .25s ease-out both',
        'slide-in': 'slide-in .22s ease-out both',
        pop: 'pop .18s ease-out both',
      },
    },
  },
  plugins: [],
};
