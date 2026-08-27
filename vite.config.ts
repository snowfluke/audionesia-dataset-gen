import { fileURLToPath } from "node:url";
import solidPlugin from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// The Pages workflow sets BASE_PATH to the repository sub-path.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [solidPlugin(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  worker: { format: "es" },
  // transformers.js locates its ONNX runtime with import.meta.url; pre-bundling breaks that.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
});
