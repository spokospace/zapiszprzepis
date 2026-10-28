import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktree scratch copies (git-ignored) — never lint these.
    ".claude/**",
    // OpenNext build output (git-ignored), same category as .next/**.
    ".open-next/**",
    // Design handoff bundles (#266): third-party prototype runtime, reference only, never shipped.
    ".ai/design/**",
    ".ai/specs/assets/**",
    // Starlight docs site (docs/README.md): its own package, deps and build, not the app.
    // The banner renderer next to it (docs/banner/) is still linted.
    "docs/{src,dist,.astro}/**",
    "docs/astro.config.mjs",
  ]),
  {
    // Test doubles stub partial shapes of third-party objects (Inngest steps,
    // Supabase clients, R2 buckets). Spelling those out in full buys no safety
    // in a file whose whole job is to fake them. eslint-config-next 16.3 turned
    // this rule on as an error; scoping it off here rather than rewriting 20
    // mocks keeps a dependency bump from becoming a test rewrite.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
