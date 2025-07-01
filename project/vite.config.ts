import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_MAPS_API_KEY),
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
