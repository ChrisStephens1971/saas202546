import { Request, Response } from 'express'
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJob,
  JobStatus,
} from './jobs.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const jobStatusEnum = z.enum([
  'draft',
  'estimate',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'on_hold',
])

const createJobSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  jobTemplateId: z.string().uuid().optional(),
  assignedMechanicId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: jobStatusEnum.optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  estimatedDurationMinutes: z.number().int().min(0).optional(),
  serviceLocationAddress: z.string().max(500).optional(),
  serviceLocationLat: z.number().min(-90).max(90).optional(),
  serviceLocationLng: z.number().min(-180).max(180).optional(),
  laborMinutes: z.number().min(0).optional(),
  laborRate: z.number().min(0).optional(),
  partsTotal: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
})

const updateJobSchema = z.object({
  assignedMechanicId: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  estimatedDurationMinutes: z.number().int().min(0).optional(),
  serviceLocationAddress: z.string().max(500).optional(),
  serviceLocationLat: z.number().min(-90).max(90).optional(),
  serviceLocationLng: z.number().min(-180).max(180).optional(),
  laborMinutes: z.number().min(0).optional(),
  laborRate: z.number().min(0).optional(),
  partsTotal: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: jobStatusEnum,
})

/**
 * GET /api/jobs
 */
export async function listJobsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Parse status filter (can be single or multiple)
    let statusFilter: JobStatus | JobStatus[] | undefined
    if (req.query.status) {
      const statusParam = req.query.status as string
      if (statusParam.includes(',')) {
        statusFilter = statusParam.split(',') as JobStatus[]
      } else {
        statusFilter = statusParam as JobStatus
      }
    }

    const filters = {
      customerId: req.query.customerId as string,
      vehicleId: req.query.vehicleId as string,
      status: statusFilter,
      assignedMechanicId: req.query.assignedMechanicId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    }

    const result = await listJobs(tenantId, filters)

    res.status(200).json(result)
  } catch (error: any) {
    logger.error('List jobs failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list jobs',
    })
  }
}

/**
 * GET /api/jobs/:id
 */
export async function getJobController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const jobId = req.params.id

    const job = await getJob(tenantId, jobId)

    res.status(200).json({ job })
  } catch (error: any) {
    logger.error('Get job failed', { error: error.message })

    if (error.message === 'Job not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get job',
    })
  }
}

/**
 * POST /api/jobs
 */
export async function createJobController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = createJobSchema.parse(req.body)

    // Convert date strings to Date objects
    const input = {
      ...validatedInput,
      scheduledStart: validatedInput.scheduledStart
        ? new Date(validatedInput.scheduledStart)
        : undefined,
      scheduledEnd: validatedInput.scheduledEnd
        ? new Date(validatedInput.scheduledEnd)
        : undefined,
    }

    // Create job
    const job = await createJob(tenantId, input)

    res.status(201).json({
      message: 'Job created successfully',
      job,
    })
  } catch (error: any) {
    logger.error('Create job failed', { error: error.message })

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

    if (error.message.includes('Vehicle not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create job',
    })
  }
}

/**
 * PUT /api/jobs/:id
 */
export async function updateJobController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const jobId = req.params.id

    // Validate input
    const validatedInput = updateJobSchema.parse(req.body)

    // Convert date strings to Date objects
    const input = {
      ...validatedInput,
      scheduledStart: validatedInput.scheduledStart
        ? new Date(validatedInput.scheduledStart)
        : undefined,
      scheduledEnd: validatedInput.scheduledEnd
        ? new Date(validatedInput.scheduledEnd)
        : undefined,
    }

    // Update job
    const job = await updateJob(tenantId, jobId, input)

    res.status(200).json({
      message: 'Job updated successfully',
      job,
    })
  } catch (error: any) {
    logger.error('Update job failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Job not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update job',
    })
  }
}

/**
 * PATCH /api/jobs/:id/status
 */
export async function updateJobStatusController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const jobId = req.params.id

    // Validate input
    const { status } = updateStatusSchema.parse(req.body)

    // Update job status
    const job = await updateJobStatus(tenantId, jobId, status)

    res.status(200).json({
      message: 'Job status updated successfully',
      job,
    })
  } catch (error: any) {
    logger.error('Update job status failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Job not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update job status',
    })
  }
}

/**
 * DELETE /api/jobs/:id
 */
export async function deleteJobController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const jobId = req.params.id

    await deleteJob(tenantId, jobId)

    res.status(200).json({
      message: 'Job deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete job failed', { error: error.message })

    if (error.message === 'Job not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job not found',
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
      message: 'Failed to delete job',
    })
  }
}
