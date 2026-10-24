/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050607",
        card: "#111418",
        surface: "#1B1F24",
        primary: "#FF2638",
        primaryDark: "#A10F20",
        foreground: "#F5F5F5",
        muted: "#A5ABB4",
        border: "#262B33",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(255, 38, 56, 0.4)",
        glowSm: "0 0 15px -3px rgba(255, 38, 56, 0.3)",
      },
    },
  },
  plugins: [],
}
