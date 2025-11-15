import { getTenantDb } from '@config/database'
import logger from '@config/logger'

export type JobStatus =
  | 'draft'
  | 'estimate'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold'

export interface CreateJobInput {
  customerId: string
  vehicleId: string
  jobTemplateId?: string
  assignedMechanicId?: string
  title: string
  description?: string
  status?: JobStatus
  scheduledStart?: Date
  scheduledEnd?: Date
  estimatedDurationMinutes?: number
  serviceLocationAddress?: string
  serviceLocationLat?: number
  serviceLocationLng?: number
  laborMinutes?: number
  laborRate?: number
  partsTotal?: number
  taxRate?: number
  discountAmount?: number
  notes?: string
}

export interface UpdateJobInput {
  assignedMechanicId?: string
  title?: string
  description?: string
  scheduledStart?: Date
  scheduledEnd?: Date
  estimatedDurationMinutes?: number
  serviceLocationAddress?: string
  serviceLocationLat?: number
  serviceLocationLng?: number
  laborMinutes?: number
  laborRate?: number
  partsTotal?: number
  taxRate?: number
  discountAmount?: number
  notes?: string
}

export interface JobFilters {
  customerId?: string
  vehicleId?: string
  status?: JobStatus | JobStatus[]
  assignedMechanicId?: string
  startDate?: Date
  endDate?: Date
  search?: string
  limit?: number
  offset?: number
}

/**
 * Generate unique job number
 */
async function generateJobNumber(db: any): Promise<string> {
  // Format: JOB-YYYYMMDD-XXXX
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

  // Get count of jobs created today
  const [{ count }] = await db('jobs')
    .where('job_number', 'like', `JOB-${dateStr}-%`)
    .count('* as count')

  const sequence = (parseInt(count as string, 10) + 1).toString().padStart(4, '0')

  return `JOB-${dateStr}-${sequence}`
}

/**
 * Calculate job total
 */
function calculateTotal(
  laborMinutes: number,
  laborRate: number,
  partsTotal: number,
  taxRate: number,
  discountAmount: number
): number {
  const laborTotal = (laborMinutes / 60) * laborRate
  const subtotal = laborTotal + partsTotal - discountAmount
  const taxAmount = subtotal * (taxRate / 100)
  return subtotal + taxAmount
}

/**
 * List jobs for a tenant
 */
export async function listJobs(tenantId: string, filters: JobFilters = {}) {
  const db = getTenantDb(tenantId)
  const {
    customerId,
    vehicleId,
    status,
    assignedMechanicId,
    startDate,
    endDate,
    search,
    limit = 50,
    offset = 0,
  } = filters

  let query = db('jobs')
    .select(
      'jobs.*',
      'customers.first_name as customer_first_name',
      'customers.last_name as customer_last_name',
      'vehicles.year as vehicle_year',
      'vehicles.make as vehicle_make',
      'vehicles.model as vehicle_model'
    )
    .leftJoin('customers', 'jobs.customer_id', 'customers.id')
    .leftJoin('vehicles', 'jobs.vehicle_id', 'vehicles.id')
    .whereNull('jobs.deleted_at')
    .orderBy('jobs.created_at', 'desc')

  // Filter by customer
  if (customerId) {
    query = query.where('jobs.customer_id', customerId)
  }

  // Filter by vehicle
  if (vehicleId) {
    query = query.where('jobs.vehicle_id', vehicleId)
  }

  // Filter by status
  if (status) {
    if (Array.isArray(status)) {
      query = query.whereIn('jobs.status', status)
    } else {
      query = query.where('jobs.status', status)
    }
  }

  // Filter by assigned mechanic
  if (assignedMechanicId) {
    query = query.where('jobs.assigned_mechanic_id', assignedMechanicId)
  }

  // Filter by date range
  if (startDate) {
    query = query.where('jobs.scheduled_start', '>=', startDate)
  }
  if (endDate) {
    query = query.where('jobs.scheduled_start', '<=', endDate)
  }

  // Search filter
  if (search) {
    query = query.where((builder) => {
      builder
        .where('jobs.job_number', 'ilike', `%${search}%`)
        .orWhere('jobs.title', 'ilike', `%${search}%`)
        .orWhere('customers.first_name', 'ilike', `%${search}%`)
        .orWhere('customers.last_name', 'ilike', `%${search}%`)
    })
  }

  // Pagination
  query = query.limit(limit).offset(offset)

  const jobs = await query

  // Get total count
  const countQuery = db('jobs').whereNull('deleted_at')
  if (customerId) countQuery.where('customer_id', customerId)
  if (vehicleId) countQuery.where('vehicle_id', vehicleId)
  if (status) {
    if (Array.isArray(status)) {
      countQuery.whereIn('status', status)
    } else {
      countQuery.where('status', status)
    }
  }
  if (assignedMechanicId) countQuery.where('assigned_mechanic_id', assignedMechanicId)
  if (startDate) countQuery.where('scheduled_start', '>=', startDate)
  if (endDate) countQuery.where('scheduled_start', '<=', endDate)

  const [{ count }] = await countQuery.count('* as count')

  return {
    data: jobs,
    pagination: {
      total: parseInt(count as string, 10),
      limit,
      offset,
      hasMore: offset + jobs.length < parseInt(count as string, 10),
    },
  }
}

/**
 * Get a single job by ID
 */
export async function getJob(tenantId: string, jobId: string) {
  const db = getTenantDb(tenantId)

  const job = await db('jobs')
    .select(
      'jobs.*',
      'customers.first_name as customer_first_name',
      'customers.last_name as customer_last_name',
      'customers.email as customer_email',
      'customers.phone as customer_phone',
      'vehicles.year as vehicle_year',
      'vehicles.make as vehicle_make',
      'vehicles.model as vehicle_model',
      'vehicles.vin as vehicle_vin',
      'vehicles.license_plate as vehicle_license_plate'
    )
    .leftJoin('customers', 'jobs.customer_id', 'customers.id')
    .leftJoin('vehicles', 'jobs.vehicle_id', 'vehicles.id')
    .where('jobs.id', jobId)
    .whereNull('jobs.deleted_at')
    .first()

  if (!job) {
    throw new Error('Job not found')
  }

  // Get job parts
  const jobParts = await db('job_parts')
    .select('job_parts.*', 'parts.name as part_name', 'parts.part_number')
    .leftJoin('parts', 'job_parts.part_id', 'parts.id')
    .where('job_parts.job_id', jobId)

  // Get trust artifacts
  const trustArtifacts = await db('trust_artifacts')
    .where('job_id', jobId)
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')

  return {
    ...job,
    parts: jobParts,
    trustArtifacts,
  }
}

/**
 * Create a new job
 */
export async function createJob(tenantId: string, input: CreateJobInput) {
  const db = getTenantDb(tenantId)

  // Verify customer exists
  const customer = await db('customers')
    .where({ id: input.customerId })
    .whereNull('deleted_at')
    .first()

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Verify vehicle exists and belongs to customer
  const vehicle = await db('vehicles')
    .where({ id: input.vehicleId, customer_id: input.customerId })
    .whereNull('deleted_at')
    .first()

  if (!vehicle) {
    throw new Error('Vehicle not found or does not belong to this customer')
  }

  // Generate job number
  const jobNumber = await generateJobNumber(db)

  // Calculate total
  const total = calculateTotal(
    input.laborMinutes || 0,
    input.laborRate || 0,
    input.partsTotal || 0,
    input.taxRate || 0,
    input.discountAmount || 0
  )

  const [job] = await db('jobs')
    .insert({
      customer_id: input.customerId,
      vehicle_id: input.vehicleId,
      job_template_id: input.jobTemplateId || null,
      assigned_mechanic_id: input.assignedMechanicId || null,
      job_number: jobNumber,
      title: input.title,
      description: input.description || null,
      status: input.status || 'draft',
      scheduled_start: input.scheduledStart || null,
      scheduled_end: input.scheduledEnd || null,
      estimated_duration_minutes: input.estimatedDurationMinutes || null,
      service_location_address: input.serviceLocationAddress || null,
      service_location_lat: input.serviceLocationLat || null,
      service_location_lng: input.serviceLocationLng || null,
      labor_minutes: input.laborMinutes || 0,
      labor_rate: input.laborRate || 0,
      parts_total: input.partsTotal || 0,
      tax_rate: input.taxRate || 0,
      discount_amount: input.discountAmount || 0,
      total,
      notes: input.notes || null,
    })
    .returning('*')

  logger.info('Job created', { tenantId, jobId: job.id, jobNumber })

  return job
}

/**
 * Update a job
 */
export async function updateJob(
  tenantId: string,
  jobId: string,
  input: UpdateJobInput
) {
  const db = getTenantDb(tenantId)

  // Check if job exists
  const existingJob = await db('jobs')
    .where({ id: jobId })
    .whereNull('deleted_at')
    .first()

  if (!existingJob) {
    throw new Error('Job not found')
  }

  // Build update object
  const updateData: any = {}

  if (input.assignedMechanicId !== undefined)
    updateData.assigned_mechanic_id = input.assignedMechanicId || null
  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined)
    updateData.description = input.description || null
  if (input.scheduledStart !== undefined)
    updateData.scheduled_start = input.scheduledStart || null
  if (input.scheduledEnd !== undefined)
    updateData.scheduled_end = input.scheduledEnd || null
  if (input.estimatedDurationMinutes !== undefined)
    updateData.estimated_duration_minutes = input.estimatedDurationMinutes || null
  if (input.serviceLocationAddress !== undefined)
    updateData.service_location_address = input.serviceLocationAddress || null
  if (input.serviceLocationLat !== undefined)
    updateData.service_location_lat = input.serviceLocationLat || null
  if (input.serviceLocationLng !== undefined)
    updateData.service_location_lng = input.serviceLocationLng || null
  if (input.laborMinutes !== undefined) updateData.labor_minutes = input.laborMinutes || 0
  if (input.laborRate !== undefined) updateData.labor_rate = input.laborRate || 0
  if (input.partsTotal !== undefined) updateData.parts_total = input.partsTotal || 0
  if (input.taxRate !== undefined) updateData.tax_rate = input.taxRate || 0
  if (input.discountAmount !== undefined)
    updateData.discount_amount = input.discountAmount || 0
  if (input.notes !== undefined) updateData.notes = input.notes || null

  // Recalculate total if pricing fields changed
  if (
    input.laborMinutes !== undefined ||
    input.laborRate !== undefined ||
    input.partsTotal !== undefined ||
    input.taxRate !== undefined ||
    input.discountAmount !== undefined
  ) {
    updateData.total = calculateTotal(
      updateData.labor_minutes ?? existingJob.labor_minutes,
      updateData.labor_rate ?? existingJob.labor_rate,
      updateData.parts_total ?? existingJob.parts_total,
      updateData.tax_rate ?? existingJob.tax_rate,
      updateData.discount_amount ?? existingJob.discount_amount
    )
  }

  updateData.updated_at = db.fn.now()

  const [job] = await db('jobs')
    .where({ id: jobId })
    .update(updateData)
    .returning('*')

  logger.info('Job updated', { tenantId, jobId })

  return job
}

/**
 * Update job status
 */
export async function updateJobStatus(
  tenantId: string,
  jobId: string,
  newStatus: JobStatus
) {
  const db = getTenantDb(tenantId)

  // Check if job exists
  const existingJob = await db('jobs')
    .where({ id: jobId })
    .whereNull('deleted_at')
    .first()

  if (!existingJob) {
    throw new Error('Job not found')
  }

  const updateData: any = {
    status: newStatus,
    updated_at: db.fn.now(),
  }

  // Set timestamps based on status
  if (newStatus === 'in_progress' && !existingJob.actual_start) {
    updateData.actual_start = db.fn.now()
  }
  if (newStatus === 'completed' && !existingJob.actual_end) {
    updateData.actual_end = db.fn.now()
  }

  const [job] = await db('jobs')
    .where({ id: jobId })
    .update(updateData)
    .returning('*')

  logger.info('Job status updated', { tenantId, jobId, oldStatus: existingJob.status, newStatus })

  return job
}

/**
 * Delete a job (soft delete)
 */
export async function deleteJob(tenantId: string, jobId: string) {
  const db = getTenantDb(tenantId)

  // Check if job exists
  const existingJob = await db('jobs')
    .where({ id: jobId })
    .whereNull('deleted_at')
    .first()

  if (!existingJob) {
    throw new Error('Job not found')
  }

  // Don't allow deletion of completed jobs
  if (existingJob.status === 'completed') {
    throw new Error('Cannot delete completed jobs. Cancel the job instead.')
  }

  // Soft delete
  await db('jobs')
    .where({ id: jobId })
    .update({
      deleted_at: db.fn.now(),
    })

  logger.info('Job deleted', { tenantId, jobId })

  return { success: true }
}
