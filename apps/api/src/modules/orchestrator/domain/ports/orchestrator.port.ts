/** DI token for the OrchestratorPort. */
export const ORCHESTRATOR = Symbol('ORCHESTRATOR');

export interface TurnInput {
  userId: string;
  conversationId: string;
  content: string;
  scope?: string;
  /** Present on a follow-up turn that confirms a consequential tool. */
  confirmation?: { toolName: string; token: string };
}

export interface TurnResult {
  turnId: string;
  status: 'completed' | 'awaiting_confirmation';
  assistantMessage?: { content: string };
  confirmation?: { toolName: string; token: string };
}

/** Drives one conversation turn end-to-end (docs/02 §6). Holds no business logic. */
export interface OrchestratorPort {
  handleTurn(input: TurnInput): Promise<TurnResult>;
}
