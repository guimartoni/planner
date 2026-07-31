import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "/planner/" = o app vai morar em usuario.github.io/planner/
export default defineConfig({
  base: "/planner/",
  plugins: [react(), tailwindcss()],
});
