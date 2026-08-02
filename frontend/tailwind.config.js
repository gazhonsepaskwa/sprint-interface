/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1c2333',
        card: '#2a324b',
        border: '#3d4766',
        primary: '#5d5fef',
        secondary: '#3b82f6',
      },
      backgroundImage: {
        'dot-pattern': "radial-gradient(circle, #3d4766 1px, transparent 1px)",
      },
      backgroundSize: {
        'dot-size': '24px 24px',
      },
    },
  },
  plugins: [],
}
