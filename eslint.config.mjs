import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["app/page.tsx"],
    rules: {
      "@next/next/no-img-element": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "output/**",
    "tmp/**",
    "local-db-data/**",
    ".playwright-cli/**"
  ])
]);
