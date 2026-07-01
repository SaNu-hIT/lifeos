import type { ContextRequest, UnifiedContext } from '@lifeos/contracts';

/** DI token for the ContextEnginePort. */
export const CONTEXT_ENGINE = Symbol('CONTEXT_ENGINE');

/** Assemble input: a ContextRequest plus an optional intent hint used to retrieve
 *  the most relevant memories. */
export interface AssembleInput extends ContextRequest {
  intentHint?: string;
}

/**
 * Assembles the permission-filtered Unified Context that every tool handler receives
 * — the single sanctioned data boundary for Skills (docs/adr/adr-0007-context-engine.md).
 */
export interface ContextEnginePort {
  assemble(input: AssembleInput): Promise<UnifiedContext>;
}
