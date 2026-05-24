import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    silent: true,
    passWithNoTests: true,
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.spec.ts", "**/*.test.ts", "**/index.ts"],
    },
  },
});
