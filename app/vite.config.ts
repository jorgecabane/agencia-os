import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./": ui-dist se carga por file://, las rutas de assets deben ser relativas.
export default defineConfig({
  root: "ui",
  base: "./",
  plugins: [react()],
  build: { outDir: "../ui-dist", emptyOutDir: true },
});
