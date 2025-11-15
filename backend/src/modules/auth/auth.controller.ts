import { Request, Response } from 'express'
import { register, login, refreshAccessToken, logout } from './auth.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const registerSchema = z.object({
  businessName: z.string().min(2).max(255),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  fullName: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8)
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantId: z.string().uuid().optional()
})

const refreshTokenSchema = z.object({
  refreshToken: z.string()
})

/**
 * POST /api/auth/register
 *
 * Register a new tenant and owner user
 */
export async function registerController(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const validatedInput = registerSchema.parse(req.body)

    // Register tenant and user
    const result = await register(validatedInput)

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        tenant: {
          id: result.user.tenantId,
          slug: result.user.tenantSlug,
          name: result.user.tenantName
        }
      },
      tokens: result.tokens
    })
  } catch (error: any) {
    logger.error('Registration failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      })
      return
    }

    res.status(400).json({
      error: 'Registration Failed',
      message: error.message
    })
  }
}

/**
 * POST /api/auth/login
 *
 * Login with email and password
 */
export async function loginController(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const validatedInput = loginSchema.parse(req.body)

    // Login
    const result = await login(validatedInput)

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        tenant: {
          id: result.user.tenantId,
          slug: result.user.tenantSlug,
          name: result.user.tenantName
        }
      },
      tokens: result.tokens
    })
  } catch (error: any) {
    logger.error('Login failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      })
      return
    }

    res.status(401).json({
      error: 'Login Failed',
      message: error.message
    })
  }
}

/**
 * POST /api/auth/refresh
 *
 * Refresh access token using refresh token
 */
export async function refreshTokenController(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const { refreshToken } = refreshTokenSchema.parse(req.body)

    // Refresh access token
    const tokens = await refreshAccessToken(refreshToken)

    res.status(200).json({
      message: 'Token refreshed',
      tokens
    })
  } catch (error: any) {
    logger.error('Token refresh failed', { error: error.message })

    res.status(401).json({
      error: 'Refresh Failed',
      message: error.message
    })
  }
}

/**
 * POST /api/auth/logout
 *
 * Logout (revoke refresh token)
 */
export async function logoutController(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const { refreshToken } = refreshTokenSchema.parse(req.body)

    // Logout
    await logout(refreshToken)

    res.status(200).json({
      message: 'Logout successful'
    })
  } catch (error: any) {
    logger.error('Logout failed', { error: error.message })

    // Return 200 even on error (logout is idempotent)
    res.status(200).json({
      message: 'Logout successful'
    })
  }
}

/**
 * GET /api/auth/me
 *
 * Get current user info
 */
export async function getMeController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.auth || !req.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      })
      return
    }

    // Get user data from database
    const user = await require('@config/database')
      .db('users')
      .select('users.*', 'tenants.slug as tenant_slug', 'tenants.business_name as tenant_name')
      .join('tenants', 'users.tenant_id', 'tenants.id')
      .where('users.id', req.userId)
      .first()

    if (!user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      })
      return
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        tenant: {
          id: user.tenant_id,
          slug: user.tenant_slug,
          name: user.tenant_name
        }
      }
    })
  } catch (error: any) {
    logger.error('Get me failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user info'
    })
  }
}
