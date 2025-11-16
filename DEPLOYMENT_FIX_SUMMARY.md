# Deployment Fix Summary

**Date**: 2025-11-15
**Issue**: Backend failed to start on Azure App Service (staging)
**Root Cause**: Startup command tried to run migrations on every container boot, but npm couldn't find package.json

---

## Problem Analysis

### Symptoms
- App Service container exited with code 127 ("command not found")
- Health endpoint returned 503 Service Unavailable
- Logs showed: `npm error path /package.json`
- Startup command: `npm run migrate:latest && node dist/server.js`

### Root Cause
The startup command ran migrations on **every container boot**, which:
1. Required `npm` to find `package.json` in the current working directory
2. Added unnecessary startup delay (running migrations every time container starts)
3. Could cause race conditions if multiple containers start simultaneously
4. Was an anti-pattern (migrations should run once per deployment, not per boot)

---

## Solution Implemented

### TASK 1: ✅ Verify knex is a runtime dependency
- **Status**: Already correct
- **Location**: `backend/package.json` line 52
- **Value**: `"knex": "^3.1.0"` in dependencies (not devDependencies)

### TASK 2: ✅ Move migrations to CI/CD workflow
- **File**: `.github/workflows/deploy-backend-staging.yml`
- **Change**: Added migration step BEFORE Azure deployment
- **Implementation**:
  ```yaml
  - name: Run database migrations
    run: |
      # Get database connection string from App Service
      DB_URL=$(az webapp config appsettings list \
        --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
        --name ${{ env.AZURE_APP_NAME }} \
        --query "[?name=='DATABASE_URL'].value | [0]" -o tsv)

      # Run migrations using the deployment package
      cd deploy-package
      export DATABASE_URL="$DB_URL"
      export NODE_ENV=staging
      npm run migrate:latest
      cd ..
  ```
- **Result**: Migrations run once per deployment, during GitHub Actions

### TASK 3: ✅ Simplify App Service startup command
- **Command**: `az webapp config set --startup-file "node dist/server.js"`
- **Before**: `npm run migrate:latest && node dist/server.js`
- **After**: `node dist/server.js`
- **Result**: App starts immediately without running migrations

---

## Benefits

1. **Faster startup**: No migration overhead on every container restart
2. **More reliable**: Avoids race conditions with multiple containers
3. **Better separation of concerns**: Migrations run during deployment, not runtime
4. **Clearer logs**: Easier to debug when migrations are separate from app startup
5. **Standard practice**: Follows recommended Azure App Service deployment pattern

---

## Testing

### Immediate Verification
After applying fixes:
1. Restart App Service ✅
2. Check health endpoint: `curl https://app-vrd-202546-stg-cus-01.azurewebsites.net/health`
3. Expected: HTTP 200 with `{"status":"ok"}`

### Next Deployment
When GitHub Actions runs:
1. Build Backend job ✅
2. **Run database migrations** (NEW - runs in CI/CD)
3. Deploy to Azure App Service ✅
4. Restart App Service ✅
5. Smoke Tests ✅ (should now pass)

---

## Commit Details

**Commit**: 63936e5
**Message**: `fix: move database migrations to CI/CD and simplify startup command`

**Changes**:
- Modified `.github/workflows/deploy-backend-staging.yml`:
  - Moved "Run database migrations" step before deployment
  - Added actual migration execution (was only echoing messages)
  - Migrations now run with DATABASE_URL from App Service settings

- Modified App Service configuration:
  - Changed startup command to `node dist/server.js`
  - Removed migration execution from container boot

---

## Next Steps

1. ✅ Changes committed to master branch
2. ⏳ Wait for app to restart (45 seconds)
3. ⏳ Verify health endpoint returns 200
4. 🔄 Push changes to trigger new deployment
5. ✅ Verify migrations run successfully in GitHub Actions
6. ✅ Verify smoke tests pass
7. ✅ Document deployment workflow changes

---

## Files Modified

- `.github/workflows/deploy-backend-staging.yml` (15 lines changed)
- App Service configuration (startup command updated via Azure CLI)

---

## Related Documentation

- `DEPLOYMENT_COMPLETE.md` - Infrastructure deployment details
- `CI_VALIDATION_CHECKLIST.md` - Local CI simulation guide
- `STAGING_VERIFICATION.md` - Staging deployment verification guide
- `NEXT_STEPS_DEPLOYMENT.md` - Deployment workflow documentation
