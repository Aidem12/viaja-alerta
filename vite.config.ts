
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages utiliza /viaja-alerta/
  // Render y localhost utilizan /
  base: process.env.DEPLOY_TARGET === 'github-pages'
    ? '/viaja-alerta/'
    : '/',

  plugins: [react(), tailwindcss()],

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },

  preview: {
    host: '0.0.0.0'
  }
})
