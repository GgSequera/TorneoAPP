import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // ✅ SOLO guardamos la cáscara visual (HTML, CSS, JS, imágenes).
        // Así la app carga sin internet, pero no interfiere con tu backend.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        
        // 🛑 BLOQUE runtimeCaching ELIMINADO: Ya no interceptará tu API.
      },
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Gestor de Torneos',
        short_name: 'Torneos',
        description: 'Sistema de gestión de torneos y resultados',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})