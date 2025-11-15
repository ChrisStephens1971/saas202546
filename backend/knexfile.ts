import { Knex } from 'knex'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '.env') })

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobile_mechanic_dev',
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './src/database/migrations',
      extension: 'ts'
    },
    seeds: {
      directory: './src/database/seeds',
      extension: 'ts'
    }
  },

  test: {
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobile_mechanic_test',
    pool: {
      min: 1,
      max: 5
    },
    migrations: {
      directory: './src/database/migrations',
      extension: 'ts'
    },
    seeds: {
      directory: './src/database/seeds',
      extension: 'ts'
    }
  },

  staging: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: './dist/database/migrations',
      extension: 'js'
    },
    seeds: {
      directory: './dist/database/seeds',
      extension: 'js'
    }
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 5,
      max: 50
    },
    migrations: {
      directory: './dist/database/migrations',
      extension: 'js',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './dist/database/seeds',
      extension: 'js'
    }
  }
}

export default config
