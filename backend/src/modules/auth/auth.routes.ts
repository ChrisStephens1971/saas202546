import { Router } from 'express'
import {
  registerController,
  loginController,
  refreshTokenController,
  logoutController,
  getMeController
} from './auth.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

/**
 * POST /api/auth/register
 * Register a new tenant and owner user
 */
router.post('/register', registerController)

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', loginController)

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', refreshTokenController)

/**
 * POST /api/auth/logout
 * Logout (revoke refresh token)
 */
router.post('/logout', logoutController)

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, getMeController)

export default router
