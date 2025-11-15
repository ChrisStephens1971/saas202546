import { hashPassword, comparePassword, validatePasswordStrength } from '../../../src/lib/password'

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50) // Bcrypt hashes are long
    })

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2) // Bcrypt uses random salt
    })
  })

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)
      const isMatch = await comparePassword(password, hash)

      expect(isMatch).toBe(true)
    })

    it('should return false for non-matching password', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)
      const isMatch = await comparePassword('WrongPassword', hash)

      expect(isMatch).toBe(false)
    })
  })

  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const result = validatePasswordStrength('StrongPass123!')

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject a password that is too short', () => {
      const result = validatePasswordStrength('Short1!')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should reject a password without uppercase', () => {
      const result = validatePasswordStrength('lowercase123!')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject a password without lowercase', () => {
      const result = validatePasswordStrength('UPPERCASE123!')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should reject a password without number', () => {
      const result = validatePasswordStrength('NoNumbers!')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should reject a password without special character', () => {
      const result = validatePasswordStrength('NoSpecial123')

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })

    it('should return multiple errors for a weak password', () => {
      const result = validatePasswordStrength('weak')

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })
})
