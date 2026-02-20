import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f8f7",
          100: "#d4ece9",
          500: "#1e7e74",
          700: "#155950",
          900: "#103f39"
        }
      }
    }
  },
  plugins: []
};

export default config;
