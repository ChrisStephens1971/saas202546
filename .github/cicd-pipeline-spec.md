# CI/CD Pipeline Specification

**Project**: Mobile Mechanic Empire
**Date**: 2025-11-15
**Status**: Active

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CI/CD Pipeline                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PR/Push to main                                                    │
│       ↓                                                             │
│  ┌─────────────┐                                                   │
│  │   Stage 1   │  Lint (ESLint/Prettier)                          │
│  │    Lint     │  - Backend TypeScript                             │
│  └─────────────┘                                                   │
│       ↓                                                             │
│  ┌─────────────┐                                                   │
│  │   Stage 2   │  Unit Tests (Jest)                               │
│  │    Test     │  - Backend services                               │
│  └─────────────┘  - Backend controllers                            │
│       ↓                                                             │
│  ┌─────────────┐                                                   │
│  │   Stage 3   │  Integration Tests (Supertest)                   │
│  │  Int Tests  │  - API endpoints with test DB                    │
│  └─────────────┘                                                   │
│       ↓                                                             │
│  ┌─────────────┐                                                   │
│  │   Stage 4   │  Build Artifacts                                 │
│  │    Build    │  - Backend: TypeScript → JavaScript              │
│  └─────────────┘  - Web Admin: Vite build (future)                │
│       ↓                                                             │
│  ┌─────────────┐                                                   │
│  │   Stage 5   │  Deploy to Staging (main branch only)            │
│  │   Staging   │  - Azure App Service                              │
│  └─────────────┘  - Run migrations                                 │
│       ↓           - Smoke tests                                     │
│  ┌─────────────┐                                                   │
│  │   Stage 6   │  Manual Approval Required                        │
│  │ Production  │  - Promote staging → production                   │
│  └─────────────┘  - Blue/green deployment                          │
│                   - Post-deploy validation                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage Definitions

### Stage 1: Lint
**Purpose**: Code quality and style enforcement
**Jobs**:
- **Backend Lint**
  - ESLint for TypeScript
  - Prettier formatting check
  - Working directory: `backend/`
  - Fail fast on errors

**Success Criteria**: No linting errors

---

### Stage 2: Unit Tests
**Purpose**: Validate individual components in isolation
**Jobs**:
- **Backend Unit Tests**
  - Framework: Jest
  - Coverage target: 80% (aspirational)
  - Test files: `backend/src/**/*.test.ts`
  - No external dependencies (DB, Redis, Azure)

**Success Criteria**: All tests pass, coverage threshold met

---

### Stage 3: Integration Tests
**Purpose**: Validate API endpoints with real dependencies
**Jobs**:
- **Backend Integration Tests**
  - Framework: Jest + Supertest
  - Test files: `backend/tests/integration/**/*.test.ts`
  - Services: PostgreSQL (GitHub Actions service), Redis (optional)
  - Database: Test database with migrations applied
  - Cleanup: Tear down test data after run

**Success Criteria**: All integration tests pass

---

### Stage 4: Build
**Purpose**: Compile and package artifacts for deployment
**Jobs**:
- **Backend Build**
  - TypeScript compilation: `tsc`
  - Path alias resolution: `tsc-alias`
  - Output: `backend/dist/`
  - Artifact upload: `dist/` + `package.json` + `package-lock.json`

- **Web Admin Build** (future)
  - Vite build: `npm run build`
  - Output: `web-admin/dist/`
  - Static files ready for CDN/blob storage

**Success Criteria**: Clean build with no TypeScript errors

---

### Stage 5: Deploy to Staging
**Purpose**: Deploy to staging environment for validation
**Trigger**: Push to `main` branch only
**Jobs**:
- **Deploy Backend to Staging**
  - Target: Azure App Service (Node 20)
  - Authentication: GitHub OIDC (Workload Identity Federation)
  - Deployment method: ZIP deploy
  - Steps:
    1. Download build artifact
    2. Authenticate to Azure via OIDC
    3. Deploy to App Service: `app-vrd-202546-stg-eus2-01`
    4. Run database migrations (Knex migrate)
    5. Restart app service
    6. Wait for health check
    7. Run smoke tests

**Smoke Tests**:
- Health endpoint: `GET /health` → 200 OK
- Readiness endpoint: `GET /health/ready` → 200 OK (DB check)
- Auth test: `POST /api/auth/login` with test credentials → 200 OK
- Simple CRUD: `GET /api/customers` with auth → 200 OK

**Success Criteria**: Deployment successful, all smoke tests pass

**Rollback Strategy**: If smoke tests fail, redeploy previous successful artifact

---

### Stage 6: Deploy to Production
**Purpose**: Promote staging to production
**Trigger**: Manual approval (GitHub Environments)
**Jobs**:
- **Promote to Production**
  - Target: Azure App Service (Node 20)
  - Deployment method: Blue/Green
  - Steps:
    1. Deploy to production slot (blue)
    2. Run smoke tests on blue slot
    3. Swap blue → green (production)
    4. Validate production health
    5. Keep blue slot warm for 24h (rollback window)

**Rollback Strategy**: Swap slots back to previous version

---

## Authentication & Authorization

### GitHub OIDC with Azure
**No cloud secrets stored in GitHub**

**Azure Setup Required**:
1. Create Azure AD App Registration
2. Create Federated Credential for GitHub Actions
3. Assign permissions: Contributor on resource group

**GitHub Secrets Required**:
- `AZURE_CLIENT_ID` - Service Principal Client ID
- `AZURE_TENANT_ID` - Azure Tenant ID
- `AZURE_SUBSCRIPTION_ID` - Azure Subscription ID

**Environment Variables**:
- `AZURE_RG_STAGING` - Resource group name (staging)
- `AZURE_APP_NAME_STAGING` - App Service name (staging)
- `AZURE_RG_PRODUCTION` - Resource group name (production)
- `AZURE_APP_NAME_PRODUCTION` - App Service name (production)

---

## Workflows

### Workflow 1: Backend CI
**File**: `.github/workflows/backend-ci.yml`
**Trigger**: Pull requests, push to any branch
**Runs**: Stages 1-4 (Lint, Test, Integration, Build)
**Purpose**: Validate code quality before merge

### Workflow 2: Deploy Backend to Staging
**File**: `.github/workflows/deploy-backend-staging.yml`
**Trigger**: Push to `main` branch
**Runs**: Stage 5 (Deploy to Staging)
**Purpose**: Automatic deployment to staging after merge

### Workflow 3: Deploy Backend to Production (future)
**File**: `.github/workflows/deploy-backend-production.yml`
**Trigger**: Manual (workflow_dispatch) or tag push (`v*`)
**Runs**: Stage 6 (Deploy to Production)
**Purpose**: Controlled production releases

---

## Rollback Strategies

### Staging Rollback
**Scenario**: Smoke tests fail after staging deployment

**Strategy**:
1. GitHub Actions detects smoke test failure
2. Retrieves previous successful artifact from GitHub artifacts (retention: 90 days)
3. Redeploys previous artifact to staging
4. Runs smoke tests on previous version
5. Notifies team via GitHub Actions output/Slack

**Manual Override**: Redeploy specific commit hash via `workflow_dispatch`

### Production Rollback
**Scenario**: Critical bug discovered in production

**Strategy 1: Slot Swap (Fast - 30 seconds)**
1. Swap production slot back to previous version
2. Validate health checks
3. Previous version is live

**Strategy 2: Redeploy Previous Artifact (5-10 minutes)**
1. Trigger production deployment workflow with previous tag
2. Deploy previous artifact to blue slot
3. Swap to production

**Strategy 3: Emergency Hotfix**
1. Create hotfix branch from production tag
2. Apply minimal fix
3. Fast-track through CI pipeline
4. Deploy to production

---

## Environment Configuration

### Staging Environment
- **App Service**: `app-vrd-202546-stg-eus2-01`
- **Database**: PostgreSQL Flexible Server (staging)
- **Blob Storage**: `stvrd202546stgeus201`
- **Redis**: `redis-vrd-202546-stg-eus2-01`
- **URL**: `https://app-vrd-202546-stg-eus2-01.azurewebsites.net`

### Production Environment
- **App Service**: `app-vrd-202546-prd-eus2-01`
- **Database**: PostgreSQL Flexible Server (production)
- **Blob Storage**: `stvrd202546prdeus201`
- **Redis**: `redis-vrd-202546-prd-eus2-01`
- **URL**: `https://app-vrd-202546-prd-eus2-01.azurewebsites.net` (custom domain TBD)

---

## Database Migrations

### Migration Strategy
**Tool**: Knex.js migrations

**Staging**:
- Migrations run automatically during deployment (before app restart)
- Command: `npm run migrate:latest`
- Failures block deployment

**Production**:
- Migrations run during blue slot deployment (before swap)
- Zero-downtime: Migrations must be backward compatible
- Rollback plan: Keep previous schema version compatible

### Migration Best Practices
1. **Additive Changes**: Add columns, don't drop (initially)
2. **Backward Compatibility**: New code works with old schema
3. **Multi-Phase Deploys**:
   - Phase 1: Add column (nullable)
   - Phase 2: Populate column
   - Phase 3: Make column required
   - Phase 4: Remove old column

---

## Monitoring & Alerts

### Post-Deployment Validation
**Staging**:
- Automated smoke tests (5 endpoints)
- Manual QA testing (optional)

**Production**:
- Automated smoke tests
- Application Insights health check
- Error rate monitoring (< 1% threshold)
- Response time monitoring (< 500ms p95)

### Alerting
- Deployment failure → GitHub Actions notification
- Smoke test failure → GitHub Actions failure + Slack (future)
- Production errors spike → Azure Monitor alert + PagerDuty (future)

---

## Security

### Secrets Management
- **No secrets in code**: All secrets in Azure Key Vault
- **GitHub Secrets**: Only OIDC credentials (client ID, tenant ID, subscription ID)
- **App Settings**: Injected from Key Vault references
- **Connection Strings**: Managed identities where possible

### Scanning
- **Dependency Scanning**: GitHub Dependabot enabled
- **Secret Scanning**: GitHub secret scanning enabled
- **SAST**: CodeQL analysis (future)
- **Container Scanning**: Trivy (if using containers, future)

---

## Performance

### Build Optimization
- **Node Modules Caching**: Cache `~/.npm` based on `package-lock.json` hash
- **Dependency Caching**: Restore dependencies in < 30 seconds
- **Parallel Jobs**: Lint + Test run in parallel where possible

### Deployment Optimization
- **Artifact Size**: Zip only `dist/`, `package.json`, `package-lock.json` (~5-10 MB)
- **Deployment Time**: Target < 5 minutes (staging), < 10 minutes (production)

---

## Future Enhancements

1. **Web Admin CI/CD**: Add build and deploy for React app (Azure Static Web Apps or Blob Storage + CDN)
2. **Mobile App CI/CD**: Add build for React Native (EAS Build for Expo)
3. **E2E Tests**: Playwright tests against staging environment
4. **Performance Tests**: Load testing with k6 or Artillery
5. **Infrastructure CD**: Terraform apply via GitHub Actions (separate workflow)
6. **Multi-Region**: Deploy to secondary region (disaster recovery)

---

## Compliance & Audit

### Audit Trail
- All deployments logged in GitHub Actions
- Artifacts retained for 90 days
- Deployment approvals tracked via GitHub Environments

### Change Management
- All production deploys require manual approval
- Approval from: Tech Lead or DevOps Engineer
- Approval documented in GitHub Environment protection rules

---

**Document Version**: 1.0
**Last Updated**: 2025-11-15
**Owner**: DevOps Team
