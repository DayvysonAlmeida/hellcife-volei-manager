import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'apple-touch-icon-180x180.png', 'badge-96x96.png'],
      // Eventos do Web Push (push e toque na notificação) somados ao service worker gerado
      workbox: {
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'HellCife Vôlei Manager',
        short_name: 'HellCife',
        description: 'Gerenciador de Peladas de Vôlei',
        theme_color: '#D90429',
        background_color: '#09090B',
        display: 'standalone',
        // Gerados do escudo-hellcife-novo.png; o maskable tem margem para o Android recortar em círculo
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
