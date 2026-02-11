import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        status: {
          earmarked: "#f59e0b",
          submitted: "#3b82f6",
          funded: "#22c55e",
          "closed-won": "#10b981",
          "closed-lost": "#ef4444",
          "closed-abandoned": "#64748b",
          escalation: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};
export default config;
