import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './ui',
  build: {
    outDir: '../dist-ui',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to the backend daemon
      '/api': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/auth': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      '/github': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      '/enqueue': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      '/progress': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      '/logs': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      '/report': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      '/jobs': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      '/healthz': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './ui/src'),
    },
  },
})
