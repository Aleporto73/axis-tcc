import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        aba: {
          50: '#fdf6f0',
          100: '#faeadb',
          200: '#f3d0b5',
          300: '#e5a876',
          400: '#d4854a',
          500: '#C46A2F',
          600: '#b05a25',
          700: '#924820',
          800: '#76391c',
          900: '#5e2e18',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      fontSize: {
        'display': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '300' }],
        'h1': ['2.5rem', { lineHeight: '1.2', fontWeight: '300' }],
        'h2': ['1.5rem', { lineHeight: '1.3', fontWeight: '300' }],
      },
      boxShadow: {
        'capsule': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'clinical': '0.5rem',
      },
    },
  },
  plugins: [],
};
export default config;
