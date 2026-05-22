import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1A5C38',
          dark: '#0E3D24',
          light: '#2A7A4E',
        },
        gold: {
          DEFAULT: '#B8913A',
          pale: '#F5EDD8',
          light: '#D4AE5C',
        },
        cream: '#FAF8F4',
        ink: '#0E0E0D',
        'ink-mid': '#3A3935',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 60%, #0E3D24 100%)',
        'dark-overlay': 'linear-gradient(to bottom, rgba(10,46,26,0.55) 0%, rgba(10,46,26,0.75) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
