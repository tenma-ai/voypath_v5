/**
 * Test Setup Configuration
 * Configures global test environment for Place API testing
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { placeApiHandlers } from './mocks/place-api-handlers'
import { testDatabase } from './utils/test-database'

// Mock Service Worker server for API mocking
export const server = setupServer(...placeApiHandlers)

// Global test configuration
beforeAll(async () => {
  console.log('🚀 Setting up test environment...')
  
  // Start MSW server
  server.listen({ onUnhandledRequest: 'warn' })
  
  // Initialize test database
  await testDatabase.initialize()
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
  
  console.log('✅ Test environment ready')
})

beforeEach(async () => {
  // Clean up test database before each test
  await testDatabase.cleanup()
  
  // Reset any request handlers that may have been modified during tests
  server.resetHandlers()
})

afterEach(async () => {
  // Clean up any test data
  await testDatabase.cleanup()
})

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
  
  // Close MSW server
  server.close()
  
  // Close test database connection
  await testDatabase.disconnect()
  
  console.log('✅ Test environment cleaned up')
})

// Global test utilities
declare global {
  namespace Vi {
    interface TestContext {
      testUserId: string
      testTripId: string
      testPlaceId: string
    }
  }
}

// Export commonly used test utilities
export * from './utils/test-helpers'
export * from './fixtures/place-fixtures'
export * from './mocks/supabase-mock'