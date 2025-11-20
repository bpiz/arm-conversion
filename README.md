# ARM Template to Pulumi Conversion

This project contains the Pulumi TypeScript conversion of the complex ARM template that deploys a comprehensive Azure infrastructure.

## What Was Converted

The ARM template (`complex-arm-template.json`) has been successfully converted to Pulumi TypeScript in `index.ts`. The conversion includes:

### Resources (40+ total)

**Networking (21 resources)**
- 1 Resource Group
- 6 Network Security Groups with security rules
- 1 Virtual Network with 7 subnets (including delegations and service endpoints)
- 3 Private DNS Zones (blob, Key Vault, SQL)
- 3 Virtual Network Links to Private DNS Zones
- 3 Private Endpoints (Storage, Key Vault, SQL)
- 3 Private DNS Zone Groups

**Compute & Platform Services (5 resources)**
- 1 App Service Plan (Linux S1 Standard)
- 1 Web App (.NET Core 7.0)
- 1 SQL Server with TLS 1.2
- 1 SQL Database (Basic tier)
- 1 Databricks Workspace with VNet injection

**Storage & Security (2 resources)**
- 1 Storage Account (StorageV2, Standard_LRS)
- 1 Key Vault with access policies

**Identity & Access (2 resources)**
- 2 Role Assignments (Storage Contributor, SQL Contributor)

## Key Features

✅ **Network Security**: All resources are deployed with network isolation and security groups
✅ **Private Endpoints**: Storage, Key Vault, and SQL Server use private endpoints
✅ **VNet Integration**: App Service and Databricks are integrated with VNet
✅ **Secure Configuration**: HTTPS only, TLS 1.2 minimum, no public blob access
✅ **RBAC**: Proper role assignments for resource access
✅ **Outputs**: All important resource IDs and URLs are exported

## Quick Start

### Option 1: Automated Setup (Recommended)

Run the configuration setup script:

**Windows (PowerShell):**
```powershell
cd arm-conversion
.\setup-config.ps1
```

**Linux/macOS (Bash):**
```bash
cd arm-conversion
chmod +x setup-config.sh
./setup-config.sh
```

The script will guide you through setting all required configuration values and attempt to auto-detect Azure AD information.

### Option 2: Manual Setup

1. **Install dependencies:**
   ```bash
   cd arm-conversion
   pnpm install
   ```

2. **Set configuration values:**
   ```bash
   pulumi config set azure-native:location eastus
   pulumi config set environment dev
   pulumi config set projectName testproject
   pulumi config set storageAccountName testdevstg01xyz
   pulumi config set sqlAdminUsername sqladmin
   pulumi config set --secret sqlAdminPassword "YourStrongPassword123!"
   pulumi config set tenantId "your-tenant-id"
   pulumi config set userObjectId "your-user-object-id"
   ```

3. **Get Azure AD information:**
   ```bash
   # Get your tenant ID
   az account show --query tenantId -o tsv
   
   # Get your user object ID
   az ad signed-in-user show --query id -o tsv
   ```

## Deployment

### Preview Changes

Review what will be created:

```bash
pulumi preview
```

### Deploy to Azure

Deploy the infrastructure:

```bash
pulumi up
```

**Expected deployment time:** 10-15 minutes

### View Outputs

After deployment, view the created resource information:

```bash
pulumi stack output
```

Available outputs:
- `resourceGroupName` - Resource group name
- `vnetId` - Virtual Network ID
- `storageAccountId` - Storage Account ID
- `keyVaultUri` - Key Vault URI
- `appServiceUrl` - App Service URL
- `sqlServerFqdn` - SQL Server FQDN
- `databricksWorkspaceUrl` - Databricks Workspace URL

## Configuration Reference

| Config Key | Type | Description | Example |
|------------|------|-------------|---------|
| `azure-native:location` | string | Azure region | `eastus` |
| `environment` | string | Environment (dev/test/prod) | `dev` |
| `projectName` | string | Project name for resources | `testproject` |
| `storageAccountName` | string | Storage account name (3-24 chars) | `testdevstg01xyz` |
| `sqlAdminUsername` | string | SQL admin username | `sqladmin` |
| `sqlAdminPassword` | secret | SQL admin password | (stored as secret) |
| `tenantId` | string | Azure AD tenant ID | `00000000-...` |
| `userObjectId` | string | User object ID for access | `00000000-...` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Virtual Network (10.0.0.0/16)           │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  App Service │  │   Storage    │  │     SQL      │      │
│  │    Subnet    │  │    Subnet    │  │   Subnet     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Databricks  │  │   Key Vault  │  │   Private    │      │
│  │   Public     │  │    Subnet    │  │  Endpoints   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐                                            │
│  │  Databricks  │                                            │
│  │   Private    │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
           │                    │                  │
           ▼                    ▼                  ▼
    ┌──────────┐         ┌──────────┐      ┌──────────┐
    │ Storage  │         │ Key Vault│      │   SQL    │
    │ Account  │         │          │      │  Server  │
    └──────────┘         └──────────┘      └──────────┘
```

## Important Notes

### Security Considerations

1. **SQL Server**: Public network access is disabled. Connect via:
   - Azure Bastion or VM within the VNet
   - VPN Gateway connection to the VNet
   - Temporarily enable public access for testing (not recommended)

2. **Key Vault**: Network rules deny public access. To access:
   - Use resources within the allowed subnets
   - Temporarily add your IP to the firewall rules
   - Use Azure Portal which has automatic bypass

3. **Storage Account**: Network ACLs deny public access except from the storage subnet

### Databricks

- Creates a managed resource group automatically
- Don't delete the managed resource group manually
- Will be cleaned up when the workspace is destroyed

### Resource Naming

- Resources use the pattern: `{projectName}-{environment}-{type}`
- Globally unique resources (Key Vault, SQL Server) include a unique suffix based on resource group ID

## Cleanup

To destroy all resources:

```bash
pulumi destroy
```

To remove the stack entirely:

```bash
pulumi stack rm dev
```

## Troubleshooting

### Resource Name Conflicts

If you encounter naming conflicts, modify the `storageAccountName` config value or change `projectName` and `environment`.

### Authentication Issues

Make sure you're logged in to Azure:
```bash
az login
```

Or configure Pulumi ESC with OIDC authentication as mentioned in the configuration.

### Deployment Failures

- Check that all configuration values are set: `pulumi config`
- Verify Azure quotas and limits for your subscription
- Ensure the storage account name is globally unique and follows naming rules

## Additional Resources

- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Azure Native Provider](https://www.pulumi.com/registry/packages/azure-native/)
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide

## Support

For issues with the conversion or deployment, refer to:
- Original ARM template: `../complex-arm-template.json`
- Parameter file: `../complex-arm-template.parameters.json`
- Deployment guide: `DEPLOYMENT.md`
