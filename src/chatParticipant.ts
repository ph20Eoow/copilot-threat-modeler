import * as vscode from 'vscode';
import { StateManager } from './state/ConversationState';
import { detectThreatModeler } from './utils/fileUtils';
import { BaseThreatModeler } from './threatModelers/BaseThreatModeler';
import { TerraformThreatModeler } from './threatModelers/TerraformThreatModeler';

export async function handleChatRequest(
  request: vscode.ChatRequest, 
  context: vscode.ChatContext, 
  response: vscode.ChatResponseStream, 
  token: vscode.CancellationToken
) {
  try {
    console.log('ThreatModel: Handling chat request:', request.prompt);
    console.log('ThreatModel: Context keys:', Object.keys(context));
    const message = request.prompt.trim().toLowerCase();
    const conversationId = 'default'; // Simplified
    const stateManager = StateManager.getInstance();
    let state = stateManager.getState(conversationId);
    console.log('ThreatModel: Current state:', state);

    // Handle slash commands
    if (request.command === 'start' || message.startsWith('start modeling') || state.step === 'start') {
      console.log('ThreatModel: Starting modeling');
      const threatModeler = await detectThreatModeler();
      console.log('ThreatModel: Threat modeler:', threatModeler ? threatModeler.getName() : 'null');
      if (!threatModeler) {
        response.markdown('No supported IaC files detected. Currently supports Terraform (.tf files).');
        return;
      }

      state.threatModeler = threatModeler.getName();
      const hasPrerequisites = await threatModeler.checkPrerequisites();
      console.log('ThreatModel: Has prerequisites:', hasPrerequisites);
      // Analyze Terraform files (no CLI needed)
      response.markdown('🔍 **Analyzing Terraform infrastructure...**\n\n✨ Discovering resources and dependencies...\n🧠 Performing architectural analysis and consolidation...');

      // Run the analysis (now includes consolidation)
      const analysis = await threatModeler.analyzeThreats('');
      console.log('ThreatModel: Analysis complete:', analysis);
      state.analysis = analysis;

      // Display consolidated architectural overview
      const systemsOutput = analysis.assets?.map((a: any) => {
        if (a.type === 'architectural_system') {
          const resourcesInfo = a.relationships?.find((r: string) => r.startsWith('Resources:')) || 'Resources: Unknown';
          const purposeInfo = a.relationships?.find((r: string) => r.startsWith('Purpose:')) || 'Purpose: Infrastructure component';
          const keyInfo = a.relationships?.find((r: string) => r.startsWith('Key:')) || 'Key: Various components';
          
          return `### 🏗️ ${a.name}\n- **${resourcesInfo}**\n- **${purposeInfo}**\n- **${keyInfo}**\n`;
        } else {
          return `### ⚙️ ${a.name}\n- **Type**: ${a.type}\n- **Role**: Critical infrastructure component\n`;
        }
      }).join('\n') || 'None';

      response.markdown(`## 🏗️ Architectural Analysis Complete\n\n**Systems Identified:** ${analysis.assets?.length || 0} architectural components\n\n${systemsOutput}\n\n**Infrastructure Relationships:** ${analysis.assetGraph?.edges.length || 0} dependencies mapped\n${analysis.assetGraph?.edges.length > 0 ? '✅ Trust boundaries and data flows identified for threat analysis' : '⚠️ Limited relationship data - consider running terraform graph for better analysis'}\n\n💡 **Note**: The LLM will generate a proper architectural diagram showing connections and data flows between components.`);

      // Skip the auto-generated diagram as it's poor quality without connections
      // The LLM will generate a much better one showing actual relationships

      // Send the threat analysis prompt to GitHub Copilot
      if (analysis.threats && analysis.threats.length > 0 && analysis.threats[0].includes('# Infrastructure Security Analysis')) {
        response.markdown(`\n## 🔒 Infrastructure Threat Modeling Analysis\n\n🏗️ Analyzing infrastructure features and assets...\n📊 Generating architectural diagram...\n🛡️ Performing STRIDE threat analysis...\n`);
        
        // Use Language Model API to analyze threats
        const threatPrompt = analysis.threats[0];
        try {
          // Get available language models - try different models in order of preference
          let models = await vscode.lm.selectChatModels({
            vendor: 'copilot'
          });

          if (models.length === 0) {
            throw new Error('No GitHub Copilot language models available');
          }

          // Log available models for debugging
          console.log('ThreatModel: Available models:', models.map(m => `${m.vendor}/${m.family} (${m.name || 'default'})`));
          
          // Use the first available model (user can switch model in Copilot settings)
          const model = models[0];
          console.log('ThreatModel: Using model:', `${model.vendor}/${model.family}`, model);
          
          // Show user which model is being used - display the actual model name if available
          const modelDisplayName = model.name || model.family || 'language model';
          response.markdown(`*Using ${modelDisplayName} for analysis...*\n`);
          
          // Request threat analysis from language model
          const chatRequest = await model.sendRequest([
            vscode.LanguageModelChatMessage.User(threatPrompt)
          ], {}, token);
          
          response.markdown(`### 🛡️ Security Assessment Results\n\n`);
          
          // Stream the response
          for await (const fragment of chatRequest.text) {
            response.markdown(fragment);
          }
          
          response.markdown(`\n\n---\n*Analysis generated using GitHub Copilot and the STRIDE framework*`);
          
        } catch (error) {
          console.error('ThreatModel: Language model analysis failed:', error);
          response.markdown(`### 📋 Manual Analysis Required\n\nGitHub Copilot is not available or accessible. Please copy and paste the following prompt into GitHub Copilot Chat for detailed threat analysis:\n\n\`\`\`\n${threatPrompt}\n\`\`\`\n\n*Tip: Use this prompt with @workspace in Copilot Chat for context-aware analysis*`);
        }
      }

      state.step = 'analyze_complete';
      stateManager.setState(conversationId, state);

    } else if (request.command === 'focus' || request.command === 'recommendations' || state.step === 'analyze_complete') {
      // Handle refinement requests and specific commands
      if (state.analysis && state.analysis.threats && state.analysis.threats[0]) {
        const basePrompt = state.analysis.threats[0];
        const refinementPrompt = `${basePrompt}\n\n## Refinement Request:\nUser asked: "${request.prompt}"\n\nPlease provide a focused analysis based on this specific request while maintaining the STRIDE framework structure.`;
        
        try {
          response.markdown(`🔍 **Refining analysis based on your request...**\n`);
          
          // Get available language models
          const models = await vscode.lm.selectChatModels({
            vendor: 'copilot'
          });

          if (models.length === 0) {
            throw new Error('No GitHub Copilot language models available');
          }

          const model = models[0];
          console.log('ThreatModel: Using model for refinement:', `${model.vendor}/${model.family}`, model);
          
          // Show user which model is being used
          const modelDisplayName = model.name || model.family || 'language model';
          response.markdown(`*Using ${modelDisplayName} for refinement...*\n`);
          
          const chatRequest = await model.sendRequest([
            vscode.LanguageModelChatMessage.User(refinementPrompt)
          ], {}, token);
          
          response.markdown(`### 🎯 Refined Security Analysis\n\n`);
          
          // Stream the response
          for await (const fragment of chatRequest.text) {
            response.markdown(fragment);
          }
          
          response.markdown(`\n\n---\n*Refined analysis based on your request using GitHub Copilot*`);
          
        } catch (error) {
          console.error('ThreatModel: Language model refinement failed:', error);
          response.markdown(`### 📋 Manual Refinement Required\n\nGitHub Copilot is not available or accessible. Please use the following refined prompt with Copilot Chat:\n\n\`\`\`\n${refinementPrompt}\n\`\`\`\n\n*Tip: Use this prompt with @workspace in Copilot Chat for context-aware analysis*`);
        }
      } else {
        response.markdown('No previous analysis found. Please start with "@threatmodel start modeling" first.');
      }
    } else {
      console.log('ThreatModel: Unknown message:', message);
      response.markdown('Usage: @threatmodel start modeling');
    }
  } catch (error: any) {
    console.error('ThreatModel: Unhandled error in handler:', error);
    response.markdown('An unexpected error occurred. Please try again or check the logs.');
  }
}

async function getThreatModelerFromState(state: any): Promise<BaseThreatModeler | null> {
  if (state.threatModeler === 'Terraform') {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return new TerraformThreatModeler(workspaceFolder);
  }
  return null;
}
