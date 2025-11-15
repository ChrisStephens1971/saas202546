import { Request, Response } from 'express'
import {
  listParts,
  getPart,
  createPart,
  updatePart,
  deletePart,
} from './parts.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const createPartSchema = z.object({
  partNumber: z.string().max(100).optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  manufacturer: z.string().max(255).optional(),
  manufacturerPartNumber: z.string().max(100).optional(),
  defaultCost: z.number().min(0).optional(),
  defaultPrice: z.number().min(0).optional(),
  minimumStock: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  specifications: z.any().optional(),
})

const updatePartSchema = z.object({
  partNumber: z.string().max(100).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  manufacturer: z.string().max(255).optional(),
  manufacturerPartNumber: z.string().max(100).optional(),
  defaultCost: z.number().min(0).optional(),
  defaultPrice: z.number().min(0).optional(),
  minimumStock: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  specifications: z.any().optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/parts
 */
export async function listPartsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    const filters = {
      category: req.query.category as string,
      manufacturer: req.query.manufacturer as string,
      search: req.query.search as string,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    }

    const result = await listParts(tenantId, filters)

    res.status(200).json(result)
  } catch (error: any) {
    logger.error('List parts failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list parts',
    })
  }
}

/**
 * GET /api/parts/:id
 */
export async function getPartController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const partId = req.params.id

    const part = await getPart(tenantId, partId)

    res.status(200).json({ part })
  } catch (error: any) {
    logger.error('Get part failed', { error: error.message })

    if (error.message === 'Part not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Part not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get part',
    })
  }
}

/**
 * POST /api/parts
 */
export async function createPartController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = createPartSchema.parse(req.body)

    // Create part
    const part = await createPart(tenantId, validatedInput)

    res.status(201).json({
      message: 'Part created successfully',
      part,
    })
  } catch (error: any) {
    logger.error('Create part failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
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
      message: 'Failed to create part',
    })
  }
}

/**
 * PUT /api/parts/:id
 */
export async function updatePartController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const partId = req.params.id

    // Validate input
    const validatedInput = updatePartSchema.parse(req.body)

    // Update part
    const part = await updatePart(tenantId, partId, validatedInput)

    res.status(200).json({
      message: 'Part updated successfully',
      part,
    })
  } catch (error: any) {
    logger.error('Update part failed', { error: error.message })

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
      message: 'Failed to update part',
    })
  }
}

/**
 * DELETE /api/parts/:id
 */
export async function deletePartController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const partId = req.params.id

    await deletePart(tenantId, partId)

    res.status(200).json({
      message: 'Part deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete part failed', { error: error.message })

    if (error.message === 'Part not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Part not found',
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
      message: 'Failed to delete part',
    })
  }
}
