import { Router } from 'express'
import {
  listVehiclesController,
  getVehicleController,
  createVehicleController,
  updateVehicleController,
  deleteVehicleController,
} from './vehicles.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/vehicles
 * List vehicles with optional filters
 */
router.get('/', listVehiclesController)

/**
 * POST /api/vehicles
 * Create a new vehicle
 */
router.post('/', createVehicleController)

/**
 * GET /api/vehicles/:id
 * Get a single vehicle by ID
 */
router.get('/:id', getVehicleController)

/**
 * PUT /api/vehicles/:id
 * Update a vehicle
 */
router.put('/:id', updateVehicleController)

/**
 * DELETE /api/vehicles/:id
 * Delete a vehicle (soft delete)
 */
router.delete('/:id', deleteVehicleController)

export default router
