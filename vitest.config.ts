import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    exclude: [
      "node_modules",
      ".next",
      "dist",
      "scripts",
      "docs",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "app/**/*.ts"],
      exclude: [
        "node_modules",
        ".next",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.d.ts",
      ],
    },
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 10000,
  },
});
