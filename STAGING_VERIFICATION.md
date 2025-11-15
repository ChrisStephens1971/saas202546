# Staging Deployment Verification Guide

**Environment**: Staging (Central US compute, East US 2 data)
**App Service**: `app-vrd-202546-stg-cus-01`
**Base URL**: `https://app-vrd-202546-stg-cus-01.azurewebsites.net`

This guide describes how to verify that a successful deployment to staging actually means the application is healthy and functional.

---

## Automated Smoke Tests

The deployment workflow (`.github/workflows/deploy-backend-staging.yml`) runs 4 automated smoke tests after deployment:

### 1. Health Check

```bash
GET https://app-vrd-202546-stg-cus-01.azurewebsites.net/health
```

**Expected Response**: HTTP 200
```json
{
  "status": "ok",
  "timestamp": "2025-11-15T18:00:00.000Z",
  "environment": "staging"
}
```

**What it validates**:
- App Service is running
- Express server started successfully
- Basic endpoint routing works

**Failure**: HTTP 503 or timeout
**Meaning**: App failed to start or crashed

---

### 2. Readiness Check

```bash
GET https://app-vrd-202546-stg-cus-01.azurewebsites.net/health/ready
```

**Expected Response**: HTTP 200
```json
{
  "status": "ready",
  "timestamp": "2025-11-15T18:00:00.000Z",
  "checks": {
    "database": "ok"
  }
}
```

**What it validates**:
- Database connection established
- PostgreSQL server reachable from Central US App Service
- SSL connection to East US 2 database works
- App is ready to serve traffic

**Failure**: HTTP 503
**Response**:
```json
{
  "status": "not_ready",
  "timestamp": "...",
  "checks": {
    "database": "failed"
  }
}
```

**Meaning**: Database connection failed
**Common causes**:
- PostgreSQL server down
- Firewall blocking App Service IP
- DATABASE_URL misconfigured
- Network issues between regions

---

### 3. API Root

```bash
GET https://app-vrd-202546-stg-cus-01.azurewebsites.net/api
```

**Expected Response**: HTTP 200
```json
{
  "message": "Mobile Mechanic Empire API",
  "version": "1.0.0",
  "timestamp": "2025-11-15T18:00:00.000Z"
}
```

**What it validates**:
- API routes mounted correctly
- Base `/api` path works
- JSON responses formatted properly

**Failure**: HTTP 404
**Meaning**: Express routing broken or app.ts not compiled correctly

---

### 4. Auth Endpoint Accessibility

```bash
POST https://app-vrd-202546-stg-cus-01.azurewebsites.net/api/auth/login
Content-Type: application/json
{}
```

**Expected Response**: HTTP 400 (Bad Request)
```json
{
  "error": "Validation Error",
  "message": "email is required, password is required"
}
```

**What it validates**:
- Auth routes loaded
- Validation middleware working
- POST endpoints accessible

**Acceptable Responses**:
- HTTP 400: Validation error (expected for empty body)
- HTTP 401: Authentication error (also acceptable)

**Failure Responses**:
- HTTP 404: Route not found
- HTTP 500: Server error

**Meaning of failures**:
- 404: Auth routes not mounted
- 500: Server crash on request (check logs)

---

## Manual Verification Flow

After GitHub Actions smoke tests pass, run these manual tests to ensure full functionality.

### Step 1: Verify Health Endpoints

```bash
STAGING_URL=https://app-vrd-202546-stg-cus-01.azurewebsites.net

# 1. Basic health
curl -i $STAGING_URL/health

# 2. Readiness (with database)
curl -i $STAGING_URL/health/ready

# 3. API root
curl -i $STAGING_URL/api
```

**Expected**: All return HTTP 200 with JSON bodies

---

### Step 2: Test Authentication Flow

#### Register a Test Tenant

```bash
curl -X POST $STAGING_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!",
    "businessName": "Test Mechanic Shop"
  }'
```

**Expected Response**: HTTP 201 Created
```json
{
  "user": {
    "id": "uuid",
    "email": "testuser@example.com",
    "tenantId": "uuid"
  },
  "tenant": {
    "id": "uuid",
    "businessName": "Test Mechanic Shop"
  },
  "accessToken": "jwt-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Failure Scenarios**:
- HTTP 400: Validation error (check password requirements)
- HTTP 409: Email already exists (use different email)
- HTTP 500: Server error (check database, logs)

#### Login

```bash
curl -X POST $STAGING_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response**: HTTP 200 OK
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "jwt-refresh-token",
  "user": { ... }
}
```

**Save the access token** for next steps:
```bash
export ACCESS_TOKEN="<paste-token-here>"
```

---

### Step 3: Test CRUD Operations

#### List Customers (Should Be Empty)

```bash
curl $STAGING_URL/api/customers \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Expected Response**: HTTP 200
```json
{
  "customers": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

#### Create a Customer

```bash
curl -X POST $STAGING_URL/api/customers \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-0123",
    "type": "individual"
  }'
```

**Expected Response**: HTTP 201 Created
```json
{
  "id": "uuid",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  ...
}
```

**Save the customer ID**:
```bash
export CUSTOMER_ID="<paste-id-here>"
```

#### Verify Customer Was Created

```bash
curl $STAGING_URL/api/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Expected Response**: HTTP 200 with customer data

---

### Step 4: Test Database Migrations

Verify that migrations ran successfully:

```bash
# SSH into App Service
az webapp ssh \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01

# Inside container, check migrations
cd /home/site/wwwroot
node -e "const db = require('./dist/config/database'); db.getTenantDb('system').select('*').from('knex_migrations').orderBy('id', 'desc').limit(5).then(r => { console.table(r); process.exit(0); })"
```

**Expected**: List of migration files with batch numbers

**Alternative** (via database directly):
```bash
az postgres flexible-server execute \
  --name pg-vrd-202546-stg-eus2 \
  --admin-user mechanic_admin \
  --admin-password 'MechEmp!re2025#Stg' \
  --database-name mobile_mechanic_staging \
  --querytext "SELECT name, batch, migration_time FROM knex_migrations ORDER BY id DESC LIMIT 10;"
```

---

### Step 5: Test Cross-Region Connectivity

The staging environment uses a hybrid setup:
- **App Service**: Central US
- **Database, Redis, Storage**: East US 2

Verify cross-region connectivity:

#### Database (Central → East US 2)

Already tested via `/health/ready` endpoint (database check).

**Latency Check**:
```bash
curl -w "\nTime: %{time_total}s\n" $STAGING_URL/health/ready
```

**Expected**: ~50-150ms response time (includes cross-region database query)

#### Storage (Test File Upload)

Create a test trust artifact (PDF):

```bash
# This requires a job to exist first
# Follow full workflow: register → login → create customer → create vehicle → create job → upload artifact
```

**Verify** blob appears in Azure Storage:
```bash
az storage blob list \
  --account-name stvrd202546stgeus201 \
  --container-name trust-artifacts \
  --query "[].{name:name, size:properties.contentLength}" \
  --output table
```

---

## Interpreting Smoke Test Results

### All Smoke Tests Pass ✅

**Meaning**:
- App deployed successfully
- Server started without errors
- Database connection established
- Core endpoints responding
- Migrations likely ran successfully

**Confidence Level**: HIGH (~95%)

**Next Steps**:
- Run manual verification tests
- Test actual CRUD operations
- Monitor Application Insights for errors

### Health Check Fails ❌

**Symptoms**: HTTP 503 or timeout on `/health`

**Likely Causes**:
1. App Service startup failed
2. Server crashed on initialization
3. Port binding issue

**Debugging**:
```bash
# View live logs
az webapp log tail \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01

# Check for startup errors
# Look for: "Application Error", "SyntaxError", "Cannot find module"
```

**Common Fixes**:
- Check environment variables configured
- Verify `dist/server.js` exists in deployment
- Check startup command: `npm run migrate:latest && node dist/server.js`

### Readiness Check Fails ❌

**Symptoms**: HTTP 503 on `/health/ready`, database check fails

**Likely Causes**:
1. PostgreSQL server unreachable
2. Firewall blocking App Service IP
3. DATABASE_URL incorrect
4. SSL connection failing

**Debugging**:
```bash
# Test database connectivity from App Service
az webapp ssh \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01

# Inside container
apt-get update && apt-get install -y postgresql-client
psql "$DATABASE_URL" -c "SELECT version();"
```

**Common Fixes**:
- Add App Service outbound IPs to PostgreSQL firewall
- Verify DATABASE_URL in Key Vault is correct
- Check PostgreSQL is running: `az postgres flexible-server show ...`

### API Root Fails ❌

**Symptoms**: HTTP 404 on `/api`

**Likely Causes**:
1. Express routes not mounted
2. Build artifacts incomplete
3. Server started but routing broken

**Debugging**:
```bash
# Check build artifacts
az webapp ssh ...

ls -la /home/site/wwwroot/
ls -la /home/site/wwwroot/dist/

# Check if app.js was compiled
cat /home/site/wwwroot/dist/app.js | grep "/api"
```

**Common Fixes**:
- Redeploy with clean build
- Verify `tsc && tsc-alias` ran successfully
- Check deployment package includes `dist/` folder

### Auth Endpoint Fails ❌

**Symptoms**: HTTP 500 or 404 on `/api/auth/login`

**Likely Causes**:
1. Auth routes not loaded
2. Validation middleware error
3. JWT_SECRET missing

**Debugging**:
```bash
# Check environment variables
az webapp config appsettings list \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01 \
  --query "[?name=='JWT_SECRET']"

# Should show Key Vault reference
```

**Common Fixes**:
- Verify JWT_SECRET in Key Vault
- Check App Service has managed identity access to Key Vault
- Review auth route registration in app.ts

---

## Monitoring After Deployment

### Application Insights

**View recent errors**:
```bash
# Get instrumentation key
az monitor app-insights component show \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --app appi-vrd-202546-stg-eus2 \
  --query instrumentationKey -o tsv
```

**Query exceptions** (via Azure Portal):
```kusto
exceptions
| where timestamp > ago(1h)
| where cloud_RoleName == "app-vrd-202546-stg-cus-01"
| order by timestamp desc
| take 50
```

**Query failed requests**:
```kusto
requests
| where timestamp > ago(1h)
| where success == false
| order by timestamp desc
| take 50
```

### Live Metrics

Azure Portal → Application Insights → Live Metrics

**Monitor**:
- Request rate
- Response times
- Failed requests (should be 0 after smoke tests)
- Server exceptions (should be 0)

### App Service Logs

**Stream live**:
```bash
az webapp log tail \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01
```

**Download logs**:
```bash
az webapp log download \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01 \
  --log-file staging-logs.zip
```

---

## Success Criteria

A deployment is considered **successful** if:

- [x] All 4 automated smoke tests pass (health, ready, api, auth)
- [x] Manual health check returns HTTP 200
- [x] Can register and login a test user
- [x] Can create and retrieve a customer
- [x] Database migrations completed successfully
- [x] No exceptions in Application Insights (last 10 minutes)
- [x] Response times < 500ms for health endpoints
- [x] Cross-region database queries work (Central US → East US 2)

**Confidence Level**: If all above pass → **99% confidence** deployment is healthy

---

## Rollback Procedure

If verification fails:

### Option 1: Redeploy Previous Commit

```bash
# Get previous successful commit SHA
git log --oneline -10

# Trigger manual deployment of previous commit
gh workflow run deploy-backend-staging.yml \
  -f commit_sha=<previous-commit-sha>
```

### Option 2: Manual Rollback

Azure App Service doesn't support one-click rollback. Must redeploy from artifact or previous code.

### Option 3: Quick Fix Forward

If issue is minor (environment variable, configuration):

```bash
# Fix environment variable
az webapp config appsettings set \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01 \
  --settings KEY=VALUE

# Restart app
az webapp restart \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-cus-01

# Re-verify
curl https://app-vrd-202546-stg-cus-01.azurewebsites.net/health
```

---

## Notification

When deployment succeeds, GitHub Actions outputs:

```
✅ Deployment to staging successful
URL: https://app-vrd-202546-stg-cus-01.azurewebsites.net
```

When deployment fails:

```
❌ Deployment to staging failed
Check logs: https://github.com/<org>/<repo>/actions/runs/<run-id>
```

**Pro Tip**: Set up Slack/email notifications for deployment status in GitHub repository settings.

---

## Staging vs Production

**Important Differences**:

| Aspect | Staging | Production |
|--------|---------|-----------|
| **Data** | Test data only | Real customer data |
| **Secrets** | Test/staging secrets | Production secrets |
| **Uptime SLA** | None (can have downtime) | 99.9% target |
| **Traffic** | Internal team only | Real users |
| **Monitoring** | Basic (Application Insights free tier) | Advanced with alerts |
| **Backups** | 7-day retention | 30-day retention |

**Before promoting to production**:
- Run full test suite against staging
- Load test with realistic traffic
- Security scan
- Manual QA approval

---

**Last Updated**: 2025-11-15
**Staging URL**: https://app-vrd-202546-stg-cus-01.azurewebsites.net
**Status**: Active
