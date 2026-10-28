import type { Config } from 'tailwindcss'

// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS — single source of truth for the Veda Heritage UI.
// Palette follows the Eccellere brand family: green + teal on a navy ink.
// (Source values: Eccellere brand palette — navy 1B2A4A, teal 1A6B72, green 1D6A3A.)
// To re-skin the whole site, change the values here and nothing else.
// Never hard-code hex values in components; use these token classes.
// ═══════════════════════════════════════════════════════════════════
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — green: main actions, brand headings, links
        primary: { DEFAULT: '#1D6A3A', dark: '#124626', light: '#2F8A52' },
        // Accent — teal: labels, rules, highlights, secondary actions
        accent: {
          DEFAULT: '#1A6B72',
          dark: '#114A50',
          light: '#8ADBD9', // accent on DARK backgrounds (hero, footer)
          pale: '#E4F1F1',  // soft accent tint for callouts
        },
        // Surfaces and text
        surface: '#F5F9F7',
        ink: { DEFAULT: '#1B2A4A', mid: '#3F4B5E' },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        // Page hero band: deep green sweeping to teal
        'hero-gradient': 'linear-gradient(160deg, #0B2F1B 0%, #1D6A3A 55%, #1A6B72 100%)',
        'dark-overlay': 'linear-gradient(to bottom, rgba(11,47,27,0.55) 0%, rgba(11,47,27,0.78) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
