import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'card-border': 'var(--color-card-border)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        gold: 'var(--color-gold)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #D4A853, #B08D3E)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-status': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'flow-dash': {
          to: { strokeDashoffset: '-20' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 4px 0 rgba(201,169,98,0.4)' },
          '50%': { boxShadow: '0 0 12px 2px rgba(201,169,98,0.6)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 250ms ease-out',
        'pulse-status': 'pulse-status 1.5s ease-in-out infinite',
        'slide-in-left': 'slide-in-left 200ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'flow-dash': 'flow-dash 0.6s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
