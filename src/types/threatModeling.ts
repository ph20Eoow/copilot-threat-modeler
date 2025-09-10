export interface ThreatAsset {
  id: string;
  name: string;
  type: string;
  file: string;
  line: number;
  relationships?: string[];
}

export interface Threat {
  id: string;
  type: string; // STRIDE or other
  description: string;
  file: string;
  line: number;
  references: string[];
  validation: ThreatValidation;
  mitigations: ThreatMitigation[];
}

export interface ThreatValidation {
  isRealWorld: boolean;
  sources: string[];
  reasoning: string;
  owaspRelevant: boolean;
  mitreRelevant: boolean;
  cveRelevant: boolean;
  attckRelevant: boolean;
  wordingChecked: boolean;
}

export interface ThreatMitigation {
  strategy: string;
  type: 'short-term' | 'long-term';
  references: string[];
}

export interface GraphNode {
  id: string;
  asset: ThreatAsset;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string; // e.g., 'depends_on', 'references', etc.
  description: string;
}

export interface AssetGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ThreatModelingWorkflowResult {
  assets: ThreatAsset[];
  graph: AssetGraph;
  threats: Threat[];
}

export interface ThreatModelingResult {
  threats: string[];
  recommendations: string[];
  graph?: string;
  assets?: ThreatAsset[];
  assetGraph?: AssetGraph;
}
