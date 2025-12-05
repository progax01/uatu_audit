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
          bg: '#0b1020',
          card: '#121a33',
          line: '#2e3a70',
          accent: '#0a7cff',
          muted: '#9fb0e3',
          text: '#eaf0ff',
          border: '#24356e',
          input: '#0f1630',
          'input-border': '#223069',
          'code-bg': '#0b122b',
          'code-border': '#253469',
          'code-text': '#d7e0ff',
        },
        status: {
          success: '#10B981',
          error: '#EF4444',
          warning: '#F59E0B',
          pending: '#6B7280',
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'uatu': '16px',
        'uatu-sm': '10px',
        'uatu-xs': '6px',
      },
    },
  },
  plugins: [],
}
