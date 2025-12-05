/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        uatu: {
          // Primary
          primary: '#0F3F62',
          'primary-light': '#1a5a8a',
          'primary-dark': '#0a2d47',
          // Backgrounds
          bg: '#ffffff',
          'bg-secondary': '#f8fafc',
          'bg-tertiary': '#f1f5f9',
          // Cards
          card: '#ffffff',
          'card-hover': '#f8fafc',
          // Borders
          border: '#e2e8f0',
          'border-light': '#f1f5f9',
          'border-focus': '#0F3F62',
          // Text
          text: '#1e293b',
          'text-secondary': '#64748b',
          'text-muted': '#94a3b8',
          // Accent
          accent: '#0F3F62',
          'accent-light': '#1a5a8a',
          'accent-bg': 'rgba(15, 63, 98, 0.1)',
          // Input
          input: '#f8fafc',
          'input-border': '#e2e8f0',
        },
        status: {
          success: '#10B981',
          error: '#EF4444',
          warning: '#F59E0B',
          pending: '#6B7280',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'uatu': '16px',
        'uatu-sm': '10px',
        'uatu-xs': '6px',
      },
      boxShadow: {
        'uatu': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'uatu-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        'uatu-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      }
    },
  },
  plugins: [],
}
