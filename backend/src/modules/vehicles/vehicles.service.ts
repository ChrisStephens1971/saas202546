import { getTenantDb } from '@config/database'
import logger from '@config/logger'

export interface CreateVehicleInput {
  customerId: string
  vin?: string
  year: string
  make: string
  model: string
  trim?: string
  color?: string
  licensePlate?: string
  licensePlateState?: string
  odometer?: number
  engine?: string
  transmission?: string
  notes?: string
}

export interface UpdateVehicleInput {
  vin?: string
  year?: string
  make?: string
  model?: string
  trim?: string
  color?: string
  licensePlate?: string
  licensePlateState?: string
  odometer?: number
  engine?: string
  transmission?: string
  notes?: string
}

export interface VehicleFilters {
  customerId?: string
  search?: string
  make?: string
  model?: string
  year?: string
  limit?: number
  offset?: number
}

/**
 * List vehicles for a tenant
 */
export async function listVehicles(
  tenantId: string,
  filters: VehicleFilters = {}
) {
  const db = await getTenantDb(tenantId)
  const { customerId, search, make, model, year, limit = 50, offset = 0 } = filters

  let query = db('vehicles')
    .select('vehicles.*', 'customers.first_name', 'customers.last_name')
    .leftJoin('customers', 'vehicles.customer_id', 'customers.id')
    .whereNull('vehicles.deleted_at')
    .orderBy('vehicles.created_at', 'desc')

  // Filter by customer
  if (customerId) {
    query = query.where('vehicles.customer_id', customerId)
  }

  // Search filter (VIN, make, model, license plate)
  if (search) {
    query = query.where((builder) => {
      builder
        .where('vehicles.vin', 'ilike', `%${search}%`)
        .orWhere('vehicles.make', 'ilike', `%${search}%`)
        .orWhere('vehicles.model', 'ilike', `%${search}%`)
        .orWhere('vehicles.license_plate', 'ilike', `%${search}%`)
    })
  }

  // Make filter
  if (make) {
    query = query.where('vehicles.make', 'ilike', `%${make}%`)
  }

  // Model filter
  if (model) {
    query = query.where('vehicles.model', 'ilike', `%${model}%`)
  }

  // Year filter
  if (year) {
    query = query.where('vehicles.year', year)
  }

  // Pagination
  query = query.limit(limit).offset(offset)

  const vehicles = await query

  // Get total count
  const countQuery = db('vehicles').whereNull('deleted_at')
  if (customerId) {
    countQuery.where('customer_id', customerId)
  }
  if (search) {
    countQuery.where((builder) => {
      builder
        .where('vin', 'ilike', `%${search}%`)
        .orWhere('make', 'ilike', `%${search}%`)
        .orWhere('model', 'ilike', `%${search}%`)
        .orWhere('license_plate', 'ilike', `%${search}%`)
    })
  }
  if (make) {
    countQuery.where('make', 'ilike', `%${make}%`)
  }
  if (model) {
    countQuery.where('model', 'ilike', `%${model}%`)
  }
  if (year) {
    countQuery.where('year', year)
  }

  const [{ count }] = await countQuery.count('* as count')

  return {
    data: vehicles,
    pagination: {
      total: parseInt(count as string, 10),
      limit,
      offset,
      hasMore: offset + vehicles.length < parseInt(count as string, 10),
    },
  }
}

/**
 * Get a single vehicle by ID
 */
export async function getVehicle(tenantId: string, vehicleId: string) {
  const db = await getTenantDb(tenantId)

  const vehicle = await db('vehicles')
    .select('vehicles.*', 'customers.first_name', 'customers.last_name', 'customers.email', 'customers.phone')
    .leftJoin('customers', 'vehicles.customer_id', 'customers.id')
    .where('vehicles.id', vehicleId)
    .whereNull('vehicles.deleted_at')
    .first()

  if (!vehicle) {
    throw new Error('Vehicle not found')
  }

  // Get service history (jobs)
  const serviceHistory = await db('jobs')
    .where({ vehicle_id: vehicleId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')
    .limit(10)

  return {
    ...vehicle,
    serviceHistory,
  }
}

/**
 * Create a new vehicle
 */
export async function createVehicle(
  tenantId: string,
  input: CreateVehicleInput
) {
  const db = await getTenantDb(tenantId)

  // Verify customer exists
  const customer = await db('customers')
    .where({ id: input.customerId })
    .whereNull('deleted_at')
    .first()

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Check for duplicate VIN if provided
  if (input.vin) {
    const existingVin = await db('vehicles')
      .where({ vin: input.vin })
      .whereNull('deleted_at')
      .first()

    if (existingVin) {
      throw new Error('Vehicle with this VIN already exists')
    }
  }

  const [vehicle] = await db('vehicles')
    .insert({
      customer_id: input.customerId,
      vin: input.vin || null,
      year: input.year,
      make: input.make,
      model: input.model,
      trim: input.trim || null,
      color: input.color || null,
      license_plate: input.licensePlate || null,
      license_plate_state: input.licensePlateState || null,
      odometer: input.odometer || null,
      engine: input.engine || null,
      transmission: input.transmission || null,
      notes: input.notes || null,
    })
    .returning('*')

  logger.info('Vehicle created', { tenantId, vehicleId: vehicle.id, customerId: input.customerId })

  return vehicle
}

/**
 * Update a vehicle
 */
export async function updateVehicle(
  tenantId: string,
  vehicleId: string,
  input: UpdateVehicleInput
) {
  const db = await getTenantDb(tenantId)

  // Check if vehicle exists
  const existingVehicle = await db('vehicles')
    .where({ id: vehicleId })
    .whereNull('deleted_at')
    .first()

  if (!existingVehicle) {
    throw new Error('Vehicle not found')
  }

  // Check for duplicate VIN if updating VIN
  if (input.vin && input.vin !== existingVehicle.vin) {
    const duplicateVin = await db('vehicles')
      .where({ vin: input.vin })
      .whereNot({ id: vehicleId })
      .whereNull('deleted_at')
      .first()

    if (duplicateVin) {
      throw new Error('Another vehicle with this VIN already exists')
    }
  }

  // Build update object
  const updateData: any = {}

  if (input.vin !== undefined) updateData.vin = input.vin || null
  if (input.year !== undefined) updateData.year = input.year
  if (input.make !== undefined) updateData.make = input.make
  if (input.model !== undefined) updateData.model = input.model
  if (input.trim !== undefined) updateData.trim = input.trim || null
  if (input.color !== undefined) updateData.color = input.color || null
  if (input.licensePlate !== undefined)
    updateData.license_plate = input.licensePlate || null
  if (input.licensePlateState !== undefined)
    updateData.license_plate_state = input.licensePlateState || null
  if (input.odometer !== undefined) updateData.odometer = input.odometer || null
  if (input.engine !== undefined) updateData.engine = input.engine || null
  if (input.transmission !== undefined)
    updateData.transmission = input.transmission || null
  if (input.notes !== undefined) updateData.notes = input.notes || null

  updateData.updated_at = db.fn.now()

  const [vehicle] = await db('vehicles')
    .where({ id: vehicleId })
    .update(updateData)
    .returning('*')

  logger.info('Vehicle updated', { tenantId, vehicleId })

  return vehicle
}

/**
 * Delete a vehicle (soft delete)
 */
export async function deleteVehicle(tenantId: string, vehicleId: string) {
  const db = await getTenantDb(tenantId)

  // Check if vehicle exists
  const existingVehicle = await db('vehicles')
    .where({ id: vehicleId })
    .whereNull('deleted_at')
    .first()

  if (!existingVehicle) {
    throw new Error('Vehicle not found')
  }

  // Check for associated jobs
  const jobCount = await db('jobs')
    .where({ vehicle_id: vehicleId })
    .whereNull('deleted_at')
    .count('* as count')
    .first()

  if (jobCount && parseInt(jobCount.count as string, 10) > 0) {
    throw new Error(
      'Cannot delete vehicle with associated jobs. Delete or archive jobs first.'
    )
  }

  // Soft delete
  await db('vehicles')
    .where({ id: vehicleId })
    .update({
      deleted_at: db.fn.now(),
    })

  logger.info('Vehicle deleted', { tenantId, vehicleId })

  return { success: true }
}
