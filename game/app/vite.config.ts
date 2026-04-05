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
  // Pre-bundle CJS dependencies so Rollup can resolve their named exports
  optimizeDeps: {
    include: [
      '@blink/engine',
      'react',
      'react-dom',
      'react/jsx-runtime',
    ],
  },
  build: {
    commonjsOptions: {
      include: [
        /@blink\/engine/,
        /packages\/blink-engine/,
        /node_modules\/react\//,
        /node_modules\/react-dom\//,
        /node_modules\/scheduler\//,
      ],
      transformMixedEsModules: true,
    },
  },
  server: {
    fs: {
      // Allow serving files from the packages directory (for @blink/engine)
      allow: ['..', '../../packages'],
    },
  },
  publicDir: 'public',
})
