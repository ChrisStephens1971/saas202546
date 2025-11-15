import app from './app'
import { config, validateConfig } from '@config'
import logger from '@config/logger'
import { checkDatabaseConnection, closeDatabaseConnection } from '@config/database'
import { initializeBlobStorage } from '@lib/azure-storage'

// Validate configuration on startup
try {
  validateConfig()
  logger.info('Configuration validated successfully')
} catch (error) {
  logger.error('Configuration validation failed', error)
  process.exit(1)
}

// Start server
const server = app.listen(config.port, async () => {
  logger.info(`🚀 Server running on port ${config.port}`)
  logger.info(`📝 Environment: ${config.nodeEnv}`)
  logger.info(`🔗 API URL: ${config.apiBaseUrl}`)

  // Check database connection
  try {
    const dbHealthy = await checkDatabaseConnection()
    if (dbHealthy) {
      logger.info('✅ Database connection established')
    } else {
      logger.warn('⚠️  Database connection check failed')
    }
  } catch (error) {
    logger.error('❌ Database connection error', error)
    if (config.nodeEnv === 'production') {
      logger.error('Shutting down due to database connection failure')
      process.exit(1)
    }
  }

  // Initialize Azure Blob Storage
  try {
    initializeBlobStorage()
    logger.info('✅ Azure Blob Storage initialized')
  } catch (error) {
    logger.warn('⚠️  Azure Blob Storage initialization failed (will continue without it)', error)
  }
})

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown`)

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed')

    try {
      // Close database connections
      await closeDatabaseConnection()
      logger.info('Database connections closed')

      logger.info('Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      logger.error('Error during graceful shutdown', error)
      process.exit(1)
    }
  })

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason })
  if (config.nodeEnv === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION')
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

export default server
