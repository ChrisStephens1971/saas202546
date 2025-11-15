import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, JwtPayload } from '@lib/jwt'
import logger from '@config/logger'

// Extend Express Request to include auth data
declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload
      tenantId?: string
      userId?: string
    }
  }
}

/**
 * Middleware to authenticate requests via JWT
 *
 * Expects Authorization header: Bearer <token>
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      })
      return
    }

    const token = authHeader.substring(7) // Remove "Bearer " prefix

    // Verify token
    const payload = verifyAccessToken(token)

    // Attach auth data to request
    req.auth = payload
    req.tenantId = payload.tenantId
    req.userId = payload.userId

    next()
  } catch (error: any) {
    logger.warn('Authentication failed', { error: error.message })

    res.status(401).json({
      error: 'Unauthorized',
      message: error.message || 'Invalid or expired token'
    })
  }
}

/**
 * Middleware to check if user has required role
 *
 * Usage: requireRole('admin', 'owner')
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      })
      return
    }

    const userRole = req.auth.role

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Authorization failed', {
        userId: req.userId,
        userRole,
        requiredRoles: allowedRoles
      })

      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      })
      return
    }

    next()
  }
}

/**
 * Middleware to extract tenant ID from header or JWT
 *
 * Supports two modes:
 * 1. Tenant from JWT (for authenticated requests)
 * 2. Tenant from X-Tenant-ID header (for public/registration endpoints)
 */
export function extractTenant(req: Request, res: Response, next: NextFunction): void {
  // If already authenticated, tenant is in JWT
  if (req.auth?.tenantId) {
    req.tenantId = req.auth.tenantId
    next()
    return
  }

  // Otherwise, check X-Tenant-ID header
  const tenantHeader = req.headers['x-tenant-id'] as string

  if (!tenantHeader) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Missing tenant identifier'
    })
    return
  }

  req.tenantId = tenantHeader
  next()
}

/**
 * Optional authentication middleware
 *
 * Attempts to authenticate, but doesn't fail if no token present
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token present, continue without auth
      next()
      return
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)

    req.auth = payload
    req.tenantId = payload.tenantId
    req.userId = payload.userId

    next()
  } catch (error) {
    // Token present but invalid, continue without auth
    next()
  }
}
