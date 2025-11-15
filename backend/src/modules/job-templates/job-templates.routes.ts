import { Router } from 'express'
import {
  listJobTemplatesController,
  getJobTemplateController,
  getJobTemplateBySlugController,
  createJobTemplateController,
  updateJobTemplateController,
  deleteJobTemplateController,
  spawnJobController,
  getTemplateStatsController,
} from './job-templates.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/job-templates
 * List job templates with optional filters
 */
router.get('/', listJobTemplatesController)

/**
 * POST /api/job-templates
 * Create a new job template
 */
router.post('/', createJobTemplateController)

/**
 * GET /api/job-templates/slug/:slug
 * Get a job template by slug
 */
router.get('/slug/:slug', getJobTemplateBySlugController)

/**
 * GET /api/job-templates/:id
 * Get a single job template by ID
 */
router.get('/:id', getJobTemplateController)

/**
 * PUT /api/job-templates/:id
 * Update a job template
 */
router.put('/:id', updateJobTemplateController)

/**
 * DELETE /api/job-templates/:id
 * Delete a job template (soft delete)
 */
router.delete('/:id', deleteJobTemplateController)

/**
 * POST /api/job-templates/:id/spawn
 * Create a job from a template
 */
router.post('/:id/spawn', spawnJobController)

/**
 * GET /api/job-templates/:id/stats
 * Get template usage statistics
 */
router.get('/:id/stats', getTemplateStatsController)

export default router
