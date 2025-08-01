import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_MAPS_API_KEY),
    'import.meta.env.VITE_TRAVELPAYOUTS_API_KEY': JSON.stringify(process.env.VITE_TRAVELPAYOUTS_API_KEY),
    'import.meta.env.VITE_TRAVELPAYOUTS_MARKER': JSON.stringify(process.env.VITE_TRAVELPAYOUTS_MARKER),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.TRAVELPAYOUTS_TOKEN': JSON.stringify(process.env.TRAVELPAYOUTS_TOKEN),
    'import.meta.env.WAYAWAY_MARKER': JSON.stringify(process.env.WAYAWAY_MARKER),
    'import.meta.env.VITE_LOG_LEVEL': JSON.stringify(process.env.VITE_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'WARN' : 'DEBUG')),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    force: true,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      cache: false,
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@headlessui/react', 'framer-motion'],
          utils: ['clsx', 'zustand'],
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
        },
      },
      maxParallelFileOps: 2,
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true,
    strictPort: false,
    fs: {
      strict: false,
    },
    hmr: {
      port: 5173,
      overlay: false,
      timeout: 60000,
      protocol: 'ws',
    },
    watch: {
      usePolling: false,
      interval: 100,
    },
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    target: 'es2020',
    logLevel: 'silent'
  },
});
