import { Router } from 'express'
import {
  listCustomersController,
  getCustomerController,
  createCustomerController,
  updateCustomerController,
  deleteCustomerController,
} from './customers.controller'
import { authenticate } from '@middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/customers
 * List customers with optional filters
 */
router.get('/', listCustomersController)

/**
 * POST /api/customers
 * Create a new customer
 */
router.post('/', createCustomerController)

/**
 * GET /api/customers/:id
 * Get a single customer by ID
 */
router.get('/:id', getCustomerController)

/**
 * PUT /api/customers/:id
 * Update a customer
 */
router.put('/:id', updateCustomerController)

/**
 * DELETE /api/customers/:id
 * Delete a customer (soft delete)
 */
router.delete('/:id', deleteCustomerController)

export default router
