import * as pulumi from "@pulumi/pulumi";
import * as authorization from "@pulumi/azure-native/authorization";
import * as databricks from "@pulumi/azure-native/databricks";
import * as keyvault from "@pulumi/azure-native/keyvault";
import * as network from "@pulumi/azure-native/network";
import * as privatedns from "@pulumi/azure-native/privatedns";
import * as resources from "@pulumi/azure-native/resources";
import * as sql from "@pulumi/azure-native/sql";
import * as storage from "@pulumi/azure-native/storage";
import * as web from "@pulumi/azure-native/web";

// Get configuration values
const config = new pulumi.Config();
const azureConfig = new pulumi.Config("azure-native");

const location = azureConfig.get("location") || "eastus";
const environment = config.require("environment");
const projectName = config.require("projectName");
const sqlAdminUsername = config.require("sqlAdminUsername");
const sqlAdminPassword = config.requireSecret("sqlAdminPassword");
const tenantId = config.require("tenantId");
const userObjectId = config.require("userObjectId");
const storageAccountName = config.require("storageAccountName");

// Create Resource Group
const resourceGroup = new resources.ResourceGroup("resourceGroup", {
	location: location,
	resourceGroupName: `${projectName}-${environment}-rg`,
});

// Generate unique strings for naming (similar to ARM uniqueString function)
const uniqueSuffix = resourceGroup.id.apply((id) => {
	// Simple hash-like suffix from resource group ID
	const hash = Buffer.from(id)
		.toString("base64")
		.replace(/[^a-z0-9]/gi, "")
		.toLowerCase()
		.substring(0, 8);
	return hash;
});

// Variable names similar to ARM template
const vnetName = `${projectName}-${environment}-vnet`;
const keyVaultName = pulumi.interpolate`${projectName}-${environment}-kv-${uniqueSuffix}`;
const appServicePlanName = `${projectName}-${environment}-asp`;
const appServiceName = `${projectName}-${environment}-app`;
const sqlServerName = pulumi.interpolate`${projectName}-${environment}-sql-${uniqueSuffix}`;
const sqlDatabaseName = `${projectName}-${environment}-db`;
const databricksWorkspaceName = `${projectName}-${environment}-dbw`;

// Subnet names
const appServiceSubnetName = "snet-appservice";
const storageSubnetName = "snet-storage";
const sqlSubnetName = "snet-sql";
const databricksPublicSubnetName = "snet-databricks-public";
const databricksPrivateSubnetName = "snet-databricks-private";
const keyVaultSubnetName = "snet-keyvault";
const privateEndpointSubnetName = "snet-privateendpoints";

// NSG names
const appServiceNsgName = `${projectName}-${environment}-nsg-appservice`;
const storageNsgName = `${projectName}-${environment}-nsg-storage`;
const sqlNsgName = `${projectName}-${environment}-nsg-sql`;
const databricksNsgName = `${projectName}-${environment}-nsg-databricks`;
const keyVaultNsgName = `${projectName}-${environment}-nsg-keyvault`;
const privateEndpointNsgName = `${projectName}-${environment}-nsg-pe`;

// Private endpoint names
const storagePrivateEndpointName = `${projectName}-${environment}-pe-storage`;
const keyVaultPrivateEndpointName = `${projectName}-${environment}-pe-keyvault`;
const sqlPrivateEndpointName = `${projectName}-${environment}-pe-sql`;

// Private DNS zone names
const privateDnsZoneStorageBlob = "privatelink.blob.core.windows.net";
const privateDnsZoneKeyVault = "privatelink.vaultcore.azure.net";
const privateDnsZoneSql = "privatelink.database.windows.net";

// ===== Network Security Groups =====

// App Service NSG
const appServiceNsg = new network.NetworkSecurityGroup("appServiceNsg", {
	resourceGroupName: resourceGroup.name,
	networkSecurityGroupName: appServiceNsgName,
	location: location,
	securityRules: [
		{
			name: "AllowHTTPS",
			priority: 100,
			direction: "Inbound",
			access: "Allow",
			protocol: "Tcp",
			sourcePortRange: "*",
			destinationPortRange: "443",
			sourceAddressPrefix: "Internet",
			destinationAddressPrefix: "*",
		},
		{
			name: "AllowHTTP",
			priority: 110,
			direction: "Inbound",
			access: "Allow",
			protocol: "Tcp",
			sourcePortRange: "*",
			destinationPortRange: "80",
			sourceAddressPrefix: "Internet",
			destinationAddressPrefix: "*",
		},
	],
});

// Storage NSG
const storageNsg = new network.NetworkSecurityGroup("storageNsg", {
	resourceGroupName: resourceGroup.name,
	networkSecurityGroupName: storageNsgName,
	location: location,
	securityRules: [
		{
			name: "DenyAllInbound",
			priority: 100,
			direction: "Inbound",
			access: "Deny",
			protocol: "*",
			sourcePortRange: "*",
			destinationPortRange: "*",
			sourceAddressPrefix: "*",
			destinationAddressPrefix: "*",
		},
	],
});

// SQL NSG
const sqlNsg = new network.NetworkSecurityGroup("sqlNsg", {
	resourceGroupName: resourceGroup.name,
	networkSecurityGroupName: sqlNsgName,
	location: location,
	securityRules: [
		{
			name: "AllowVnetInbound",
			priority: 100,
			direction: "Inbound",
			access: "Allow",
			protocol: "Tcp",
			sourcePortRange: "*",
			destinationPortRange: "1433",
			sourceAddressPrefix: "VirtualNetwork",
			destinationAddressPrefix: "*",
		},
		{
			name: "DenyAllInbound",
			priority: 200,
			direction: "Inbound",
			access: "Deny",
			protocol: "*",
			sourcePortRange: "*",
			destinationPortRange: "*",
			sourceAddressPrefix: "*",
			destinationAddressPrefix: "*",
		},
	],
});

// Databricks NSG
const databricksNsg = new network.NetworkSecurityGroup("databricksNsg", {
	resourceGroupName: resourceGroup.name,
	networkSecurityGroupName: databricksNsgName,
	location: location,
	securityRules: [],
});

// Key Vault NSG
const keyVaultNsg = new network.NetworkSecurityGroup("keyVaultNsg", {
	resourceGroupName: resourceGroup.name,
	networkSecurityGroupName: keyVaultNsgName,
	location: location,
	securityRules: [
		{
			name: "AllowVnetInbound",
			priority: 100,
			direction: "Inbound",
			access: "Allow",
			protocol: "Tcp",
			sourcePortRange: "*",
			destinationPortRange: "443",
			sourceAddressPrefix: "VirtualNetwork",
			destinationAddressPrefix: "*",
		},
	],
});

// Private Endpoint NSG
const privateEndpointNsg = new network.NetworkSecurityGroup(
	"privateEndpointNsg",
	{
		resourceGroupName: resourceGroup.name,
		networkSecurityGroupName: privateEndpointNsgName,
		location: location,
		securityRules: [],
	}
);

// ===== Virtual Network =====

const virtualNetwork = new network.VirtualNetwork("virtualNetwork", {
	resourceGroupName: resourceGroup.name,
	virtualNetworkName: vnetName,
	location: location,
	addressSpace: {
		addressPrefixes: ["10.0.0.0/16"],
	},
	subnets: [
		{
			name: appServiceSubnetName,
			addressPrefix: "10.0.1.0/24",
			networkSecurityGroup: {
				id: appServiceNsg.id,
			},
			delegations: [
				{
					name: "delegation",
					serviceName: "Microsoft.Web/serverfarms",
				},
			],
		},
		{
			name: storageSubnetName,
			addressPrefix: "10.0.2.0/24",
			networkSecurityGroup: {
				id: storageNsg.id,
			},
			serviceEndpoints: [
				{
					service: "Microsoft.Storage",
				},
			],
		},
		{
			name: sqlSubnetName,
			addressPrefix: "10.0.3.0/24",
			networkSecurityGroup: {
				id: sqlNsg.id,
			},
			serviceEndpoints: [
				{
					service: "Microsoft.Sql",
				},
			],
		},
		{
			name: databricksPublicSubnetName,
			addressPrefix: "10.0.4.0/24",
			networkSecurityGroup: {
				id: databricksNsg.id,
			},
			delegations: [
				{
					name: "databricks-del-public",
					serviceName: "Microsoft.Databricks/workspaces",
				},
			],
		},
		{
			name: databricksPrivateSubnetName,
			addressPrefix: "10.0.5.0/24",
			networkSecurityGroup: {
				id: databricksNsg.id,
			},
			delegations: [
				{
					name: "databricks-del-private",
					serviceName: "Microsoft.Databricks/workspaces",
				},
			],
		},
		{
			name: keyVaultSubnetName,
			addressPrefix: "10.0.6.0/24",
			networkSecurityGroup: {
				id: keyVaultNsg.id,
			},
			serviceEndpoints: [
				{
					service: "Microsoft.KeyVault",
				},
			],
		},
		{
			name: privateEndpointSubnetName,
			addressPrefix: "10.0.7.0/24",
			networkSecurityGroup: {
				id: privateEndpointNsg.id,
			},
			privateEndpointNetworkPolicies: "Disabled",
			privateLinkServiceNetworkPolicies: "Enabled",
		},
	],
});

// Get subnet IDs for later use
const appServiceSubnetId = pulumi.interpolate`${virtualNetwork.id}/subnets/${appServiceSubnetName}`;
const storageSubnetId = pulumi.interpolate`${virtualNetwork.id}/subnets/${storageSubnetName}`;
const sqlSubnetId = pulumi.interpolate`${virtualNetwork.id}/subnets/${sqlSubnetName}`;
const keyVaultSubnetId = pulumi.interpolate`${virtualNetwork.id}/subnets/${keyVaultSubnetName}`;
const privateEndpointSubnetId = pulumi.interpolate`${virtualNetwork.id}/subnets/${privateEndpointSubnetName}`;

// ===== Storage Account =====

const storageAccount = new storage.StorageAccount("storageAccount", {
	resourceGroupName: resourceGroup.name,
	accountName: storageAccountName,
	location: location,
	sku: {
		name: storage.SkuName.Standard_LRS,
	},
	kind: storage.Kind.StorageV2,
	accessTier: storage.AccessTier.Hot,
	enableHttpsTrafficOnly: true,
	minimumTlsVersion: storage.MinimumTlsVersion.TLS1_2,
	allowBlobPublicAccess: false,
	networkRuleSet: {
		defaultAction: storage.DefaultAction.Deny,
		bypass: storage.Bypass.AzureServices,
		virtualNetworkRules: [
			{
				virtualNetworkResourceId: storageSubnetId,
			},
		],
	},
});

// ===== Key Vault =====

const keyVault = new keyvault.Vault("keyVault", {
	resourceGroupName: resourceGroup.name,
	vaultName: keyVaultName,
	location: location,
	properties: {
		sku: {
			family: "A",
			name: keyvault.SkuName.Standard,
		},
		tenantId: tenantId,
		accessPolicies: [
			{
				tenantId: tenantId,
				objectId: userObjectId,
				permissions: {
					keys: [
						keyvault.KeyPermissions.Get,
						keyvault.KeyPermissions.List,
						keyvault.KeyPermissions.Create,
						keyvault.KeyPermissions.Update,
						keyvault.KeyPermissions.Import,
						keyvault.KeyPermissions.Delete,
						keyvault.KeyPermissions.Backup,
						keyvault.KeyPermissions.Restore,
					],
					secrets: [
						keyvault.SecretPermissions.Get,
						keyvault.SecretPermissions.List,
						keyvault.SecretPermissions.Set,
						keyvault.SecretPermissions.Delete,
						keyvault.SecretPermissions.Backup,
						keyvault.SecretPermissions.Restore,
					],
					certificates: [
						keyvault.CertificatePermissions.Get,
						keyvault.CertificatePermissions.List,
						keyvault.CertificatePermissions.Create,
						keyvault.CertificatePermissions.Update,
						keyvault.CertificatePermissions.Delete,
					],
				},
			},
		],
		enabledForDeployment: true,
		enabledForTemplateDeployment: true,
		enabledForDiskEncryption: true,
		enableSoftDelete: true,
		softDeleteRetentionInDays: 90,
		enablePurgeProtection: true,
		networkAcls: {
			defaultAction: keyvault.NetworkRuleAction.Deny,
			bypass: keyvault.NetworkRuleBypassOptions.AzureServices,
			virtualNetworkRules: [
				{
					id: keyVaultSubnetId,
				},
			],
		},
	},
});

// ===== App Service Plan & Web App =====

const appServicePlan = new web.AppServicePlan("appServicePlan", {
	resourceGroupName: resourceGroup.name,
	name: appServicePlanName,
	location: location,
	sku: {
		name: "S1",
		tier: "Standard",
	},
	kind: "linux",
	reserved: true,
});

const appService = new web.WebApp("appService", {
	resourceGroupName: resourceGroup.name,
	name: appServiceName,
	location: location,
	kind: "app,linux",
	serverFarmId: appServicePlan.id,
	siteConfig: {
		linuxFxVersion: "DOTNETCORE|7.0",
		alwaysOn: true,
		ftpsState: web.FtpsState.Disabled,
		minTlsVersion: web.SupportedTlsVersions.SupportedTlsVersions_1_2,
		http20Enabled: true,
	},
	httpsOnly: true,
	virtualNetworkSubnetId: appServiceSubnetId,
});

// ===== SQL Server & Database =====

const sqlServer = new sql.Server("sqlServer", {
	resourceGroupName: resourceGroup.name,
	serverName: sqlServerName,
	location: location,
	administratorLogin: sqlAdminUsername,
	administratorLoginPassword: sqlAdminPassword,
	version: "12.0",
	minimalTlsVersion: "1.2",
	publicNetworkAccess: sql.ServerPublicNetworkAccessFlag.Disabled,
});

const sqlDatabase = new sql.Database("sqlDatabase", {
	resourceGroupName: resourceGroup.name,
	serverName: sqlServer.name,
	databaseName: sqlDatabaseName,
	location: location,
	sku: {
		name: "Basic",
		tier: "Basic",
	},
	collation: "SQL_Latin1_General_CP1_CI_AS",
});

// ===== Databricks Workspace =====

const databricksManagedResourceGroupName = pulumi.interpolate`databricks-rg-${databricksWorkspaceName}-${uniqueSuffix}`;

const databricksWorkspace = new databricks.Workspace("databricksWorkspace", {
	resourceGroupName: resourceGroup.name,
	workspaceName: databricksWorkspaceName,
	location: location,
	sku: {
		name: "standard",
	},
	managedResourceGroupId: pulumi.interpolate`/subscriptions/${
		authorization.getClientConfigOutput().subscriptionId
	}/resourceGroups/${databricksManagedResourceGroupName}`,
	parameters: {
		customVirtualNetworkId: {
			value: virtualNetwork.id,
		},
		customPublicSubnetName: {
			value: databricksPublicSubnetName,
		},
		customPrivateSubnetName: {
			value: databricksPrivateSubnetName,
		},
		enableNoPublicIp: {
			value: true,
		},
	},
});

// ===== Private DNS Zones =====

const privateDnsZoneBlob = new privatedns.PrivateZone("privateDnsZoneBlob", {
	resourceGroupName: resourceGroup.name,
	privateZoneName: privateDnsZoneStorageBlob,
	location: "global",
});

const privateDnsZoneKv = new privatedns.PrivateZone("privateDnsZoneKv", {
	resourceGroupName: resourceGroup.name,
	privateZoneName: privateDnsZoneKeyVault,
	location: "global",
});

const privateDnsZoneSqlDb = new privatedns.PrivateZone("privateDnsZoneSqlDb", {
	resourceGroupName: resourceGroup.name,
	privateZoneName: privateDnsZoneSql,
	location: "global",
});

// ===== Virtual Network Links =====

const vnetLinkBlob = new privatedns.VirtualNetworkLink("vnetLinkBlob", {
	resourceGroupName: resourceGroup.name,
	privateZoneName: privateDnsZoneBlob.name,
	virtualNetworkLinkName: `link-to-${vnetName}`,
	location: "global",
	registrationEnabled: false,
	virtualNetwork: {
		id: virtualNetwork.id,
	},
});

const vnetLinkKv = new privatedns.VirtualNetworkLink("vnetLinkKv", {
	resourceGroupName: resourceGroup.name,
	privateZoneName: privateDnsZoneKv.name,
	virtualNetworkLinkName: `link-to-${vnetName}`,
	location: "global",
	registrationEnabled: false,
	virtualNetwork: {
		id: virtualNetwork.id,
	},
});

const vnetLinkSql = new privatedns.VirtualNetworkLink("vnetLinkSql", {
	resourceGroupName: resourceGroup.name,
	privateZoneName: privateDnsZoneSqlDb.name,
	virtualNetworkLinkName: `link-to-${vnetName}`,
	location: "global",
	registrationEnabled: false,
	virtualNetwork: {
		id: virtualNetwork.id,
	},
});

// ===== Private Endpoints =====

// Storage Private Endpoint
const storagePrivateEndpoint = new network.PrivateEndpoint(
	"storagePrivateEndpoint",
	{
		resourceGroupName: resourceGroup.name,
		privateEndpointName: storagePrivateEndpointName,
		location: location,
		subnet: {
			id: privateEndpointSubnetId,
		},
		privateLinkServiceConnections: [
			{
				name: "storage-privatelink",
				privateLinkServiceId: storageAccount.id,
				groupIds: ["blob"],
			},
		],
	}
);

const storagePeDnsZoneGroup = new network.PrivateDnsZoneGroup(
	"storagePeDnsZoneGroup",
	{
		resourceGroupName: resourceGroup.name,
		privateEndpointName: storagePrivateEndpoint.name,
		privateDnsZoneGroupName: "default",
		privateDnsZoneConfigs: [
			{
				name: "storage-blob-dns",
				privateDnsZoneId: privateDnsZoneBlob.id,
			},
		],
	}
);

// Key Vault Private Endpoint
const keyVaultPrivateEndpoint = new network.PrivateEndpoint(
	"keyVaultPrivateEndpoint",
	{
		resourceGroupName: resourceGroup.name,
		privateEndpointName: keyVaultPrivateEndpointName,
		location: location,
		subnet: {
			id: privateEndpointSubnetId,
		},
		privateLinkServiceConnections: [
			{
				name: "keyvault-privatelink",
				privateLinkServiceId: keyVault.id,
				groupIds: ["vault"],
			},
		],
	}
);

const keyVaultPeDnsZoneGroup = new network.PrivateDnsZoneGroup(
	"keyVaultPeDnsZoneGroup",
	{
		resourceGroupName: resourceGroup.name,
		privateEndpointName: keyVaultPrivateEndpoint.name,
		privateDnsZoneGroupName: "default",
		privateDnsZoneConfigs: [
			{
				name: "keyvault-dns",
				privateDnsZoneId: privateDnsZoneKv.id,
			},
		],
	}
);

// SQL Private Endpoint
const sqlPrivateEndpoint = new network.PrivateEndpoint("sqlPrivateEndpoint", {
	resourceGroupName: resourceGroup.name,
	privateEndpointName: sqlPrivateEndpointName,
	location: location,
	subnet: {
		id: privateEndpointSubnetId,
	},
	privateLinkServiceConnections: [
		{
			name: "sql-privatelink",
			privateLinkServiceId: sqlServer.id,
			groupIds: ["sqlServer"],
		},
	],
});

const sqlPeDnsZoneGroup = new network.PrivateDnsZoneGroup("sqlPeDnsZoneGroup", {
	resourceGroupName: resourceGroup.name,
	privateEndpointName: sqlPrivateEndpoint.name,
	privateDnsZoneGroupName: "default",
	privateDnsZoneConfigs: [
		{
			name: "sql-dns",
			privateDnsZoneId: privateDnsZoneSqlDb.id,
		},
	],
});

// ===== Role Assignments =====

// Storage Account Contributor role
const storageRoleAssignment = new authorization.RoleAssignment(
	"storageRoleAssignment",
	{
		scope: storageAccount.id,
		roleDefinitionId: pulumi.interpolate`/subscriptions/${
			authorization.getClientConfigOutput().subscriptionId
		}/providers/Microsoft.Authorization/roleDefinitions/17d1049b-9a84-46fb-8f53-869881c3d3ab`,
		principalId: userObjectId,
		principalType: authorization.PrincipalType.User,
	}
);

// SQL DB Contributor role
const sqlRoleAssignment = new authorization.RoleAssignment(
	"sqlRoleAssignment",
	{
		scope: sqlServer.id,
		roleDefinitionId: pulumi.interpolate`/subscriptions/${
			authorization.getClientConfigOutput().subscriptionId
		}/providers/Microsoft.Authorization/roleDefinitions/6d8ee4ec-f05a-4a1d-8b00-a9b17e38b437`,
		principalId: userObjectId,
		principalType: authorization.PrincipalType.User,
	}
);

// ===== Outputs =====

export const resourceGroupName = resourceGroup.name;
export const vnetId = virtualNetwork.id;
export const storageAccountId = storageAccount.id;
export const keyVaultUri = keyVault.properties.apply((p) => p.vaultUri);
export const appServiceUrl = appService.defaultHostName.apply(
	(hostname) => `https://${hostname}`
);
export const sqlServerFqdn = sqlServer.fullyQualifiedDomainName;
export const databricksWorkspaceUrl = databricksWorkspace.workspaceUrl.apply(
	(url) => `https://${url}`
);
