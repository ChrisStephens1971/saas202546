import { getTenantDb } from '@config/database'
import logger from '@config/logger'

export interface CreateCustomerInput {
  firstName: string
  lastName: string
  email?: string
  phone: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  notes?: string
  customFields?: Record<string, any>
}

export interface UpdateCustomerInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  notes?: string
  customFields?: Record<string, any>
}

export interface CustomerFilters {
  search?: string
  email?: string
  phone?: string
  limit?: number
  offset?: number
}

/**
 * List customers for a tenant
 */
export async function listCustomers(
  tenantId: string,
  filters: CustomerFilters = {}
) {
  const db = await getTenantDb(tenantId)
  const { search, email, phone, limit = 50, offset = 0 } = filters

  let query = db('customers')
    .select('*')
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')

  // Search filter (name, email, phone)
  if (search) {
    query = query.where((builder) => {
      builder
        .where('first_name', 'ilike', `%${search}%`)
        .orWhere('last_name', 'ilike', `%${search}%`)
        .orWhere('email', 'ilike', `%${search}%`)
        .orWhere('phone', 'ilike', `%${search}%`)
    })
  }

  // Email filter
  if (email) {
    query = query.where('email', 'ilike', `%${email}%`)
  }

  // Phone filter
  if (phone) {
    query = query.where('phone', 'ilike', `%${phone}%`)
  }

  // Pagination
  query = query.limit(limit).offset(offset)

  const customers = await query

  // Get total count for pagination
  const countQuery = db('customers').whereNull('deleted_at')
  if (search) {
    countQuery.where((builder) => {
      builder
        .where('first_name', 'ilike', `%${search}%`)
        .orWhere('last_name', 'ilike', `%${search}%`)
        .orWhere('email', 'ilike', `%${search}%`)
        .orWhere('phone', 'ilike', `%${search}%`)
    })
  }
  if (email) {
    countQuery.where('email', 'ilike', `%${email}%`)
  }
  if (phone) {
    countQuery.where('phone', 'ilike', `%${phone}%`)
  }

  const [{ count }] = await countQuery.count('* as count')

  return {
    data: customers,
    pagination: {
      total: parseInt(count as string, 10),
      limit,
      offset,
      hasMore: offset + customers.length < parseInt(count as string, 10),
    },
  }
}

/**
 * Get a single customer by ID
 */
export async function getCustomer(tenantId: string, customerId: string) {
  const db = await getTenantDb(tenantId)

  const customer = await db('customers')
    .where({ id: customerId })
    .whereNull('deleted_at')
    .first()

  if (!customer) {
    throw new Error('Customer not found')
  }

  // Get associated vehicles
  const vehicles = await db('vehicles')
    .where({ customer_id: customerId })
    .whereNull('deleted_at')

  // Get recent jobs
  const recentJobs = await db('jobs')
    .where({ customer_id: customerId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')
    .limit(5)

  return {
    ...customer,
    vehicles,
    recentJobs,
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(
  tenantId: string,
  input: CreateCustomerInput
) {
  const db = await getTenantDb(tenantId)

  // Check for duplicate phone number
  const existingCustomer = await db('customers')
    .where({ phone: input.phone })
    .whereNull('deleted_at')
    .first()

  if (existingCustomer) {
    throw new Error('Customer with this phone number already exists')
  }

  // Check for duplicate email if provided
  if (input.email) {
    const existingEmail = await db('customers')
      .where({ email: input.email })
      .whereNull('deleted_at')
      .first()

    if (existingEmail) {
      throw new Error('Customer with this email already exists')
    }
  }

  const [customer] = await db('customers')
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email || null,
      phone: input.phone,
      address_line1: input.addressLine1 || null,
      address_line2: input.addressLine2 || null,
      city: input.city || null,
      state: input.state || null,
      postal_code: input.postalCode || null,
      notes: input.notes || null,
      custom_fields: JSON.stringify(input.customFields || {}),
    })
    .returning('*')

  logger.info('Customer created', { tenantId, customerId: customer.id })

  return customer
}

/**
 * Update a customer
 */
export async function updateCustomer(
  tenantId: string,
  customerId: string,
  input: UpdateCustomerInput
) {
  const db = await getTenantDb(tenantId)

  // Check if customer exists
  const existingCustomer = await db('customers')
    .where({ id: customerId })
    .whereNull('deleted_at')
    .first()

  if (!existingCustomer) {
    throw new Error('Customer not found')
  }

  // Check for duplicate phone if updating phone
  if (input.phone && input.phone !== existingCustomer.phone) {
    const duplicatePhone = await db('customers')
      .where({ phone: input.phone })
      .whereNot({ id: customerId })
      .whereNull('deleted_at')
      .first()

    if (duplicatePhone) {
      throw new Error('Another customer with this phone number already exists')
    }
  }

  // Check for duplicate email if updating email
  if (input.email && input.email !== existingCustomer.email) {
    const duplicateEmail = await db('customers')
      .where({ email: input.email })
      .whereNot({ id: customerId })
      .whereNull('deleted_at')
      .first()

    if (duplicateEmail) {
      throw new Error('Another customer with this email already exists')
    }
  }

  // Build update object
  const updateData: any = {}

  if (input.firstName !== undefined) updateData.first_name = input.firstName
  if (input.lastName !== undefined) updateData.last_name = input.lastName
  if (input.email !== undefined) updateData.email = input.email || null
  if (input.phone !== undefined) updateData.phone = input.phone
  if (input.addressLine1 !== undefined)
    updateData.address_line1 = input.addressLine1 || null
  if (input.addressLine2 !== undefined)
    updateData.address_line2 = input.addressLine2 || null
  if (input.city !== undefined) updateData.city = input.city || null
  if (input.state !== undefined) updateData.state = input.state || null
  if (input.postalCode !== undefined)
    updateData.postal_code = input.postalCode || null
  if (input.notes !== undefined) updateData.notes = input.notes || null
  if (input.customFields !== undefined)
    updateData.custom_fields = JSON.stringify(input.customFields)

  updateData.updated_at = db.fn.now()

  const [customer] = await db('customers')
    .where({ id: customerId })
    .update(updateData)
    .returning('*')

  logger.info('Customer updated', { tenantId, customerId })

  return customer
}

/**
 * Delete a customer (soft delete)
 */
export async function deleteCustomer(tenantId: string, customerId: string) {
  const db = await getTenantDb(tenantId)

  // Check if customer exists
  const existingCustomer = await db('customers')
    .where({ id: customerId })
    .whereNull('deleted_at')
    .first()

  if (!existingCustomer) {
    throw new Error('Customer not found')
  }

  // Check for associated vehicles
  const vehicleCount = await db('vehicles')
    .where({ customer_id: customerId })
    .whereNull('deleted_at')
    .count('* as count')
    .first()

  if (vehicleCount && parseInt(vehicleCount.count as string, 10) > 0) {
    throw new Error(
      'Cannot delete customer with associated vehicles. Delete vehicles first.'
    )
  }

  // Check for associated jobs
  const jobCount = await db('jobs')
    .where({ customer_id: customerId })
    .whereNull('deleted_at')
    .count('* as count')
    .first()

  if (jobCount && parseInt(jobCount.count as string, 10) > 0) {
    throw new Error(
      'Cannot delete customer with associated jobs. Delete or archive jobs first.'
    )
  }

  // Soft delete
  await db('customers')
    .where({ id: customerId })
    .update({
      deleted_at: db.fn.now(),
    })

  logger.info('Customer deleted', { tenantId, customerId })

  return { success: true }
}
