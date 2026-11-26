import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // relative paths so the build works from any folder/host (GitHub Pages, Netlify, a USB stick…)
  base: './',
  server: { host: true },
})
