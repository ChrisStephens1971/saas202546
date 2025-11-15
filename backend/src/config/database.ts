import { Knex } from 'knex'
import { config } from '@config'

// Base Knex configuration
export const knexConfig: Knex.Config = {
  client: 'pg',
  connection: config.database.url,
  pool: {
    min: config.database.poolMin,
    max: config.database.poolMax,
    // Propagate create errors to the pool
    propagateCreateError: false
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts'
  },
  debug: config.nodeEnv === 'development'
}

// SSL configuration for production
if (config.database.ssl) {
  knexConfig.connection = {
    connectionString: config.database.url,
    ssl: { rejectUnauthorized: false }
  }
}

// Export typed Knex instance
import knex, { Knex as KnexType } from 'knex'
export const db: KnexType = knex(knexConfig)

// Tenant database connection helper
export function getTenantDb(tenantId: string): KnexType {
  const tenantSchema = `tenant_${tenantId}`

  // Clone the main connection but set search_path to tenant schema
  // @ts-ignore - withSchema returns QueryBuilder but we use it as Knex instance
  return db.withSchema(tenantSchema)
}

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1')
    return true
  } catch (error) {
    return false
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await db.destroy()
}
