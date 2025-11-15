import { Request, Response } from 'express'
import {
  listInventory,
  getInventoryItem,
  addInventory,
  updateInventory,
  transferInventory,
  allocateInventory,
  deallocateInventory,
  deleteInventory,
} from './inventory.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const addInventorySchema = z.object({
  partId: z.string().uuid(),
  location: z.string().min(1).max(100),
  quantityOnHand: z.number().int().min(0),
  binLocation: z.string().max(100).optional(),
  notes: z.string().optional(),
})

const updateInventorySchema = z.object({
  quantityOnHand: z.number().int().min(0).optional(),
  binLocation: z.string().max(100).optional(),
  notes: z.string().optional(),
})

const transferInventorySchema = z.object({
  fromInventoryId: z.string().uuid(),
  toLocation: z.string().min(1).max(100),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
})

const allocateInventorySchema = z.object({
  partId: z.string().uuid(),
  location: z.string().min(1).max(100),
  quantity: z.number().int().min(1),
  jobId: z.string().uuid(),
})

/**
 * GET /api/inventory
 */
export async function listInventoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    const filters = {
      partId: req.query.partId as string,
      location: req.query.location as string,
      lowStock: req.query.lowStock === 'true',
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    }

    const result = await listInventory(tenantId, filters)

    res.status(200).json(result)
  } catch (error: any) {
    logger.error('List inventory failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list inventory',
    })
  }
}

/**
 * GET /api/inventory/:id
 */
export async function getInventoryItemController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const inventoryId = req.params.id

    const inventory = await getInventoryItem(tenantId, inventoryId)

    res.status(200).json({ inventory })
  } catch (error: any) {
    logger.error('Get inventory item failed', { error: error.message })

    if (error.message === 'Inventory item not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Inventory item not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get inventory item',
    })
  }
}

/**
 * POST /api/inventory
 */
export async function addInventoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = addInventorySchema.parse(req.body)

    // Add inventory
    const inventory = await addInventory(tenantId, validatedInput)

    res.status(201).json({
      message: 'Inventory added successfully',
      inventory,
    })
  } catch (error: any) {
    logger.error('Add inventory failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Part not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Part not found',
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
      message: 'Failed to add inventory',
    })
  }
}

/**
 * PUT /api/inventory/:id
 */
export async function updateInventoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const inventoryId = req.params.id

    // Validate input
    const validatedInput = updateInventorySchema.parse(req.body)

    // Update inventory
    const inventory = await updateInventory(tenantId, inventoryId, validatedInput)

    res.status(200).json({
      message: 'Inventory updated successfully',
      inventory,
    })
  } catch (error: any) {
    logger.error('Update inventory failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Inventory item not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Inventory item not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update inventory',
    })
  }
}

/**
 * POST /api/inventory/transfer
 */
export async function transferInventoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = transferInventorySchema.parse(req.body)

    // Transfer inventory
    await transferInventory(tenantId, validatedInput)

    res.status(200).json({
      message: 'Inventory transferred successfully',
    })
  } catch (error: any) {
    logger.error('Transfer inventory failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      })
      return
    }

    if (error.message.includes('Insufficient')) {
      res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to transfer inventory',
    })
  }
}

/**
 * POST /api/inventory/allocate
 */
export async function allocateInventoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = allocateInventorySchema.parse(req.body)

    // Allocate inventory
    const jobPart = await allocateInventory(tenantId, validatedInput)

    res.status(201).json({
      message: 'Inventory allocated to job successfully',
      jobPart,
    })
  } catch (error: any) {
    logger.error('Allocate inventory failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      })
      return
    }

    if (error.message.includes('Insufficient')) {
      res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to allocate inventory',
    })
  }
}

/**
 * DELETE /api/inventory/allocate/:jobPartId
 */
export async function deallocateInventoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const jobPartId = req.params.jobPartId

    await deallocateInventory(tenantId, jobPartId)

    res.status(200).json({
      message: 'Inventory deallocated successfully',
    })
  } catch (error: any) {
    logger.error('Deallocate inventory failed', { error: error.message })

    if (error.message === 'Job part not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job part not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to deallocate inventory',
    })
  }
}

/**
 * DELETE /api/inventory/:id
 */
export async function deleteInventoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const inventoryId = req.params.id

    await deleteInventory(tenantId, inventoryId)

    res.status(200).json({
      message: 'Inventory deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete inventory failed', { error: error.message })

    if (error.message === 'Inventory item not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Inventory item not found',
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
      message: 'Failed to delete inventory',
    })
  }
}
