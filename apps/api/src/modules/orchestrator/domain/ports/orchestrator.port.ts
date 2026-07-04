/** DI token for the OrchestratorPort. */
export const ORCHESTRATOR = Symbol('ORCHESTRATOR');

export interface TurnInput {
  userId: string;
  conversationId: string;
  content: string;
  scope?: string;
  /** Present on a follow-up turn that confirms a consequential tool. */
  confirmation?: { toolName: string; token: string };
  /** Present on a follow-up turn that answers a batched clarification question. */
  clarification?: { toolName: string; selections: Record<string, ClarificationSelection> };
}

/** One clarification answer for one ambiguous product ("milk" -> the brand/unit picked). */
export interface ClarificationSelection {
  brand: string;
  unit?: string;
}

export interface ClarificationOption {
  brand: string;
  unit: string;
  priceMinor: number;
  storeKey: string;
}

/** One ambiguous product and the options the user can pick from — batched across a
 *  whole turn so the user answers once for the whole list, not once per item. */
export interface ClarificationChoice {
  productName: string;
  options: ClarificationOption[];
}

/** A step-by-step trace of the turn pipeline, for the UI's execution log (introspection). */
export interface TurnTrace {
  scope: string;
  /** How this turn was classified before planning (phase-1 state-awareness). */
  intent?: 'read' | 'write' | 'analysis' | 'chat';
  capabilities: string[];
  availableTools: string[];
  plan: { tool: string; args: unknown }[];
  steps: {
    tool: string;
    status: 'ok' | 'error' | 'needs_confirmation' | 'needs_clarification';
    error?: { code: string; message: string };
  }[];
}

/** A one-tap next step offered after a turn completes (e.g. "Compare prices" after
 *  items were added). Tapping it sends `prompt` back as an ordinary user message.
 *  When `url` is present (e.g. an upgrade nudge), the UI should open it as an
 *  external link instead — informational only, never triggers a plan change. */
export interface SuggestedAction {
  label: string;
  prompt: string;
  url?: string;
}

export interface TurnResult {
  turnId: string;
  status: 'completed' | 'awaiting_confirmation' | 'awaiting_clarification';
  assistantMessage?: { content: string; priceMatrix?: PriceMatrix };
  confirmation?: { toolName: string; token: string };
  clarification?: { toolName: string; choices: ClarificationChoice[] };
  /** Next-step buttons surfaced by the tools that ran this turn (deduped). */
  suggestedActions?: SuggestedAction[];
  trace?: TurnTrace;
}

/** One product×store cell: the price plus the extra product info scraped alongside it
 *  (rating, how many rated it, whether it's in stock). `null` cell = store had no match. */
export interface PriceCell {
  priceMinor: number;
  rating?: number;
  ratingCount?: number;
  available?: boolean;
  brand?: string;
  size?: string;
  mrpMinor?: number;
  discountMinor?: number;
  deliveryEtaMinutes?: number;
  imageUrl?: string;
  productUrl?: string;
  stockStatus?: 'in_stock' | 'limited' | 'out_of_stock';
}

/** Rows = products, columns = stores, cells = price + product info, plus a totals
 *  row — the structured shape behind the price-comparison summary. */
export interface PriceMatrix {
  products: string[];
  stores: string[];
  cells: Record<string, Record<string, PriceCell | null>>;
  totalsByStore: Record<string, number>;
}

/** Drives one conversation turn end-to-end (docs/02 §6). Holds no business logic. */
export interface OrchestratorPort {
  handleTurn(input: TurnInput): Promise<TurnResult>;
}
