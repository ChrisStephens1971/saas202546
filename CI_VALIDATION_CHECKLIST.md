# CI Validation Checklist

**Purpose**: Simulate GitHub Actions CI pipeline locally before pushing code.

This guide helps you run the same checks that `backend-ci.yml` runs in GitHub Actions, allowing you to catch issues before they fail in CI.

---

## Prerequisites

**Required**:
- Node.js 20+ (`node --version`)
- npm 10+ (`npm --version`)
- Git

**For Integration Tests**:
- Docker Desktop (for local Postgres and Redis containers)
- OR PostgreSQL 15 installed locally
- OR Access to remote test database

---

## Quick Validation (5 minutes)

Run these commands from the **repository root**:

```bash
# 1. Install dependencies
cd backend
npm ci

# 2. Lint (ESLint + TypeScript type checking)
npm run lint
npm run type-check

# 3. Unit tests only (no database required)
npm test -- --testPathIgnorePatterns=integration

# 4. Build
npm run build

# Expected result: All commands exit with code 0
```

**If any command fails**, fix the issue before committing.

---

## Full CI Simulation (15-20 minutes)

This matches exactly what GitHub Actions runs, including integration tests with PostgreSQL and Redis.

### Step 1: Start Test Databases (Docker)

```bash
# Start PostgreSQL
docker run -d \
  --name postgres-test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mechanic_test \
  -p 5432:5432 \
  postgres:15-alpine

# Start Redis
docker run -d \
  --name redis-test \
  -p 6379:6379 \
  redis:7-alpine

# Wait for containers to be ready (10-15 seconds)
sleep 15
```

**Alternative (without Docker)**:
- Install PostgreSQL 15 locally
- Create database: `createdb mechanic_test`
- Start Redis locally or skip integration tests

### Step 2: Run All CI Checks

```bash
cd backend

# 1. Install dependencies
npm ci

# 2. Lint
npm run lint
echo "✅ Lint passed"

# 3. Type check
npm run type-check
echo "✅ Type check passed"

# 4. Unit tests with coverage
npm test -- --coverage --testPathIgnorePatterns=integration
echo "✅ Unit tests passed"

# 5. Run database migrations
export NODE_ENV=test
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mechanic_test"
export JWT_SECRET="test-secret-key"
export REFRESH_TOKEN_SECRET="test-refresh-secret"

npm run migrate:latest
echo "✅ Migrations passed"

# 6. Integration tests
export REDIS_URL="redis://localhost:6379"
npm test -- --testPathPattern=integration
echo "✅ Integration tests passed"

# 7. Build
npm run build
echo "✅ Build passed"

# 8. Verify build artifacts
ls -lh dist/server.js
ls -lh dist/database/migrations/
echo "✅ Build artifacts verified"
```

### Step 3: Cleanup

```bash
# Stop and remove test containers
docker stop postgres-test redis-test
docker rm postgres-test redis-test
```

---

## Expected Outcomes

### Successful Run

All commands should exit with code 0 and show:

```
✅ Lint passed (0 errors, 0 warnings)
✅ Type check passed (0 errors)
✅ Unit tests passed (37/37 tests)
✅ Migrations passed (X migrations run)
✅ Integration tests passed (Y/Y tests)
✅ Build passed (TypeScript compiled)
✅ Build artifacts verified (dist/ directory exists)
```

### Common Failures

**Lint Errors**:
```
Error: 'variable' is declared but never used
```
**Fix**: Remove unused variables or add `// eslint-disable-next-line` if intentional

**Type Errors**:
```
Error: Type 'string' is not assignable to type 'number'
```
**Fix**: Fix type mismatches in TypeScript code

**Test Failures**:
```
FAIL tests/unit/example.test.ts
  Expected: 5
  Received: 4
```
**Fix**: Correct test expectations or fix the code being tested

**Migration Failures**:
```
Error: relation "users" already exists
```
**Fix**: Rollback migrations or drop test database and recreate

**Build Failures**:
```
Error: Cannot find module '@config'
```
**Fix**: Check path aliases in tsconfig.json and jest.config.js

---

## Minimal Validation (No Database)

If you don't have Postgres/Redis available, you can still validate most of the pipeline:

```bash
cd backend

# Install
npm ci

# Lint + Type Check
npm run lint && npm run type-check

# Unit tests only (skip integration)
npm test -- --testPathIgnorePatterns=integration

# Build
npm run build

# Verify migration files exist (not run)
ls src/database/migrations/
```

**Limitations**:
- Integration tests skipped
- Migrations not tested
- Database connectivity not validated

**When to use**: Quick pre-commit checks

---

## GitHub Actions vs Local

### Differences

| Aspect | GitHub Actions | Local |
|--------|---------------|-------|
| **Node version** | Exactly 20 (specified) | Your installed version |
| **PostgreSQL** | Fresh container per run | Persistent local DB |
| **Redis** | Fresh container per run | Persistent local Redis |
| **Environment** | Ubuntu latest | Your OS (Windows/Mac/Linux) |
| **Caching** | npm cache restored | Local node_modules |

### Why Tests Pass Locally But Fail in CI

1. **Node version mismatch**: Use `nvm use 20` to match CI
2. **Dirty database**: CI uses fresh DB; local may have stale data
3. **Environment variables**: CI sets specific env vars; check `.github/workflows/backend-ci.yml` for values
4. **OS-specific behavior**: Paths, file permissions may differ
5. **Cached dependencies**: Run `rm -rf node_modules && npm ci` to match CI

---

## Debugging Failed CI Runs

### Step 1: Get Failure Details

```bash
# View latest GitHub Actions run logs
gh run list --workflow=backend-ci.yml --limit 1
gh run view <run-id> --log
```

### Step 2: Reproduce Locally

Match the exact environment from the failed workflow:

```bash
# Use exact Node version
nvm use 20

# Clean install
rm -rf node_modules package-lock.json
npm install

# Fresh test database
docker stop postgres-test && docker rm postgres-test
# Then recreate container (see Step 1 above)

# Run specific test that failed
npm test -- --testNamePattern="specific test name"
```

### Step 3: Common Issues

**Issue**: Tests pass locally but fail in CI
**Cause**: Database state or timezone differences
**Fix**: Use fresh database, set `TZ=UTC` in tests

**Issue**: Build succeeds locally but fails in CI
**Cause**: Different TypeScript version or missing files
**Fix**: Run `npm ci` instead of `npm install`, check `.gitignore`

**Issue**: Lint passes locally but fails in CI
**Cause**: Different ESLint configuration or auto-fixing enabled locally
**Fix**: Run `npm run lint` without auto-fix, commit `.eslintrc.js`

---

## Pre-Push Checklist

Before pushing to GitHub, ensure:

- [ ] `npm run lint` exits with code 0
- [ ] `npm run type-check` exits with code 0
- [ ] `npm test` passes all tests
- [ ] `npm run build` completes successfully
- [ ] No uncommitted changes to `package.json` or `package-lock.json`
- [ ] All new files are tracked in git (`git status`)

**Recommended**: Set up a git pre-push hook to run these checks automatically.

---

## Running Specific Test Suites

```bash
# Only unit tests
npm test -- --testPathPattern=unit

# Only integration tests (requires database)
npm test -- --testPathPattern=integration

# Specific test file
npm test -- tests/unit/jobs.test.ts

# Tests matching pattern
npm test -- --testNamePattern="should calculate"

# With coverage
npm test -- --coverage

# Watch mode (for development)
npm run test:watch
```

---

## Performance Notes

**Typical run times** (on moderate hardware):

- Lint: ~5 seconds
- Type check: ~10 seconds
- Unit tests: ~7 seconds
- Integration tests: ~20 seconds (with database startup)
- Build: ~15 seconds

**Total**: ~1 minute for full CI simulation (excluding database container startup)

**GitHub Actions**: Usually takes 2-3 minutes due to container setup overhead

---

## Next Steps

Once local validation passes:

1. **Commit changes**: `git add . && git commit -m "your message"`
2. **Push to GitHub**: `git push origin <branch>`
3. **Monitor CI**: Check GitHub Actions tab for workflow status
4. **Fix failures**: If CI fails, use this guide to reproduce and fix locally

**Remember**: Local validation catches ~95% of CI failures. Always run before pushing!
