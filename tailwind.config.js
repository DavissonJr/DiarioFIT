/** @type {import('tailwindcss').Config} */

// Cada cor vem de uma variável CSS definida por tema em src/index.css.
// O formato "rgb(var(--x) / <alpha-value>)" mantém funcionando bg-ink/40, text-mute/60 etc.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        ink: v('ink'),
        mute: v('mute'),
        line: v('line'),
        'on-brand': v('on-brand'),
        brand: {
          50: v('brand-50'),
          100: v('brand-100'),
          200: v('brand-200'),
          400: v('brand-400'),
          500: v('brand-500'),
          600: v('brand-600'),
          700: v('brand-700'),
        },
        prot: v('prot'),
        carb: v('carb'),
        fat: v('fat'),
        fiber: v('fiber'),
        water: v('water'),
        meal: {
          cafe: v('meal-cafe'),
          almoco: v('meal-almoco'),
          lanche: v('meal-lanche'),
          jantar: v('meal-jantar'),
          ceia: v('meal-ceia'),
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .06), 0 8px 24px -16px rgb(var(--shadow) / .30)',
        lift: '0 -8px 40px -12px rgb(var(--shadow) / .40)',
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
