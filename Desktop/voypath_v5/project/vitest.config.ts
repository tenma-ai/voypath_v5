import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,js}'],
    exclude: ['tests/browser/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.{ts,js}',
        '**/*.d.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 120000, // 2 minutes for performance tests
    hookTimeout: 30000,
    teardownTimeout: 10000,
    // Performance test specific configurations
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true // For database tests
      }
    },
    // Test sequencing for performance tests
    sequence: {
      concurrent: false // Run performance tests sequentially
    },
    // Retry configuration for flaky performance tests
    retry: 2,
    // Test reporters
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './tests/results/test-results.json'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    }
  },
  define: {
    // Test environment variables
    'process.env.NODE_ENV': '"test"',
  }
})