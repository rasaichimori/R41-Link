import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [svelte()],
  build: {
    outDir: "dist",
  },
})
