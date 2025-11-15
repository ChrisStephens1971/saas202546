import { getTenantDb } from '@config/database'
import logger from '@config/logger'

export interface JobTemplateStep {
  order: number
  title: string
  description?: string
  estimatedMinutes?: number
}

export interface RequiredPart {
  partNumber?: string
  name: string
  quantity: number
  estimatedCost?: number
}

export interface ChecklistItem {
  category: string
  item: string
  required: boolean
}

export interface CreateJobTemplateInput {
  name: string
  slug: string
  description?: string
  category?: string
  defaultLaborMinutes?: number
  defaultLaborRate?: number
  defaultPartsMarkupPercent?: number
  steps?: JobTemplateStep[]
  requiredParts?: RequiredPart[]
  checklistItems?: ChecklistItem[]
  isActive?: boolean
  isGlobal?: boolean
}

export interface UpdateJobTemplateInput {
  name?: string
  slug?: string
  description?: string
  category?: string
  defaultLaborMinutes?: number
  defaultLaborRate?: number
  defaultPartsMarkupPercent?: number
  steps?: JobTemplateStep[]
  requiredParts?: RequiredPart[]
  checklistItems?: ChecklistItem[]
  isActive?: boolean
}

export interface JobTemplateFilters {
  category?: string
  search?: string
  isActive?: boolean
  isGlobal?: boolean
  limit?: number
  offset?: number
}

/**
 * List job templates for a tenant
 */
export async function listJobTemplates(
  tenantId: string,
  filters: JobTemplateFilters = {}
) {
  const db = getTenantDb(tenantId)
  const { category, search, isActive, isGlobal, limit = 50, offset = 0 } = filters

  let query = db('job_templates')
    .select('*')
    .whereNull('deleted_at')
    .orderBy('name', 'asc')

  // Filter by category
  if (category) {
    query = query.where('category', category)
  }

  // Filter by active status
  if (isActive !== undefined) {
    query = query.where('is_active', isActive)
  }

  // Filter by global status
  if (isGlobal !== undefined) {
    query = query.where('is_global', isGlobal)
  }

  // Search filter
  if (search) {
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`)
        .orWhere('category', 'ilike', `%${search}%`)
    })
  }

  // Pagination
  query = query.limit(limit).offset(offset)

  const templates = await query

  // Get total count
  const countQuery = db('job_templates').whereNull('deleted_at')
  if (category) countQuery.where('category', category)
  if (isActive !== undefined) countQuery.where('is_active', isActive)
  if (isGlobal !== undefined) countQuery.where('is_global', isGlobal)
  if (search) {
    countQuery.where((builder) => {
      builder
        .where('name', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`)
        .orWhere('category', 'ilike', `%${search}%`)
    })
  }

  const [{ count }] = await countQuery.count('* as count')

  return {
    data: templates,
    pagination: {
      total: parseInt(count as string, 10),
      limit,
      offset,
      hasMore: offset + templates.length < parseInt(count as string, 10),
    },
  }
}

/**
 * Get a single job template by ID
 */
export async function getJobTemplate(tenantId: string, templateId: string) {
  const db = getTenantDb(tenantId)

  const template = await db('job_templates')
    .where({ id: templateId })
    .whereNull('deleted_at')
    .first()

  if (!template) {
    throw new Error('Job template not found')
  }

  return template
}

/**
 * Get a job template by slug
 */
export async function getJobTemplateBySlug(tenantId: string, slug: string) {
  const db = getTenantDb(tenantId)

  const template = await db('job_templates')
    .where({ slug })
    .whereNull('deleted_at')
    .first()

  if (!template) {
    throw new Error('Job template not found')
  }

  return template
}

/**
 * Create a new job template
 */
export async function createJobTemplate(
  tenantId: string,
  input: CreateJobTemplateInput
) {
  const db = getTenantDb(tenantId)

  // Check for duplicate slug
  const existingTemplate = await db('job_templates')
    .where({ slug: input.slug })
    .whereNull('deleted_at')
    .first()

  if (existingTemplate) {
    throw new Error('Job template with this slug already exists')
  }

  const [template] = await db('job_templates')
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      category: input.category || null,
      default_labor_minutes: input.defaultLaborMinutes || null,
      default_labor_rate: input.defaultLaborRate || null,
      default_parts_markup_percent: input.defaultPartsMarkupPercent || 30,
      steps: JSON.stringify(input.steps || []),
      required_parts: JSON.stringify(input.requiredParts || []),
      checklist_items: JSON.stringify(input.checklistItems || []),
      is_active: input.isActive !== undefined ? input.isActive : true,
      is_global: input.isGlobal !== undefined ? input.isGlobal : false,
    })
    .returning('*')

  logger.info('Job template created', { tenantId, templateId: template.id, slug: input.slug })

  return template
}

/**
 * Update a job template
 */
export async function updateJobTemplate(
  tenantId: string,
  templateId: string,
  input: UpdateJobTemplateInput
) {
  const db = getTenantDb(tenantId)

  // Check if template exists
  const existingTemplate = await db('job_templates')
    .where({ id: templateId })
    .whereNull('deleted_at')
    .first()

  if (!existingTemplate) {
    throw new Error('Job template not found')
  }

  // Check for duplicate slug if updating slug
  if (input.slug && input.slug !== existingTemplate.slug) {
    const duplicateSlug = await db('job_templates')
      .where({ slug: input.slug })
      .whereNot({ id: templateId })
      .whereNull('deleted_at')
      .first()

    if (duplicateSlug) {
      throw new Error('Another job template with this slug already exists')
    }
  }

  // Build update object
  const updateData: any = {}

  if (input.name !== undefined) updateData.name = input.name
  if (input.slug !== undefined) updateData.slug = input.slug
  if (input.description !== undefined) updateData.description = input.description || null
  if (input.category !== undefined) updateData.category = input.category || null
  if (input.defaultLaborMinutes !== undefined)
    updateData.default_labor_minutes = input.defaultLaborMinutes || null
  if (input.defaultLaborRate !== undefined)
    updateData.default_labor_rate = input.defaultLaborRate || null
  if (input.defaultPartsMarkupPercent !== undefined)
    updateData.default_parts_markup_percent = input.defaultPartsMarkupPercent
  if (input.steps !== undefined) updateData.steps = JSON.stringify(input.steps)
  if (input.requiredParts !== undefined)
    updateData.required_parts = JSON.stringify(input.requiredParts)
  if (input.checklistItems !== undefined)
    updateData.checklist_items = JSON.stringify(input.checklistItems)
  if (input.isActive !== undefined) updateData.is_active = input.isActive

  updateData.updated_at = db.fn.now()

  const [template] = await db('job_templates')
    .where({ id: templateId })
    .update(updateData)
    .returning('*')

  logger.info('Job template updated', { tenantId, templateId })

  return template
}

/**
 * Delete a job template (soft delete)
 */
export async function deleteJobTemplate(tenantId: string, templateId: string) {
  const db = getTenantDb(tenantId)

  // Check if template exists
  const existingTemplate = await db('job_templates')
    .where({ id: templateId })
    .whereNull('deleted_at')
    .first()

  if (!existingTemplate) {
    throw new Error('Job template not found')
  }

  // Don't allow deletion of global templates
  if (existingTemplate.is_global) {
    throw new Error('Cannot delete global templates. Deactivate instead.')
  }

  // Soft delete
  await db('job_templates')
    .where({ id: templateId })
    .update({
      deleted_at: db.fn.now(),
    })

  logger.info('Job template deleted', { tenantId, templateId })

  return { success: true }
}

/**
 * Spawn a job from a template
 */
export async function spawnJobFromTemplate(
  tenantId: string,
  templateId: string,
  customerId: string,
  vehicleId: string,
  assignedMechanicId?: string
) {
  const db = getTenantDb(tenantId)

  // Get template
  const template = await getJobTemplate(tenantId, templateId)

  if (!template.is_active) {
    throw new Error('Cannot create job from inactive template')
  }

  // Verify customer exists
  const customer = await db('customers')
    .where({ id: customerId })
    .whereNull('deleted_at')
    .first()

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Verify vehicle exists and belongs to customer
  const vehicle = await db('vehicles')
    .where({ id: vehicleId, customer_id: customerId })
    .whereNull('deleted_at')
    .first()

  if (!vehicle) {
    throw new Error('Vehicle not found or does not belong to this customer')
  }

  // Generate job number
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const [{ count }] = await db('jobs')
    .where('job_number', 'like', `JOB-${dateStr}-%`)
    .count('* as count')
  const sequence = (parseInt(count as string, 10) + 1).toString().padStart(4, '0')
  const jobNumber = `JOB-${dateStr}-${sequence}`

  // Calculate initial pricing from template
  const laborMinutes = template.default_labor_minutes || 0
  const laborRate = template.default_labor_rate || 0
  const laborTotal = (laborMinutes / 60) * laborRate

  // Create job with template data
  const [job] = await db('jobs')
    .insert({
      customer_id: customerId,
      vehicle_id: vehicleId,
      job_template_id: templateId,
      assigned_mechanic_id: assignedMechanicId || null,
      job_number: jobNumber,
      title: template.name,
      description: template.description || null,
      status: 'draft',
      labor_minutes: laborMinutes,
      labor_rate: laborRate,
      parts_total: 0,
      tax_rate: 0,
      discount_amount: 0,
      total: laborTotal,
      template_snapshot: JSON.stringify({
        name: template.name,
        steps: template.steps,
        required_parts: template.required_parts,
        checklist_items: template.checklist_items,
      }),
      completed_steps: JSON.stringify([]),
      checklist_results: JSON.stringify([]),
    })
    .returning('*')

  logger.info('Job spawned from template', {
    tenantId,
    jobId: job.id,
    templateId,
    jobNumber,
  })

  return job
}

/**
 * Get template usage statistics
 */
export async function getTemplateUsageStats(tenantId: string, templateId: string) {
  const db = getTenantDb(tenantId)

  // Check if template exists
  const template = await getJobTemplate(tenantId, templateId)

  // Get total jobs created from this template
  const [{ totalJobs }] = await db('jobs')
    .where({ job_template_id: templateId })
    .whereNull('deleted_at')
    .count('* as totalJobs')

  // Get jobs by status
  const jobsByStatus = await db('jobs')
    .select('status')
    .where({ job_template_id: templateId })
    .whereNull('deleted_at')
    .count('* as count')
    .groupBy('status')

  // Get average completion time (for completed jobs)
  const completionStats = await db('jobs')
    .select(
      db.raw(
        `AVG(EXTRACT(EPOCH FROM (actual_end - actual_start)) / 60) as avg_minutes`
      )
    )
    .where({ job_template_id: templateId, status: 'completed' })
    .whereNotNull('actual_start')
    .whereNotNull('actual_end')
    .first()

  return {
    template: {
      id: template.id,
      name: template.name,
      category: template.category,
    },
    usage: {
      totalJobs: parseInt(totalJobs as string, 10),
      jobsByStatus: jobsByStatus.reduce((acc: any, row: any) => {
        acc[row.status] = parseInt(row.count, 10)
        return acc
      }, {}),
      avgCompletionMinutes: completionStats?.avg_minutes
        ? Math.round(parseFloat(completionStats.avg_minutes))
        : null,
    },
  }
}
