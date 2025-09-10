// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { handleChatRequest } from './chatParticipant';
import { detectThreatModeler } from './utils/fileUtils';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "threat-model" is now active!');

	// Register the chat participant
	const participant = vscode.chat.createChatParticipant('threatmodel', handleChatRequest);

	context.subscriptions.push(participant);

	// Register the init command
	const disposableInit = vscode.commands.registerCommand('threatmodel.init', async () => {
		try {
			const threatModeler = await detectThreatModeler();
			if (!threatModeler) {
				vscode.window.showInformationMessage('No IaC files detected. Currently supports Terraform (.tf files).');
				return;
			}

			const hasPrerequisites = await threatModeler.checkPrerequisites();
			if (!hasPrerequisites) {
				vscode.window.showInformationMessage('Terraform CLI not detected. Proceeding with file-based analysis only.');
				const files = await threatModeler.findFiles(threatModeler.getFilePatterns());
				vscode.window.showInformationMessage(`Found ${files.length} Terraform files. Analyzing for threats...`);
				const analysis = await threatModeler.analyzeThreats('');
				vscode.window.showInformationMessage(`Threats: ${analysis.threats.join(', ')}\nRecommendations: ${analysis.recommendations.join(', ')}`);
				return;
			}

			vscode.window.showInformationMessage('Initializing Terraform project...');
			await threatModeler.initializeProject();
			vscode.window.showInformationMessage('Project initialized successfully. Analyzing Terraform files for threats...');
			const analysis = await threatModeler.analyzeThreats('');
			vscode.window.showInformationMessage(`Threat Analysis Results:\n\nThreats:\n${analysis.threats.map((t: string) => `- ${t}`).join('\n')}\n\nRecommendations:\n${analysis.recommendations.map((r: string) => `- ${r}`).join('\n')}`);
		} catch (error: any) {
			vscode.window.showInformationMessage(`Error: ${error.message}`);
		}
	});

	context.subscriptions.push(disposableInit);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('threat-model.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from threat-model!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
