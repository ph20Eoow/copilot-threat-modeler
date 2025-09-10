import * as vscode from 'vscode';
import { BaseThreatModeler } from './BaseThreatModeler';
import { ThreatModelingResult } from '../types/threatModeling';
import { ThreatModelingWorkflow } from './ThreatModelingWorkflow';
import { ThreatAsset, GraphNode, GraphEdge, AssetGraph, ThreatModelingWorkflowResult } from '../types/threatModeling';
const hclToJson = require('hcl-to-json');

class TerraformWorkflow extends ThreatModelingWorkflow {
  async identifyAssets(files: vscode.Uri[]): Promise<ThreatAsset[]> {
    let aggregatedHcl = '';
    for (const file of files) {
      const doc = await vscode.workspace.openTextDocument(file);
      aggregatedHcl += doc.getText() + '\n';
    }

    try {
      const jsonData = hclToJson(aggregatedHcl);
      const assets: ThreatAsset[] = [];
      if (jsonData.resource) {
        for (const [type, resources] of Object.entries(jsonData.resource)) {
          for (const [name, config] of Object.entries(resources as any)) {
            assets.push({
              id: `${type}.${name}`,
              name: `${type}.${name}`,
              type: type,
              file: '', // Can be improved to track file
              line: 1
            });
          }
        }
      }
      return assets;
    } catch (error) {
      console.error('HCL parsing failed:', error);
      // Fallback to dummy assets
      return files.map((file, idx) => ({
        id: `asset_${idx}`,
        name: `Resource${idx+1}`,
        type: 'resource',
        file: file.fsPath,
        line: 1
      }));
    }
  }

  async mapRelationships(assets: ThreatAsset[], files: vscode.Uri[]): Promise<AssetGraph> {
    // Parse HCL to find dependencies
    let aggregatedHcl = '';
    for (const file of files) {
      const doc = await vscode.workspace.openTextDocument(file);
      aggregatedHcl += doc.getText() + '\n';
    }

    const nodes: GraphNode[] = assets.map(asset => ({
      id: asset.id,
      asset
    }));

    const edges: GraphEdge[] = [];

    try {
      const jsonData = hclToJson(aggregatedHcl);
      if (jsonData.resource) {
        for (const [type, resources] of Object.entries(jsonData.resource)) {
          for (const [name, config] of Object.entries(resources as any)) {
            const resourceId = `${type}.${name}`;
            if ((config as any).depends_on) {
              const deps = Array.isArray((config as any).depends_on) ? (config as any).depends_on : [(config as any).depends_on];
              for (const dep of deps) {
                edges.push({
                  from: resourceId,
                  to: dep,
                  type: 'depends_on',
                  description: `${resourceId} depends on ${dep}`
                });
              }
            }
            // Add implicit edges based on references (simplified)
            // For example, if config references another resource
            // This is basic; can be enhanced
          }
        }
      }
    } catch (error) {
      console.error('HCL parsing for relationships failed:', error);
      // Fallback to dummy edges
      for (let i = 0; i < assets.length - 1; i++) {
        edges.push({
          from: assets[i].id,
          to: assets[i+1].id,
          type: 'depends_on',
          description: `Dependency from ${assets[i].name} to ${assets[i+1].name}`
        });
      }
    }

    return { nodes, edges };
  }

  generateThreatAnalysisPrompt(assets: ThreatAsset[], graph: AssetGraph): string {
    const systemsSummary = assets.map(asset => {
      if (asset.type === 'architectural_system') {
        const resourceCount = asset.relationships?.find(r => r.startsWith('Resources:'))?.replace('Resources: ', '') || 'Unknown';
        const purpose = asset.relationships?.find(r => r.startsWith('Purpose:'))?.replace('Purpose: ', '') || 'Infrastructure component';
        return `- **${asset.name}**: ${resourceCount} (${purpose})`;
      } else {
        return `- **${asset.name}**: Individual component (${asset.type})`;
      }
    }).join('\n');

    return `# Infrastructure Security Analysis

## System Overview
This is a Terraform-managed cloud infrastructure with the following architectural components:

${systemsSummary}

## Analysis Tasks

Please analyze this Terraform infrastructure following the threat modeling methodology structure:

### 1. Infrastructure Key Features
Identify the key features and components of this infrastructure based on the architectural systems identified above.

### 2. Architecture Diagram
Create a Mermaid diagram showing the logical relationships between components:
- Data flow connections (API → Compute → Database → Storage)
- Network boundaries (VPC, subnets, security groups)
- Trust boundaries (Internet → Frontend → Backend → Data)
- Access control relationships (IAM roles accessing resources)

🚨 **CRITICAL: Mermaid Formatting Rules - MUST FOLLOW:**
1. **NEVER use parentheses () in node labels** - Replace with simple descriptions
2. **NEVER use spaces in subgraph names** - Use camelCase or underscores
3. **Keep node labels short and clean** - No technical details like resource names

**Examples:**
❌ BAD: APIGW1[API Gateway ]
✅ GOOD: APIGW1[API Gateway:aws_api_gateway_rest_api.api]

❌ BAD: subgraph Public Zone
✅ GOOD: subgraph PublicZone

❌ BAD: Compute[Compute Layer (EC2/Lambda)]
✅ GOOD: Compute[Compute Layer]

### 3. Assets
Identify the key assets that require protection in this infrastructure:
- Data assets (databases, storage, user data)
- Functional assets (APIs, compute resources, network access)
- System attributes (availability, integrity, confidentiality)

### 4. STRIDE Threat Analysis
Analyze this infrastructure using the STRIDE methodology. For each threat identified, provide:
- **Threat ID**: T01, T02, T03, etc.
- **Threat Title**: Descriptive name
- **STRIDE Category**: (S/T/R/I/D/E)
- **Description**: What the threat involves
- **STRIDE Categories**: Which STRIDE categories apply
- **Assets Impacted**: Which assets are affected

## Expected Output Format 

### 1. Infrastructure Key Features
Create a table of key features:

| **Feature** | **Description** |
|-------------|-----------------|
| Feature 1   | Description... |
| Feature 2   | Description... |

### 2. Architecture Diagram
🚨 **REMINDER: NO parentheses in node labels, NO spaces in subgraph names!**

\`\`\`mermaid
[Your generated diagram here]
\`\`\`

### 3. Assets
List the key assets that require protection:
- **Data Assets**: [List data that needs protection]
- **Functional Assets**: [List functional components]
- **System Attributes**: [List system properties requiring protection]

### 4. STRIDE Threat Analysis
For each threat, follow this exact format:

**T01 [Threat Title]**
- **Description**: [What the threat involves]
- **STRIDE Categories**: [Which STRIDE categories apply - can be multiple]
- **Assets Impacted**: [Which assets are affected]

**T02 [Threat Title]**
- **Description**: [What the threat involves] 
- **STRIDE Categories**: [Which STRIDE categories apply]
- **Assets Impacted**: [Which assets are affected]

Continue for each threat identified...

### 5. Threat Mitigation (Optional)
For each threat, provide specific mitigation recommendations following the T01, T02 format used in the threats section.

**Focus on concrete, implementable security controls rather than theoretical threat actor speculation.**`;
  }

  async consolidateAssets(rawAssets: ThreatAsset[]): Promise<ThreatAsset[]> {
    console.log('ThreatModel: Analyzing architecture with LLM to understand system purpose...');
    
    // Let LLM understand the architecture and group assets by their architectural role
    return await this.performArchitecturalAnalysis(rawAssets);
  }

  consolidateRelationships(rawEdges: GraphEdge[], consolidatedAssets: ThreatAsset[]): GraphEdge[] {
    console.log('ThreatModel: Consolidating relationships based on semantic understanding...');
    
    // Filter and enhance relationships based on consolidated assets
    const validAssetIds = new Set(consolidatedAssets.map(a => a.id));
    return rawEdges.filter(edge => 
      validAssetIds.has(edge.from) && validAssetIds.has(edge.to)
    );
  }

  private async performArchitecturalAnalysis(rawAssets: ThreatAsset[]): Promise<ThreatAsset[]> {
    console.log('ThreatModel: Generating terraform graph for architectural overview...');
    
    // Try to get architectural overview using terraform graph (read-only)
    const architecturalGraph = await this.generateTerraformGraph();
    
    if (architecturalGraph) {
      console.log('ThreatModel: Using terraform graph for architectural analysis');
      return this.analyzeGraphArchitecture(architecturalGraph, rawAssets);
    } else {
      console.log('ThreatModel: Terraform graph not available, using LLM-based analysis');
      return this.createHighLevelArchitecturalComponents(rawAssets);
    }
  }

  private async generateTerraformGraph(): Promise<string | null> {
    try {
      // Use terraform graph without requiring init/plan - this is read-only
      // terraform graph -type=plan-refresh-only generates a dependency graph without state changes
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      console.log('ThreatModel: Attempting read-only terraform graph generation...');
      
      // First try: just terraform graph (works if .terraform exists)
      try {
        const { stdout } = await execAsync('terraform graph', { 
          cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
          timeout: 10000 // 10 second timeout
        });
        return stdout;
      } catch (firstError) {
        console.log('ThreatModel: Standard terraform graph failed, trying configuration-only approach...');
        
        // Second try: terraform graph -type=configuration (no state needed)
        try {
          const { stdout } = await execAsync('terraform graph -type=configuration', {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            timeout: 10000
          });
          return stdout;
        } catch (secondError) {
          console.log('ThreatModel: Terraform graph not available, will use alternative approach');
          return null;
        }
      }
    } catch (error) {
      console.log('ThreatModel: Error generating terraform graph:', error);
      return null;
    }
  }

  private analyzeGraphArchitecture(terraformGraph: string, rawAssets: ThreatAsset[]): ThreatAsset[] {
    console.log('ThreatModel: Analyzing terraform graph for architectural patterns...');
    
    // Parse the DOT graph to understand dependencies and clusters
    const architecturalClusters = this.extractArchitecturalClustersFromGraph(terraformGraph);
    
    // Group assets based on graph clusters
    const consolidated = this.consolidateByGraphClusters(rawAssets, architecturalClusters);
    
    console.log(`ThreatModel: Graph-based consolidation: ${rawAssets.length} → ${consolidated.length} components`);
    return consolidated;
  }

  private extractArchitecturalClustersFromGraph(dotGraph: string): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    
    // Parse DOT graph to find resource dependencies and natural groupings
    const lines = dotGraph.split('\n');
    const edges: Array<{from: string, to: string}> = [];
    
    // Extract edges from DOT format
    for (const line of lines) {
      const edgeMatch = line.match(/^\s*"([^"]+)"\s*->\s*"([^"]+)"/);
      if (edgeMatch) {
        edges.push({ from: edgeMatch[1], to: edgeMatch[2] });
      }
    }
    
    // Find natural clusters based on dependency patterns
    const resourceGroups = new Map<string, Set<string>>();
    
    edges.forEach(edge => {
      // Group resources that are closely connected
      const fromBase = this.extractResourceBase(edge.from);
      const toBase = this.extractResourceBase(edge.to);
      
      if (fromBase && toBase) {
        // If resources share similar naming patterns, group them
        const commonPattern = this.findCommonPattern(fromBase, toBase);
        if (commonPattern) {
          if (!resourceGroups.has(commonPattern)) {
            resourceGroups.set(commonPattern, new Set());
          }
          resourceGroups.get(commonPattern)!.add(edge.from);
          resourceGroups.get(commonPattern)!.add(edge.to);
        }
      }
    });
    
    // Convert to clusters
    resourceGroups.forEach((resources, pattern) => {
      if (resources.size > 1) {
        clusters.set(pattern, Array.from(resources));
      }
    });
    
    return clusters;
  }

  private extractResourceBase(resourceName: string): string | null {
    // Extract base resource name from terraform graph node names
    // e.g., "[root] aws_s3_bucket.my_bucket" -> "aws_s3_bucket.my_bucket"
    const match = resourceName.match(/\[root\]\s+(.+)/);
    return match ? match[1] : resourceName;
  }

  private findCommonPattern(resource1: string, resource2: string): string | null {
    // Find common patterns between resource names to group them
    const parts1 = resource1.split('.');
    const parts2 = resource2.split('.');
    
    if (parts1.length >= 2 && parts2.length >= 2) {
      const type1 = parts1[0];
      const name1 = parts1[1];
      const type2 = parts2[0];
      const name2 = parts2[1];
      
      // Group by similar resource types and name patterns
      if (type1 === type2 || this.areRelatedTypes(type1, type2)) {
        return this.getTypeFamily(type1);
      }
      
      // Group by similar naming patterns
      const commonPrefix = this.getLongestCommonPrefix(name1, name2);
      if (commonPrefix.length > 3) {
        return `${commonPrefix}_group`;
      }
    }
    
    return null;
  }

  private areRelatedTypes(type1: string, type2: string): boolean {
    // Define related resource types that should be grouped together
    const relatedGroups = [
      ['aws_s3_bucket', 'aws_s3_bucket_policy', 'aws_s3_bucket_acl', 'aws_s3_bucket_cors_configuration'],
      ['aws_iam_role', 'aws_iam_role_policy_attachment', 'aws_iam_policy'],
      ['aws_api_gateway_rest_api', 'aws_api_gateway_resource', 'aws_api_gateway_method'],
      ['aws_lambda_function', 'aws_lambda_permission', 'aws_lambda_alias'],
      ['aws_vpc', 'aws_subnet', 'aws_route_table', 'aws_security_group']
    ];
    
    return relatedGroups.some(group => 
      group.includes(type1) && group.includes(type2)
    );
  }

  private getTypeFamily(resourceType: string): string {
    if (resourceType.includes('s3')) return 'storage_system';
    if (resourceType.includes('iam')) return 'security_system';
    if (resourceType.includes('api_gateway')) return 'api_system';
    if (resourceType.includes('lambda')) return 'compute_system';
    if (resourceType.includes('vpc') || resourceType.includes('subnet')) return 'network_system';
    if (resourceType.includes('rds') || resourceType.includes('dynamodb')) return 'database_system';
    
    return 'infrastructure_system';
  }

  private getLongestCommonPrefix(str1: string, str2: string): string {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.slice(0, i);
  }

  private consolidateByGraphClusters(rawAssets: ThreatAsset[], clusters: Map<string, string[]>): ThreatAsset[] {
    const consolidated: ThreatAsset[] = [];
    const groupedAssetIds = new Set<string>();
    
    // Create consolidated assets for each cluster
    clusters.forEach((resourceNames, clusterName) => {
      const clusterAssets = rawAssets.filter(asset => 
        resourceNames.some(name => name.includes(asset.name))
      );
      
      if (clusterAssets.length > 1) {
        const representative = clusterAssets[0];
        consolidated.push({
          id: `cluster_${clusterName}`,
          name: `${this.getArchitecturalName(clusterName)} (${clusterAssets.length} resources)`,
          type: 'architectural_cluster',
          file: representative.file,
          line: representative.line,
          relationships: [
            `Graph-based cluster: ${clusterName}`,
            `Resources: ${clusterAssets.map(a => a.name).slice(0, 3).join(', ')}${clusterAssets.length > 3 ? '...' : ''}`
          ]
        });
        
        clusterAssets.forEach(asset => groupedAssetIds.add(asset.id));
      }
    });
    
    // Add ungrouped assets as individual high-level components
    const ungroupedAssets = rawAssets.filter(asset => !groupedAssetIds.has(asset.id));
    const highLevelUngrouped = this.createHighLevelComponents(ungroupedAssets);
    consolidated.push(...highLevelUngrouped);
    
    return consolidated;
  }

  private getArchitecturalName(clusterName: string): string {
    const nameMap: Record<string, string> = {
      'storage_system': 'Storage System',
      'security_system': 'Security & IAM System', 
      'api_system': 'API Gateway System',
      'compute_system': 'Compute System',
      'network_system': 'Network Infrastructure',
      'database_system': 'Database System',
      'infrastructure_system': 'Infrastructure System'
    };
    
    return nameMap[clusterName] || `${clusterName.replace(/_/g, ' ')} System`;
  }

  private createHighLevelArchitecturalComponents(rawAssets: ThreatAsset[]): ThreatAsset[] {
    console.log('ThreatModel: Creating high-level architectural components...');
    
    const architecturalMap = new Map<string, ThreatAsset[]>();
    
    rawAssets.forEach(asset => {
      const archComponent = this.determineHighLevelArchitecture(asset);
      if (!architecturalMap.has(archComponent)) {
        architecturalMap.set(archComponent, []);
      }
      architecturalMap.get(archComponent)!.push(asset);
    });
    
    const consolidated: ThreatAsset[] = [];
    
    // Create architectural components for any group with 2+ resources
    architecturalMap.forEach((assets, componentName) => {
      if (assets.length >= 2) {
        const representative = assets[0];
        const keyResources = this.getKeyResources(assets);
        consolidated.push({
          id: `arch_${componentName.toLowerCase().replace(/\s+/g, '_')}`,
          name: `${componentName}`,
          type: 'architectural_system',
          file: representative.file,
          line: representative.line,
          relationships: [
            `Resources: ${assets.length} components`,
            `Purpose: ${this.getSystemPurpose(componentName)}`,
            `Key: ${keyResources.length > 0 ? keyResources.join(', ') : 'Various components'}`
          ]
        });
      } else if (assets.length === 1) {
        // For single important resources, keep them if they're architecturally significant
        const asset = assets[0];
        if (this.getResourceImportanceScore(asset) >= 7) {
          consolidated.push({
            ...asset,
            name: asset.name.replace(/^aws_/, '').replace(/_/g, ' ')
          });
        }
      }
    });
    
    console.log(`ThreatModel: Architectural consolidation: ${rawAssets.length} → ${consolidated.length} systems`);
    return consolidated;
  }

  private createHighLevelComponents(ungroupedAssets: ThreatAsset[]): ThreatAsset[] {
    // Further reduce ungrouped assets by importance
    const importantAssets = ungroupedAssets.filter(asset => 
      this.isArchitecturallySignificant(asset)
    );
    
    // Group remaining assets by architectural layer
    const layerGroups = new Map<string, ThreatAsset[]>();
    importantAssets.forEach(asset => {
      const layer = this.determineArchitecturalComponent(asset);
      if (!layerGroups.has(layer)) {
        layerGroups.set(layer, []);
      }
      layerGroups.get(layer)!.push(asset);
    });
    
    // Only return consolidated groups or single important assets
    const result: ThreatAsset[] = [];
    layerGroups.forEach((assets, layer) => {
      if (assets.length > 2) {
        const representative = assets[0];
        result.push({
          id: `layer_${layer.toLowerCase().replace(/\s+/g, '_')}`,
          name: `${layer} (${assets.length} components)`,
          type: 'infrastructure_layer',
          file: representative.file,
          line: representative.line,
          relationships: [`Layer components: ${assets.map(a => a.name).slice(0, 3).join(', ')}`]
        });
      } else {
        result.push(...assets);
      }
    });
    
    return result;
  }

  private determineHighLevelArchitecture(asset: ThreatAsset): string {
    const type = asset.type.toLowerCase();
    const name = asset.name.toLowerCase();
    
    // Frontend/API Layer
    if (type.includes('api_gateway') || type.includes('cloudfront') || type.includes('load_balancer')) {
      return 'Frontend & API Layer';
    }
    
    // Application/Compute Layer  
    if (type.includes('lambda') || type.includes('ecs') || type.includes('ec2') || type.includes('function')) {
      return 'Application Layer';
    }
    
    // Database Layer
    if (type.includes('rds') || type.includes('dynamodb') || type.includes('database') || type.includes('table')) {
      return 'Database Layer';
    }
    
    // Storage Layer
    if (type.includes('s3') || type.includes('bucket') || type.includes('storage')) {
      return 'Storage Layer';
    }
    
    // Security & Identity Layer
    if (type.includes('iam') || type.includes('role') || type.includes('policy') || 
        type.includes('cognito') || type.includes('auth')) {
      return 'Security & Identity';
    }
    
    // Network Infrastructure
    if (type.includes('vpc') || type.includes('subnet') || type.includes('security_group') || 
        type.includes('route') || type.includes('gateway') || type.includes('nat')) {
      return 'Network Infrastructure';
    }
    
    // Monitoring & Operations
    if (type.includes('cloudwatch') || type.includes('log') || type.includes('alarm') || 
        type.includes('metric') || type.includes('sns') || type.includes('sqs')) {
      return 'Monitoring & Operations';
    }
    
    return 'Supporting Infrastructure';
  }

  private getSystemPurpose(componentName: string): string {
    const purposes: Record<string, string> = {
      'Frontend & API Layer': 'Handles external requests and user interactions',
      'Application Layer': 'Executes business logic and application processing',
      'Database Layer': 'Manages persistent data storage and retrieval',
      'Storage Layer': 'Handles file storage, backups, and static content',
      'Security & Identity': 'Controls access, authentication, and authorization',
      'Network Infrastructure': 'Provides connectivity, isolation, and traffic routing',
      'Monitoring & Operations': 'Enables observability, alerting, and operational insights',
      'Supporting Infrastructure': 'Provides auxiliary services and configurations'
    };
    
    return purposes[componentName] || 'Infrastructure component';
  }

  private getKeyResources(assets: ThreatAsset[]): string[] {
    // Return the 3 most important/representative resources
    const sorted = assets.sort((a, b) => {
      const scoreA = this.getResourceImportanceScore(a);
      const scoreB = this.getResourceImportanceScore(b);
      return scoreB - scoreA;
    });
    
    return sorted.slice(0, 3).map(asset => {
      // Clean up the asset name for better readability
      const cleanName = asset.name.replace(/^aws_/, '').replace(/_/g, ' ');
      return cleanName;
    });
  }

  private getResourceImportanceScore(asset: ThreatAsset): number {
    const type = asset.type.toLowerCase();
    
    // Higher scores for more architecturally significant resources
    if (type.includes('api_gateway_rest_api') || type.includes('load_balancer')) return 10;
    if (type.includes('lambda_function') || type.includes('ecs_service')) return 9;
    if (type.includes('rds_instance') || type.includes('dynamodb_table')) return 8;
    if (type.includes('s3_bucket')) return 7;
    if (type.includes('iam_role')) return 6;
    if (type.includes('vpc') || type.includes('security_group')) return 5;
    if (type.includes('policy') || type.includes('attachment')) return 3;
    if (type.includes('method') || type.includes('integration')) return 2;
    
    return 1;
  }

  private selectMostImportantResource(assets: ThreatAsset[]): ThreatAsset | null {
    if (assets.length === 0) return null;
    
    return assets.reduce((most, current) => {
      const mostScore = this.getResourceImportanceScore(most);
      const currentScore = this.getResourceImportanceScore(current);
      return currentScore > mostScore ? current : most;
    });
  }

  private isArchitecturallySignificant(asset: ThreatAsset): boolean {
    return this.getResourceImportanceScore(asset) >= 5;
  }

  private async getAllHclContent(): Promise<string> {
    const files = await vscode.workspace.findFiles('**/*.tf');
    let allContent = '';
    
    for (const file of files) {
      try {
        const doc = await vscode.workspace.openTextDocument(file);
        allContent += `\n# File: ${file.fsPath}\n${doc.getText()}\n`;
      } catch (error) {
        console.error(`Error reading ${file.fsPath}:`, error);
      }
    }
    
    return allContent;
  }

  private generateArchitecturalAnalysisPrompt(hclContent: string, assets: ThreatAsset[]): string {
    return `# Infrastructure Architecture Analysis

## Mission
Analyze this Terraform infrastructure to understand:
1. **What kind of system is being built?** (e.g., web application, data pipeline, microservices, etc.)
2. **What are the major architectural components?** (frontend, backend, database, storage, etc.)
3. **What are the trust boundaries?** (public internet, internal network, admin access, etc.)
4. **What are the main data flows?** (user requests, data processing, storage, etc.)

## Infrastructure Code
\`\`\`hcl
${hclContent.slice(0, 10000)} ${hclContent.length > 10000 ? '...[truncated]' : ''}
\`\`\`

## Identified Resources (${assets.length} total)
${assets.slice(0, 20).map(asset => `- ${asset.name} (${asset.type})`).join('\n')}
${assets.length > 20 ? `... and ${assets.length - 20} more resources` : ''}

## Analysis Request
Please provide:

### 1. System Purpose
What kind of system/application is this infrastructure supporting?

### 2. Architectural Components
Group the resources into logical architectural components (e.g., "Web Tier", "Database Layer", "Storage System", "Security Layer")

### 3. Trust Boundaries
Identify the major trust boundaries and security zones

### 4. Data Flow
Describe the main data flows through the system

### 5. Critical Security Focus Areas
What are the key security concerns for this type of architecture?

Respond in a structured format that will help with threat modeling.`;
  }

  private createArchitecturalComponents(rawAssets: ThreatAsset[], hclContent: string): ThreatAsset[] {
    // Simplified architectural grouping based on common patterns
    // This will be enhanced by LLM analysis
    
    const architecturalComponents: Map<string, ThreatAsset[]> = new Map();
    
    // Group by architectural layer/purpose
    rawAssets.forEach(asset => {
      const component = this.determineArchitecturalComponent(asset);
      if (!architecturalComponents.has(component)) {
        architecturalComponents.set(component, []);
      }
      architecturalComponents.get(component)!.push(asset);
    });
    
    const consolidated: ThreatAsset[] = [];
    
    // Create architectural component assets
    for (const [componentName, componentAssets] of architecturalComponents) {
      if (componentAssets.length > 1) {
        const representative = componentAssets[0];
        consolidated.push({
          id: `arch_${componentName.toLowerCase().replace(/\s+/g, '_')}`,
          name: `${componentName} (${componentAssets.length} resources)`,
          type: 'architectural_component',
          file: representative.file,
          line: representative.line,
          relationships: [
            `Contains: ${componentAssets.map(a => a.name).join(', ')}`,
            `Purpose: ${this.getComponentPurpose(componentName)}`
          ]
        });
      } else {
        consolidated.push(...componentAssets);
      }
    }
    
    return consolidated;
  }

  private determineArchitecturalComponent(asset: ThreatAsset): string {
    const type = asset.type.toLowerCase();
    
    // Map resources to architectural components
    if (type.includes('api_gateway') || type.includes('load_balancer') || type.includes('cloudfront')) {
      return 'API & Frontend Layer';
    } else if (type.includes('lambda') || type.includes('function') || type.includes('ecs') || type.includes('ec2')) {
      return 'Compute Layer';
    } else if (type.includes('rds') || type.includes('dynamodb') || type.includes('database')) {
      return 'Database Layer';
    } else if (type.includes('s3') || type.includes('bucket') || type.includes('storage')) {
      return 'Storage Layer';
    } else if (type.includes('iam') || type.includes('role') || type.includes('policy') || type.includes('security_group')) {
      return 'Security & IAM Layer';
    } else if (type.includes('vpc') || type.includes('subnet') || type.includes('route') || type.includes('gateway')) {
      return 'Network Infrastructure';
    } else if (type.includes('cloudwatch') || type.includes('log') || type.includes('monitoring')) {
      return 'Monitoring & Logging';
    } else {
      return 'Supporting Infrastructure';
    }
  }

  private getComponentPurpose(componentName: string): string {
    const purposes: Record<string, string> = {
      'API & Frontend Layer': 'Handles incoming requests and user interactions',
      'Compute Layer': 'Processes business logic and application workloads',
      'Database Layer': 'Stores and manages persistent data',
      'Storage Layer': 'Handles file storage and static content',
      'Security & IAM Layer': 'Manages access control and security policies',
      'Network Infrastructure': 'Provides network connectivity and isolation',
      'Monitoring & Logging': 'Provides observability and audit trails',
      'Supporting Infrastructure': 'Supporting services and configurations'
    };
    
    return purposes[componentName] || 'Infrastructure component';
  }


  generateAssetThreatPrompt(asset: ThreatAsset, context: string): string {
    return `${context}\n\nAnalyzing asset: ${asset.name} (${asset.type}) from ${asset.file}:${asset.line}`;
  }

  generateRelationshipThreatPrompt(edge: GraphEdge, fromAsset: ThreatAsset, toAsset: ThreatAsset, context: string): string {
    return `${context}\n\nAnalyzing relationship: ${fromAsset.name} -> ${toAsset.name} (${edge.type})`;
  }

  generateAnalysisContext(assets: ThreatAsset[], graph: AssetGraph): string {
    // Generate architecture-focused context for threat modeling
    const architecturalLayers = this.categorizeAssetsByArchitecture(assets);
    
    let context = `# Infrastructure Architecture Threat Modeling Context\n\n`;
    context += `## System Overview\n`;
    context += `This analysis focuses on understanding the architectural components and their security implications.\n\n`;
    
    // Show architectural layers
    for (const [layer, layerAssets] of Object.entries(architecturalLayers)) {
      if (layerAssets.length > 0) {
        context += `### ${layer}\n`;
        context += `**Purpose**: ${this.getComponentPurpose(layer)}\n`;
        layerAssets.forEach(asset => {
          const filename = asset.file ? asset.file.split('/').pop() || asset.file : 'Unknown';
          context += `- ${asset.name} (${filename}:${asset.line})\n`;
          if (asset.relationships) {
            asset.relationships.forEach(rel => {
              context += `  - ${rel}\n`;
            });
          }
        });
        context += `\n`;
      }
    }
    
    context += `## Trust Boundaries & Data Flows\n`;
    context += `The following relationships represent critical trust boundaries:\n`;
    graph.edges.forEach(edge => {
      context += `- ${edge.from} → ${edge.to} (${edge.type}): ${edge.description}\n`;
    });
    
    context += `\n## Threat Modeling Focus\n`;
    context += `Key areas for STRIDE analysis:\n`;
    context += `1. **External Attack Surface**: How can attackers reach the system from the internet?\n`;
    context += `2. **Privilege Escalation**: How can compromised components access higher-privilege resources?\n`;
    context += `3. **Data Flow Security**: How is sensitive data protected as it moves between components?\n`;
    context += `4. **Trust Boundary Violations**: What happens when trust boundaries are crossed?\n`;
    context += `5. **Infrastructure Misconfigurations**: What default or weak configurations exist?\n`;
    
    return context;
  }

  private categorizeAssetsByArchitecture(assets: ThreatAsset[]): Record<string, ThreatAsset[]> {
    const layers: Record<string, ThreatAsset[]> = {
      'API & Frontend Layer': [],
      'Compute Layer': [],
      'Database Layer': [],
      'Storage Layer': [],
      'Security & IAM Layer': [],
      'Network Infrastructure': [],
      'Monitoring & Logging': [],
      'Supporting Infrastructure': []
    };
    
    assets.forEach(asset => {
      const layer = asset.type === 'architectural_component' ? 
        asset.name.split(' (')[0] : // Extract layer name from consolidated assets
        this.determineArchitecturalComponent(asset);
      
      if (layers[layer]) {
        layers[layer].push(asset);
      } else {
        layers['Supporting Infrastructure'].push(asset);
      }
    });
    
    return layers;
  }
}

export class TerraformThreatModeler extends BaseThreatModeler {
  private workflow = new TerraformWorkflow();

  getFilePatterns(): string[] {
    return ['**/*.tf'];
  }

  async checkPrerequisites(): Promise<boolean> {
    // Always return true since we don't need Terraform CLI for file-based analysis
    return true;
  }

  async initializeProject(): Promise<void> {
    // No initialization needed for file-based analysis
    return;
  }

  async generateGraph(): Promise<string> {
    // Generate Mermaid diagram instead of Terraform graph
    const files = await this.findFiles(this.getFilePatterns());
    const result = await this.workflow.run(files);
    return this.workflow.generateMermaidDiagram(result.graph);
  }

  async analyzeThreats(graph?: string): Promise<ThreatModelingResult> {
    // Find all .tf files
    const files = await this.findFiles(this.getFilePatterns());
    
    if (files.length === 0) {
      return {
        threats: ['No Terraform files found in workspace'],
        recommendations: ['Add .tf files to enable threat modeling'],
        graph: '',
        assets: [],
        assetGraph: { nodes: [], edges: [] }
      };
    }

    // Phase 1: Run the raw discovery workflow
    console.log('ThreatModel: Phase 1 - Raw discovery');
    const rawResult: ThreatModelingWorkflowResult = await this.workflow.run(files);
    console.log(`ThreatModel: Raw discovery found ${rawResult.assets.length} resources`);
    
    // Phase 2: Consolidate to architectural components
    console.log('ThreatModel: Phase 2 - Architectural consolidation');
    const consolidatedResult = await this.workflow.consolidate(rawResult.assets, rawResult.graph);
    console.log(`ThreatModel: Consolidated to ${consolidatedResult.assets.length} architectural components`);
    
    // Generate the LLM prompt for threat analysis using consolidated assets
    const threatAnalysisPrompt = this.workflow.generateThreatAnalysisPrompt(consolidatedResult.assets, consolidatedResult.graph);
    
    return {
      threats: [threatAnalysisPrompt], // Return the prompt as the main "threat" for now
      recommendations: ['Use the generated prompt with GitHub Copilot Chat for detailed threat analysis'],
      graph: this.workflow.generateMermaidDiagram(consolidatedResult.graph),
      assets: consolidatedResult.assets,
      assetGraph: consolidatedResult.graph
    };
  }

  getName(): string {
    return 'Terraform';
  }
}
