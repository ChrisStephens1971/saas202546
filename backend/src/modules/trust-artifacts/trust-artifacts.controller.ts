import { Request, Response } from 'express'
import {
  listTrustArtifacts,
  getTrustArtifact,
  createTrustArtifact,
  updateTrustArtifact,
  deleteTrustArtifact,
  getJobTrustSummary,
  getVehicleTrustHistory,
} from './trust-artifacts.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const createTrustArtifactSchema = z.object({
  jobId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  artifactType: z.enum([
    'before_photo',
    'after_photo',
    'inspection_video',
    'diagnostic_report',
    'customer_approval',
    'receipt',
    'other',
  ]),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  metadata: z.any().optional(),
})

const updateTrustArtifactSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  metadata: z.any().optional(),
})

/**
 * GET /api/trust-artifacts
 */
export async function listTrustArtifactsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    const filters = {
      jobId: req.query.jobId as string,
      vehicleId: req.query.vehicleId as string,
      artifactType: req.query.artifactType as string,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    }

    const result = await listTrustArtifacts(tenantId, filters)

    res.status(200).json(result)
  } catch (error: any) {
    logger.error('List trust artifacts failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list trust artifacts',
    })
  }
}

/**
 * GET /api/trust-artifacts/:id
 */
export async function getTrustArtifactController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const artifactId = req.params.id

    const artifact = await getTrustArtifact(tenantId, artifactId)

    res.status(200).json({ artifact })
  } catch (error: any) {
    logger.error('Get trust artifact failed', { error: error.message })

    if (error.message === 'Trust artifact not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Trust artifact not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get trust artifact',
    })
  }
}

/**
 * POST /api/trust-artifacts
 * Upload a file and create trust artifact
 */
export async function createTrustArtifactController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'No file uploaded',
      })
      return
    }

    // Validate input (from form fields)
    const validatedInput = createTrustArtifactSchema.parse({
      jobId: req.body.jobId,
      vehicleId: req.body.vehicleId,
      artifactType: req.body.artifactType,
      title: req.body.title,
      description: req.body.description,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
    })

    // Create artifact with file upload
    const artifact = await createTrustArtifact(tenantId, {
      ...validatedInput,
      fileBuffer: req.file.buffer,
      originalFilename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    res.status(201).json({
      message: 'Trust artifact created successfully',
      artifact,
    })
  } catch (error: any) {
    logger.error('Create trust artifact failed', { error: error.message })

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

    if (
      error.message.includes('Invalid file type') ||
      error.message.includes('File size exceeds')
    ) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      })
      return
    }

    if (error.message.includes('must be provided')) {
      res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create trust artifact',
    })
  }
}

/**
 * PUT /api/trust-artifacts/:id
 */
export async function updateTrustArtifactController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const artifactId = req.params.id

    // Validate input
    const validatedInput = updateTrustArtifactSchema.parse(req.body)

    // Update artifact
    const artifact = await updateTrustArtifact(tenantId, artifactId, validatedInput)

    res.status(200).json({
      message: 'Trust artifact updated successfully',
      artifact,
    })
  } catch (error: any) {
    logger.error('Update trust artifact failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Trust artifact not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Trust artifact not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update trust artifact',
    })
  }
}

/**
 * DELETE /api/trust-artifacts/:id
 */
export async function deleteTrustArtifactController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const artifactId = req.params.id

    await deleteTrustArtifact(tenantId, artifactId)

    res.status(200).json({
      message: 'Trust artifact deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete trust artifact failed', { error: error.message })

    if (error.message === 'Trust artifact not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Trust artifact not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete trust artifact',
    })
  }
}

/**
 * GET /api/trust-artifacts/job/:jobId/summary
 */
export async function getJobTrustSummaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const jobId = req.params.jobId

    const summary = await getJobTrustSummary(tenantId, jobId)

    res.status(200).json(summary)
  } catch (error: any) {
    logger.error('Get job trust summary failed', { error: error.message })

    if (error.message === 'Job not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get job trust summary',
    })
  }
}

/**
 * GET /api/trust-artifacts/vehicle/:vehicleId/history
 */
export async function getVehicleTrustHistoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const vehicleId = req.params.vehicleId

    const history = await getVehicleTrustHistory(tenantId, vehicleId)

    res.status(200).json(history)
  } catch (error: any) {
    logger.error('Get vehicle trust history failed', { error: error.message })

    if (error.message === 'Vehicle not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Vehicle not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get vehicle trust history',
    })
  }
}
