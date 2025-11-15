# Mobile Mechanic Empire - Backend

Node.js + TypeScript backend API for Mobile Mechanic Empire.

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.3
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL 15+ (multi-tenant via schema-per-tenant)
- **ORM**: Knex.js (query builder + migrations)
- **Auth**: JWT + bcrypt
- **Cache**: Redis (ioredis)
- **Storage**: Azure Blob Storage
- **Logging**: Winston
- **Validation**: Zod
- **Testing**: Jest + Supertest

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for caching)
- Azure Storage Account (or Azurite for local development)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your local database credentials
```

### Database Setup

```bash
# Run public schema migrations (tenants, users)
npm run migrate:latest

# Provision a demo tenant (creates tenant_<id> schema)
npm run provision-tenant <tenant-id> --seed
```

### Development

```bash
# Start dev server with hot reload
npm run dev

# Server runs on http://localhost:3001
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration (env, database, logger)
│   ├── database/        # Migrations, seeds, provisioning
│   ├── middleware/      # Express middleware (auth, tenant, validation)
│   ├── modules/         # Business logic modules
│   │   ├── auth/        # Authentication
│   │   ├── customers/   # Customer management
│   │   ├── jobs/        # Job management
│   │   ├── parts/       # Parts & inventory
│   │   ├── trust/       # Trust engine (photos/videos)
│   │   └── ...
│   ├── integrations/    # External APIs (Stripe, Google Maps, etc.)
│   ├── lib/             # Shared utilities
│   ├── types/           # TypeScript type definitions
│   ├── workers/         # Background jobs (optional)
│   ├── app.ts           # Express app factory
│   └── server.ts        # HTTP server entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test fixtures and helpers
├── knexfile.ts          # Knex configuration
├── tsconfig.json        # TypeScript config
└── package.json
```

## Multi-Tenant Architecture

This application uses **schema-per-tenant** isolation in PostgreSQL:

- **Public schema**: Shared tables (`tenants`, `users`, `refresh_tokens`)
- **Tenant schemas**: Isolated schemas per tenant (`tenant_<id>`)
  - Each tenant gets: `customers`, `vehicles`, `jobs`, `parts`, `invoices`, etc.

### Provisioning a New Tenant

```bash
# Manually provision a tenant
tsx src/database/provision-tenant.ts provision <tenant-id> --seed

# Or via npm script
npm run provision-tenant <tenant-id> -- --seed
```

### Tenant Provisioning Flow

1. User signs up → creates record in `public.tenants`
2. System calls `provisionTenant(tenantId)`
3. Creates schema `tenant_<id>` with all tables
4. Optionally seeds demo data

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (includes DB)

### Authentication

- `POST /api/auth/register` - Register new tenant + owner
- `POST /api/auth/login` - Login (email + password)
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout (revoke refresh token)

### Customers

- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/:id` - Get customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Jobs

- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job
- `PATCH /api/jobs/:id/status` - Update job status
- `DELETE /api/jobs/:id` - Cancel job

*(Full API documentation will be in Swagger/OpenAPI)*

## Environment Variables

See `.env.example` for all available variables.

Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (256-bit)
- `REFRESH_TOKEN_SECRET` - Refresh token secret
- `AZURE_STORAGE_CONNECTION_STRING` - Azure Blob Storage
- `STRIPE_SECRET_KEY` - Stripe API key
- `GOOGLE_MAPS_API_KEY` - Google Maps API key

## Scripts

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run all tests
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests
npm run test:watch       # Run tests in watch mode
npm run migrate:latest   # Run latest migrations
npm run migrate:rollback # Rollback last migration
npm run seed:demo        # Seed demo data
npm run lint             # Lint code
npm run lint:fix         # Fix linting errors
npm run format           # Format code with Prettier
```

## Database Migrations

Migrations are managed with Knex.js.

```bash
# Create a new migration
npx knex migrate:make migration_name

# Run migrations
npm run migrate:latest

# Rollback last migration
npm run migrate:rollback

# Check migration status
npx knex migrate:status
```

## Testing

The project has **37 unit tests** and integration tests that validate core functionality.

### Quick Test (No Database Required)

```bash
# Run unit tests only (fastest, no external dependencies)
npm test -- --testPathIgnorePatterns=integration
```

**Expected**: 37 tests pass in ~7 seconds

### Full Test Suite (Requires Database)

**Prerequisites**:
- PostgreSQL 15+ running on `localhost:5432`
- Redis running on `localhost:6379` (optional for integration tests)
- Test database: `mobile_mechanic_test`

**Using Docker**:
```bash
# Start test databases
docker run -d --name postgres-test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mechanic_test \
  -p 5432:5432 \
  postgres:15-alpine

docker run -d --name redis-test \
  -p 6379:6379 \
  redis:7-alpine

# Run migrations
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mechanic_test"
npm run migrate:latest

# Run all tests (unit + integration)
npm test

# Cleanup
docker stop postgres-test redis-test
docker rm postgres-test redis-test
```

### Unit Tests

Located in `tests/unit/`, test individual functions and modules in isolation.

**Coverage**:
- Password utilities (hashing, validation)
- Jobs module (status transitions, calculations)
- Parts & Inventory (stock levels, allocation)

```bash
npm run test:unit
```

**No external dependencies** - runs purely in-memory.

### Integration Tests

Located in `tests/integration/`, test API endpoints end-to-end.

**Requires**: PostgreSQL and Redis containers running

```bash
# Set test environment variables
export NODE_ENV=test
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mechanic_test"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="test-secret-key"
export REFRESH_TOKEN_SECRET="test-refresh-secret"

# Run integration tests
npm run test:integration
```

### Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# View report
open coverage/lcov-report/index.html
```

### CI/CD Testing

Before pushing code, run the same tests that CI runs:

```bash
# Quick validation (5 minutes)
npm ci
npm run lint
npm run type-check
npm test -- --testPathIgnorePatterns=integration
npm run build

# Full CI simulation (15 minutes, requires Docker)
# See CI_VALIDATION_CHECKLIST.md for complete guide
```

## Deployment

### Azure App Service (Recommended)

1. Build the project: `npm run build`
2. Deploy `dist/` folder to App Service
3. Set environment variables in App Service Configuration
4. Run migrations: `npm run migrate:latest`

### Docker (Optional)

```bash
# Build image
docker build -t mobile-mechanic-api .

# Run container
docker run -p 3001:3001 --env-file .env.local mobile-mechanic-api
```

## Security

- Helmet.js for security headers
- CORS configured for frontend origin
- JWT authentication with short-lived access tokens (15m)
- Refresh tokens with 7-day expiration
- Bcrypt password hashing (10 rounds)
- Rate limiting on auth endpoints
- SQL injection protection via Knex parameterized queries

## Logging

Winston logger with structured JSON logging.

- **Development**: Colorized console output
- **Production**: JSON logs to files (`logs/error.log`, `logs/combined.log`)

Access via:

```typescript
import logger from '@config/logger'

logger.info('Message', { key: 'value' })
logger.error('Error occurred', error)
```

## Next Steps

- [ ] Implement authentication module
- [ ] Create customer CRUD endpoints
- [ ] Implement job template engine
- [ ] Set up Azure Blob Storage for trust artifacts
- [ ] Add Stripe payment integration
- [ ] Set up CI/CD pipeline
- [ ] Write comprehensive tests
- [ ] Deploy to Azure staging environment

## License

Proprietary - Mobile Mechanic Empire
