import jwt from 'jsonwebtoken'
import { config } from '@config'

export interface JwtPayload {
  userId: string
  tenantId: string
  email: string
  role: string
}

export interface RefreshTokenPayload {
  userId: string
  tokenId: string
}

/**
 * Generate access token (short-lived, 15 minutes)
 */
export function generateAccessToken(payload: JwtPayload): string {
  // @ts-ignore - jwt.sign type definition issue
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn
  })
}

/**
 * Generate refresh token (long-lived, 7 days)
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  // @ts-ignore - jwt.sign type definition issue
  return jwt.sign(payload, config.auth.refreshTokenSecret, {
    expiresIn: config.auth.refreshTokenExpiresIn
  })
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload
    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token')
    }
    throw error
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, config.auth.refreshTokenSecret) as RefreshTokenPayload
    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token')
    }
    throw error
  }
}

/**
 * Decode token without verification (useful for debugging)
 */
export function decodeToken(token: string): any {
  return jwt.decode(token)
}
