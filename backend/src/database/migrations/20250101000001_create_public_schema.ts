import { Knex } from 'knex'

/**
 * Migration: Create public schema tables
 *
 * This migration creates the shared public schema tables that are not tenant-specific:
 * - tenants: stores tenant/account information
 * - users: stores all users across all tenants with tenant_id foreign key
 */

export async function up(knex: Knex): Promise<void> {
  // Create tenants table
  await knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('slug', 100).notNullable().unique() // subdomain or URL slug
    table.string('business_name', 255).notNullable()
    table.string('contact_email', 255).notNullable()
    table.string('contact_phone', 50)

    // Subscription and billing
    table.enum('plan', ['free', 'starter', 'professional', 'enterprise']).defaultTo('free')
    table.enum('status', ['active', 'suspended', 'cancelled', 'trial']).defaultTo('trial')
    table.timestamp('trial_ends_at')
    table.timestamp('subscription_starts_at')
    table.timestamp('subscription_ends_at')

    // Metadata
    table.jsonb('settings').defaultTo('{}')
    table.string('timezone', 100).defaultTo('America/New_York')
    table.string('currency', 3).defaultTo('USD')

    // Timestamps
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()
  })

  // Create users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')

    // Auth
    table.string('email', 255).notNullable()
    table.string('password_hash', 255).notNullable()
    table.enum('role', ['owner', 'admin', 'mechanic', 'dispatcher']).defaultTo('mechanic')

    // Profile
    table.string('full_name', 255).notNullable()
    table.string('phone', 50)
    table.string('avatar_url', 500)

    // Status
    table.boolean('is_active').defaultTo(true)
    table.boolean('email_verified').defaultTo(false)
    table.timestamp('email_verified_at')
    table.timestamp('last_login_at')

    // Timestamps
    table.timestamps(true, true)
    table.timestamp('deleted_at').nullable()

    // Indexes
    table.unique(['tenant_id', 'email']) // Email unique per tenant
    table.index('tenant_id')
    table.index('email')
  })

  // Create refresh_tokens table for JWT refresh tokens
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('token', 500).notNullable().unique()
    table.timestamp('expires_at').notNullable()
    table.boolean('revoked').defaultTo(false)
    table.timestamps(true, true)

    table.index('user_id')
    table.index('token')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens')
  await knex.schema.dropTableIfExists('users')
  await knex.schema.dropTableIfExists('tenants')
}
