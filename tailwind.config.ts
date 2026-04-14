import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        capybara: {
          50: '#fdf8f0',
          100: '#f5edd8',
          200: '#e8d5a8',
          300: '#d4b872',
          400: '#c49a45',
          500: '#a67c30',
          600: '#8a6228',
          700: '#6d4c22',
          800: '#5a3f20',
          900: '#4d361e',
        },
        river: {
          50: '#eef9ff',
          100: '#d8f1ff',
          200: '#bae8ff',
          300: '#8bdbff',
          400: '#54c4ff',
          500: '#2ca5ff',
          600: '#1586f5',
          700: '#0e6de1',
          800: '#1258b6',
          900: '#154b8f',
        },
        meadow: {
          50: '#f0fdf0',
          100: '#dcfcdc',
          200: '#bbf7bb',
          300: '#86ef86',
          400: '#4ade4a',
          500: '#22c522',
          600: '#16a316',
          700: '#158015',
          800: '#166516',
          900: '#145314',
        },
      },
    },
  },
  plugins: [],
}

export default config
