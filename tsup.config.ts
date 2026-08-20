import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["app/index.ts"],
  tsconfig: "tsconfig.sdk.json",
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  treeshake: true,
  minify: true,
  clean: true,
  external: ["react", "react-dom", "next"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
