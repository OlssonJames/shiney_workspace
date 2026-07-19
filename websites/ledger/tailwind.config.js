/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        'primary-dark': '#4F46E5',
        'primary-light': '#8183FF',
        accent: '#14B8A6',
        'accent-dark': '#0D9488',
        background: '#F7F7FB',
        surface: '#FFFFFF',
        ink: '#1A1A1F',
        muted: '#6B6F76',
        divider: '#E4E6EB',
        deep: '#0F1115',
        // The 6 tracked life-area colors — identical hex values to the
        // Habit Tracker / Session Notes / Day Planner apps for visual continuity.
        sidehustle: '#6366F1',
        gym: '#F97316',
        bjj: '#14B8A6',
        coding: '#8B5CF6',
        growth: '#EC4899',
        screentime: '#0EA5E9',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2.5xl': '1.25rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
        '7xl': '4rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
