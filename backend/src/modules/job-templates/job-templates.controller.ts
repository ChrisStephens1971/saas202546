import { Request, Response } from 'express'
import {
  listJobTemplates,
  getJobTemplate,
  getJobTemplateBySlug,
  createJobTemplate,
  updateJobTemplate,
  deleteJobTemplate,
  spawnJobFromTemplate,
  getTemplateUsageStats,
} from './job-templates.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const jobTemplateStepSchema = z.object({
  order: z.number().int().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
})

const requiredPartSchema = z.object({
  partNumber: z.string().max(100).optional(),
  name: z.string().min(1).max(255),
  quantity: z.number().int().min(1),
  estimatedCost: z.number().min(0).optional(),
})

const checklistItemSchema = z.object({
  category: z.string().min(1).max(100),
  item: z.string().min(1).max(255),
  required: z.boolean(),
})

const createJobTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  defaultLaborMinutes: z.number().min(0).optional(),
  defaultLaborRate: z.number().min(0).optional(),
  defaultPartsMarkupPercent: z.number().min(0).max(100).optional(),
  steps: z.array(jobTemplateStepSchema).optional(),
  requiredParts: z.array(requiredPartSchema).optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
  isActive: z.boolean().optional(),
  isGlobal: z.boolean().optional(),
})

const updateJobTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  defaultLaborMinutes: z.number().min(0).optional(),
  defaultLaborRate: z.number().min(0).optional(),
  defaultPartsMarkupPercent: z.number().min(0).max(100).optional(),
  steps: z.array(jobTemplateStepSchema).optional(),
  requiredParts: z.array(requiredPartSchema).optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
  isActive: z.boolean().optional(),
})

const spawnJobSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  assignedMechanicId: z.string().uuid().optional(),
})

/**
 * GET /api/job-templates
 */
export async function listJobTemplatesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    const filters = {
      category: req.query.category as string,
      search: req.query.search as string,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      isGlobal: req.query.isGlobal === 'true' ? true : req.query.isGlobal === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    }

    const result = await listJobTemplates(tenantId, filters)

    res.status(200).json(result)
  } catch (error: any) {
    logger.error('List job templates failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list job templates',
    })
  }
}

/**
 * GET /api/job-templates/:id
 */
export async function getJobTemplateController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const templateId = req.params.id

    const template = await getJobTemplate(tenantId, templateId)

    res.status(200).json({ template })
  } catch (error: any) {
    logger.error('Get job template failed', { error: error.message })

    if (error.message === 'Job template not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job template not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get job template',
    })
  }
}

/**
 * GET /api/job-templates/slug/:slug
 */
export async function getJobTemplateBySlugController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const slug = req.params.slug

    const template = await getJobTemplateBySlug(tenantId, slug)

    res.status(200).json({ template })
  } catch (error: any) {
    logger.error('Get job template by slug failed', { error: error.message })

    if (error.message === 'Job template not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job template not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get job template',
    })
  }
}

/**
 * POST /api/job-templates
 */
export async function createJobTemplateController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = createJobTemplateSchema.parse(req.body)

    // Create template
    const template = await createJobTemplate(tenantId, validatedInput)

    res.status(201).json({
      message: 'Job template created successfully',
      template,
    })
  } catch (error: any) {
    logger.error('Create job template failed', { error: error.message })

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
      message: 'Failed to create job template',
    })
  }
}

/**
 * PUT /api/job-templates/:id
 */
export async function updateJobTemplateController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const templateId = req.params.id

    // Validate input
    const validatedInput = updateJobTemplateSchema.parse(req.body)

    // Update template
    const template = await updateJobTemplate(tenantId, templateId, validatedInput)

    res.status(200).json({
      message: 'Job template updated successfully',
      template,
    })
  } catch (error: any) {
    logger.error('Update job template failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (error.message === 'Job template not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job template not found',
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
      message: 'Failed to update job template',
    })
  }
}

/**
 * DELETE /api/job-templates/:id
 */
export async function deleteJobTemplateController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const templateId = req.params.id

    await deleteJobTemplate(tenantId, templateId)

    res.status(200).json({
      message: 'Job template deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete job template failed', { error: error.message })

    if (error.message === 'Job template not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job template not found',
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
      message: 'Failed to delete job template',
    })
  }
}

/**
 * POST /api/job-templates/:id/spawn
 */
export async function spawnJobController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const templateId = req.params.id

    // Validate input
    const { customerId, vehicleId, assignedMechanicId } = spawnJobSchema.parse(req.body)

    // Spawn job from template
    const job = await spawnJobFromTemplate(
      tenantId,
      templateId,
      customerId,
      vehicleId,
      assignedMechanicId
    )

    res.status(201).json({
      message: 'Job created from template successfully',
      job,
    })
  } catch (error: any) {
    logger.error('Spawn job from template failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (
      error.message === 'Job template not found' ||
      error.message === 'Customer not found' ||
      error.message.includes('Vehicle not found')
    ) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      })
      return
    }

    if (error.message.includes('inactive template')) {
      res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create job from template',
    })
  }
}

/**
 * GET /api/job-templates/:id/stats
 */
export async function getTemplateStatsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const templateId = req.params.id

    const stats = await getTemplateUsageStats(tenantId, templateId)

    res.status(200).json(stats)
  } catch (error: any) {
    logger.error('Get template stats failed', { error: error.message })

    if (error.message === 'Job template not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Job template not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get template statistics',
    })
  }
}
