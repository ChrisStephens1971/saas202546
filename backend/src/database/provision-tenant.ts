import { db } from '@config/database'
import { createTenantSchema, dropTenantSchema } from './migrations/20250101000002_create_tenant_schema_template'
import logger from '@config/logger'

/**
 * Provision a new tenant schema
 *
 * This function:
 * 1. Creates a new schema for the tenant
 * 2. Runs all tenant-specific migrations in that schema
 * 3. Optionally seeds demo data
 *
 * @param tenantId - UUID of the tenant from the public.tenants table
 * @param seedDemo - Whether to seed demo data (default: false)
 */
export async function provisionTenant(
  tenantId: string,
  seedDemo: boolean = false
): Promise<void> {
  const schema = `tenant_${tenantId}`

  try {
    logger.info(`Provisioning tenant schema: ${schema}`)

    // Create the tenant schema with all tables
    await createTenantSchema(db, tenantId)

    logger.info(`✅ Tenant schema created: ${schema}`)

    // TODO: Optionally seed demo data
    if (seedDemo) {
      logger.info(`Seeding demo data for ${schema}`)
      // await seedTenantDemoData(db, tenantId)
    }

    logger.info(`🎉 Tenant provisioning complete: ${schema}`)
  } catch (error) {
    logger.error(`Failed to provision tenant ${tenantId}`, error)
    throw error
  }
}

/**
 * Deprovision a tenant schema (use with caution!)
 *
 * @param tenantId - UUID of the tenant
 */
export async function deprovisionTenant(tenantId: string): Promise<void> {
  const schema = `tenant_${tenantId}`

  try {
    logger.warn(`⚠️  Deprovisioning tenant schema: ${schema}`)

    await dropTenantSchema(db, tenantId)

    logger.info(`✅ Tenant schema dropped: ${schema}`)
  } catch (error) {
    logger.error(`Failed to deprovision tenant ${tenantId}`, error)
    throw error
  }
}

/**
 * Check if a tenant schema exists
 */
export async function tenantSchemaExists(tenantId: string): Promise<boolean> {
  const schema = `tenant_${tenantId}`

  const result = await db.raw(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`,
    [schema]
  )

  return result.rows.length > 0
}

/**
 * List all tenant schemas
 */
export async function listTenantSchemas(): Promise<string[]> {
  const result = await db.raw(`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
    ORDER BY schema_name
  `)

  return result.rows.map((row: any) => row.schema_name)
}

// CLI usage if run directly
if (require.main === module) {
  const command = process.argv[2]
  const tenantId = process.argv[3]

  if (!command || !tenantId) {
    console.log('Usage:')
    console.log('  tsx src/database/provision-tenant.ts provision <tenant-id> [--seed]')
    console.log('  tsx src/database/provision-tenant.ts deprovision <tenant-id>')
    console.log('  tsx src/database/provision-tenant.ts list')
    process.exit(1)
  }

  const seedDemo = process.argv.includes('--seed')

  ;(async () => {
    try {
      switch (command) {
        case 'provision':
          await provisionTenant(tenantId, seedDemo)
          break
        case 'deprovision':
          await deprovisionTenant(tenantId)
          break
        case 'list':
          const schemas = await listTenantSchemas()
          console.log('Tenant schemas:', schemas)
          break
        default:
          console.error(`Unknown command: ${command}`)
          process.exit(1)
      }

      await db.destroy()
      process.exit(0)
    } catch (error) {
      console.error('Error:', error)
      await db.destroy()
      process.exit(1)
    }
  })()
}
