import { Router } from 'express'
import {
  listPartsController,
  getPartController,
  createPartController,
  updatePartController,
  deletePartController,
} from './parts.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/parts
 * List parts with optional filters
 */
router.get('/', listPartsController)

/**
 * POST /api/parts
 * Create a new part
 */
router.post('/', createPartController)

/**
 * GET /api/parts/:id
 * Get a single part by ID
 */
router.get('/:id', getPartController)

/**
 * PUT /api/parts/:id
 * Update a part
 */
router.put('/:id', updatePartController)

/**
 * DELETE /api/parts/:id
 * Delete a part (soft delete)
 */
router.delete('/:id', deletePartController)

export default router
