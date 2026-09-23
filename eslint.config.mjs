import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-config-prettier";

/**
 * Dependency rules of the modular architecture (see CLAUDE.md, "Architecture modulaire").
 *
 * - `core/` never imports `modules/`.
 * - A module never imports the internals of another module; only its public `index.ts`.
 * - `app/` (routes/layouts) may import `core/` and any module's public `index.ts`.
 * - Modules talk to each other through domain events, never direct calls.
 */
const sameModule = { module: "{{ from.element.captured.module }}" };

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*"],
      // Next requires this file at the root of `src`; it belongs to no element.
      // Named `proxy.ts` since Next 16 renamed the middleware convention.
      "boundaries/ignore": ["src/proxy.ts"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app", partialMatch: false },
        { type: "core", pattern: "src/core", partialMatch: false },
        { type: "module", pattern: "src/modules/*", partialMatch: false, capture: ["module"] },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Import interdit par l'architecture modulaire : {{ from.element.type }} → {{ to.element.type }} (voir CLAUDE.md).",
          policies: [
            // core → core only
            { from: { element: { type: "core" } }, allow: { to: { element: { type: "core" } } } },
            // app → app, core, and any module's public index.ts
            {
              from: { element: { type: "app" } },
              allow: [
                { to: { element: { types: { anyOf: ["app", "core"] } } } },
                { to: { element: { type: "module", fileInternalPath: "index.ts" } } },
              ],
            },
            // module → core, its own files, and OTHER modules' public index.ts only
            {
              from: { element: { type: "module" } },
              allow: [
                { to: { element: { type: "core" } } },
                { to: { element: { type: "module", captured: sameModule } } },
                { to: { element: { type: "module", fileInternalPath: "index.ts" } } },
              ],
            },
          ],
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    },
  },
  {
    // Domain logic must stay pure: no Supabase, no React, no Next.
    files: ["src/modules/*/domain/**/*.{ts,tsx}", "src/core/time/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "react", "react-dom", "next", "next/*", "@/core/db/*"],
              message: "domain/ code must be pure (no DB, no React, no Next).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "supabase/**",
  ]),
]);

export default eslintConfig;
