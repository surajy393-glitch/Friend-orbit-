/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        heading: ['Unbounded', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Archetype colors
        anchor: "hsl(var(--anchor))",
        spark: "hsl(var(--spark))",
        sage: "hsl(var(--sage))",
        comet: "hsl(var(--comet))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 20px currentColor, 0 0 40px currentColor",
            opacity: "1"
          },
          "50%": { 
            boxShadow: "0 0 30px currentColor, 0 0 60px currentColor",
            opacity: "0.9"
          }
        },
        "orbit-entry": {
          "0%": { 
            transform: "scale(0)",
            opacity: "0"
          },
          "100%": { 
            transform: "scale(1)",
            opacity: "1"
          }
        },
        "meteor-float": {
          "0%, 100%": { 
            transform: "translateY(0) rotate(1deg)"
          },
          "50%": { 
            transform: "translateY(-4px) rotate(-1deg)"
          }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 4s ease-in-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "orbit-entry": "orbit-entry 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "meteor-float": "meteor-float 5s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite"
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'space-gradient': 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
