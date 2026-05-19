import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        /* shadcn tokens */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        /* Brand: Navy primary */
        navy: {
          DEFAULT: '#0F2942',
          light: '#1E4D6B',
          lighter: '#2D6A8F',
          50: '#E8F0F7',
        },

        /* Brand: Semantic */
        success: { DEFAULT: '#059669', light: '#D1FAE5' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7' },
        danger:  { DEFAULT: '#DC2626', light: '#FEE2E2' },
        info:    { DEFAULT: '#2563EB', light: '#DBEAFE' },

        /* Brand: Accent */
        gold: { DEFAULT: '#C9A84C', light: '#F5EDDA' },
      },

      fontSize: {
        /* Brand scale overrides */
        sm:   ['0.8125rem', { lineHeight: '1.25rem' }],  /* 13px */
        base: ['0.875rem',  { lineHeight: '1.5rem'  }],  /* 14px — body default */
        md:   ['1rem',      { lineHeight: '1.5rem'  }],  /* 16px */
      },

      boxShadow: {
        sm:  '0 1px 2px 0 rgba(0,0,0,0.05)',
        md:  '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.04)',
        lg:  '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
        DEFAULT: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.04)',
      },

      height: {
        header: '56px',
      },

      width: {
        sidebar: '240px',
        'sidebar-collapsed': '64px',
      },
    },
  },
  plugins: [],
};

export default config;
