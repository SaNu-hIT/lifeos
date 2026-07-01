import type { PermissionPort } from '@lifeos/contracts';
import type {
  HomeEnginePort,
  HomeView,
  WidgetContribution,
  WidgetPreference,
  WidgetView,
} from './domain/ports/home.port.js';
import type {
  WidgetInstance,
  WidgetInstanceRepository,
} from './adapters/out/widget-instance.repository.js';

/** How strongly an urgency signal (0..1) can lift a widget above its base priority. */
const URGENCY_BOOST = 100;

/**
 * Assembles the dynamic home from Skill-contributed widgets (docs/02 §15). Nothing
 * is hardcoded: enabling a Skill makes its widget eligible; a capability gate hides
 * it otherwise; ranking is data-driven (pinned → urgency-boosted priority / user
 * override). Widgets pull from the phase 19/20 read models — the home never writes.
 */
export class HomeEngine implements HomeEnginePort {
  private readonly widgets = new Map<string, WidgetContribution>();

  constructor(
    private readonly permissions: PermissionPort,
    private readonly instances: WidgetInstanceRepository,
  ) {}

  registerWidget(contribution: WidgetContribution): void {
    this.widgets.set(contribution.key, contribution);
  }

  async getHome(userId: string): Promise<HomeView> {
    const prefs = await this.instances.forUser(userId);

    // Capability filter (deny-by-default) + user-hidden filter.
    const eligible = [];
    for (const widget of this.widgets.values()) {
      if (prefs.get(widget.key)?.hidden) continue;
      if (widget.requiredCapability) {
        const decision = await this.permissions.can(userId, widget.requiredCapability);
        if (!decision.allow) continue;
      }
      eligible.push(widget);
    }

    // Build each widget's data concurrently; a null or a throw drops the widget.
    const built = await Promise.all(
      eligible.map(async (widget) => {
        try {
          const data = await widget.build({ userId });
          return data ? { widget, data } : null;
        } catch {
          return null; // a failing widget must never break the whole home
        }
      }),
    );

    const ranked = built
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .map((b) => {
        const pref = prefs.get(b.widget.key);
        return { ...b, pref, weight: this.weight(b.widget, b.data.urgency, pref) };
      })
      .sort((a, b) => {
        const ap = a.pref?.pinned ? 1 : 0;
        const bp = b.pref?.pinned ? 1 : 0;
        return bp - ap || b.weight - a.weight || a.widget.key.localeCompare(b.widget.key);
      });

    return {
      widgets: ranked.map(
        (r): WidgetView => ({
          key: r.widget.key,
          title: r.widget.title,
          pinned: r.pref?.pinned ?? false,
          data: r.data,
        }),
      ),
    };
  }

  setPreference(userId: string, widgetKey: string, pref: WidgetPreference): Promise<void> {
    return this.instances.upsert(userId, widgetKey, pref);
  }

  private weight(
    widget: WidgetContribution,
    urgency: number | undefined,
    pref: WidgetInstance | undefined,
  ): number {
    if (pref?.sortOverride != null) return pref.sortOverride;
    return widget.priority + (urgency ?? 0) * URGENCY_BOOST;
  }
}
