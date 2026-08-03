/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0c1222',
          900: '#141c2e',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#78879c',
          300: '#94a3b8',
          200: '#cbd5e1',
          100: '#e2e8f0',
          50: '#f8fafc',
        },
        sand: {
          50: '#f7f5f1',
          100: '#efeae2',
          200: '#e0d8cc',
          // Warm dark surfaces (not pure slate)
          dark: {
            900: '#17140f',
            800: '#211c15',
            700: '#2a241c',
          },
        },
        teal: {
          700: '#0f766e',
          600: '#0d9488',
          500: '#14b8a6',
          400: '#2dd4bf',
          50: '#f0fdfa',
        },
        brick: {
          600: '#b45309',
          500: '#d97706',
        },
      },
      fontFamily: {
        display: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          'system-ui',
          'sans-serif',
        ],
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        // shadow-soft ≡ shadow-1 (resting). Prefer shadow-1/2/3 for new UI.
        soft: '0 1px 0 rgba(15, 23, 42, 0.04), 0 8px 20px -14px rgba(15, 23, 42, 0.16)',
        1: '0 1px 0 rgba(15, 23, 42, 0.04), 0 8px 20px -14px rgba(15, 23, 42, 0.16)',
        2: '0 2px 0 rgba(15, 23, 42, 0.05), 0 20px 36px -18px rgba(15, 23, 42, 0.26)',
        3: '0 30px 70px -24px rgba(15, 23, 42, 0.38)',
      },
      backgroundImage: {
        'app-grid':
          'linear-gradient(180deg, rgba(247,245,241,0.96), rgba(239,234,226,0.9)), radial-gradient(ellipse 80% 50% at 10% -10%, rgba(20,184,166,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(148,163,184,0.18), transparent)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOutSoft: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        dialogBackdrop: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        dialogPanel: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.45s ease-out both',
        fadeOutSoft: 'fadeOutSoft 0.4s ease-in both',
        pulseSoft: 'pulseSoft 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        dialogBackdrop: 'dialogBackdrop 200ms ease-out both',
        dialogPanel: 'dialogPanel 200ms ease-out both',
        toastIn: 'toastIn 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
