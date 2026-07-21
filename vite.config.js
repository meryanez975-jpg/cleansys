import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        // Solo assets estáticos — excluye HTML para no interferir con el routing de Vercel
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
        navigateFallback: null,
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        registro: resolve(__dirname, 'registro.html'),
        semana:   resolve(__dirname, 'semana.html'),
      },
    },
  },
})
