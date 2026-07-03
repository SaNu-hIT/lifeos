// Client-side view DTOs — the shapes the LifeOS API returns to the web app. The web
// package can't import the platform core, so these are hand-declared against the
// documented API (docs/10). They intentionally stay loose (Skills own their widget props).

export interface Me {
  id: string;
  email?: string;
}

export interface WidgetView {
  key: string;
  title: string;
  pinned: boolean;
  data: { props: Record<string, unknown>; urgency?: number; asOf?: string };
}

export interface HomeView {
  widgets: WidgetView[];
}

export interface ActivityView {
  id: string;
  kind: string;
  title: string;
  summary?: string;
  occurredAt: string;
}

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body?: string;
  readAt?: string;
  occurredAt: string;
}

export interface TurnStep {
  tool: string;
  status: 'ok' | 'error' | 'needs_confirmation' | 'needs_clarification';
  error?: { code: string; message: string };
}

export interface TurnTrace {
  scope: string;
  capabilities: string[];
  availableTools: string[];
  plan: { tool: string; args: unknown }[];
  steps: TurnStep[];
}

export interface ClarificationOption {
  brand: string;
  unit: string;
  priceMinor: number;
  storeKey: string;
}

/** One ambiguous product and its brand/pack options — a turn can batch several of
 *  these into one clarification instead of asking per item. */
export interface ClarificationChoice {
  productName: string;
  options: ClarificationOption[];
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
 *  row per store — the structured price-comparison summary. */
export interface PriceMatrix {
  products: string[];
  stores: string[];
  cells: Record<string, Record<string, PriceCell | null>>;
  totalsByStore: Record<string, number>;
}

/** A one-tap next step suggested after a turn (e.g. "Compare prices"). Tapping it
 *  sends `prompt` as an ordinary message. */
export interface SuggestedAction {
  label: string;
  prompt: string;
}

export interface TurnResult {
  turnId: string;
  status: 'completed' | 'awaiting_confirmation' | 'awaiting_clarification';
  assistantMessage?: { content: string; priceMatrix?: PriceMatrix };
  confirmation?: { toolName: string; token: string };
  clarification?: { toolName: string; choices: ClarificationChoice[] };
  suggestedActions?: SuggestedAction[];
  trace?: TurnTrace;
}

/** One saved preference in the admin users view. */
export interface AdminPreference {
  productName: string;
  preferredBrand: string;
  preferredUnit?: string;
  updatedAt: string;
}

/** A user and the preferences they've saved across Skills (admin/overview tab). */
export interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  preferences: AdminPreference[];
}
