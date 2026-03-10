import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  root: "src/ui",
  build: {
    outDir: resolve(__dirname, "."),
    emptyOutDir: false,
    target: "es2017",
    rollupOptions: {
      input: resolve(__dirname, "src/ui/index.html"),
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/ui"),
    },
  },
});
