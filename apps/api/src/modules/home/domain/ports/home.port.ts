import type { WidgetContext, WidgetContribution, WidgetData } from '@lifeos/contracts';

export type { WidgetContext, WidgetContribution, WidgetData };

/** DI token for the HomeEnginePort. */
export const HOME_ENGINE = Symbol('HOME_ENGINE');

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
