import { getTenantDb } from '@config/database'
import logger from '@config/logger'

export interface CreatePartInput {
  partNumber?: string
  name: string
  description?: string
  category?: string
  manufacturer?: string
  manufacturerPartNumber?: string
  defaultCost?: number
  defaultPrice?: number
  minimumStock?: number
  reorderPoint?: number
  specifications?: any
}

export interface UpdatePartInput {
  partNumber?: string
  name?: string
  description?: string
  category?: string
  manufacturer?: string
  manufacturerPartNumber?: string
  defaultCost?: number
  defaultPrice?: number
  minimumStock?: number
  reorderPoint?: number
  specifications?: any
  isActive?: boolean
}

export interface PartFilters {
  category?: string
  manufacturer?: string
  search?: string
  isActive?: boolean
  inStock?: boolean
  limit?: number
  offset?: number
}

/**
 * List parts in catalog
 */
export async function listParts(tenantId: string, filters: PartFilters = {}) {
  const db = getTenantDb(tenantId)
  const { category, manufacturer, search, isActive, limit = 50, offset = 0 } = filters

  let query = db('parts')
    .select('*')
    .whereNull('deleted_at')
    .orderBy('name', 'asc')

  // Filter by category
  if (category) {
    query = query.where('category', category)
  }

  // Filter by manufacturer
  if (manufacturer) {
    query = query.where('manufacturer', 'ilike', `%${manufacturer}%`)
  }

  // Filter by active status
  if (isActive !== undefined) {
    query = query.where('is_active', isActive)
  }

  // Search filter
  if (search) {
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${search}%`)
        .orWhere('part_number', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`)
        .orWhere('manufacturer_part_number', 'ilike', `%${search}%`)
    })
  }

  // Pagination
  query = query.limit(limit).offset(offset)

  const parts = await query

  // Get total count
  const countQuery = db('parts').whereNull('deleted_at')
  if (category) countQuery.where('category', category)
  if (manufacturer) countQuery.where('manufacturer', 'ilike', `%${manufacturer}%`)
  if (isActive !== undefined) countQuery.where('is_active', isActive)
  if (search) {
    countQuery.where((builder) => {
      builder
        .where('name', 'ilike', `%${search}%`)
        .orWhere('part_number', 'ilike', `%${search}%`)
        .orWhere('description', 'ilike', `%${search}%`)
        .orWhere('manufacturer_part_number', 'ilike', `%${search}%`)
    })
  }

  const [{ count }] = await countQuery.count('* as count')

  return {
    data: parts,
    pagination: {
      total: parseInt(count as string, 10),
      limit,
      offset,
      hasMore: offset + parts.length < parseInt(count as string, 10),
    },
  }
}

/**
 * Get a single part by ID
 */
export async function getPart(tenantId: string, partId: string) {
  const db = getTenantDb(tenantId)

  const part = await db('parts')
    .where({ id: partId })
    .whereNull('deleted_at')
    .first()

  if (!part) {
    throw new Error('Part not found')
  }

  // Get inventory levels across all locations
  const inventoryLevels = await db('inventory_items')
    .select('location', 'quantity_on_hand', 'quantity_allocated')
    .where({ part_id: partId })
    .whereNull('deleted_at')

  return {
    ...part,
    inventory: inventoryLevels,
  }
}

/**
 * Create a new part
 */
export async function createPart(tenantId: string, input: CreatePartInput) {
  const db = getTenantDb(tenantId)

  // Check for duplicate part number
  if (input.partNumber) {
    const existingPart = await db('parts')
      .where({ part_number: input.partNumber })
      .whereNull('deleted_at')
      .first()

    if (existingPart) {
      throw new Error('Part with this part number already exists')
    }
  }

  const [part] = await db('parts')
    .insert({
      part_number: input.partNumber || null,
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      manufacturer: input.manufacturer || null,
      manufacturer_part_number: input.manufacturerPartNumber || null,
      default_cost: input.defaultCost || null,
      default_price: input.defaultPrice || null,
      minimum_stock: input.minimumStock || 0,
      reorder_point: input.reorderPoint || 0,
      specifications: input.specifications ? JSON.stringify(input.specifications) : null,
      is_active: true,
    })
    .returning('*')

  logger.info('Part created', { tenantId, partId: part.id, partNumber: input.partNumber })

  return part
}

/**
 * Update a part
 */
export async function updatePart(
  tenantId: string,
  partId: string,
  input: UpdatePartInput
) {
  const db = getTenantDb(tenantId)

  // Check if part exists
  const existingPart = await db('parts')
    .where({ id: partId })
    .whereNull('deleted_at')
    .first()

  if (!existingPart) {
    throw new Error('Part not found')
  }

  // Check for duplicate part number if updating
  if (input.partNumber && input.partNumber !== existingPart.part_number) {
    const duplicatePartNumber = await db('parts')
      .where({ part_number: input.partNumber })
      .whereNot({ id: partId })
      .whereNull('deleted_at')
      .first()

    if (duplicatePartNumber) {
      throw new Error('Another part with this part number already exists')
    }
  }

  // Build update object
  const updateData: any = {}

  if (input.partNumber !== undefined) updateData.part_number = input.partNumber || null
  if (input.name !== undefined) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description || null
  if (input.category !== undefined) updateData.category = input.category || null
  if (input.manufacturer !== undefined) updateData.manufacturer = input.manufacturer || null
  if (input.manufacturerPartNumber !== undefined)
    updateData.manufacturer_part_number = input.manufacturerPartNumber || null
  if (input.defaultCost !== undefined) updateData.default_cost = input.defaultCost || null
  if (input.defaultPrice !== undefined) updateData.default_price = input.defaultPrice || null
  if (input.minimumStock !== undefined) updateData.minimum_stock = input.minimumStock
  if (input.reorderPoint !== undefined) updateData.reorder_point = input.reorderPoint
  if (input.specifications !== undefined)
    updateData.specifications = input.specifications ? JSON.stringify(input.specifications) : null
  if (input.isActive !== undefined) updateData.is_active = input.isActive

  updateData.updated_at = db.fn.now()

  const [part] = await db('parts')
    .where({ id: partId })
    .update(updateData)
    .returning('*')

  logger.info('Part updated', { tenantId, partId })

  return part
}

/**
 * Delete a part (soft delete)
 */
export async function deletePart(tenantId: string, partId: string) {
  const db = getTenantDb(tenantId)

  // Check if part exists
  const existingPart = await db('parts')
    .where({ id: partId })
    .whereNull('deleted_at')
    .first()

  if (!existingPart) {
    throw new Error('Part not found')
  }

  // Check if part is used in inventory
  const inventoryCount = await db('inventory_items')
    .where({ part_id: partId })
    .whereNull('deleted_at')
    .count('* as count')
    .first()

  if (inventoryCount && parseInt(inventoryCount.count as string, 10) > 0) {
    throw new Error('Cannot delete part that has inventory items. Deactivate instead.')
  }

  // Check if part is used in jobs
  const jobPartsCount = await db('job_parts')
    .where({ part_id: partId })
    .count('* as count')
    .first()

  if (jobPartsCount && parseInt(jobPartsCount.count as string, 10) > 0) {
    throw new Error('Cannot delete part that has been used in jobs. Deactivate instead.')
  }

  // Soft delete
  await db('parts')
    .where({ id: partId })
    .update({
      deleted_at: db.fn.now(),
    })

  logger.info('Part deleted', { tenantId, partId })

  return { success: true }
}
