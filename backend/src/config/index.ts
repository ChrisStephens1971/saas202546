import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local or .env
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env.local'
dotenv.config({ path: path.resolve(process.cwd(), envFile) })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

export const config = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
    ssl: process.env.DATABASE_SSL === 'true'
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Auth
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10)
  },

  // Azure Storage
  azureStorage: {
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || ''
  },

  // External Integrations
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
  },

  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@mechanicempire.com'
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development'
  },

  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
  }
}

// Validate required configuration
export function validateConfig() {
  const required = [
    { key: 'DATABASE_URL', value: config.database.url },
    { key: 'JWT_SECRET', value: config.auth.jwtSecret },
    { key: 'REFRESH_TOKEN_SECRET', value: config.auth.refreshTokenSecret }
  ]

  const missing = required.filter(({ value }) => !value)

  if (missing.length > 0 && config.nodeEnv !== 'test') {
    const keys = missing.map(({ key }) => key).join(', ')
    throw new Error(`Missing required environment variables: ${keys}`)
  }
}
