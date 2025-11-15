import express, { Express, Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { config } from '@config'
import logger, { httpLoggerStream } from '@config/logger'
import { checkDatabaseConnection } from '@config/database'
import authRoutes from './modules/auth/auth.routes'
import customersRoutes from './modules/customers/customers.routes'
import vehiclesRoutes from './modules/vehicles/vehicles.routes'
import jobsRoutes from './modules/jobs/jobs.routes'
import jobTemplatesRoutes from './modules/job-templates/job-templates.routes'
import partsRoutes from './modules/parts/parts.routes'
import inventoryRoutes from './modules/inventory/inventory.routes'
import trustArtifactsRoutes from './modules/trust-artifacts/trust-artifacts.routes'

// Create Express app
const app: Express = express()

// =========================
// Security Middleware
// =========================

// Helmet for security headers
app.use(helmet())

// CORS configuration
app.use(
  cors({
    origin: [config.frontendUrl, config.apiBaseUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
  })
)

// =========================
// Request Parsing
// =========================

// Parse JSON bodies (limit 10mb for image uploads via base64)
app.use(express.json({ limit: '10mb' }))

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// =========================
// Logging
// =========================

// HTTP request logging with Morgan
app.use(
  morgan(
    config.nodeEnv === 'development'
      ? 'dev'
      : ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
    { stream: httpLoggerStream }
  )
)

// =========================
// Health Check Routes
// =========================

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  })
})

app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    const dbHealthy = await checkDatabaseConnection()

    if (!dbHealthy) {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'failed'
        }
      })
      return
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok'
      }
    })
  } catch (error) {
    logger.error('Readiness check failed', error)
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString()
    })
  }
})

// =========================
// API Routes
// =========================

// Auth routes
app.use('/api/auth', authRoutes)

// Customers routes
app.use('/api/customers', customersRoutes)

// Vehicles routes
app.use('/api/vehicles', vehiclesRoutes)

// Jobs routes
app.use('/api/jobs', jobsRoutes)

// Job Templates routes
app.use('/api/job-templates', jobTemplatesRoutes)

// Parts routes
app.use('/api/parts', partsRoutes)

// Inventory routes
app.use('/api/inventory', inventoryRoutes)

// Trust Artifacts routes
app.use('/api/trust-artifacts', trustArtifactsRoutes)

// TODO: Mount additional API routes here
// app.use('/api/invoices', invoicesRoutes)
// etc.

app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Mobile Mechanic Empire API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// =========================
// Error Handling
// =========================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path
  })
})

// Global error handler
interface AppError extends Error {
  status?: number
  statusCode?: number
  isOperational?: boolean
}

app.use((err: AppError, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    status
  })

  // Send error response
  res.status(status).json({
    error: config.nodeEnv === 'production' ? 'Internal Server Error' : err.message,
    message: config.nodeEnv === 'production'
      ? 'An error occurred processing your request'
      : message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  })
})

export default app
