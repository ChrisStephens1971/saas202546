import { getTenantDb } from '@config/database'
import logger from '@config/logger'

export interface AddInventoryInput {
  partId: string
  location: string
  quantityOnHand: number
  binLocation?: string
  notes?: string
}

export interface UpdateInventoryInput {
  quantityOnHand?: number
  binLocation?: string
  notes?: string
}

export interface TransferInventoryInput {
  fromInventoryId: string
  toLocation: string
  quantity: number
  notes?: string
}

export interface AllocateInventoryInput {
  partId: string
  location: string
  quantity: number
  jobId: string
}

export interface InventoryFilters {
  partId?: string
  location?: string
  lowStock?: boolean
  search?: string
  limit?: number
  offset?: number
}

/**
 * List inventory items
 */
export async function listInventory(tenantId: string, filters: InventoryFilters = {}) {
  const db = getTenantDb(tenantId)
  const { partId, location, lowStock, search, limit = 50, offset = 0 } = filters

  let query = db('inventory_items as inv')
    .select(
      'inv.*',
      'parts.name as part_name',
      'parts.part_number',
      'parts.category',
      'parts.minimum_stock',
      'parts.reorder_point'
    )
    .leftJoin('parts', 'inv.part_id', 'parts.id')
    .whereNull('inv.deleted_at')
    .orderBy('inv.location', 'asc')
    .orderBy('parts.name', 'asc')

  // Filter by part
  if (partId) {
    query = query.where('inv.part_id', partId)
  }

  // Filter by location
  if (location) {
    query = query.where('inv.location', 'ilike', `%${location}%`)
  }

  // Filter by low stock
  if (lowStock) {
    query = query.whereRaw('inv.quantity_on_hand <= parts.reorder_point')
  }

  // Search filter
  if (search) {
    query = query.where((builder) => {
      builder
        .where('parts.name', 'ilike', `%${search}%`)
        .orWhere('parts.part_number', 'ilike', `%${search}%`)
        .orWhere('inv.location', 'ilike', `%${search}%`)
        .orWhere('inv.bin_location', 'ilike', `%${search}%`)
    })
  }

  // Pagination
  query = query.limit(limit).offset(offset)

  const inventory = await query

  // Get total count
  const countQuery = db('inventory_items as inv')
    .leftJoin('parts', 'inv.part_id', 'parts.id')
    .whereNull('inv.deleted_at')

  if (partId) countQuery.where('inv.part_id', partId)
  if (location) countQuery.where('inv.location', 'ilike', `%${location}%`)
  if (lowStock) countQuery.whereRaw('inv.quantity_on_hand <= parts.reorder_point')
  if (search) {
    countQuery.where((builder) => {
      builder
        .where('parts.name', 'ilike', `%${search}%`)
        .orWhere('parts.part_number', 'ilike', `%${search}%`)
        .orWhere('inv.location', 'ilike', `%${search}%`)
        .orWhere('inv.bin_location', 'ilike', `%${search}%`)
    })
  }

  const [{ count }] = await countQuery.count('* as count')

  return {
    data: inventory,
    pagination: {
      total: parseInt(count as string, 10),
      limit,
      offset,
      hasMore: offset + inventory.length < parseInt(count as string, 10),
    },
  }
}

/**
 * Get a single inventory item by ID
 */
export async function getInventoryItem(tenantId: string, inventoryId: string) {
  const db = getTenantDb(tenantId)

  const inventory = await db('inventory_items as inv')
    .select(
      'inv.*',
      'parts.name as part_name',
      'parts.part_number',
      'parts.category',
      'parts.manufacturer'
    )
    .leftJoin('parts', 'inv.part_id', 'parts.id')
    .where('inv.id', inventoryId)
    .whereNull('inv.deleted_at')
    .first()

  if (!inventory) {
    throw new Error('Inventory item not found')
  }

  return inventory
}

/**
 * Add inventory to a location
 */
export async function addInventory(tenantId: string, input: AddInventoryInput) {
  const db = getTenantDb(tenantId)

  // Verify part exists
  const part = await db('parts')
    .where({ id: input.partId })
    .whereNull('deleted_at')
    .first()

  if (!part) {
    throw new Error('Part not found')
  }

  // Check if inventory already exists for this part at this location
  const existingInventory = await db('inventory_items')
    .where({ part_id: input.partId, location: input.location })
    .whereNull('deleted_at')
    .first()

  if (existingInventory) {
    throw new Error('Inventory for this part already exists at this location. Use update instead.')
  }

  const [inventory] = await db('inventory_items')
    .insert({
      part_id: input.partId,
      location: input.location,
      quantity_on_hand: input.quantityOnHand,
      quantity_allocated: 0,
      bin_location: input.binLocation || null,
      notes: input.notes || null,
    })
    .returning('*')

  logger.info('Inventory added', {
    tenantId,
    inventoryId: inventory.id,
    partId: input.partId,
    location: input.location,
  })

  return inventory
}

/**
 * Update inventory quantities
 */
export async function updateInventory(
  tenantId: string,
  inventoryId: string,
  input: UpdateInventoryInput
) {
  const db = getTenantDb(tenantId)

  // Check if inventory exists
  const existingInventory = await db('inventory_items')
    .where({ id: inventoryId })
    .whereNull('deleted_at')
    .first()

  if (!existingInventory) {
    throw new Error('Inventory item not found')
  }

  // Build update object
  const updateData: any = {}

  if (input.quantityOnHand !== undefined) updateData.quantity_on_hand = input.quantityOnHand
  if (input.binLocation !== undefined) updateData.bin_location = input.binLocation || null
  if (input.notes !== undefined) updateData.notes = input.notes || null

  updateData.updated_at = db.fn.now()

  const [inventory] = await db('inventory_items')
    .where({ id: inventoryId })
    .update(updateData)
    .returning('*')

  logger.info('Inventory updated', { tenantId, inventoryId })

  return inventory
}

/**
 * Transfer inventory between locations
 */
export async function transferInventory(tenantId: string, input: TransferInventoryInput) {
  const db = getTenantDb(tenantId)

  return await db.transaction(async (trx) => {
    // Get source inventory
    const sourceInventory = await trx('inventory_items')
      .where({ id: input.fromInventoryId })
      .whereNull('deleted_at')
      .first()

    if (!sourceInventory) {
      throw new Error('Source inventory not found')
    }

    // Check available quantity
    const available = sourceInventory.quantity_on_hand - sourceInventory.quantity_allocated
    if (available < input.quantity) {
      throw new Error(`Insufficient available inventory. Available: ${available}, requested: ${input.quantity}`)
    }

    // Reduce source inventory
    await trx('inventory_items')
      .where({ id: input.fromInventoryId })
      .decrement('quantity_on_hand', input.quantity)

    // Check if destination inventory exists
    const destinationInventory = await trx('inventory_items')
      .where({ part_id: sourceInventory.part_id, location: input.toLocation })
      .whereNull('deleted_at')
      .first()

    if (destinationInventory) {
      // Increment existing destination inventory
      await trx('inventory_items')
        .where({ id: destinationInventory.id })
        .increment('quantity_on_hand', input.quantity)
    } else {
      // Create new destination inventory
      await trx('inventory_items').insert({
        part_id: sourceInventory.part_id,
        location: input.toLocation,
        quantity_on_hand: input.quantity,
        quantity_allocated: 0,
        notes: input.notes || null,
      })
    }

    logger.info('Inventory transferred', {
      tenantId,
      fromInventoryId: input.fromInventoryId,
      toLocation: input.toLocation,
      quantity: input.quantity,
    })

    return { success: true }
  })
}

/**
 * Allocate inventory to a job
 */
export async function allocateInventory(tenantId: string, input: AllocateInventoryInput) {
  const db = getTenantDb(tenantId)

  return await db.transaction(async (trx) => {
    // Get inventory item
    const inventory = await trx('inventory_items')
      .where({ part_id: input.partId, location: input.location })
      .whereNull('deleted_at')
      .first()

    if (!inventory) {
      throw new Error('Inventory not found for this part at this location')
    }

    // Check available quantity
    const available = inventory.quantity_on_hand - inventory.quantity_allocated
    if (available < input.quantity) {
      throw new Error(`Insufficient available inventory. Available: ${available}, requested: ${input.quantity}`)
    }

    // Verify job exists
    const job = await trx('jobs')
      .where({ id: input.jobId })
      .whereNull('deleted_at')
      .first()

    if (!job) {
      throw new Error('Job not found')
    }

    // Get part details
    const part = await trx('parts')
      .where({ id: input.partId })
      .first()

    // Allocate inventory
    await trx('inventory_items')
      .where({ id: inventory.id })
      .increment('quantity_allocated', input.quantity)

    // Add to job_parts
    const [jobPart] = await trx('job_parts')
      .insert({
        job_id: input.jobId,
        part_id: input.partId,
        inventory_item_id: inventory.id,
        quantity: input.quantity,
        unit_cost: part.default_cost || 0,
        unit_price: part.default_price || 0,
        subtotal: (part.default_price || 0) * input.quantity,
      })
      .returning('*')

    // Update job parts_total
    const [{ total }] = await trx('job_parts')
      .where({ job_id: input.jobId })
      .sum('subtotal as total')

    const partsTotal = parseFloat(total || '0')

    await trx('jobs')
      .where({ id: input.jobId })
      .update({
        parts_total: partsTotal,
        total: calculateJobTotal(job, partsTotal),
        updated_at: trx.fn.now(),
      })

    logger.info('Inventory allocated to job', {
      tenantId,
      jobId: input.jobId,
      partId: input.partId,
      quantity: input.quantity,
    })

    return jobPart
  })
}

/**
 * Deallocate inventory from a job
 */
export async function deallocateInventory(tenantId: string, jobPartId: string) {
  const db = getTenantDb(tenantId)

  return await db.transaction(async (trx) => {
    // Get job part
    const jobPart = await trx('job_parts')
      .where({ id: jobPartId })
      .first()

    if (!jobPart) {
      throw new Error('Job part not found')
    }

    // Deallocate inventory
    if (jobPart.inventory_item_id) {
      await trx('inventory_items')
        .where({ id: jobPart.inventory_item_id })
        .decrement('quantity_allocated', jobPart.quantity)
    }

    // Delete job part
    await trx('job_parts')
      .where({ id: jobPartId })
      .delete()

    // Update job parts_total
    const [{ total }] = await trx('job_parts')
      .where({ job_id: jobPart.job_id })
      .sum('subtotal as total')

    const partsTotal = parseFloat(total || '0')

    const job = await trx('jobs')
      .where({ id: jobPart.job_id })
      .first()

    await trx('jobs')
      .where({ id: jobPart.job_id })
      .update({
        parts_total: partsTotal,
        total: calculateJobTotal(job, partsTotal),
        updated_at: trx.fn.now(),
      })

    logger.info('Inventory deallocated from job', {
      tenantId,
      jobId: jobPart.job_id,
      partId: jobPart.part_id,
      quantity: jobPart.quantity,
    })

    return { success: true }
  })
}

/**
 * Delete inventory item (soft delete)
 */
export async function deleteInventory(tenantId: string, inventoryId: string) {
  const db = getTenantDb(tenantId)

  // Check if inventory exists
  const existingInventory = await db('inventory_items')
    .where({ id: inventoryId })
    .whereNull('deleted_at')
    .first()

  if (!existingInventory) {
    throw new Error('Inventory item not found')
  }

  // Check if inventory is allocated
  if (existingInventory.quantity_allocated > 0) {
    throw new Error('Cannot delete inventory with allocated quantity. Deallocate first.')
  }

  // Soft delete
  await db('inventory_items')
    .where({ id: inventoryId })
    .update({
      deleted_at: db.fn.now(),
    })

  logger.info('Inventory deleted', { tenantId, inventoryId })

  return { success: true }
}

/**
 * Calculate job total including parts
 */
function calculateJobTotal(job: any, partsTotal: number): number {
  const laborMinutes = job.labor_minutes || 0
  const laborRate = job.labor_rate || 0
  const taxRate = job.tax_rate || 0
  const discountAmount = job.discount_amount || 0

  const laborTotal = (laborMinutes / 60) * laborRate
  const subtotal = laborTotal + partsTotal - discountAmount
  const taxAmount = subtotal * (taxRate / 100)

  return subtotal + taxAmount
}
