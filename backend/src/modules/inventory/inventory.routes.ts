import { Router } from 'express'
import {
  listInventoryController,
  getInventoryItemController,
  addInventoryController,
  updateInventoryController,
  transferInventoryController,
  allocateInventoryController,
  deallocateInventoryController,
  deleteInventoryController,
} from './inventory.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/inventory
 * List inventory items with optional filters
 */
router.get('/', listInventoryController)

/**
 * POST /api/inventory
 * Add inventory to a location
 */
router.post('/', addInventoryController)

/**
 * POST /api/inventory/transfer
 * Transfer inventory between locations
 */
router.post('/transfer', transferInventoryController)

/**
 * POST /api/inventory/allocate
 * Allocate inventory to a job
 */
router.post('/allocate', allocateInventoryController)

/**
 * DELETE /api/inventory/allocate/:jobPartId
 * Deallocate inventory from a job
 */
router.delete('/allocate/:jobPartId', deallocateInventoryController)

/**
 * GET /api/inventory/:id
 * Get a single inventory item by ID
 */
router.get('/:id', getInventoryItemController)

/**
 * PUT /api/inventory/:id
 * Update inventory quantities
 */
router.put('/:id', updateInventoryController)

/**
 * DELETE /api/inventory/:id
 * Delete an inventory item (soft delete)
 */
router.delete('/:id', deleteInventoryController)

export default router
