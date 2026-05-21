// frontend/vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    // ── React (Fast Refresh + JSX transform) ─────────────────────────────────
    react(),

    // ── PWA (service worker + manifest) ──────────────────────────────────────
    VitePWA({
      registerType: 'prompt',          // main.jsx handles the update prompt
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'masked-icon.svg',
      ],
      manifest: {
        name: 'TradeLens',
        short_name: 'TradeLens',
        description:
          'Cross-border trade compliance platform — Tanzania–Zambia corridor',
        theme_color: '#111111',
        background_color: '#f9f9f7',
        display: 'standalone',
        scope: '/',
        start_url: '/',
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
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache the Supabase anon key requests and API responses
        // so customs officers can verify cached certs offline (BR-03)
        runtimeCaching: [
          {
            // Supabase REST API — cache certificates for offline QR fallback
            urlPattern: ({ url }) =>
              url.origin.includes('.supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // TradeLens backend API (Render)
            urlPattern: ({ url }) =>
              url.origin.includes('tradelens-api.onrender.com') ||
              url.origin.includes('localhost:4000'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 12, // 12 hours
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Static assets — fonts, images, icons
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],

  // ── Dev server ──────────────────────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      // Proxy /api calls to the Express backend in local dev
      // so you don't hit CORS issues during development
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // ── Build ───────────────────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,       // disable in production; enable for debugging
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manual chunks — split vendor libs from app code
        // keeps each role's bundle lean
        manualChunks: {
          react:    ['react', 'react-dom'],
          router:   ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },

  // ── Path resolution ─────────────────────────────────────────────────────────
  resolve: {
    alias: {
      '@': '/src',          // import from '@/components/...' anywhere in src/
    },
  },
});
