import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  // Set base for GitHub Pages deployment.
  // VITE_BASE_URL is injected by the CI workflow; defaults to '/' for local dev.
  base: process.env.VITE_BASE_URL ?? '/',
})
