# threat-model README

## Features

- STRIDE Threat modeling based on your codebase
- GitHub Copilot compatible: fully utilizes Copilot API, no extra cost required

## What's Working

- **Structured Threat Modeling**: Generates comprehensive threat analysis reports following industry best practices
- **Terraform Infrastructure Analysis**: Full parsing of `.tf` files directly (no Terraform CLI required)
- **Architectural Consolidation**: Intelligently groups 200+ resources into 8-12 major architectural systems
- **STRIDE Framework Integration**: Comprehensive threat identification using STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
- **Asset & Relationship Mapping**: Identifies infrastructure assets and maps trust boundaries/dependencies
- **Structured Threat Reports**: Outputs include:
  - Infrastructure key features analysis
  - Mermaid architectural diagrams showing data flows and trust boundaries
  - Detailed asset inventory (data, functional, and system attributes)
  - Threat analysis with STRIDE categorization and affected assets
  - Mitigation recommendations with implementation strategies
- **Real-time GitHub Copilot Integration**: Leverages vscode.lm API for contextual threat analysis
- **Reputable Source Validation**: References OWASP, MITRE CWE, CVE databases, and MITRE ATT&CK framework

## On the Roadmap

- [ ] Support for CloudFormation (AWS YAML/JSON IaC)
- [ ] Support for application codebases (e.g., Node.js, Python, etc.)
- [ ] Support for hybrid project structures (both IaC and app code)
- [ ] Enhanced relationship/graph extraction for complex dependencies
- [ ] More advanced LLM-powered threat/mitigation suggestions

## Requirements

- GitHub Copilot enabled in VS Code
- No external APIs or cloud required; runs fully client-side
- For IaC parsing: only `.tf` files required (no `terraform init` or CLI needed)

## Usage

1. Open a workspace with Terraform files.
2. In Copilot Chat, type `@threatmodel start modeling`.
3. Review the threat analysis, asset list, and relationships directly in the chat.

---

For more details, see the code and roadmap in the repository.
