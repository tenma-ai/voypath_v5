import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    force: true,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
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
    port: 8080,
    open: true,
    strictPort: false,
    fs: {
      strict: false,
    },
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    target: 'es2020',
    logLevel: 'silent'
  },
});
