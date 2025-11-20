# Pulumi Configuration Setup Script
# This script helps you set up the required configuration values for the ARM template conversion

Write-Host "=== Pulumi ARM Template Conversion - Configuration Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if Pulumi is installed
try {
    $null = pulumi version
} catch {
    Write-Host "ERROR: Pulumi CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Pulumi from: https://www.pulumi.com/docs/get-started/install/" -ForegroundColor Yellow
    exit 1
}

# Check if Azure CLI is installed
try {
    $null = az version
} catch {
    Write-Host "WARNING: Azure CLI is not installed or not in PATH" -ForegroundColor Yellow
    Write-Host "You may need it for authentication. Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Step 1: Azure Location Configuration" -ForegroundColor Green
Write-Host "---------------------------------------"
$location = Read-Host "Enter Azure location (e.g., eastus, westus2, centralus) [default: eastus]"
if ([string]::IsNullOrWhiteSpace($location)) {
    $location = "eastus"
}
pulumi config set azure-native:location $location
Write-Host "  ✓ Set azure-native:location to $location" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 2: Environment Configuration" -ForegroundColor Green
Write-Host "----------------------------------"
$environment = Read-Host "Enter environment name (dev/test/prod) [default: dev]"
if ([string]::IsNullOrWhiteSpace($environment)) {
    $environment = "dev"
}
pulumi config set environment $environment
Write-Host "  ✓ Set environment to $environment" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 3: Project Name" -ForegroundColor Green
Write-Host "--------------------"
$projectName = Read-Host "Enter project name [default: testproject]"
if ([string]::IsNullOrWhiteSpace($projectName)) {
    $projectName = "testproject"
}
pulumi config set projectName $projectName
Write-Host "  ✓ Set projectName to $projectName" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 4: Storage Account Name" -ForegroundColor Green
Write-Host "-----------------------------"
Write-Host "  (3-24 characters, lowercase letters and numbers only)" -ForegroundColor Gray
$storageAccountName = Read-Host "Enter storage account name [default: testdevstg01xyz]"
if ([string]::IsNullOrWhiteSpace($storageAccountName)) {
    $storageAccountName = "testdevstg01xyz"
}
pulumi config set storageAccountName $storageAccountName
Write-Host "  ✓ Set storageAccountName to $storageAccountName" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 5: SQL Server Configuration" -ForegroundColor Green
Write-Host "---------------------------------"
$sqlAdminUsername = Read-Host "Enter SQL admin username [default: sqladmin]"
if ([string]::IsNullOrWhiteSpace($sqlAdminUsername)) {
    $sqlAdminUsername = "sqladmin"
}
pulumi config set sqlAdminUsername $sqlAdminUsername
Write-Host "  ✓ Set sqlAdminUsername to $sqlAdminUsername" -ForegroundColor Gray
Write-Host ""

Write-Host "Enter SQL admin password (will be stored as secret):" -ForegroundColor Yellow
$sqlAdminPassword = Read-Host "SQL admin password" -AsSecureString
$sqlAdminPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sqlAdminPassword))
if ([string]::IsNullOrWhiteSpace($sqlAdminPasswordPlain)) {
    Write-Host "  ERROR: SQL password cannot be empty" -ForegroundColor Red
    exit 1
}
pulumi config set --secret sqlAdminPassword $sqlAdminPasswordPlain
Write-Host "  ✓ Set sqlAdminPassword (secret)" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 6: Azure AD Configuration" -ForegroundColor Green
Write-Host "-------------------------------"
Write-Host "  Getting Azure AD information..." -ForegroundColor Gray

# Try to get tenant ID automatically
try {
    $tenantId = az account show --query tenantId -o tsv 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($tenantId)) {
        Write-Host "  Auto-detected Tenant ID: $tenantId" -ForegroundColor Gray
        $useTenantId = Read-Host "  Use this Tenant ID? (Y/n)"
        if ([string]::IsNullOrWhiteSpace($useTenantId) -or $useTenantId -eq "Y" -or $useTenantId -eq "y") {
            pulumi config set tenantId $tenantId
            Write-Host "  ✓ Set tenantId to $tenantId" -ForegroundColor Gray
        } else {
            $tenantId = Read-Host "  Enter Tenant ID"
            pulumi config set tenantId $tenantId
            Write-Host "  ✓ Set tenantId to $tenantId" -ForegroundColor Gray
        }
    } else {
        throw "Could not auto-detect"
    }
} catch {
    Write-Host "  Could not auto-detect Tenant ID. Please enter manually." -ForegroundColor Yellow
    $tenantId = Read-Host "  Enter Tenant ID"
    pulumi config set tenantId $tenantId
    Write-Host "  ✓ Set tenantId to $tenantId" -ForegroundColor Gray
}
Write-Host ""

# Try to get user object ID automatically
try {
    $userObjectId = az ad signed-in-user show --query id -o tsv 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($userObjectId)) {
        Write-Host "  Auto-detected User Object ID: $userObjectId" -ForegroundColor Gray
        $useObjectId = Read-Host "  Use this User Object ID? (Y/n)"
        if ([string]::IsNullOrWhiteSpace($useObjectId) -or $useObjectId -eq "Y" -or $useObjectId -eq "y") {
            pulumi config set userObjectId $userObjectId
            Write-Host "  ✓ Set userObjectId to $userObjectId" -ForegroundColor Gray
        } else {
            $userObjectId = Read-Host "  Enter User Object ID"
            pulumi config set userObjectId $userObjectId
            Write-Host "  ✓ Set userObjectId to $userObjectId" -ForegroundColor Gray
        }
    } else {
        throw "Could not auto-detect"
    }
} catch {
    Write-Host "  Could not auto-detect User Object ID. Please enter manually." -ForegroundColor Yellow
    $userObjectId = Read-Host "  Enter User Object ID"
    pulumi config set userObjectId $userObjectId
    Write-Host "  ✓ Set userObjectId to $userObjectId" -ForegroundColor Gray
}
Write-Host ""

Write-Host "=== Configuration Complete! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary of configured values:" -ForegroundColor Yellow
pulumi config
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  1. Preview the deployment:  pulumi preview" -ForegroundColor White
Write-Host "  2. Deploy to Azure:         pulumi up" -ForegroundColor White
Write-Host ""
Write-Host "Note: The deployment will create approximately 40 Azure resources" -ForegroundColor Gray
Write-Host "      and may take 10-15 minutes to complete." -ForegroundColor Gray
Write-Host ""

