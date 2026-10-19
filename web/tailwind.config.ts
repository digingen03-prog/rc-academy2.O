import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF8500',
          50: '#FFF8F0',
          100: '#FFF1E0',
          200: '#FFE0BD',
          300: '#FFCE94',
          400: '#FFAA47',
          500: '#FF8500',
          600: '#E67700',
          700: '#CC6B00',
          800: '#A65700',
          900: '#804300',
          subtle: '#FFF4E5',
          border: '#FFD199',
        },
        brand: {
          DEFAULT: '#FF8500',
          50: '#FFF8F0',
          100: '#FFF1E0',
          200: '#FFE0BD',
          300: '#FFCE94',
          400: '#FFAA47',
          500: '#FF8500',
          600: '#E67700',
          700: '#CC6B00',
          800: '#A65700',
          900: '#804300',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
      },
      zIndex: {
        'base': '0',
        'sticky': '20',
        'header': '30',
        'sidebar': '30',
        'dropdown': '35',
        'nav-mobile': '40',
        'backdrop': '50',
        'modal': '50',
        'toast': '60',
      },
    },
  },
  plugins: [],
};

export default config;
