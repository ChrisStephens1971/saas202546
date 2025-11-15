import { db } from '@config/database'
import { hashPassword, comparePassword, validatePasswordStrength } from '@lib/password'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@lib/jwt'
import logger from '@config/logger'
import { provisionTenant } from '../../database/provision-tenant'

interface RegisterInput {
  // Tenant info
  businessName: string
  slug: string
  contactEmail: string
  contactPhone?: string

  // Owner user info
  fullName: string
  email: string
  password: string
}

interface LoginInput {
  email: string
  password: string
  tenantId?: string // Optional if email is unique globally
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: string
}

interface UserWithTenant {
  id: string
  tenantId: string
  email: string
  fullName: string
  role: string
  tenantSlug: string
  tenantName: string
}

/**
 * Register a new tenant and owner user
 */
export async function register(input: RegisterInput): Promise<{ user: UserWithTenant; tokens: AuthTokens }> {
  const { businessName, slug, contactEmail, contactPhone, fullName, email, password } = input

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password)
  if (!passwordValidation.valid) {
    throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`)
  }

  // Check if tenant slug already exists
  const existingTenant = await db('tenants').where({ slug }).first()
  if (existingTenant) {
    throw new Error('Business slug already taken')
  }

  // Check if email already exists for this tenant (though tenant doesn't exist yet, check globally)
  const existingUser = await db('users').where({ email }).first()
  if (existingUser) {
    throw new Error('Email already registered')
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Create tenant and user in a transaction
  const result = await db.transaction(async (trx) => {
    // Create tenant
    const [tenant] = await trx('tenants')
      .insert({
        slug,
        business_name: businessName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        plan: 'free',
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        timezone: 'America/New_York',
        currency: 'USD'
      })
      .returning('*')

    // Create owner user
    const [user] = await trx('users')
      .insert({
        tenant_id: tenant.id,
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'owner',
        is_active: true,
        email_verified: false
      })
      .returning('*')

    return { tenant, user }
  })

  const { tenant, user } = result

  // Provision tenant schema (run migrations for this tenant)
  try {
    await provisionTenant(tenant.id, false) // Don't seed demo data by default
    logger.info(`Tenant schema provisioned for ${tenant.slug}`)
  } catch (error) {
    logger.error(`Failed to provision tenant schema for ${tenant.id}`, error)
    // Rollback tenant and user creation
    await db('users').where({ id: user.id }).delete()
    await db('tenants').where({ id: tenant.id }).delete()
    throw new Error('Failed to provision tenant workspace')
  }

  // Generate tokens
  const tokens = await generateTokensForUser(user.id, tenant.id, email, user.role)

  const userWithTenant: UserWithTenant = {
    id: user.id,
    tenantId: tenant.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    tenantSlug: tenant.slug,
    tenantName: tenant.business_name
  }

  logger.info(`New tenant registered: ${tenant.slug}`, { tenantId: tenant.id, userId: user.id })

  return { user: userWithTenant, tokens }
}

/**
 * Login with email and password
 */
export async function login(input: LoginInput): Promise<{ user: UserWithTenant; tokens: AuthTokens }> {
  const { email, password, tenantId } = input

  // Find user by email (and optionally tenantId)
  let query = db('users')
    .select('users.*', 'tenants.slug as tenant_slug', 'tenants.business_name as tenant_name', 'tenants.status as tenant_status')
    .join('tenants', 'users.tenant_id', 'tenants.id')
    .where('users.email', email)
    .where('users.deleted_at', null)

  if (tenantId) {
    query = query.where('users.tenant_id', tenantId)
  }

  const user = await query.first()

  if (!user) {
    throw new Error('Invalid email or password')
  }

  // Check if tenant is active
  if (user.tenant_status !== 'active' && user.tenant_status !== 'trial') {
    throw new Error('Account is suspended or cancelled')
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash)

  if (!isPasswordValid) {
    throw new Error('Invalid email or password')
  }

  // Check if user is active
  if (!user.is_active) {
    throw new Error('User account is disabled')
  }

  // Update last login
  await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() })

  // Generate tokens
  const tokens = await generateTokensForUser(user.id, user.tenant_id, user.email, user.role)

  const userWithTenant: UserWithTenant = {
    id: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    tenantSlug: user.tenant_slug,
    tenantName: user.tenant_name
  }

  logger.info(`User logged in: ${user.email}`, { userId: user.id, tenantId: user.tenant_id })

  return { user: userWithTenant, tokens }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken)

  // Check if refresh token exists and is not revoked
  const tokenRecord = await db('refresh_tokens')
    .where({ id: payload.tokenId, revoked: false })
    .where('expires_at', '>', db.fn.now())
    .first()

  if (!tokenRecord) {
    throw new Error('Invalid or expired refresh token')
  }

  // Get user data
  const user = await db('users')
    .select('id', 'tenant_id', 'email', 'role', 'is_active')
    .where({ id: payload.userId })
    .first()

  if (!user || !user.is_active) {
    throw new Error('User not found or inactive')
  }

  // Generate new access token (keep same refresh token)
  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role
  })

  return {
    accessToken,
    refreshToken, // Return same refresh token
    expiresIn: '15m'
  }
}

/**
 * Logout (revoke refresh token)
 */
export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken)

    await db('refresh_tokens')
      .where({ id: payload.tokenId })
      .update({ revoked: true })

    logger.info(`User logged out`, { userId: payload.userId })
  } catch (error) {
    // Silently fail if token is invalid (already expired/revoked)
    logger.warn('Logout with invalid token attempted')
  }
}

/**
 * Helper: Generate access and refresh tokens for a user
 */
async function generateTokensForUser(
  userId: string,
  tenantId: string,
  email: string,
  role: string
): Promise<AuthTokens> {
  // Generate access token
  const accessToken = generateAccessToken({
    userId,
    tenantId,
    email,
    role
  })

  // Create refresh token record
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [refreshTokenRecord] = await db('refresh_tokens')
    .insert({
      user_id: userId,
      token: generateRefreshToken({ userId, tokenId: '' }), // Temporary token
      expires_at: expiresAt,
      revoked: false
    })
    .returning('*')

  // Regenerate refresh token with the actual tokenId
  const refreshToken = generateRefreshToken({
    userId,
    tokenId: refreshTokenRecord.id
  })

  // Update the token in the database
  await db('refresh_tokens').where({ id: refreshTokenRecord.id }).update({ token: refreshToken })

  return {
    accessToken,
    refreshToken,
    expiresIn: '15m'
  }
}
