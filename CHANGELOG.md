# Change Log

All notable changes to the "copilot-threat-modeler" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- **STRIDE Threat Modeling**: Complete implementation of STRIDE framework for infrastructure analysis
- **Terraform Infrastructure Support**: Full parsing of `.tf` files without requiring Terraform CLI
- **Architectural Consolidation**: Intelligent grouping of Terraform resources into major architectural systems (Frontend & API, Database, Storage, Security & Identity, Network Infrastructure, etc.)
- **GitHub Copilot Integration**: Real-time threat analysis using vscode.lm API
- **Structured Report Generation**: Comprehensive threat analysis reports with:
  - Infrastructure key features analysis
  - Mermaid architectural diagrams showing data flows and trust boundaries
  - Detailed asset inventory (data, functional, and system attributes)
  - Threat analysis with STRIDE categorization and affected assets
  - Mitigation recommendations with implementation strategies
- **Multi-turn Conversations**: Persistent state management for refinement requests and follow-up analysis
- **HCL Direct Parsing**: Uses hcl-to-json library for client-side infrastructure analysis
- **Graph-based Architecture Analysis**: Attempts Terraform CLI graph analysis with fallback to pattern-based grouping
- **Security Source Integration**: References OWASP, MITRE CWE, CVE databases, and MITRE ATT&CK framework
- **VS Code Chat Participant**: Native integration with `@threat-modeler start modeling` command
- **Error Handling & Fallbacks**: Graceful degradation when Terraform CLI or Copilot unavailable

### Technical Implementation
- **Modular Architecture**: Extensible design ready for CloudFormation and application code support
- **Type-Safe Implementation**: Complete TypeScript interfaces for all threat modeling data structures
- **Two-Phase Analysis Pipeline**: Raw discovery followed by architectural consolidation
- **Real-time Streaming**: Live response streaming through VS Code chat interface

## [0.0.1] - 2025-09-09

### Added
- Initial project setup and architecture
- Core extension framework with VS Code API integration
- Basic chat participant registration and command handling