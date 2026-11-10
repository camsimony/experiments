import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // (relative, so the build runs from any folder it's served out of)
  base: "./",
  plugins: [react()],
});
