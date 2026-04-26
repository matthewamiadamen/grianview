import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        page: '#f7f7f5',
        panel: '#ffffff',
        'border-default': '#e2e1dc',
        'border-strong': '#c8c7c2',
        'text-primary': '#1a1a18',
        'text-secondary': '#5a5a55',
        'text-muted': '#8a8a84',
        amber: {
          DEFAULT: '#d97706',
          light: '#fef3c7',
        },
        suitable: {
          DEFAULT: '#15803d',
          fill: '#dcfce7',
        },
        unsuitable: {
          DEFAULT: '#dc2626',
          fill: '#fee2e2',
        },
        confidence: {
          DEFAULT: '#1d4ed8',
          fill: '#dbeafe',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
      },
      fontSize: {
        nav: ['15px', { lineHeight: '1.2', letterSpacing: '-0.3px', fontWeight: '600' }],
        body: ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        label: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        section: ['11px', { lineHeight: '1.2', letterSpacing: '0.5px', fontWeight: '400' }],
        score: ['22px', { lineHeight: '1', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};

export default config;
