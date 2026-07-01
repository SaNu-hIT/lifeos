import type { CapabilityKey } from '@lifeos/contracts';

/** DI token for the HomeEnginePort. */
export const HOME_ENGINE = Symbol('HOME_ENGINE');

/** The data a widget renders — deliberately open (Skills own their shape). */
export interface WidgetData {
  /** Optional 0..1 urgency signal; boosts ranking above base priority. */
  urgency?: number;
  /** Optional freshness marker for the client (ISO-8601). */
  asOf?: string;
  /** Arbitrary render payload consumed by the future UI. */
  props: Record<string, unknown>;
}

export interface WidgetContext {
  userId: string;
}

/** A Skill/engine-contributed widget. `build` reads from read models (phase 19/20)
 *  and returns data, or null to render nothing this cycle. */
export interface WidgetContribution {
  key: string;
  title: string;
  /** Capability required to show this widget; omit for always-eligible. */
  capability?: CapabilityKey;
  /** Base ordering weight (higher = earlier); overridable per user. */
  priority: number;
  build(ctx: WidgetContext): Promise<WidgetData | null>;
}

export interface WidgetView {
  key: string;
  title: string;
  pinned: boolean;
  data: WidgetData;
}

export interface HomeView {
  widgets: WidgetView[];
}

export interface WidgetPreference {
  hidden?: boolean;
  pinned?: boolean;
  sortOverride?: number | null;
}

export interface HomeEnginePort {
  registerWidget(contribution: WidgetContribution): void;
  getHome(userId: string): Promise<HomeView>;
  setPreference(userId: string, widgetKey: string, pref: WidgetPreference): Promise<void>;
}
