import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Для GitHub Pages: замени 'fahhhh-tapper' на имя своего репо
  base: process.env.NODE_ENV === "production" ? "/fahhhh-tapper/" : "/",
});
