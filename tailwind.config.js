/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./ui/index.html",
    "./ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--base-bg)",
        surface: "var(--base-surface)",
        brand: {
          primary: "var(--brand-primary)",
          soft: "var(--brand-primary-soft)",
          emerald: "var(--brand-emerald)",
          amber: "var(--brand-amber)",
          rose: "var(--brand-rose)",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'premium': "var(--shadow-premium)",
        'md': "var(--shadow-md)",
        'lg': "var(--shadow-lg)",
      }
    },
  },
  plugins: [],
}
