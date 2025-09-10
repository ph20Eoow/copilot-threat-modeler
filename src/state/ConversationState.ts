export interface ConversationState {
  step: string;
  threatModeler?: string;
  graph?: string;
  analysis?: any;
}

export class StateManager {
  private static instance: StateManager;
  private states = new Map<string, ConversationState>();

  private constructor() {}

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  getState(conversationId: string): ConversationState {
    return this.states.get(conversationId) || { step: 'start' };
  }

  setState(conversationId: string, state: ConversationState): void {
    this.states.set(conversationId, state);
  }

  clearState(conversationId: string): void {
    this.states.delete(conversationId);
  }
}
