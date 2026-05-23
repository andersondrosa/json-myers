import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",       // Full bundle — diff + patch + myers + fingerprint
    patch: "src/patch-entry.ts", // Patch-only subset (runtime/apply side)
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: true,
  treeshake: true,
});
