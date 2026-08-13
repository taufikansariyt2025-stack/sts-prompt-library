import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /*
       * Enforces CLAUDE.md rule #3: user content is never rendered as HTML.
       * Prompt bodies are plain text nodes with `white-space: pre-wrap`, which
       * is both XSS-safe and correct for preserving their formatting.
       */
      "react/no-danger": "error",

      // No silent `any`.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // console.log is a debugging leftover; warn/error are intentional.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Scripts are operator tools — they are supposed to talk to the terminal.
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
