import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── shadcn/ui CSS 변수 기반 색상 (호환성 유지) ──────────────────
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          // ── IVY 브랜드 컬러 (네이비 블루) ──────────────────────────
          900: "#0C2340",
          800: "#1B3A5C",
          700: "#1865F2",
          600: "#4B8AF5",
          100: "#EEF4FF",
          50: "#F7F9FC",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          // ── 보조 색상 ──────────────────────────────────────────────
          green: "#1FAF54",
          "green-light": "#E6F7ED",
          gold: "#FFB100",
          "gold-light": "#FFF8E6",
          red: "#D92916",
          "red-light": "#FFF0EE",
          purple: "#7854F7",
          "purple-light": "#F3EFFF",
          teal: "#0FBFAD",
          "teal-light": "#E6FAF8",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // ── 중립 색상 ────────────────────────────────────────────────
        gray: {
          900: "#21242C",
          700: "#3B3E48",
          500: "#6B6F7A",
          300: "#BABEC7",
          200: "#E3E5EA",
          100: "#F0F1F3",
          50: "#F7F8F9",
        },
        // ── 4영역 도메인 색상 ─────────────────────────────────────────
        domain: {
          grammar: "#1865F2",
          vocabulary: "#7854F7",
          reading: "#0FBFAD",
          writing: "#E35C20",
        },
      },
      keyframes: {
        progress: {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(200%)" },
        },
      },
      animation: {
        progress: "progress 1.2s ease-in-out infinite",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
