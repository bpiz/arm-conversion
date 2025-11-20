#!/bin/bash
# Pulumi Configuration Setup Script
# This script helps you set up the required configuration values for the ARM template conversion

set -e

echo "=== Pulumi ARM Template Conversion - Configuration Setup ==="
echo ""

# Check if Pulumi is installed
if ! command -v pulumi &> /dev/null; then
    echo "ERROR: Pulumi CLI is not installed or not in PATH"
    echo "Please install Pulumi from: https://www.pulumi.com/docs/get-started/install/"
    exit 1
fi

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "WARNING: Azure CLI is not installed or not in PATH"
    echo "You may need it for authentication. Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    echo ""
fi

echo "Step 1: Azure Location Configuration"
echo "---------------------------------------"
read -p "Enter Azure location (e.g., eastus, westus2, centralus) [default: eastus]: " location
location=${location:-eastus}
pulumi config set azure-native:location "$location"
echo "  ✓ Set azure-native:location to $location"
echo ""

echo "Step 2: Environment Configuration"
echo "----------------------------------"
read -p "Enter environment name (dev/test/prod) [default: dev]: " environment
environment=${environment:-dev}
pulumi config set environment "$environment"
echo "  ✓ Set environment to $environment"
echo ""

echo "Step 3: Project Name"
echo "--------------------"
read -p "Enter project name [default: testproject]: " projectName
projectName=${projectName:-testproject}
pulumi config set projectName "$projectName"
echo "  ✓ Set projectName to $projectName"
echo ""

echo "Step 4: Storage Account Name"
echo "-----------------------------"
echo "  (3-24 characters, lowercase letters and numbers only)"
read -p "Enter storage account name [default: testdevstg01xyz]: " storageAccountName
storageAccountName=${storageAccountName:-testdevstg01xyz}
pulumi config set storageAccountName "$storageAccountName"
echo "  ✓ Set storageAccountName to $storageAccountName"
echo ""

echo "Step 5: SQL Server Configuration"
echo "---------------------------------"
read -p "Enter SQL admin username [default: sqladmin]: " sqlAdminUsername
sqlAdminUsername=${sqlAdminUsername:-sqladmin}
pulumi config set sqlAdminUsername "$sqlAdminUsername"
echo "  ✓ Set sqlAdminUsername to $sqlAdminUsername"
echo ""

echo "Enter SQL admin password (will be stored as secret):"
read -s -p "SQL admin password: " sqlAdminPassword
echo ""
if [ -z "$sqlAdminPassword" ]; then
    echo "  ERROR: SQL password cannot be empty"
    exit 1
fi
pulumi config set --secret sqlAdminPassword "$sqlAdminPassword"
echo "  ✓ Set sqlAdminPassword (secret)"
echo ""

echo "Step 6: Azure AD Configuration"
echo "-------------------------------"
echo "  Getting Azure AD information..."

# Try to get tenant ID automatically
if command -v az &> /dev/null; then
    tenantId=$(az account show --query tenantId -o tsv 2>/dev/null || echo "")
    if [ -n "$tenantId" ]; then
        echo "  Auto-detected Tenant ID: $tenantId"
        read -p "  Use this Tenant ID? (Y/n): " useTenantId
        useTenantId=${useTenantId:-Y}
        if [[ "$useTenantId" =~ ^[Yy]$ ]]; then
            pulumi config set tenantId "$tenantId"
            echo "  ✓ Set tenantId to $tenantId"
        else
            read -p "  Enter Tenant ID: " tenantId
            pulumi config set tenantId "$tenantId"
            echo "  ✓ Set tenantId to $tenantId"
        fi
    else
        read -p "  Could not auto-detect. Enter Tenant ID: " tenantId
        pulumi config set tenantId "$tenantId"
        echo "  ✓ Set tenantId to $tenantId"
    fi
else
    read -p "  Enter Tenant ID: " tenantId
    pulumi config set tenantId "$tenantId"
    echo "  ✓ Set tenantId to $tenantId"
fi
echo ""

# Try to get user object ID automatically
if command -v az &> /dev/null; then
    userObjectId=$(az ad signed-in-user show --query id -o tsv 2>/dev/null || echo "")
    if [ -n "$userObjectId" ]; then
        echo "  Auto-detected User Object ID: $userObjectId"
        read -p "  Use this User Object ID? (Y/n): " useObjectId
        useObjectId=${useObjectId:-Y}
        if [[ "$useObjectId" =~ ^[Yy]$ ]]; then
            pulumi config set userObjectId "$userObjectId"
            echo "  ✓ Set userObjectId to $userObjectId"
        else
            read -p "  Enter User Object ID: " userObjectId
            pulumi config set userObjectId "$userObjectId"
            echo "  ✓ Set userObjectId to $userObjectId"
        fi
    else
        read -p "  Could not auto-detect. Enter User Object ID: " userObjectId
        pulumi config set userObjectId "$userObjectId"
        echo "  ✓ Set userObjectId to $userObjectId"
    fi
else
    read -p "  Enter User Object ID: " userObjectId
    pulumi config set userObjectId "$userObjectId"
    echo "  ✓ Set userObjectId to $userObjectId"
fi
echo ""

echo "=== Configuration Complete! ==="
echo ""
echo "Summary of configured values:"
pulumi config
echo ""
echo "Next steps:"
echo "  1. Preview the deployment:  pulumi preview"
echo "  2. Deploy to Azure:         pulumi up"
echo ""
echo "Note: The deployment will create approximately 40 Azure resources"
echo "      and may take 10-15 minutes to complete."
echo ""

