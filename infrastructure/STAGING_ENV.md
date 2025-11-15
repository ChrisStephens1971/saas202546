# Staging Environment Configuration

**Project**: Mobile Mechanic Empire (saas202546)
**Environment**: Staging (stg)
**Region**: East US 2 (eus2)
**Last Updated**: 2025-11-15

---

## Azure Resource Names

Based on Verdaio Azure Naming Standard v1.2:
- **Organization**: vrd
- **Project**: 202546
- **Environment**: stg
- **Region**: eus2

### Resource Groups

```
rg-vrd-202546-stg-eus2-app     # Application resources
rg-vrd-202546-stg-eus2-data    # Data resources (PostgreSQL, Redis)
rg-vrd-202546-stg-eus2-net     # Network resources
```

### Compute Resources

```
App Service Plan: asp-vrd-202546-stg-eus2
App Service:      app-vrd-202546-stg-eus2-01
```

**App Service Configuration**:
- Runtime: Node 20 LTS
- OS: Linux
- SKU: B1 (Basic) or higher for staging
- Always On: Enabled
- ARR Affinity: Disabled (for multi-instance)

### Data Resources

```
PostgreSQL Server:   sqlsvr-vrd-202546-stg-eus2 (or pg-vrd-202546-stg-eus2)
PostgreSQL Database: mobile_mechanic_staging
Redis Cache:         redis-vrd-202546-stg-eus2-01
```

**PostgreSQL Configuration**:
- Version: 15 (Flexible Server)
- SKU: B_Standard_B1ms (Burstable, 1 vCore, 2 GB RAM) for staging
- Storage: 32 GB
- Backup Retention: 7 days
- SSL: Enforced
- Public Access: Disabled (use VNet integration or firewall rules)

**Redis Configuration**:
- SKU: Basic C0 (250 MB) for staging
- SSL: Required
- Version: 6.x

### Storage Resources

```
Storage Account:  stvrd202546stgeus201
Container:        trust-artifacts
```

**Storage Configuration**:
- Account Kind: StorageV2 (general purpose v2)
- Replication: LRS (Locally Redundant Storage) for staging
- Access Tier: Hot
- Blob Public Access: Container level (for trust artifacts)

### Security Resources

```
Key Vault: kv-vrd-202546-stg-eus2-01
```

**Key Vault Secrets** (to be created):
- `DATABASE-URL` - PostgreSQL connection string
- `JWT-SECRET` - JWT signing secret
- `REFRESH-TOKEN-SECRET` - Refresh token signing secret
- `AZURE-STORAGE-CONNECTION-STRING` - Blob storage connection string
- `REDIS-URL` - Redis connection string

### Monitoring Resources

```
Log Analytics:      la-vrd-202546-stg-eus2
Application Insights: appi-vrd-202546-stg-eus2
```

---

## Terraform Deployment

### Prerequisites

1. Azure CLI installed and authenticated
2. Terraform >= 1.5 installed
3. Contributor role on subscription

### Deploy Infrastructure

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Select workspace or create new
terraform workspace new staging  # First time only
terraform workspace select staging

# Plan deployment
terraform plan \
  -var="env=stg" \
  -var="location=East US 2" \
  -out=staging.tfplan

# Apply deployment
terraform apply staging.tfplan

# Capture outputs
terraform output -json > staging-outputs.json
```

### Create Additional Resources (if not in Terraform)

If App Service or PostgreSQL are not in the main Terraform, create them manually:

#### Create App Service

```bash
# Create App Service Plan
az appservice plan create \
  --name asp-vrd-202546-stg-eus2 \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --location eastus2 \
  --is-linux \
  --sku B1

# Create App Service
az webapp create \
  --name app-vrd-202546-stg-eus2-01 \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --plan asp-vrd-202546-stg-eus2 \
  --runtime "NODE:20-lts"
```

#### Create PostgreSQL Flexible Server

```bash
# Create PostgreSQL server
az postgres flexible-server create \
  --name pg-vrd-202546-stg-eus2 \
  --resource-group rg-vrd-202546-stg-eus2-data \
  --location eastus2 \
  --admin-user mechanic_admin \
  --admin-password '<STRONG_PASSWORD>' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --backup-retention 7 \
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group rg-vrd-202546-stg-eus2-data \
  --server-name pg-vrd-202546-stg-eus2 \
  --database-name mobile_mechanic_staging
```

#### Create Redis Cache

```bash
az redis create \
  --name redis-vrd-202546-stg-eus2-01 \
  --resource-group rg-vrd-202546-stg-eus2-data \
  --location eastus2 \
  --sku Basic \
  --vm-size c0
```

#### Create Storage Account

```bash
# Create storage account
az storage account create \
  --name stvrd202546stgeus201 \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --location eastus2 \
  --sku Standard_LRS \
  --kind StorageV2

# Create blob container
az storage container create \
  --name trust-artifacts \
  --account-name stvrd202546stgeus201 \
  --public-access container
```

---

## App Service Configuration

### Environment Variables (App Settings)

Configure these in Azure Portal or via Azure CLI:

```bash
az webapp config appsettings set \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-eus2-01 \
  --settings \
    NODE_ENV=staging \
    PORT=8080 \
    API_BASE_URL=https://app-vrd-202546-stg-eus2-01.azurewebsites.net \
    FRONTEND_URL=https://app-vrd-202546-stg-eus2-01.azurewebsites.net \
    LOG_LEVEL=info \
    DATABASE_URL='postgresql://mechanic_admin:<PASSWORD>@pg-vrd-202546-stg-eus2.postgres.database.azure.com:5432/mobile_mechanic_staging?sslmode=require' \
    DATABASE_POOL_MIN=2 \
    DATABASE_POOL_MAX=10 \
    DATABASE_SSL=true \
    REDIS_URL='rediss://redis-vrd-202546-stg-eus2-01.redis.cache.windows.net:6380,password=<REDIS_KEY>,ssl=true' \
    JWT_SECRET='<GENERATE_STRONG_256_BIT_KEY>' \
    JWT_EXPIRES_IN=15m \
    REFRESH_TOKEN_SECRET='<GENERATE_STRONG_256_BIT_KEY>' \
    REFRESH_TOKEN_EXPIRES_IN=7d \
    BCRYPT_ROUNDS=10 \
    AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=https;AccountName=stvrd202546stgeus201;AccountKey=<STORAGE_KEY>;EndpointSuffix=core.windows.net' \
    SCM_DO_BUILD_DURING_DEPLOYMENT=false \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
```

### Startup Command

Configure the startup command to run migrations before starting the server:

```bash
az webapp config set \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-eus2-01 \
  --startup-file "npm run migrate:latest && node dist/server.js"
```

Or create a `startup.sh` script in the backend root:

```bash
#!/bin/bash
# startup.sh
echo "Running database migrations..."
npm run migrate:latest

if [ $? -eq 0 ]; then
  echo "Migrations completed successfully"
  echo "Starting server..."
  node dist/server.js
else
  echo "Migration failed"
  exit 1
fi
```

Then set:
```bash
az webapp config set \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-eus2-01 \
  --startup-file "./startup.sh"
```

### Health Check

Enable Azure's health check feature:

```bash
az webapp config set \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-eus2-01 \
  --generic-configurations '{"healthCheckPath": "/health"}'
```

---

## GitHub OIDC Setup

### Create Azure AD App Registration

```bash
# Create app registration
az ad app create --display-name "GitHub-Actions-MobileMechanic-Staging"

# Capture Application (client) ID
CLIENT_ID=$(az ad app list --display-name "GitHub-Actions-MobileMechanic-Staging" --query "[0].appId" -o tsv)

# Create service principal
az ad sp create --id $CLIENT_ID

# Get service principal object ID
SP_OBJECT_ID=$(az ad sp list --display-name "GitHub-Actions-MobileMechanic-Staging" --query "[0].id" -o tsv)
```

### Create Federated Credentials

```bash
# For main branch
az ad app federated-credential create \
  --id $CLIENT_ID \
  --parameters '{
    "name": "GitHub-Actions-Main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:<YOUR_GITHUB_USERNAME>/saas202546:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions federated credential for main branch"
  }'

# For pull requests (optional)
az ad app federated-credential create \
  --id $CLIENT_ID \
  --parameters '{
    "name": "GitHub-Actions-PR",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:<YOUR_GITHUB_USERNAME>/saas202546:pull_request",
    "audiences": ["api://AzureADTokenExchange"],
    "description": "GitHub Actions federated credential for pull requests"
  }'
```

### Assign Permissions

```bash
# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Assign Contributor role to the service principal on the resource group
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role Contributor \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-vrd-202546-stg-eus2-app
```

### GitHub Secrets

Add these secrets to GitHub repository (`Settings > Secrets and variables > Actions`):

```
AZURE_CLIENT_ID        = <CLIENT_ID from above>
AZURE_TENANT_ID        = <Your Azure tenant ID>
AZURE_SUBSCRIPTION_ID  = <Your subscription ID>
```

Get tenant ID:
```bash
az account show --query tenantId -o tsv
```

---

## Database Setup

### Run Migrations

Migrations will run automatically on App Service startup via the startup command.

To run manually:

```bash
# SSH into App Service
az webapp ssh --resource-group rg-vrd-202546-stg-eus2-app --name app-vrd-202546-stg-eus2-01

# Inside the container
cd /home/site/wwwroot
export NODE_ENV=staging
npm run migrate:latest
```

Or locally against staging database:

```bash
# In backend directory
export DATABASE_URL='postgresql://mechanic_admin:<PASSWORD>@pg-vrd-202546-stg-eus2.postgres.database.azure.com:5432/mobile_mechanic_staging?sslmode=require'
export NODE_ENV=staging
npm run migrate:latest
```

### Verify Migrations

```bash
# Connect to PostgreSQL
az postgres flexible-server execute \
  --name pg-vrd-202546-stg-eus2 \
  --admin-user mechanic_admin \
  --admin-password '<PASSWORD>' \
  --database-name mobile_mechanic_staging \
  --querytext "SELECT * FROM knex_migrations ORDER BY batch DESC, id DESC LIMIT 10;"
```

---

## Deployment Workflow

### GitHub Actions Workflow

The deployment workflow is already configured in `.github/workflows/deploy-backend-staging.yml`.

**Trigger**: Push to `main` branch or manual workflow dispatch

**Steps**:
1. Build backend (TypeScript → JavaScript)
2. Create deployment package (dist + node_modules)
3. Authenticate to Azure via OIDC
4. Deploy to App Service (ZIP deploy)
5. Restart App Service
6. Run smoke tests:
   - GET /health → 200
   - GET /health/ready → 200
   - GET /api → 200
   - POST /api/auth/login → 400 (missing body)

**Workflow URL**: `https://github.com/<ORG>/<REPO>/actions/workflows/deploy-backend-staging.yml`

### Manual Deployment

To deploy manually without GitHub Actions:

```bash
cd backend

# Build
npm run build

# Install production dependencies
npm ci --omit=dev

# Create zip
mkdir deploy-package
cp -r dist/* deploy-package/
cp package.json deploy-package/
cp package-lock.json deploy-package/
cp -r node_modules deploy-package/
cd deploy-package && zip -r ../backend-deploy.zip . && cd ..

# Deploy
az webapp deploy \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-eus2-01 \
  --src-path backend-deploy.zip \
  --type zip \
  --async false
```

---

## Testing Staging Environment

### Smoke Tests

After deployment, run these smoke tests:

```bash
STAGING_URL=https://app-vrd-202546-stg-eus2-01.azurewebsites.net

# Health check
curl $STAGING_URL/health
# Expected: {"status":"ok","timestamp":"...","environment":"staging"}

# Readiness check
curl $STAGING_URL/health/ready
# Expected: {"status":"ready","timestamp":"...","checks":{"database":"ok"}}

# API root
curl $STAGING_URL/api
# Expected: {"message":"Mobile Mechanic Empire API","version":"1.0.0","timestamp":"..."}

# Auth endpoint (should return 400 for missing body)
curl -X POST $STAGING_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 Bad Request with validation errors
```

### Functional Tests

Test a complete flow:

```bash
STAGING_URL=https://app-vrd-202546-stg-eus2-01.azurewebsites.net

# 1. Register a test tenant
curl -X POST $STAGING_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "businessName": "Test Mechanic Shop"
  }'

# 2. Login
curl -X POST $STAGING_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
# Save the access token from response

# 3. List customers (should be empty)
curl $STAGING_URL/api/customers \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Monitoring & Logs

### View Logs

```bash
# Stream live logs
az webapp log tail \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-eus2-01

# Download logs
az webapp log download \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --name app-vrd-202546-stg-eus2-01 \
  --log-file staging-logs.zip
```

### Application Insights

View metrics and logs in Application Insights:

```bash
# Get instrumentation key
az monitor app-insights component show \
  --resource-group rg-vrd-202546-stg-eus2-app \
  --app appi-vrd-202546-stg-eus2 \
  --query instrumentationKey -o tsv
```

---

## Troubleshooting

### App Won't Start

1. Check logs: `az webapp log tail ...`
2. Verify environment variables are set
3. Check startup command is correct
4. Ensure migrations completed successfully

### Database Connection Fails

1. Verify DATABASE_URL is correct
2. Check PostgreSQL firewall rules allow App Service IP
3. Verify SSL is enabled in connection string
4. Test connection from App Service SSH console

### Migrations Fail

1. Check DATABASE_URL has correct SSL mode
2. Verify database exists
3. Run migrations manually via SSH
4. Check migration files are in `dist/database/migrations/`

### Deployment Fails in GitHub Actions

1. Verify GitHub secrets are set correctly
2. Check OIDC federated credentials are configured
3. Ensure service principal has Contributor role
4. Review workflow run logs in GitHub Actions

---

## Cost Estimates (Staging)

**Monthly costs for staging environment**:

- App Service (B1): ~$13/month
- PostgreSQL (B1ms): ~$12/month
- Redis (C0): ~$17/month
- Storage Account: ~$1/month
- Application Insights: ~$5/month (first 5GB free)

**Total**: ~$48/month

**Note**: These are estimates. Actual costs may vary based on usage.

---

## Checklist

- [ ] Terraform applied to create resource groups and networking
- [ ] App Service created
- [ ] PostgreSQL Flexible Server created
- [ ] Redis Cache created
- [ ] Storage Account created
- [ ] Key Vault created (optional for staging)
- [ ] App Service settings configured
- [ ] Startup command configured
- [ ] Azure AD App Registration created
- [ ] Federated credentials configured
- [ ] Service Principal permissions assigned
- [ ] GitHub secrets configured
- [ ] Database migrations run successfully
- [ ] Deployment workflow triggered and passed
- [ ] Smoke tests passed
- [ ] Staging URL responding correctly

---

**Staging URL**: https://app-vrd-202546-stg-eus2-01.azurewebsites.net

**Status**: Ready for deployment
**Last Updated**: 2025-11-15
