import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**", "apps/mobile/**"],
  },
  nextPlugin.configs["core-web-vitals"],
];
