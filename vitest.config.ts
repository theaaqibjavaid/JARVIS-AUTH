/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react() as any],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    typecheck: {
      tsconfig: "./tsconfig.vitest.json",
      checker: "tsc",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "html"],
      include: [
        "app/lib/**/*.{ts,tsx}",
        "app/context/**/*.{ts,tsx}",
        "app/types/**/*.{ts,tsx}",
        "app/components/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "**/*.stories.*", "**/python-backend/**"],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
