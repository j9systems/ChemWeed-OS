import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'ChemWeed OS',
        short_name: 'ChemWeed OS',
        description: 'Vegetation management operations',
        theme_color: '#2a6b2a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'https://res.cloudinary.com/duy32f0q4/image/upload/c_fill,w_192,h_192/q_auto/f_png/v1775945506/Untitled_design_4_zvtwsp.png', sizes: '192x192', type: 'image/png' },
          { src: 'https://res.cloudinary.com/duy32f0q4/image/upload/c_fill,w_512,h_512/q_auto/f_png/v1775945506/Untitled_design_4_zvtwsp.png', sizes: '512x512', type: 'image/png' },
          { src: 'https://res.cloudinary.com/duy32f0q4/image/upload/c_fill,w_512,h_512/q_auto/f_png/v1775945506/Untitled_design_4_zvtwsp.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [{
          urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-cache',
            expiration: { maxEntries: 50, maxAgeSeconds: 300 },
          },
        }],
      },
    }),
  ],
})
