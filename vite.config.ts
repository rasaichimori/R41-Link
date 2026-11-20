import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/R41-Link/",
  root: ".",
  publicDir: "public",
  plugins: [svelte()],
  build: {
    outDir: "dist",
  },
})
