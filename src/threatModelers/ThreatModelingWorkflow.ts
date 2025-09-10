import * as vscode from 'vscode';
import { ThreatModelingResult } from '../types/threatModeling';
import {
  ThreatAsset,
  Threat,
  ThreatValidation,
  ThreatMitigation,
  GraphNode,
  GraphEdge,
  AssetGraph,
  ThreatModelingWorkflowResult
} from '../types/threatModeling';

export abstract class ThreatModelingWorkflow {
  protected defaultSources = [
    'https://owasp.org/www-project-top-ten/',
    'https://cwe.mitre.org/',
    'https://cve.mitre.org/',
    'https://attack.mitre.org/'
  ];

  abstract identifyAssets(files: vscode.Uri[]): Promise<ThreatAsset[]>;
  abstract mapRelationships(assets: ThreatAsset[], files: vscode.Uri[]): Promise<AssetGraph>;

  // Generate structured prompt for individual asset analysis
  abstract generateAssetThreatPrompt(asset: ThreatAsset, context: string): string;
  
  // Generate structured prompt for individual relationship analysis
  abstract generateRelationshipThreatPrompt(edge: GraphEdge, fromAsset: ThreatAsset, toAsset: ThreatAsset, context: string): string;

  // Generate context information for threat analysis
  abstract generateAnalysisContext(assets: ThreatAsset[], graph: AssetGraph): string;

  // Consolidate and deduplicate assets
  abstract consolidateAssets(rawAssets: ThreatAsset[]): Promise<ThreatAsset[]>;
  
  // Consolidate and deduplicate relationships
  abstract consolidateRelationships(rawEdges: GraphEdge[], consolidatedAssets: ThreatAsset[]): GraphEdge[];

  async run(files: vscode.Uri[]): Promise<ThreatModelingWorkflowResult> {
    console.log('ThreatModel: Workflow run started with', files.length, 'files');
    
    // Phase 1: Raw discovery
    const rawAssets = await this.identifyAssets(files);
    console.log('ThreatModel: Raw assets identified:', rawAssets.length);
    
    const rawGraph = await this.mapRelationships(rawAssets, files);
    console.log('ThreatModel: Raw relationships mapped:', rawGraph.edges.length);
    
    // Return raw data for consolidation phase
    return { assets: rawAssets, graph: rawGraph, threats: [] };
  }

  // New method for consolidation phase
  async consolidate(rawAssets: ThreatAsset[], rawGraph: AssetGraph): Promise<{ assets: ThreatAsset[], graph: AssetGraph }> {
    console.log('ThreatModel: Starting consolidation phase');
    
    // Consolidate assets
    const consolidatedAssets = await this.consolidateAssets(rawAssets);
    console.log('ThreatModel: Assets consolidated from', rawAssets.length, 'to', consolidatedAssets.length);
    
    // Consolidate relationships
    const consolidatedEdges = this.consolidateRelationships(rawGraph.edges, consolidatedAssets);
    console.log('ThreatModel: Relationships consolidated from', rawGraph.edges.length, 'to', consolidatedEdges.length);
    
    const consolidatedGraph: AssetGraph = {
      nodes: consolidatedAssets.map(asset => ({ id: asset.id, asset })),
      edges: consolidatedEdges
    };
    
    return { assets: consolidatedAssets, graph: consolidatedGraph };
  }

  // Helper method to create Mermaid diagram from graph
  generateMermaidDiagram(graph: AssetGraph): string {
    const lines = ['graph TD'];
    
    // Add nodes
    graph.nodes.forEach(node => {
      const sanitizedId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  ${sanitizedId}["${node.asset.name}<br/>${node.asset.type}"]`);
    });
    
    // Add edges
    graph.edges.forEach(edge => {
      const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
      const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  ${fromId} --> ${toId}`);
    });
    
    return lines.join('\n');
  }
}
