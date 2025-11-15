import { Request, Response } from 'express'
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from './customers.service'
import logger from '@config/logger'
import { z } from 'zod'

// Validation schemas
const createCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(50),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  postalCode: z.string().max(20).optional(),
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
})

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(50).optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  postalCode: z.string().max(20).optional(),
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
})

/**
 * GET /api/customers
 *
 * List customers with optional filters
 */
export async function listCustomersController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    const filters = {
      search: req.query.search as string,
      email: req.query.email as string,
      phone: req.query.phone as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    }

    const result = await listCustomers(tenantId, filters)

    res.status(200).json(result)
  } catch (error: any) {
    logger.error('List customers failed', { error: error.message })

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list customers',
    })
  }
}

/**
 * GET /api/customers/:id
 *
 * Get a single customer by ID
 */
export async function getCustomerController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const customerId = req.params.id

    const customer = await getCustomer(tenantId, customerId)

    res.status(200).json({ customer })
  } catch (error: any) {
    logger.error('Get customer failed', { error: error.message })

    if (error.message === 'Customer not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found',
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get customer',
    })
  }
}

/**
 * POST /api/customers
 *
 * Create a new customer
 */
export async function createCustomerController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!

    // Validate input
    const validatedInput = createCustomerSchema.parse(req.body)

    // Create customer
    const customer = await createCustomer(tenantId, validatedInput)

    res.status(201).json({
      message: 'Customer created successfully',
      customer,
    })
  } catch (error: any) {
    logger.error('Create customer failed', { error: error.message })

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors,
      })
      return
    }

    if (
      error.message.includes('already exists') ||
      error.message.includes('duplicate')
    ) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create customer',
    })
  }
}

/**
 * PUT /api/customers/:id
 *
 * Update a customer
 */
export async function updateCustomerController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const customerId = req.params.id

    // Validate input
    const validatedInput = updateCustomerSchema.parse(req.body)

    // Update customer
    const customer = await updateCustomer(tenantId, customerId, validatedInput)

    res.status(200).json({
      message: 'Customer updated successfully',
      customer,
    })
  } catch (error: any) {
    logger.error('Update customer failed', { error: error.message })

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

    if (
      error.message.includes('already exists') ||
      error.message.includes('duplicate')
    ) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      })
      return
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update customer',
    })
  }
}

/**
 * DELETE /api/customers/:id
 *
 * Delete a customer (soft delete)
 */
export async function deleteCustomerController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.tenantId!
    const customerId = req.params.id

    await deleteCustomer(tenantId, customerId)

    res.status(200).json({
      message: 'Customer deleted successfully',
    })
  } catch (error: any) {
    logger.error('Delete customer failed', { error: error.message })

    if (error.message === 'Customer not found') {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found',
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
      message: 'Failed to delete customer',
    })
  }
}
