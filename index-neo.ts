import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";

// Get configuration
const config = new pulumi.Config();
const environment = config.require("environment");
const projectName = config.require("projectName");
const location = config.get("azure-native:location") || "EastUS2";

// Create an Azure Resource Group
const resourceGroup = new azure_native.resources.ResourceGroup(
	"resourceGroup",
	{
		location: location,
	}
);

// Network Security Groups
// App Service NSG
const appServiceNsg = new azure_native.network.NetworkSecurityGroup(
	"appServiceNsg",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		networkSecurityGroupName: `${projectName}-${environment}-nsg-appservice`,
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
	}
);

// Storage NSG
const storageNsg = new azure_native.network.NetworkSecurityGroup("storageNsg", {
	resourceGroupName: resourceGroup.name,
	location: location,
	networkSecurityGroupName: `${projectName}-${environment}-nsg-storage`,
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
const sqlNsg = new azure_native.network.NetworkSecurityGroup("sqlNsg", {
	resourceGroupName: resourceGroup.name,
	location: location,
	networkSecurityGroupName: `${projectName}-${environment}-nsg-sql`,
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
const databricksNsg = new azure_native.network.NetworkSecurityGroup(
	"databricksNsg",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		networkSecurityGroupName: `${projectName}-${environment}-nsg-databricks`,
		securityRules: [],
	}
);

// Key Vault NSG
const keyVaultNsg = new azure_native.network.NetworkSecurityGroup(
	"keyVaultNsg",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		networkSecurityGroupName: `${projectName}-${environment}-nsg-keyvault`,
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
	}
);

// Private Endpoint NSG
const privateEndpointNsg = new azure_native.network.NetworkSecurityGroup(
	"privateEndpointNsg",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		networkSecurityGroupName: `${projectName}-${environment}-nsg-pe`,
		securityRules: [],
	}
);

// Virtual Network with 7 subnets
const vnet = new azure_native.network.VirtualNetwork("vnet", {
	resourceGroupName: resourceGroup.name,
	location: location,
	virtualNetworkName: `${projectName}-${environment}-vnet`,
	addressSpace: {
		addressPrefixes: ["10.0.0.0/16"],
	},
	subnets: [
		{
			name: "snet-appservice",
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
			name: "snet-storage",
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
			name: "snet-sql",
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
			name: "snet-databricks-public",
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
			name: "snet-databricks-private",
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
			name: "snet-keyvault",
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
			name: "snet-privateendpoints",
			addressPrefix: "10.0.7.0/24",
			networkSecurityGroup: {
				id: privateEndpointNsg.id,
			},
			privateEndpointNetworkPolicies: "Disabled",
			privateLinkServiceNetworkPolicies: "Enabled",
		},
	],
});

// Storage Account with network ACLs
const storageAccountName = config.require("storageAccountName");
const storageAccount = new azure_native.storage.StorageAccount(
	"storageAccount",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		accountName: storageAccountName,
		sku: {
			name: "Standard_LRS",
		},
		kind: "StorageV2",
		accessTier: "Hot",
		enableHttpsTrafficOnly: true,
		minimumTlsVersion: "TLS1_2",
		allowBlobPublicAccess: false,
		networkRuleSet: {
			defaultAction: "Deny",
			bypass: "AzureServices",
			virtualNetworkRules: [
				{
					virtualNetworkResourceId: pulumi.interpolate`${vnet.id}/subnets/snet-storage`,
				},
			],
		},
	}
);

// Private DNS Zone for Storage Blob
const privateDnsZoneStorageBlob = new azure_native.privatedns.PrivateZone(
	"privateDnsZoneStorageBlob",
	{
		resourceGroupName: resourceGroup.name,
		privateZoneName: "privatelink.blob.core.windows.net",
		location: "global",
	}
);

// VNet Link for Storage Blob DNS Zone
const storageBlobVnetLink = new azure_native.privatedns.VirtualNetworkLink(
	"storageBlobVnetLink",
	{
		resourceGroupName: resourceGroup.name,
		privateZoneName: privateDnsZoneStorageBlob.name,
		virtualNetworkLinkName: pulumi.interpolate`link-to-${vnet.name}`,
		location: "global",
		registrationEnabled: false,
		virtualNetwork: {
			id: vnet.id,
		},
	}
);

// Private Endpoint for Storage
const storagePrivateEndpoint = new azure_native.network.PrivateEndpoint(
	"storagePrivateEndpoint",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		privateEndpointName: `${projectName}-${environment}-pe-storage`,
		subnet: {
			id: pulumi.interpolate`${vnet.id}/subnets/snet-privateendpoints`,
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

// Private DNS Zone Group for Storage
const storagePrivateDnsZoneGroup = new azure_native.network.PrivateDnsZoneGroup(
	"storagePrivateDnsZoneGroup",
	{
		resourceGroupName: resourceGroup.name,
		privateEndpointName: storagePrivateEndpoint.name,
		privateDnsZoneGroupName: "default",
		privateDnsZoneConfigs: [
			{
				name: "storage-blob-dns",
				privateDnsZoneId: privateDnsZoneStorageBlob.id,
			},
		],
	}
);

// Get tenant ID and user object ID from config
const userObjectId = config.require("userObjectId");
const tenantId = pulumi.output(
	azure_native.authorization.getClientConfig()
).tenantId;

// Key Vault - name must be 3-24 chars, alphanumeric and hyphens only
// Generate a short unique suffix from resource group ID
const keyVaultName = resourceGroup.id.apply((id) => {
	const rgName = id.split("/").pop() || "default";
	const hash = rgName.substring(0, 6);
	return `${projectName}-${environment}-kv-${hash}`.substring(0, 24);
});

const keyVault = new azure_native.keyvault.Vault("keyVault", {
	resourceGroupName: resourceGroup.name,
	location: location,
	vaultName: keyVaultName,
	properties: {
		sku: {
			family: "A",
			name: "standard",
		},
		tenantId: tenantId,
		accessPolicies: [
			{
				tenantId: tenantId,
				objectId: userObjectId,
				permissions: {
					keys: [
						"get",
						"list",
						"create",
						"update",
						"import",
						"delete",
						"backup",
						"restore",
					],
					secrets: [
						"get",
						"list",
						"set",
						"delete",
						"backup",
						"restore",
					],
					certificates: ["get", "list", "create", "update", "delete"],
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
			defaultAction: "Deny",
			bypass: "AzureServices",
			virtualNetworkRules: [
				{
					id: pulumi.interpolate`${vnet.id}/subnets/snet-keyvault`,
				},
			],
		},
	},
});

// Private DNS Zone for Key Vault
const privateDnsZoneKeyVault = new azure_native.privatedns.PrivateZone(
	"privateDnsZoneKeyVault",
	{
		resourceGroupName: resourceGroup.name,
		privateZoneName: "privatelink.vaultcore.azure.net",
		location: "global",
	}
);

// VNet Link for Key Vault DNS Zone
const keyVaultVnetLink = new azure_native.privatedns.VirtualNetworkLink(
	"keyVaultVnetLink",
	{
		resourceGroupName: resourceGroup.name,
		privateZoneName: privateDnsZoneKeyVault.name,
		virtualNetworkLinkName: pulumi.interpolate`link-to-${vnet.name}`,
		location: "global",
		registrationEnabled: false,
		virtualNetwork: {
			id: vnet.id,
		},
	}
);

// Private Endpoint for Key Vault
const keyVaultPrivateEndpoint = new azure_native.network.PrivateEndpoint(
	"keyVaultPrivateEndpoint",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		privateEndpointName: `${projectName}-${environment}-pe-keyvault`,
		subnet: {
			id: pulumi.interpolate`${vnet.id}/subnets/snet-privateendpoints`,
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

// Private DNS Zone Group for Key Vault
const keyVaultPrivateDnsZoneGroup =
	new azure_native.network.PrivateDnsZoneGroup(
		"keyVaultPrivateDnsZoneGroup",
		{
			resourceGroupName: resourceGroup.name,
			privateEndpointName: keyVaultPrivateEndpoint.name,
			privateDnsZoneGroupName: "default",
			privateDnsZoneConfigs: [
				{
					name: "keyvault-dns",
					privateDnsZoneId: privateDnsZoneKeyVault.id,
				},
			],
		}
	);

// App Service Plan
const appServicePlan = new azure_native.web.AppServicePlan("appServicePlan", {
	resourceGroupName: resourceGroup.name,
	location: location,
	name: `${projectName}-${environment}-asp`,
	sku: {
		name: "S1",
		tier: "Standard",
	},
	kind: "linux",
	reserved: true,
});

// App Service
const appService = new azure_native.web.WebApp("appService", {
	resourceGroupName: resourceGroup.name,
	location: location,
	name: `${projectName}-${environment}-app`,
	serverFarmId: appServicePlan.id,
	kind: "app,linux",
	siteConfig: {
		linuxFxVersion: "DOTNETCORE|7.0",
		alwaysOn: true,
		ftpsState: "Disabled",
		minTlsVersion: "1.2",
		http20Enabled: true,
	},
	httpsOnly: true,
	virtualNetworkSubnetId: pulumi.interpolate`${vnet.id}/subnets/snet-appservice`,
});

// SQL Server
const sqlAdminUsername = config.require("sqlAdminUsername");
const sqlAdminPassword = config.requireSecret("sqlAdminPassword");

// SQL Server name - must be globally unique, lowercase letters, numbers, and hyphens
const sqlServerName = resourceGroup.id.apply((id) => {
	const rgName = id.split("/").pop() || "default";
	const hash = rgName.substring(0, 8).toLowerCase();
	return `${projectName}-${environment}-sql-${hash}`;
});

const sqlServer = new azure_native.sql.Server("sqlServer", {
	resourceGroupName: resourceGroup.name,
	location: location,
	serverName: sqlServerName,
	administratorLogin: sqlAdminUsername,
	administratorLoginPassword: sqlAdminPassword,
	version: "12.0",
	minimalTlsVersion: "1.2",
	publicNetworkAccess: "Disabled",
});

// SQL Database
const sqlDatabase = new azure_native.sql.Database("sqlDatabase", {
	resourceGroupName: resourceGroup.name,
	location: location,
	serverName: sqlServer.name,
	databaseName: `${projectName}-${environment}-db`,
	sku: {
		name: "Basic",
		tier: "Basic",
	},
	collation: "SQL_Latin1_General_CP1_CI_AS",
});

// Private DNS Zone for SQL
const privateDnsZoneSql = new azure_native.privatedns.PrivateZone(
	"privateDnsZoneSql",
	{
		resourceGroupName: resourceGroup.name,
		privateZoneName: "privatelink.database.windows.net",
		location: "global",
	}
);

// VNet Link for SQL DNS Zone
const sqlVnetLink = new azure_native.privatedns.VirtualNetworkLink(
	"sqlVnetLink",
	{
		resourceGroupName: resourceGroup.name,
		privateZoneName: privateDnsZoneSql.name,
		virtualNetworkLinkName: pulumi.interpolate`link-to-${vnet.name}`,
		location: "global",
		registrationEnabled: false,
		virtualNetwork: {
			id: vnet.id,
		},
	}
);

// Private Endpoint for SQL
const sqlPrivateEndpoint = new azure_native.network.PrivateEndpoint(
	"sqlPrivateEndpoint",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		privateEndpointName: `${projectName}-${environment}-pe-sql`,
		subnet: {
			id: pulumi.interpolate`${vnet.id}/subnets/snet-privateendpoints`,
		},
		privateLinkServiceConnections: [
			{
				name: "sql-privatelink",
				privateLinkServiceId: sqlServer.id,
				groupIds: ["sqlServer"],
			},
		],
	}
);

// Private DNS Zone Group for SQL
const sqlPrivateDnsZoneGroup = new azure_native.network.PrivateDnsZoneGroup(
	"sqlPrivateDnsZoneGroup",
	{
		resourceGroupName: resourceGroup.name,
		privateEndpointName: sqlPrivateEndpoint.name,
		privateDnsZoneGroupName: "default",
		privateDnsZoneConfigs: [
			{
				name: "sql-dns",
				privateDnsZoneId: privateDnsZoneSql.id,
			},
		],
	}
);

// Databricks Workspace
const databricksWorkspaceName = `${projectName}-${environment}-dbw`;
const databricksWorkspace = new azure_native.databricks.Workspace(
	"databricksWorkspace",
	{
		resourceGroupName: resourceGroup.name,
		location: location,
		workspaceName: databricksWorkspaceName,
		sku: {
			name: "standard",
		},
		managedResourceGroupId: pulumi.interpolate`/subscriptions/${
			azure_native.authorization.getClientConfigOutput().subscriptionId
		}/resourceGroups/databricks-rg-${databricksWorkspaceName}`,
		parameters: {
			customVirtualNetworkId: {
				value: vnet.id,
			},
			customPublicSubnetName: {
				value: "snet-databricks-public",
			},
			customPrivateSubnetName: {
				value: "snet-databricks-private",
			},
			enableNoPublicIp: {
				value: true,
			},
		},
	}
);

// Role Assignments
// Storage Blob Data Contributor role for the user
const storageRoleAssignment = new azure_native.authorization.RoleAssignment(
	"storageRoleAssignment",
	{
		scope: storageAccount.id,
		roleDefinitionId: pulumi.interpolate`/subscriptions/${
			azure_native.authorization.getClientConfigOutput().subscriptionId
		}/providers/Microsoft.Authorization/roleDefinitions/17d1049b-9a84-46fb-8f53-869881c3d3ab`,
		principalId: userObjectId,
		principalType: "User",
	}
);

// SQL DB Contributor role for the user
const sqlRoleAssignment = new azure_native.authorization.RoleAssignment(
	"sqlRoleAssignment",
	{
		scope: sqlServer.id,
		roleDefinitionId: pulumi.interpolate`/subscriptions/${
			azure_native.authorization.getClientConfigOutput().subscriptionId
		}/providers/Microsoft.Authorization/roleDefinitions/6d8ee4ec-f05a-4a1d-8b00-a9b17e38b437`,
		principalId: userObjectId,
		principalType: "User",
	}
);

// Exports matching ARM template outputs
export const vnetId = vnet.id;
export const storageAccountId = storageAccount.id;
export const keyVaultUri = keyVault.properties.apply(
	(props) => props?.vaultUri || ""
);
export const appServiceUrl = appService.defaultHostName.apply(
	(hostname) => `https://${hostname}`
);
export const sqlServerFqdn = sqlServer.fullyQualifiedDomainName;
export const databricksWorkspaceUrl = databricksWorkspace.workspaceUrl.apply(
	(url) => `https://${url}`
);
