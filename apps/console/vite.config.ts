import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: resolve(here, "index.html"),
      output: {
        entryFileNames: "app.js",
        assetFileNames: ({ name }) => {
          if (name && name.endsWith(".css")) return "app.css";
          return "assets/[name].[ext]";
        },
        chunkFileNames: "assets/[name].js",
      },
    },
  },
  optimizeDeps: {},
});


