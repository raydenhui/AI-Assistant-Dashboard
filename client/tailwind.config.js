/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors from UI_demo.html
        primary: {
          DEFAULT: '#347ac0',
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b9dfff',
          300: '#7cc4ff',
          400: '#36a5ff',
          500: '#347ac0',
          600: '#2a6299',
          700: '#224f7a',
          800: '#1a3c5c',
          900: '#12293d',
        },
        secondary: {
          DEFAULT: '#6bb98a',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#6bb98a',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Semantic colors
        danger: {
          DEFAULT: '#DC3545',
          light: '#f8d7da',
          dark: '#721c24',
        },
        warning: {
          DEFAULT: '#FFC107',
          light: '#fff3cd',
          dark: '#856404',
        },
        // UI colors - using CSS variables for dark mode support
        background: {
          DEFAULT: 'var(--color-background)',
        },
        widget: {
          DEFAULT: 'var(--color-widget)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
        },
        // Chat colors
        'chat-ai': 'var(--color-chat-ai)',
        'chat-user': 'var(--color-chat-user)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      boxShadow: {
        'widget': '0 1px 3px rgba(0,0,0,0.08)',
        'header': '0 2px 4px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        'chat': '20px',
      },
    },
  },
  plugins: [],
}
