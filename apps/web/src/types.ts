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

export interface TurnResult {
  reply: string;
  requiresConfirmation?: boolean;
  [key: string]: unknown;
}
