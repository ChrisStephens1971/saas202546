# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project:** saas202546
**Created:** 2025-11-14
**Template:** Azure (azure)
**Platform:** Microsoft Azure
**Path:** C:\devop\saas202546

---

## 🎯 Project Overview

This is an **Azure-specific SaaS project** using the Verdaio Azure naming standard v1.2.

**Azure Configuration:**
- **Organization:** vrd
- **Project Code:** 202546
- **Primary Region:** eus2
- **Secondary Region:** none
- **Multi-Tenant:** true
- **Tenant Model:** subdomain

**Project Status:**
- **Phase:** Planning (from `.project-state.json`)
- **Application Code:** None yet - project is in planning/setup phase
- **Infrastructure:** Templates ready, not deployed
- **Next Steps:** Complete planning phase, then move to foundation phase

---

## ⚡ Quick Reference

**Most Common Commands:**
```bash
# Check project status
cat .project-state.json | jq '.workflow.currentPhase'

# Check GitHub Actions health (do this daily!)
gh run list --limit 5

# View current workflow tasks
cat .project-workflow.json | jq '.phases[.currentPhase].checklist'

# Generate Azure resource names
python C:/devop/.template-system/scripts/azure-name-generator.py \
  --type app --org vrd --proj 202546 --env dev --region eus2 --seq 01

# Validate Azure resource names
python C:/devop/.template-system/scripts/azure-name-validator.py \
  --name "app-vrd-202546-prd-eus2-01"

# Enable git hooks
git config core.hooksPath .githooks
```

---

## 📂 Current Codebase

**What Actually Exists:**

### 1. Fundraising Helper (Node.js)
- **Location:** `fundraising/`
- **Purpose:** Document generation utility
- **Dependencies:** `docx@^9.5.1`
- **Run:** `cd fundraising && npm install && node [script].js`

### 2. Infrastructure Templates (Ready to Deploy)
- **Bicep (Recommended):**
  - `infrastructure/azure-security-bicep/` - Complete security baseline
  - `infrastructure/bicep/main.bicep` - Main infrastructure template
- **Terraform (Alternative):**
  - `infrastructure/azure-security-terraform/` - Security modules
  - `infrastructure/terraform/` - Main infrastructure

### 3. Planning & Documentation Structure
- `product/` - PRDs, roadmaps, features (templates ready)
- `sprints/` - Sprint planning (templates ready)
- `technical/` - Tech specs, ADRs, API docs (templates ready)
- `business/` - OKRs, metrics, strategy (templates ready)
- `project-brief/` - Initial vision documents (add yours here)

### 4. Mobile Mechanic Starter Pack
- **Location:** `mobile-mechanic-empire_starter_pack/` (untracked)
- **Note:** Reference material for mobile mechanic business - either commit if relevant, remove if not needed, or add to `.gitignore`

**No Tests Yet** - Will be created during foundation/development phases

---

## 🛠️ Development Commands

**Note:** Some scripts in `scripts/` directory may need creation during setup. Git hooks exist in `.githooks/`.

### Daily Workflow

**Morning:**
```bash
gh run list --limit 5  # Check GitHub Actions
cat .project-workflow.json | jq '.phases[.currentPhase].checklist[] | select(.status=="pending")'
```

**During development:**
```bash
# Validate Azure names before using
python C:/devop/.template-system/scripts/azure-name-validator.py --name "[resource-name]"

# Generate Azure tags
python C:/devop/.template-system/scripts/azure-tag-generator.py \
  --org vrd --proj 202546 --env dev --region eus2 \
  --owner ops@verdaio.com --cost-center 202546-llc --format terraform
```

**End of day:**
```bash
gh run list --limit 5  # Ensure GitHub Actions green
git add . && git commit -m "Your message" && git push
```

### Infrastructure Deployment

**Bicep (Recommended):**
```bash
cd infrastructure/bicep
az deployment group create \
  --resource-group rg-vrd-202546-dev-eus2-app \
  --template-file main.bicep \
  --parameters @environments/dev.parameters.json

# Deploy security baseline (30-45 min)
cd ../azure-security-bicep
az deployment sub create --location eastus2 --template-file main.bicep \
  --parameters org=vrd proj=202546 env=prd primaryRegion=eus2
```

**Terraform (Alternative):**
```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file="environments/dev.tfvars"
terraform apply -var-file="environments/dev.tfvars"
```

### Testing & Validation

**Pre-deployment:**
```bash
terraform validate && terraform fmt -check  # In terraform/
az bicep build --file main.bicep            # In bicep/
checkov -d infrastructure/terraform         # Security scan
```

**Post-deployment:**
```bash
az resource list --tag Project=202546 -o table
python C:/devop/.template-system/scripts/azure-name-validator.py --subscription [id]
az policy state list --filter "complianceState eq 'NonCompliant'" -o table
```

### Git Operations

**Enable hooks:** `git config core.hooksPath .githooks`

**Hooks automatically:**
- Block commits with placeholders
- Block pushes if GitHub Actions failing
- Validate commit messages
- Check for secrets

**Emergency bypass:** `git commit --no-verify` (use sparingly!)

---

## 📋 Azure Naming Standard

**Pattern:** `{type}-{org}-{proj}-{env}-{region}-{slice}-{seq}`

**Examples:**
```
rg-vrd-202546-prd-eus2-app           # Resource Group
app-vrd-202546-prd-eus2-01           # App Service
func-vrd-202546-prd-eus2-01          # Function App
stvrd202546prdeus201                 # Storage (no hyphens)
kv-vrd-202546-prd-eus2-01            # Key Vault
sqlsvr-vrd-202546-prd-eus2           # SQL Server
cosmos-vrd-202546-prd-eus2           # Cosmos DB
```

**Full Documentation:** `technical/azure-naming-standard.md`

### Automation Scripts

Located in `C:\devop\.template-system\scripts\`:

```bash
# Generate resource name
python azure-name-generator.py --type app --org vrd --proj 202546 --env prd --region eus2 --seq 01

# Validate resource name
python azure-name-validator.py --name "app-vrd-202546-prd-eus2-01"

# Generate tags
python azure-tag-generator.py --org vrd --proj 202546 --env prd --region eus2 \
  --owner ops@verdaio.com --cost-center 202546-llc --format terraform
```

---

## 🔒 Azure Security Baseline

**Resources:**
- `technical/azure-security-zero-to-prod-v2.md` - Complete security playbook (Days 0-9)
- `azure-security-baseline-checklist.csv` - 151-task tracking checklist
- `azure-security-runbooks/` - 5 incident response procedures (credential-leak, exposed-storage, suspicious-consent, ransomware, privilege-escalation)
- `infrastructure/azure-security-bicep/` - Production-ready Bicep modules (Recommended)
- `infrastructure/azure-security-terraform/` - Terraform reference modules

**Quick Deploy Security Baseline:**
```bash
cd infrastructure/azure-security-bicep
az deployment sub create --location eastus2 --template-file main.bicep \
  --parameters org=vrd proj=202546 env=prd primaryRegion=eus2 enableDDoS=true firewallSku=Premium
```

**Deploys:** Hub network (Firewall Premium + DDoS + Bastion), Spoke network with NSGs, Log Analytics + Sentinel, Microsoft Defender, Azure Policies, Private DNS zones

**Cost:** ~$5,000-6,000/month (production) | ~$1,000-1,500/month (dev/test)

---

## 🏗️ Infrastructure as Code

### Terraform
**Location:** `infrastructure/terraform/`
**Key Files:** `main.tf`, `variables.tf`, `outputs.tf`, `modules/naming/`, `environments/*.tfvars`

### Bicep
**Location:** `infrastructure/bicep/`
**Key Files:** `main.bicep`, `modules/naming.bicep`, `environments/*.parameters.json`

### CI/CD Pipelines
- **GitHub Actions:** `.github/workflows/` (terraform-plan.yml, terraform-apply.yml, azure-validation.yml, bicep-deploy.yml)
- **Azure DevOps:** `infrastructure/pipelines/` (azure-pipelines.yml, terraform-pipeline.yml, bicep-pipeline.yml)

---

## ⚡ GitHub Health Monitoring

**MANDATORY:** Fix GitHub errors and warnings immediately, not when they block something.

### Zero-Tolerance Policy
- ❌ **NEVER** ignore failing GitHub Actions
- ❌ **NEVER** push code while workflows are failing
- ✅ **ALWAYS** fix errors before next commit

### Daily Monitoring
```bash
gh run list --limit 5           # View latest runs
gh run view --log               # View specific failure
gh api repos/{owner}/{repo}/dependabot/alerts  # Security alerts
```

### When Workflows Fail
1. **Stop new work** - Don't commit until fixed
2. **View logs:** `gh run view --log`
3. **Fix the error** - Not just the symptom
4. **Re-run:** `gh run rerun <run-id>`

**Git hooks automatically prevent pushes if workflows failing.** Enable with: `git config core.hooksPath .githooks`

---

## 🔄 Project Lifecycle Workflow

**See:** `PROJECT-WORKFLOW.md` for complete documentation

### Five Phases
1. **Planning (1-2 weeks):** Discovery, roadmap, architecture
2. **Foundation (1-2 weeks):** Setup, database, auth, CI/CD
3. **Development (4-8 weeks):** Sprint-based feature development
4. **Testing & Polish (2-3 weeks):** QA, performance, security
5. **Launch Preparation (1-2 weeks):** Deployment, monitoring, go-live

### Workflow Commands
```bash
# View current phase
cat .project-state.json | jq '.workflow.currentPhase'

# View current tasks
cat .project-workflow.json | jq '.phases[.currentPhase].checklist'

# View completion percentage
cat .project-workflow.json | jq '.phases[.currentPhase].completionPercent'

# Check strict mode status
cat .workflow-config.json | jq '.strictMode, .enforcePhaseTransitions'
```

### AI Assistant Behavior

**At Session Start:**
1. Read `.project-state.json` → get current phase
2. Read `.project-workflow.json` → get current checklist
3. Show current phase and pending tasks
4. Remind about daily practices if not done
5. Check GitHub Actions status

**Phase-Specific:**
- **Planning:** Guide discovery, create roadmap, ADRs, sprint plans
- **Foundation:** Help scaffolding, database design, auth, CI/CD setup
- **Development:** Sprint planning, code review, testing reminders
- **Testing:** Coverage tracking, performance optimization, security validation
- **Launch:** Deployment checklist, monitoring validation, go-live prep

### Strict Mode Enforcement

**Default:** Strict mode is ON. Phase transitions and daily practices are MANDATORY.

**When user requests phase change:**
1. Validate transition criteria (GitHub Actions green, tests passing, etc.)
2. If validation fails → BLOCK transition and show missing criteria
3. Allow override with reason: "override phase transition with reason: [explanation]"
4. Or disable strict mode: Reference `.workflow-config.json` and `WORKFLOW-STRICT-MODE.md`

**Phase Transition Criteria:**
- Planning → Foundation: Roadmap complete, architecture decided
- Foundation → Development: Infrastructure green, tests passing
- Development → Testing: Core features complete, 60%+ coverage
- Testing → Launch: 80%+ coverage, performance targets met
- Launch → Production: Deployment tested, monitoring active

### Daily Practices
**Morning:** Check GitHub Actions, review yesterday's work, plan today (1-3 tasks)
**During:** Commit frequently, update workflow progress, document decisions, fix errors immediately
**Evening:** Push code, update workflow state, verify GitHub Actions green

**See:** `workflows/DAILY-PRACTICES.md` for complete guide

---

## 🏷️ Required Tags

**Core Tags (Required):**
- `Org`: vrd
- `Project`: 202546
- `Environment`: prd|stg|dev|tst|sbx
- `Region`: eus2
- `Owner`: ops@verdaio.com
- `CostCenter`: 202546-llc

**Recommended:** DataSensitivity, Compliance, DRTier, BackupRetention, ManagedBy

**Tags automatically applied via IaC modules.**

---

## 🔐 Azure Secrets Management

**Key Vault Naming:** `kv-vrd-202546-{env}-eus2-01`

**Secret Naming:** `{service}-{purpose}-{env}`
Examples: `sqlsvr-connection-string-prd`, `storage-access-key-prd`, `api-client-secret-prd`

**Terraform:**
```hcl
data "azurerm_key_vault_secret" "db_connection" {
  name         = "sqlsvr-connection-string-prd"
  key_vault_id = azurerm_key_vault.main.id
}
```

**Bicep:**
```bicep
resource kv 'Microsoft.KeyVault/vaults@2021-10-01' existing = {
  name: 'kv-vrd-202546-prd-eus2-01'
}
output connectionString string = kv.getSecret('sqlsvr-connection-string-prd')
```

---

## 🌍 Multi-Region Architecture

**Primary Region:** eus2 | **Secondary Region:** none

**DR Strategy:** Active-Passive (Recommended) or Active-Active
**Tags:** Add `RegionRole` (primary|secondary|dr|active) and `PairedRegion` tags

---

## 🔍 Azure Policy Enforcement

**Policies:** Resource Group Naming, Required Tags, Tag Inheritance, Naming Validation
**Location:** `infrastructure/policies/`

**Deploy:**
```bash
# Terraform
cd infrastructure/terraform/policies && terraform apply

# Azure CLI
cd infrastructure/policies
az policy definition create --name "rg-naming" --rules rg-naming-policy.json
az policy assignment create --policy "rg-naming" --scope /subscriptions/{sub-id}
```

---

## 📊 Cost Management

**Cost Allocation Tags:** CostCenter: 202546-llc, BusinessUnit (optional), Application: saas202546

**Azure Cost Analysis Queries:**
```kusto
# Cost by Environment
Resources
| where tags['Project'] == '202546'
| extend env = tostring(tags['Environment'])
| summarize cost = sum(toint(tags['monthlyCost'])) by env

# Cost by Resource Type
Resources
| where tags['Project'] == '202546'
| summarize cost = sum(toint(tags['monthlyCost'])) by type
| order by cost desc
```

### 💰 Automatic Cost Optimization (Dev/Staging)

**Save 60-70% on dev/staging costs with automatic resource deallocation!**

**Quick Setup:**
```bash
pip install azure-mgmt-compute azure-mgmt-web azure-mgmt-resource azure-identity
az login
cd C:\devop\.template-system\scripts
python create-deallocation-config.py --interactive
python azure-auto-deallocate.py --dry-run --force
python azure-cost-dashboard.py
.\Setup-AzureDeallocationSchedule.ps1  # PowerShell as Admin
```

**Features:** Auto VM deallocation (8pm-6am weekdays), weekend shutdown (Fri 8pm - Mon 6am), production protection, cost dashboard
**Savings:** ~$47/month per project (60-70% reduction)
**See:** `C:\devop\.template-system\AZURE-AUTO-COST-OPTIMIZATION.md`

---

## 🤖 Virtual Agent: Azure Helper

**Trigger:** User mentions "azure", "deploy", "infrastructure", "terraform", "bicep"

**Common Tasks:**
1. **Generate resource names** → Use `azure-name-generator.py`, validate with `azure-name-validator.py`
2. **Create Terraform module** → Use naming module template, include common_tags
3. **Deploy to Azure** → Validate naming/tagging, run plan first, get approval before apply
4. **Check compliance** → Run Azure Policy checks, validate naming, verify tags
5. **Multi-region setup** → Deploy primary first, configure geo-replication, add multi-region tags

---

## 📚 Documentation

**Azure-Specific:** `technical/azure-naming-standard.md`, `technical/azure-architecture.md`, `technical/azure-security.md`, `infrastructure/README.md`

**General Project:** `product/`, `sprints/`, `technical/`, `business/`

**Onboarding:** `_START-HERE.md`, `docs/ONBOARDING-GUIDE.md`, `README.md`

**Workflow:** `PROJECT-WORKFLOW.md`, `WORKFLOW-STRICT-MODE.md`, `workflows/DAILY-PRACTICES.md`

---

## 🔗 Related Resources

**Azure Naming Tool:** `C:\devop\.template-system\scripts\azure-name-*.py`

**Terraform Registry:**
- [azurerm provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Naming module](https://registry.terraform.io/modules/Azure/naming/azurerm/latest)

**Microsoft Docs:**
- [Azure naming conventions](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/naming-and-tagging)
- [Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/)
- [Bicep documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)

---

## 🚨 Important Notes

1. **Never bypass naming standard** - All resources must follow the pattern
2. **Always tag resources** - Required tags must be present
3. **Validate before deploying** - Run validation scripts
4. **Document exceptions** - Use `infrastructure/EXCEPTIONS.md`
5. **Test in dev first** - Never deploy directly to production
6. **Use IaC modules** - Don't manually create resources
7. **Check costs regularly** - Review Azure Cost Management
8. **Fix errors immediately** - Always follow the user's instruction to "always fix errors as they happen"

---

**Template Version:** 1.0 (Azure)
**Last Updated:** 2025-11-14
