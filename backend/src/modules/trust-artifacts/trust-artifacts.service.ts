import { getTenantDb } from '@config/database'
import logger from '@config/logger'
import { uploadFile, deleteFile, validateFileType, validateFileSize } from '@lib/azure-storage'

export interface CreateTrustArtifactInput {
  jobId?: string
  vehicleId?: string
  artifactType: 'before_photo' | 'after_photo' | 'inspection_video' | 'diagnostic_report' | 'customer_approval' | 'receipt' | 'other'
  title: string
  description?: string
  fileBuffer: Buffer
  originalFilename: string
  contentType: string
  metadata?: any
}

export interface UpdateTrustArtifactInput {
  title?: string
  description?: string
  metadata?: any
}

export interface TrustArtifactFilters {
  jobId?: string
  vehicleId?: string
  artifactType?: string
  search?: string
  limit?: number
  offset?: number
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_IMAGE_SIZE_MB = 10
const MAX_VIDEO_SIZE_MB = 100
const CONTAINER_NAME = 'trust-artifacts'

/**
 * List trust artifacts
 */
export async function listTrustArtifacts(
  tenantId: string,
  filters: TrustArtifactFilters = {}
) {
  const db = getTenantDb(tenantId)
  const { jobId, vehicleId, artifactType, search, limit = 50, offset = 0 } = filters

  let query = db('trust_artifacts')
    .select('*')
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')

  // Filter by job
  if (jobId) {
    query = query.where('job_id', jobId)
  }

  // Filter by vehicle
  if (vehicleId) {
    query = query.where('vehicle_id', vehicleId)
  }

  // Filter by artifact type
  if (artifactType) {
    query = query.where('artifact_type', artifactType)
  }

  // Search filter
  if (search) {
    query = query.where((builder) => {
      builder
        .where('title', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`)
    })
  }

  // Pagination
  query = query.limit(limit).offset(offset)

  const artifacts = await query

  // Get total count
  const countQuery = db('trust_artifacts').whereNull('deleted_at')
  if (jobId) countQuery.where('job_id', jobId)
  if (vehicleId) countQuery.where('vehicle_id', vehicleId)
  if (artifactType) countQuery.where('artifact_type', artifactType)
  if (search) {
    countQuery.where((builder) => {
      builder
        .where('title', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`)
    })
  }

  const [{ count }] = await countQuery.count('* as count')

  return {
    data: artifacts,
    pagination: {
      total: parseInt(count as string, 10),
      limit,
      offset,
      hasMore: offset + artifacts.length < parseInt(count as string, 10),
    },
  }
}

/**
 * Get a single trust artifact by ID
 */
export async function getTrustArtifact(tenantId: string, artifactId: string) {
  const db = getTenantDb(tenantId)

  const artifact = await db('trust_artifacts')
    .where({ id: artifactId })
    .whereNull('deleted_at')
    .first()

  if (!artifact) {
    throw new Error('Trust artifact not found')
  }

  return artifact
}

/**
 * Create a new trust artifact with file upload
 */
export async function createTrustArtifact(
  tenantId: string,
  input: CreateTrustArtifactInput
) {
  const db = getTenantDb(tenantId)

  // Validate that at least jobId or vehicleId is provided
  if (!input.jobId && !input.vehicleId) {
    throw new Error('Either jobId or vehicleId must be provided')
  }

  // Verify job exists if provided
  if (input.jobId) {
    const job = await db('jobs')
      .where({ id: input.jobId })
      .whereNull('deleted_at')
      .first()

    if (!job) {
      throw new Error('Job not found')
    }
  }

  // Verify vehicle exists if provided
  if (input.vehicleId) {
    const vehicle = await db('vehicles')
      .where({ id: input.vehicleId })
      .whereNull('deleted_at')
      .first()

    if (!vehicle) {
      throw new Error('Vehicle not found')
    }
  }

  // Validate file type based on artifact type
  let allowedTypes: string[]
  let maxSizeMB: number

  if (input.artifactType.includes('photo')) {
    allowedTypes = ALLOWED_IMAGE_TYPES
    maxSizeMB = MAX_IMAGE_SIZE_MB
  } else if (input.artifactType.includes('video')) {
    allowedTypes = ALLOWED_VIDEO_TYPES
    maxSizeMB = MAX_VIDEO_SIZE_MB
  } else {
    allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]
    maxSizeMB = MAX_IMAGE_SIZE_MB
  }

  if (!validateFileType(input.contentType, allowedTypes)) {
    throw new Error(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    )
  }

  if (!validateFileSize(input.fileBuffer.length, maxSizeMB)) {
    throw new Error(`File size exceeds maximum of ${maxSizeMB}MB`)
  }

  // Upload file to Azure Blob Storage
  const { url, blobName } = await uploadFile(
    CONTAINER_NAME,
    input.fileBuffer,
    input.originalFilename,
    input.contentType,
    tenantId
  )

  // Create trust artifact record
  const [artifact] = await db('trust_artifacts')
    .insert({
      job_id: input.jobId || null,
      vehicle_id: input.vehicleId || null,
      artifact_type: input.artifactType,
      title: input.title,
      description: input.description || null,
      file_url: url,
      file_type: input.contentType,
      file_size: input.fileBuffer.length,
      blob_name: blobName,
      container_name: CONTAINER_NAME,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .returning('*')

  logger.info('Trust artifact created', {
    tenantId,
    artifactId: artifact.id,
    artifactType: input.artifactType,
    fileSize: input.fileBuffer.length,
  })

  return artifact
}

/**
 * Update a trust artifact (metadata only, not the file)
 */
export async function updateTrustArtifact(
  tenantId: string,
  artifactId: string,
  input: UpdateTrustArtifactInput
) {
  const db = getTenantDb(tenantId)

  // Check if artifact exists
  const existingArtifact = await db('trust_artifacts')
    .where({ id: artifactId })
    .whereNull('deleted_at')
    .first()

  if (!existingArtifact) {
    throw new Error('Trust artifact not found')
  }

  // Build update object
  const updateData: any = {}

  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined) updateData.description = input.description || null
  if (input.metadata !== undefined)
    updateData.metadata = input.metadata ? JSON.stringify(input.metadata) : null

  updateData.updated_at = db.fn.now()

  const [artifact] = await db('trust_artifacts')
    .where({ id: artifactId })
    .update(updateData)
    .returning('*')

  logger.info('Trust artifact updated', { tenantId, artifactId })

  return artifact
}

/**
 * Delete a trust artifact (soft delete + delete file from Azure)
 */
export async function deleteTrustArtifact(tenantId: string, artifactId: string) {
  const db = getTenantDb(tenantId)

  // Check if artifact exists
  const existingArtifact = await db('trust_artifacts')
    .where({ id: artifactId })
    .whereNull('deleted_at')
    .first()

  if (!existingArtifact) {
    throw new Error('Trust artifact not found')
  }

  // Delete file from Azure Blob Storage
  try {
    await deleteFile(existingArtifact.container_name, existingArtifact.blob_name)
  } catch (error: any) {
    logger.error('Failed to delete file from Azure, continuing with soft delete', {
      error: error.message,
      blobName: existingArtifact.blob_name,
    })
  }

  // Soft delete artifact record
  await db('trust_artifacts')
    .where({ id: artifactId })
    .update({
      deleted_at: db.fn.now(),
    })

  logger.info('Trust artifact deleted', { tenantId, artifactId })

  return { success: true }
}

/**
 * Get trust artifacts summary for a job
 */
export async function getJobTrustSummary(tenantId: string, jobId: string) {
  const db = getTenantDb(tenantId)

  // Verify job exists
  const job = await db('jobs')
    .where({ id: jobId })
    .whereNull('deleted_at')
    .first()

  if (!job) {
    throw new Error('Job not found')
  }

  // Get all artifacts for this job
  const artifacts = await db('trust_artifacts')
    .where({ job_id: jobId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'asc')

  // Group by artifact type
  const groupedArtifacts = artifacts.reduce((acc: any, artifact: any) => {
    const type = artifact.artifact_type
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(artifact)
    return acc
  }, {})

  // Get counts
  const counts = await db('trust_artifacts')
    .select('artifact_type')
    .where({ job_id: jobId })
    .whereNull('deleted_at')
    .count('* as count')
    .groupBy('artifact_type')

  const countsByType = counts.reduce((acc: any, row: any) => {
    acc[row.artifact_type] = parseInt(row.count, 10)
    return acc
  }, {})

  return {
    job: {
      id: job.id,
      job_number: job.job_number,
      title: job.title,
      status: job.status,
    },
    artifacts: groupedArtifacts,
    counts: countsByType,
    totalArtifacts: artifacts.length,
  }
}

/**
 * Get trust artifacts for a vehicle
 */
export async function getVehicleTrustHistory(tenantId: string, vehicleId: string) {
  const db = getTenantDb(tenantId)

  // Verify vehicle exists
  const vehicle = await db('vehicles')
    .where({ id: vehicleId })
    .whereNull('deleted_at')
    .first()

  if (!vehicle) {
    throw new Error('Vehicle not found')
  }

  // Get all artifacts for this vehicle
  const artifacts = await db('trust_artifacts')
    .where({ vehicle_id: vehicleId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')

  return {
    vehicle: {
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      vin: vehicle.vin,
    },
    artifacts,
    totalArtifacts: artifacts.length,
  }
}
