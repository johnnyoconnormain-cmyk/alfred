import type { Config } from 'tailwindcss';

/**
 * Groundwork's visual language: paper and ink, one deep field green for action,
 * and a reserved status set. No gradients, no glass, no decorative color.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#f6f5f1',
          raised: '#ffffff',
          sunken: '#eeece5',
        },
        ink: {
          DEFAULT: '#12130f',
          muted: '#5f6259',
          faint: '#8b8e84',
        },
        line: {
          DEFAULT: '#e2e0d8',
          strong: '#cfccc1',
        },
        field: {
          DEFAULT: '#1f6b3f',
          deep: '#175934',
          light: '#e7f0e9',
        },
        status: {
          good: '#1f6b3f',
          warning: '#a8720c',
          serious: '#b4551f',
          critical: '#a32b28',
        },
        series: {
          1: '#2a78d6',
          2: '#eb6834',
          3: '#1baf7a',
          4: '#eda100',
          5: '#e87ba4',
          6: '#008300',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18, 19, 15, 0.04)',
        raised: '0 1px 3px rgba(18, 19, 15, 0.08), 0 8px 24px -12px rgba(18, 19, 15, 0.18)',
        pop: '0 12px 48px -12px rgba(18, 19, 15, 0.28)',
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '5px',
        md: '6px',
        lg: '8px',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulse_dot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-dot': 'pulse_dot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
