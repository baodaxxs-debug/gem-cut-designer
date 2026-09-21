import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative assets work on both a GitHub Pages project URL and local previews.
  base: './',
  plugins: [react()],
})
