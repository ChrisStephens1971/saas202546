/**
 * Jest setup file
 * Runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test'

// Set test database URL
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobile_mechanic_test'

// Set test secrets
process.env.JWT_SECRET = 'test-jwt-secret-256-bit-key-for-testing-only'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-256-bit-key-for-testing'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console output in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}
