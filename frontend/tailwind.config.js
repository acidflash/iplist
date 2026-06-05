/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        c: {
          base:      'var(--c-base)',
          surface:   'var(--c-surface)',
          raised:    'var(--c-raised)',
          overlay:   'var(--c-overlay)',
          border:    'var(--c-border)',
          'border-sub': 'var(--c-border-sub)',
          text:      'var(--c-text)',
          text2:     'var(--c-text-2)',
          text3:     'var(--c-text-3)',
          accent:    'var(--c-accent)',
          success:   'var(--c-success)',
          warning:   'var(--c-warning)',
          danger:    'var(--c-danger)',
          purple:    'var(--c-purple)',
        },
      },
    },
  },
  plugins: [],
}
