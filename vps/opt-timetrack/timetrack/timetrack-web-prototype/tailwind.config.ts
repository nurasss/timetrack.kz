import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#46dd8b',
          500: '#2ecc71',
          600: '#29c166',
          700: '#1fa058',
          800: '#18804a',
          900: '#146640',
          950: '#0a3d26',
        },
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
        navy: {
          50:  '#eef2f6',
          100: '#dde4ea',
          200: '#b3c2d1',
          300: '#7f93a8',
          400: '#4d6178',
          500: '#34495f',
          600: '#243448',
          700: '#152436',
          800: '#111e2d',
          900: '#0b1623',
          950: '#071421',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2ecc71 0%, #1fa058 100%)',
        'hero-mesh': 'radial-gradient(at 40% 20%, #d1fae5 0px, transparent 50%), radial-gradient(at 80% 0%, #ccfbf1 0px, transparent 50%), radial-gradient(at 0% 50%, #ecfdf5 0px, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        'brand': '0 4px 14px 0 rgb(41 193 102 / 0.30)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
