import * as vscode from 'vscode';

export abstract class BaseThreatModeler {
  protected workspaceFolder: vscode.WorkspaceFolder | undefined;

  constructor(workspaceFolder?: vscode.WorkspaceFolder) {
    this.workspaceFolder = workspaceFolder;
  }

  abstract getFilePatterns(): string[];

  abstract checkPrerequisites(): Promise<boolean>;

  abstract initializeProject(): Promise<void>;

  abstract generateGraph(): Promise<string>;

  abstract analyzeThreats(graph?: string): Promise<any>;

  abstract getName(): string;

  public async findFiles(patterns: string[]): Promise<vscode.Uri[]> {
    const files: vscode.Uri[] = [];
    for (const pattern of patterns) {
      const found = await vscode.workspace.findFiles(pattern, null, 100);
      files.push(...found);
    }
    return files;
  }
}
