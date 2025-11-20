# ARM Template to Pulumi Deployment Guide

This guide walks you through deploying the converted ARM template as a Pulumi program to Azure.

## Prerequisites

1. **Azure CLI**: Install and authenticate with Azure
   ```bash
   az login
   ```

2. **Pulumi CLI**: Ensure Pulumi is installed
   ```bash
   pulumi version
   ```

3. **Node.js & pnpm**: Required for TypeScript runtime
   ```bash
   node --version
   pnpm --version
   ```

## Step 1: Install Dependencies

Navigate to the project directory and install packages:

```bash
cd arm-conversion
pnpm install
```

## Step 2: Select or Create Pulumi Stack

Select your existing stack or create a new one:

```bash
# Use existing "dev" stack
pulumi stack select dev

# OR create a new stack
pulumi stack init dev
```

## Step 3: Configure Azure Provider

Set the Azure location for your resources:

```bash
pulumi config set azure-native:location eastus
```

You can use any Azure region (e.g., `westus2`, `centralus`, `westeurope`).

## Step 4: Set Required Configuration Values

Set all required configuration parameters:

### Basic Configuration

```bash
# Environment (dev/test/prod)
pulumi config set environment dev

# Project name for resource naming
pulumi config set projectName testproject

# Storage account name (3-24 chars, lowercase and numbers only)
pulumi config set storageAccountName testdevstg01xyz
```

### SQL Server Configuration

```bash
# SQL admin username
pulumi config set sqlAdminUsername sqladmin

# SQL admin password (stored as secret)
pulumi config set --secret sqlAdminPassword "YourStrongPassword123!"
```

### Azure AD Configuration

You'll need to get your Azure AD tenant ID and user object ID:

```bash
# Get your tenant ID
az account show --query tenantId -o tsv

# Get your user object ID
az ad signed-in-user show --query id -o tsv
```

Then set these values:

```bash
# Azure AD Tenant ID
pulumi config set tenantId "your-tenant-id-here"

# User Object ID for Key Vault access
pulumi config set userObjectId "your-user-object-id-here"
```

## Step 5: Verify Configuration

Review all configured values:

```bash
pulumi config
```

Expected output should show all configuration values (secrets will be marked as `[secret]`).

## Step 6: Preview the Deployment

Preview what resources will be created:

```bash
pulumi preview
```

This will show you all ~40+ resources that will be created, including:
- Resource Group
- 6 Network Security Groups
- Virtual Network with 7 subnets
- Storage Account with private endpoint
- Key Vault with private endpoint
- App Service Plan & Web App
- SQL Server & Database with private endpoint
- Databricks Workspace
- 3 Private DNS Zones
- Role Assignments

## Step 7: Deploy to Azure

Deploy the infrastructure:

```bash
pulumi up
```

Review the proposed changes and select "yes" to proceed.

**Note**: The deployment will take approximately 10-15 minutes due to the complexity and number of resources.

## Step 8: View Outputs

After deployment completes, view the stack outputs:

```bash
pulumi stack output
```

Available outputs:
- `resourceGroupName`: Name of the resource group
- `vnetId`: Virtual Network resource ID
- `storageAccountId`: Storage Account resource ID
- `keyVaultUri`: Key Vault URI
- `appServiceUrl`: App Service URL
- `sqlServerFqdn`: SQL Server FQDN
- `databricksWorkspaceUrl`: Databricks Workspace URL

Get specific output values:

```bash
pulumi stack output appServiceUrl
pulumi stack output keyVaultUri
```

## Alternative: Using Pulumi ESC with OIDC

If you want to use OIDC authentication via Pulumi ESC instead of `az login`:

1. Set up an Azure AD application with OIDC trust relationship
2. Configure Pulumi ESC environment with Azure credentials
3. Reference the ESC environment in your stack:

```bash
pulumi config env add <your-esc-environment>
```

## Cleanup

To destroy all resources:

```bash
pulumi destroy
```

Review the resources to be deleted and confirm.

To remove the stack entirely:

```bash
pulumi stack rm dev
```

## Troubleshooting

### Resource Name Conflicts

If you encounter naming conflicts (especially for globally unique resources like Key Vault or SQL Server), the program uses a unique suffix based on the resource group ID. If issues persist, you can modify the `storageAccountName` config value.

### Key Vault Access Issues

If you can't access Key Vault after deployment, verify:
1. Your `userObjectId` is correct
2. Network rules allow access from your IP (you may need to temporarily add your IP to the Key Vault firewall)

### SQL Server Connection

The SQL Server has public network access disabled and uses a private endpoint. To connect:
1. Use Azure Bastion or a VM within the VNet
2. Use VPN Gateway to connect to the VNet
3. Or temporarily enable public access for testing

### Databricks Managed Resource Group

The Databricks workspace creates a managed resource group automatically. Don't delete this resource group manually - it will be cleaned up when you destroy the workspace.

## Configuration Reference

Complete list of required configuration values:

| Configuration Key | Type | Description | Example |
|------------------|------|-------------|---------|
| `azure-native:location` | string | Azure region | `eastus` |
| `environment` | string | Environment name | `dev`, `test`, or `prod` |
| `projectName` | string | Project name for resources | `testproject` |
| `storageAccountName` | string | Storage account name (3-24 chars) | `testdevstg01xyz` |
| `sqlAdminUsername` | string | SQL admin username | `sqladmin` |
| `sqlAdminPassword` | secret | SQL admin password | `YourStrongPassword123!` |
| `tenantId` | string | Azure AD tenant ID | `00000000-0000-0000-0000-000000000000` |
| `userObjectId` | string | User object ID | `00000000-0000-0000-0000-000000000000` |

## Resources Created

This deployment creates approximately 40+ Azure resources:

**Networking (15 resources)**
- 1 Virtual Network
- 7 Subnets (with delegations and service endpoints)
- 6 Network Security Groups
- 3 Private DNS Zones
- 3 VNet Links

**Compute & PaaS (5 resources)**
- 1 App Service Plan
- 1 Web App
- 1 Databricks Workspace (+ managed resource group)
- 1 SQL Server
- 1 SQL Database

**Storage & Security (2 resources)**
- 1 Storage Account
- 1 Key Vault

**Private Connectivity (6 resources)**
- 3 Private Endpoints
- 3 Private DNS Zone Groups

**Identity & Access (2 resources)**
- 2 Role Assignments

Total: ~40 resources (not counting Databricks managed resources)

