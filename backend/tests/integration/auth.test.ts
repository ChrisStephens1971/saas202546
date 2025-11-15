import request from 'supertest'
import app from '../../src/app'
import { db } from '../../src/config/database'

describe('Auth Endpoints', () => {
  // Clean up database before and after tests
  beforeAll(async () => {
    // Run migrations
    await db.migrate.latest()
  })

  afterAll(async () => {
    // Clean up and close database connection
    await db('refresh_tokens').delete()
    await db('users').delete()
    await db('tenants').delete()
    await db.destroy()
  })

  beforeEach(async () => {
    // Clean tables before each test
    await db('refresh_tokens').delete()
    await db('users').delete()
    await db('tenants').delete()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new tenant and user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          businessName: 'Test Mechanic Shop',
          slug: 'test-mechanic',
          contactEmail: 'owner@testmechanic.com',
          fullName: 'John Doe',
          email: 'john@testmechanic.com',
          password: 'StrongPass123!',
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('message', 'Registration successful')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('email', 'john@testmechanic.com')
      expect(response.body.user).toHaveProperty('role', 'owner')
      expect(response.body).toHaveProperty('tokens')
      expect(response.body.tokens).toHaveProperty('accessToken')
      expect(response.body.tokens).toHaveProperty('refreshToken')
    })

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          businessName: 'Test Mechanic Shop',
          slug: 'test-mechanic-2',
          contactEmail: 'owner@testmechanic2.com',
          fullName: 'John Doe',
          email: 'john@testmechanic2.com',
          password: 'weak',
        })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    it('should reject registration with duplicate slug', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          businessName: 'Test Mechanic Shop',
          slug: 'duplicate-slug',
          contactEmail: 'owner1@test.com',
          fullName: 'User One',
          email: 'user1@test.com',
          password: 'StrongPass123!',
        })

      // Second registration with same slug
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          businessName: 'Another Shop',
          slug: 'duplicate-slug',
          contactEmail: 'owner2@test.com',
          fullName: 'User Two',
          email: 'user2@test.com',
          password: 'StrongPass123!',
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('slug already taken')
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a test user
      await request(app)
        .post('/api/auth/register')
        .send({
          businessName: 'Test Shop',
          slug: 'test-login-shop',
          contactEmail: 'owner@testshop.com',
          fullName: 'Test User',
          email: 'test@testshop.com',
          password: 'StrongPass123!',
        })
    })

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@testshop.com',
          password: 'StrongPass123!',
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('message', 'Login successful')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('email', 'test@testshop.com')
      expect(response.body).toHaveProperty('tokens')
    })

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@testshop.com',
          password: 'WrongPassword123!',
        })

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'StrongPass123!',
        })

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/auth/me', () => {
    let accessToken: string

    beforeEach(async () => {
      // Register and login
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          businessName: 'Test Shop',
          slug: 'test-me-shop',
          contactEmail: 'owner@testmeshop.com',
          fullName: 'Test User',
          email: 'test@testmeshop.com',
          password: 'StrongPass123!',
        })

      accessToken = response.body.tokens.accessToken
    })

    it('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('email', 'test@testmeshop.com')
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')

      expect(response.status).toBe(401)
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
    })
  })
})
