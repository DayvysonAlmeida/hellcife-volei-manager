/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta HellLife Vôlei
        background: '#09090B',
        surface: '#18181B',
        card: '#1C1C1F',
        border: '#27272A',
        'border-subtle': '#3F3F46',

        // Cores primárias
        red: {
          DEFAULT: '#D90429',
          dark: '#A80020',
          light: '#FF1744',
          neon: '#FF0035',
        },
        blue: {
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
          light: '#3B82F6',
          neon: '#00B4FF',
        },

        // Texto
        'text-primary': '#FAFAFA',
        'text-secondary': '#A1A1AA',
        'text-muted': '#71717A',

        // Status
        success: '#16A34A',
        warning: '#CA8A04',
        error: '#DC2626',
        info: '#2563EB',

        // Posições
        position: {
          libero: '#0891B2',
          setter: '#7C3AED',
          opposite: '#D90429',
          outside: '#16A34A',
          middle: '#CA8A04',
          universal: '#EA580C',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'Impact', 'sans-serif'],
      },
      boxShadow: {
        'neon-red': '0 0 20px rgba(217, 4, 41, 0.4), 0 0 40px rgba(217, 4, 41, 0.2)',
        'neon-blue': '0 0 20px rgba(37, 99, 235, 0.4), 0 0 40px rgba(37, 99, 235, 0.2)',
        'neon-red-sm': '0 0 10px rgba(217, 4, 41, 0.3)',
        'neon-blue-sm': '0 0 10px rgba(37, 99, 235, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse at top, rgba(217, 4, 41, 0.15) 0%, rgba(9, 9, 11, 0) 60%)',
        'card-gradient': 'linear-gradient(135deg, rgba(28, 28, 31, 0.9), rgba(24, 24, 27, 0.95))',
        'red-gradient': 'linear-gradient(135deg, #D90429, #A80020)',
        'blue-gradient': 'linear-gradient(135deg, #2563EB, #1D4ED8)',
        'sidebar-gradient': 'linear-gradient(180deg, #09090B 0%, #0D0D10 100%)',
      },
      animation: {
        'pulse-red': 'pulseRed 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(217, 4, 41, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(217, 4, 41, 0.6)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
