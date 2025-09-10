import * as vscode from 'vscode';
import { BaseThreatModeler } from '../threatModelers/BaseThreatModeler';
import { TerraformThreatModeler } from '../threatModelers/TerraformThreatModeler';

export async function detectThreatModeler(): Promise<BaseThreatModeler | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return null;

  // For now, only Terraform
  const terraformModeler = new TerraformThreatModeler(workspaceFolder);
  const files = await terraformModeler.findFiles(terraformModeler.getFilePatterns());
  if (files.length > 0) {
    return terraformModeler;
  }

  return null;
}
