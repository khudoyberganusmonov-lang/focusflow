/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        light: {
          bg: '#FFFFFF',
          sidebar: '#F5F5F5',
          accent: '#007AFF',
          text: '#000000',
          dim: '#8E8E93',
        },
        dark: {
          bg: '#1C1C1E',
          sidebar: '#2C2C2E',
          accent: '#0A84FF',
          text: '#FFFFFF',
          dim: '#8E8E93',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'system-ui',
          'sans-serif',
        ],
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease',
      },
    },
  },
  plugins: [],
};
