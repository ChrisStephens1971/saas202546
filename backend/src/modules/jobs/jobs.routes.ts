import { Router } from 'express'
import {
  listJobsController,
  getJobController,
  createJobController,
  updateJobController,
  updateJobStatusController,
  deleteJobController,
} from './jobs.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/jobs
 * List jobs with optional filters
 */
router.get('/', listJobsController)

/**
 * POST /api/jobs
 * Create a new job
 */
router.post('/', createJobController)

/**
 * GET /api/jobs/:id
 * Get a single job by ID
 */
router.get('/:id', getJobController)

/**
 * PUT /api/jobs/:id
 * Update a job
 */
router.put('/:id', updateJobController)

/**
 * PATCH /api/jobs/:id/status
 * Update job status
 */
router.patch('/:id/status', updateJobStatusController)

/**
 * DELETE /api/jobs/:id
 * Delete a job (soft delete)
 */
router.delete('/:id', deleteJobController)

export default router
