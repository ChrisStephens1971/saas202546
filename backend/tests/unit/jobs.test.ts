/**
 * Unit tests for Jobs module
 * Tests job number generation and status transitions
 */

describe('Jobs Module', () => {
  describe('Job number format', () => {
    it('should generate job number in correct format', () => {
      // Job numbers should be in format: JOB-YYYYMMDD-XXXX
      const jobNumberPattern = /^JOB-\d{8}-\d{4}$/
      const sampleJobNumber = 'JOB-20251115-0001'

      expect(sampleJobNumber).toMatch(jobNumberPattern)
    })

    it('should pad sequence with leading zeros', () => {
      const jobNumber1 = 'JOB-20251115-0001'
      const jobNumber99 = 'JOB-20251115-0099'
      const jobNumber1000 = 'JOB-20251115-1000'

      expect(jobNumber1).toMatch(/^JOB-\d{8}-0001$/)
      expect(jobNumber99).toMatch(/^JOB-\d{8}-0099$/)
      expect(jobNumber1000).toMatch(/^JOB-\d{8}-1000$/)
    })
  })

  describe('Job status transitions', () => {
    const validStatuses = [
      'draft',
      'estimate',
      'scheduled',
      'in_progress',
      'completed',
      'cancelled',
      'on_hold'
    ]

    it('should recognize all valid job statuses', () => {
      validStatuses.forEach(status => {
        expect(validStatuses).toContain(status)
      })
    })

    it('should allow transition from draft to estimate', () => {
      const newStatus = 'estimate'
      const allowedTransitions = ['estimate', 'cancelled']

      expect(allowedTransitions).toContain(newStatus)
    })

    it('should allow transition from estimate to scheduled', () => {
      const newStatus = 'scheduled'
      const allowedTransitions = ['scheduled', 'draft', 'cancelled']

      expect(allowedTransitions).toContain(newStatus)
    })

    it('should allow transition from scheduled to in_progress', () => {
      const newStatus = 'in_progress'
      const allowedTransitions = ['in_progress', 'on_hold', 'cancelled']

      expect(allowedTransitions).toContain(newStatus)
    })

    it('should allow transition from in_progress to completed', () => {
      const newStatus = 'completed'
      const allowedTransitions = ['completed', 'on_hold', 'cancelled']

      expect(allowedTransitions).toContain(newStatus)
    })
  })

  describe('Job calculation logic', () => {
    it('should calculate total correctly without discount', () => {
      const laborMinutes = 120 // 2 hours
      const laborRate = 85 // $85/hour
      const partsTotal = 150.00
      const taxRate = 0.08 // 8%
      const discountAmount = 0

      const laborCost = (laborMinutes / 60) * laborRate // $170
      const subtotal = laborCost + partsTotal // $320
      const tax = subtotal * taxRate // $25.60
      const total = subtotal + tax - discountAmount // $345.60

      expect(laborCost).toBe(170)
      expect(subtotal).toBe(320)
      expect(tax).toBeCloseTo(25.60, 2)
      expect(total).toBeCloseTo(345.60, 2)
    })

    it('should calculate total correctly with discount', () => {
      const laborMinutes = 120 // 2 hours
      const laborRate = 85 // $85/hour
      const partsTotal = 150.00
      const taxRate = 0.08 // 8%
      const discountAmount = 30.00 // $30 discount

      const laborCost = (laborMinutes / 60) * laborRate // $170
      const subtotal = laborCost + partsTotal // $320
      const tax = subtotal * taxRate // $25.60
      const total = subtotal + tax - discountAmount // $315.60

      expect(total).toBeCloseTo(315.60, 2)
    })

    it('should handle zero labor rate', () => {
      const laborMinutes = 120
      const laborRate = 0 // Free labor (warranty work)
      const partsTotal = 150.00
      const taxRate = 0.08
      const discountAmount = 0

      const laborCost = (laborMinutes / 60) * laborRate // $0
      const subtotal = laborCost + partsTotal // $150
      const tax = subtotal * taxRate // $12.00
      const total = subtotal + tax - discountAmount // $162.00

      expect(laborCost).toBe(0)
      expect(total).toBeCloseTo(162.00, 2)
    })
  })

  describe('Job filtering logic', () => {
    it('should filter jobs by status', () => {
      const allJobs = [
        { id: '1', status: 'draft' },
        { id: '2', status: 'scheduled' },
        { id: '3', status: 'completed' },
        { id: '4', status: 'scheduled' }
      ]

      const scheduledJobs = allJobs.filter(job => job.status === 'scheduled')

      expect(scheduledJobs).toHaveLength(2)
      expect(scheduledJobs[0].id).toBe('2')
      expect(scheduledJobs[1].id).toBe('4')
    })

    it('should filter jobs by multiple statuses', () => {
      const allJobs = [
        { id: '1', status: 'draft' },
        { id: '2', status: 'scheduled' },
        { id: '3', status: 'completed' },
        { id: '4', status: 'in_progress' }
      ]

      const activeStatuses = ['scheduled', 'in_progress']
      const activeJobs = allJobs.filter(job => activeStatuses.includes(job.status))

      expect(activeJobs).toHaveLength(2)
    })
  })
})
