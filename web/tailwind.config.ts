import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#FBF5DD',  // Swatch Tier 1 (Warm Cream Canvas)
          100: '#F5ECCD',
          200: '#EBE0BA', // Swatch Tier 2 (Soft Sage Cream)
          300: '#DFCFA4',
          400: '#3A8F60',
          500: '#328A59',
          600: '#28734A', // Swatch Tier 3 (Primary Brand Forest Green)
          700: '#1F5C3B',
          800: '#16422B',
          900: '#0E4225', // Swatch Tier 4 (Deep Dark Pine Green)
          950: '#0A2E18',
        },
        brand: {
          50: '#FBF5DD',
          100: '#EBE0BA',
          500: '#28734A',
          900: '#0E4225',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
