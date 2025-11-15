import { Knex } from 'knex'

/**
 * Migration: Create tenant schema template
 *
 * This migration creates the schema structure for a single tenant.
 * It will be executed for each new tenant when they sign up.
 *
 * Note: This migration should NOT be run directly. It serves as a template.
 * Use the createTenantSchema() function to provision tenant schemas.
 */

export async function createTenantSchema(knex: Knex, tenantId: string): Promise<void> {
  const schema = `tenant_${tenantId}`

  // Create the schema
  await knex.raw(`CREATE SCHEMA IF NOT EXISTS ${schema}`)

  // Set search path for this transaction
  await knex.raw(`SET search_path TO ${schema}`)

  // ===========================
  // Customers
  // ===========================
  await knex.schema.withSchema(schema).createTable('customers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('first_name', 100).notNullable()
    table.string('last_name', 100).notNullable()
    table.string('email', 255)
    table.string('phone', 50).notNullable()
    table.string('address_line1', 255)
    table.string('address_line2', 255)
    table.string('city', 100)
    table.string('state', 50)
    table.string('postal_code', 20)
    table.text('notes')
    table.jsonb('custom_fields').defaultTo('{}')
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('email')
    table.index('phone')
  })

  // ===========================
  // Vehicles
  // ===========================
  await knex.schema.withSchema(schema).createTable('vehicles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('customer_id').notNullable().references('id').inTable(`${schema}.customers`).onDelete('CASCADE')

    table.string('vin', 17).unique()
    table.string('year', 4).notNullable()
    table.string('make', 100).notNullable()
    table.string('model', 100).notNullable()
    table.string('trim', 100)
    table.string('color', 50)
    table.string('license_plate', 50)
    table.string('license_plate_state', 2)
    table.integer('odometer')
    table.string('engine', 100)
    table.string('transmission', 100)
    table.text('notes')

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('customer_id')
    table.index('vin')
    table.index('license_plate')
  })

  // ===========================
  // Job Templates
  // ===========================
  await knex.schema.withSchema(schema).createTable('job_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 255).notNullable()
    table.string('slug', 255).notNullable().unique()
    table.text('description')
    table.string('category', 100) // 'maintenance', 'repair', 'diagnostic', etc.

    // Pricing
    table.decimal('default_labor_minutes', 10, 2)
    table.decimal('default_labor_rate', 10, 2)
    table.decimal('default_parts_markup_percent', 5, 2).defaultTo(30)

    // Template structure
    table.jsonb('steps').defaultTo('[]') // Array of step objects
    table.jsonb('required_parts').defaultTo('[]') // Array of part specifications
    table.jsonb('checklist_items').defaultTo('[]') // Array of inspection items

    table.boolean('is_active').defaultTo(true)
    table.boolean('is_global').defaultTo(false) // System-provided vs custom

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('category')
    table.index('slug')
  })

  // ===========================
  // Jobs
  // ===========================
  await knex.schema.withSchema(schema).createTable('jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('customer_id').notNullable().references('id').inTable(`${schema}.customers`)
    table.uuid('vehicle_id').notNullable().references('id').inTable(`${schema}.vehicles`)
    table.uuid('job_template_id').nullable().references('id').inTable(`${schema}.job_templates`)
    table.uuid('assigned_mechanic_id').nullable() // Foreign key to public.users

    // Job details
    table.string('job_number', 50).notNullable().unique()
    table.string('title', 255).notNullable()
    table.text('description')
    table.enum('status', [
      'draft',
      'estimate',
      'scheduled',
      'in_progress',
      'completed',
      'cancelled',
      'on_hold'
    ]).defaultTo('draft')

    // Scheduling
    table.timestamp('scheduled_start')
    table.timestamp('scheduled_end')
    table.timestamp('actual_start')
    table.timestamp('actual_end')
    table.integer('estimated_duration_minutes')

    // Location
    table.string('service_location_address', 500)
    table.decimal('service_location_lat', 10, 7)
    table.decimal('service_location_lng', 10, 7)

    // Pricing
    table.decimal('labor_minutes', 10, 2).defaultTo(0)
    table.decimal('labor_rate', 10, 2).defaultTo(0)
    table.decimal('parts_total', 10, 2).defaultTo(0)
    table.decimal('tax_rate', 5, 2).defaultTo(0)
    table.decimal('discount_amount', 10, 2).defaultTo(0)
    table.decimal('total', 10, 2).defaultTo(0)

    // Job-in-a-Box data
    table.jsonb('template_snapshot').defaultTo('{}') // Frozen copy of template at creation
    table.jsonb('completed_steps').defaultTo('[]')
    table.jsonb('checklist_results').defaultTo('[]')

    table.text('notes')

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('customer_id')
    table.index('vehicle_id')
    table.index('status')
    table.index('scheduled_start')
    table.index('job_number')
  })

  // ===========================
  // Parts Catalog
  // ===========================
  await knex.schema.withSchema(schema).createTable('parts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('part_number', 100).notNullable()
    table.string('name', 255).notNullable()
    table.text('description')
    table.string('category', 100)
    table.string('manufacturer', 100)

    // Pricing
    table.decimal('cost', 10, 2).defaultTo(0)
    table.decimal('price', 10, 2).defaultTo(0)
    table.decimal('markup_percent', 5, 2).defaultTo(30)

    // Vendor integration
    table.string('vendor_sku', 100)
    table.string('vendor_name', 100)
    table.jsonb('vendor_data').defaultTo('{}')

    table.boolean('is_active').defaultTo(true)

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('part_number')
    table.index('category')
    table.index('vendor_sku')
  })

  // ===========================
  // Inventory Items
  // ===========================
  await knex.schema.withSchema(schema).createTable('inventory_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('part_id').notNullable().references('id').inTable(`${schema}.parts`)
    table.string('location', 100).notNullable() // 'Van #1', 'Shop', etc.
    table.integer('quantity').defaultTo(0)
    table.integer('min_quantity').defaultTo(0) // Replenishment threshold
    table.integer('max_quantity').defaultTo(0)
    table.timestamp('last_restocked_at')

    table.timestamps(true, true)

    table.unique(['part_id', 'location'])
    table.index('location')
  })

  // ===========================
  // Job Parts (parts used in jobs)
  // ===========================
  await knex.schema.withSchema(schema).createTable('job_parts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('job_id').notNullable().references('id').inTable(`${schema}.jobs`).onDelete('CASCADE')
    table.uuid('part_id').notNullable().references('id').inTable(`${schema}.parts`)

    table.integer('quantity').notNullable().defaultTo(1)
    table.decimal('unit_cost', 10, 2).notNullable()
    table.decimal('unit_price', 10, 2).notNullable()
    table.decimal('total', 10, 2).notNullable()

    table.boolean('is_customer_supplied').defaultTo(false)
    table.text('notes')

    table.timestamps(true, true)

    table.index('job_id')
    table.index('part_id')
  })

  // ===========================
  // Trust Artifacts
  // ===========================
  await knex.schema.withSchema(schema).createTable('trust_artifacts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('job_id').nullable().references('id').inTable(`${schema}.jobs`).onDelete('CASCADE')
    table.uuid('vehicle_id').nullable().references('id').inTable(`${schema}.vehicles`)

    table.enum('type', ['photo', 'video', 'inspection', 'summary']).notNullable()
    table.string('title', 255)
    table.text('description')

    // File storage
    table.string('file_url', 500)
    table.string('thumbnail_url', 500)
    table.string('mime_type', 100)
    table.bigInteger('file_size')

    // Inspection data
    table.jsonb('inspection_data').defaultTo('{}')

    // Metadata
    table.timestamp('captured_at').defaultTo(knex.fn.now())
    table.string('captured_by_user_id', 255) // User who captured it

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('job_id')
    table.index('vehicle_id')
    table.index('type')
  })

  // ===========================
  // Route Plans
  // ===========================
  await knex.schema.withSchema(schema).createTable('route_plans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('assigned_mechanic_id').notNullable() // Foreign key to public.users
    table.date('route_date').notNullable()
    table.jsonb('stops').defaultTo('[]') // Ordered array of job IDs and part pickup locations
    table.decimal('total_distance_miles', 10, 2).defaultTo(0)
    table.integer('estimated_duration_minutes').defaultTo(0)
    table.enum('status', ['draft', 'active', 'completed', 'cancelled']).defaultTo('draft')

    table.timestamps(true, true)

    table.index('assigned_mechanic_id')
    table.index('route_date')
  })

  // ===========================
  // Invoices
  // ===========================
  await knex.schema.withSchema(schema).createTable('invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('customer_id').notNullable().references('id').inTable(`${schema}.customers`)
    table.string('invoice_number', 50).notNullable().unique()

    // Linked jobs
    table.specificType('job_ids', 'uuid[]').defaultTo('{}') // Array of job UUIDs

    // Amounts
    table.decimal('subtotal', 10, 2).notNullable()
    table.decimal('tax_amount', 10, 2).defaultTo(0)
    table.decimal('discount_amount', 10, 2).defaultTo(0)
    table.decimal('total', 10, 2).notNullable()
    table.decimal('amount_paid', 10, 2).defaultTo(0)
    table.decimal('amount_due', 10, 2).notNullable()

    table.enum('status', ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']).defaultTo('draft')

    table.date('issue_date').notNullable()
    table.date('due_date').notNullable()
    table.timestamp('paid_at')

    table.text('notes')
    table.text('terms')

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('customer_id')
    table.index('invoice_number')
    table.index('status')
  })

  // ===========================
  // Payments
  // ===========================
  await knex.schema.withSchema(schema).createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('invoice_id').notNullable().references('id').inTable(`${schema}.invoices`)
    table.uuid('customer_id').notNullable().references('id').inTable(`${schema}.customers`)

    table.decimal('amount', 10, 2).notNullable()
    table.enum('method', ['cash', 'check', 'card', 'stripe', 'other']).notNullable()
    table.enum('status', ['pending', 'completed', 'failed', 'refunded']).defaultTo('completed')

    table.date('payment_date').notNullable()
    table.string('reference_number', 100)
    table.string('stripe_payment_intent_id', 255)
    table.text('notes')

    table.timestamps(true, true)

    table.index('invoice_id')
    table.index('customer_id')
    table.index('payment_date')
  })

  // ===========================
  // Memberships
  // ===========================
  await knex.schema.withSchema(schema).createTable('memberships', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('customer_id').notNullable().references('id').inTable(`${schema}.customers`)

    table.string('plan_name', 255).notNullable()
    table.decimal('monthly_fee', 10, 2).notNullable()
    table.integer('included_services_per_month').defaultTo(0)
    table.decimal('discount_percent', 5, 2).defaultTo(0)

    table.enum('status', ['active', 'paused', 'cancelled', 'expired']).defaultTo('active')
    table.date('start_date').notNullable()
    table.date('end_date')
    table.date('next_billing_date')

    table.integer('services_used_this_month').defaultTo(0)
    table.date('usage_period_start')

    table.timestamps(true, true)

    table.index('customer_id')
    table.index('status')
  })

  // ===========================
  // Fleets (for fleet customers)
  // ===========================
  await knex.schema.withSchema(schema).createTable('fleets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 255).notNullable()
    table.uuid('customer_id').nullable().references('id').inTable(`${schema}.customers`) // Optional link to customer

    table.string('contact_name', 255)
    table.string('contact_email', 255)
    table.string('contact_phone', 50)

    table.text('notes')

    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    table.index('customer_id')
  })

  // Add fleet_id to vehicles
  await knex.schema.withSchema(schema).table('vehicles', (table) => {
    table.uuid('fleet_id').nullable().references('id').inTable(`${schema}.fleets`)
    table.index('fleet_id')
  })

  // Reset search path
  await knex.raw('SET search_path TO public')
}

export async function dropTenantSchema(knex: Knex, tenantId: string): Promise<void> {
  const schema = `tenant_${tenantId}`
  await knex.raw(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
}

// Stub migration functions (not meant to be run directly)
export async function up(_knex: Knex): Promise<void> {
  // This migration is a template only
  // Use createTenantSchema() function to provision tenants
}

export async function down(_knex: Knex): Promise<void> {
  // This migration is a template only
}
