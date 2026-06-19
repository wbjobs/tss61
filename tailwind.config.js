/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        brand: {
          bg: '#0D0D0D',
          surface: '#1A1A1A',
          border: '#2A2A2A',
          muted: '#3A3A3A',
          accent: '#00E5CC',
          'accent-dim': '#00B3A0',
          text: '#E0E0E0',
          'text-dim': '#888888',
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Segoe UI"', 'sans-serif'],
        body: ['"DM Sans"', '"Segoe UI"', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 229, 204, 0.3)',
        'glow-lg': '0 0 40px rgba(0, 229, 204, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 229, 204, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 229, 204, 0.4)' },
        }
      }
    },
  },
  plugins: [],
};
