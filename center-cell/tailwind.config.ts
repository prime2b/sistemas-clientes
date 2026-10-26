import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        brand: {50:'var(--cx-brand-50)',600:'var(--cx-brand-600)',900:'var(--cx-brand-900)'},
        neutral: {50:'var(--cx-neutral-50)',100:'var(--cx-neutral-100)',200:'var(--cx-neutral-200)',300:'var(--cx-neutral-300)',500:'var(--cx-neutral-500)',600:'var(--cx-neutral-600)',900:'var(--cx-neutral-900)'},
        success:'var(--cx-success)',warning:'var(--cx-warning)',danger:'var(--cx-danger)',info:'var(--cx-info)',
      },
      borderRadius: {control:'var(--cx-radius-control)',card:'var(--cx-radius-card)',pill:'var(--cx-radius-pill)'},
      fontFamily: {sans:['var(--font-geist-sans)','Inter','system-ui','sans-serif'],mono:['var(--font-geist-mono)','ui-monospace','monospace']},
    },
  },
} satisfies Config;
