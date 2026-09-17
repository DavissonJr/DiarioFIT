/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#EFF2ED',
        surface: '#FFFFFF',
        ink: '#16221C',
        mute: '#61706A',
        line: '#DDE4DC',
        leaf: {
          50: '#EAF3ED',
          100: '#D3E7DB',
          200: '#A9CDB8',
          400: '#3E8A63',
          500: '#1F6B47',
          600: '#18573A',
          700: '#12412B',
        },
        prot: '#C0553F',
        carb: '#D9A036',
        fat: '#6E7FB8',
        water: '#3E86A0',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        card: '0 1px 2px rgba(22,34,28,.05), 0 8px 24px -16px rgba(22,34,28,.28)',
        lift: '0 -8px 40px -12px rgba(22,34,28,.35)',
      },
      keyframes: {
        rise: { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        pop: { '0%': { transform: 'scale(.85)' }, '60%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: { rise: 'rise .22s ease-out', pop: 'pop .25s ease-out' },
    },
  },
  plugins: [],
};
