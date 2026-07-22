import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'icons/apple-touch-icon.png',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png'
      ],
      manifest: '/manifest.json',
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2}',
          '**/models/**/*.{json,bin}'
        ],
        globIgnores: [
          '**/node_modules/**/*',
          '**/dist/**/*'
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 tahun
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 tahun
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 hari
              }
            }
          },
          {
            urlPattern: /\/models\/.*\.(json|bin)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 hari
              }
            }
          }
        ],
        // Strategi precaching untuk model AI
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/_/, /\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },
      // Development options
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Pisahkan vendor chunks untuk optimasi caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-tfjs': ['@tensorflow/tfjs'],
          'vendor-transformers': ['@huggingface/transformers']
        }
      }
    }
  }
});