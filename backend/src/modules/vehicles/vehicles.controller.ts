import { Request, Response } from 'express'
import {
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from './vehicles.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const createVehicleSchema = z.object({
  customerId: z.string().uuid(),
  vin: z.string().length(17).optional(),
  year: z.string().length(4),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  trim: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  licensePlate: z.string().max(50).optional(),
  licensePlateState: z.string().length(2).optional(),
  odometer: z.number().int().min(0).optional(),
  engine: z.string().max(100).optional(),
  transmission: z.string().max(100).optional(),
  notes: z.string().optional(),
})

const updateVehicleSchema = z.object({
  vin: z.string().length(17).optional(),
  year: z.string().length(4).optional(),
  make: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  trim: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  licensePlate: z.string().max(50).optional(),
  licensePlateState: z.string().length(2).optional(),
  odometer: z.number().int().min(0).optional(),
  engine: z.string().max(100).optional(),
  transmission: z.string().max(100).optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/vehicles
 */
export async function listVehiclesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    const filters = {
      customerId: req.query.customerId as string,
      search: req.query.search as string,
      make: req.query.make as string,
      model: req.query.model as string,
      year: req.query.year as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    }

    const result = await listVehicles(tenantId, filters)

    res.status(200).json(result)
  } catch (error: any) {
    logger.error('List vehicles failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list vehicles',
    })
  }
}

/**
 * GET /api/vehicles/:id
 */
export async function getVehicleController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const vehicleId = req.params.id

    const vehicle = await getVehicle(tenantId, vehicleId)

    res.status(200).json({ vehicle })
  } catch (error: any) {
    logger.error('Get vehicle failed', { error: error.message })

    if (error.message === 'Vehicle not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Vehicle not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get vehicle',
    })
  }
}

/**
 * POST /api/vehicles
 */
export async function createVehicleController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = createVehicleSchema.parse(req.body)

    // Create vehicle
    const vehicle = await createVehicle(tenantId, validatedInput)

    res.status(201).json({
      message: 'Vehicle created successfully',
      vehicle,
    })
  } catch (error: any) {
    logger.error('Create vehicle failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Customer not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found',
      })
      return
    }

    if (error.message.includes('already exists')) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create vehicle',
    })
  }
}

/**
 * PUT /api/vehicles/:id
 */
export async function updateVehicleController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const vehicleId = req.params.id

    // Validate input
    const validatedInput = updateVehicleSchema.parse(req.body)

    // Update vehicle
    const vehicle = await updateVehicle(tenantId, vehicleId, validatedInput)

    res.status(200).json({
      message: 'Vehicle updated successfully',
      vehicle,
    })
  } catch (error: any) {
    logger.error('Update vehicle failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Vehicle not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Vehicle not found',
      })
      return
    }

    if (error.message.includes('already exists')) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update vehicle',
    })
  }
}

/**
 * DELETE /api/vehicles/:id
 */
export async function deleteVehicleController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const vehicleId = req.params.id

    await deleteVehicle(tenantId, vehicleId)

    res.status(200).json({
      message: 'Vehicle deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete vehicle failed', { error: error.message })

    if (error.message === 'Vehicle not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Vehicle not found',
      })
      return
    }

    if (error.message.includes('Cannot delete')) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete vehicle',
    })
  }
}
