// Builds the Skill manifests this deployment installs. Kept separate from main.ts so it
// is unit-testable without booting Nest. Each Skill is a factory over its ports: a repo
// (in-memory here), a provider connector, an id factory, and a `publish` hook.

import { randomUUID } from 'node:crypto';
import type { ConnectorRegistryPort, DomainEvent, SkillManifest } from '@lifeos/contracts';
import type { DatabasePort } from '@lifeos/api';
import { createGrocerySkill } from '@lifeos/skill-grocery';
import { createCalendarSkill } from '@lifeos/skill-calendar';
import { createWorkoutSkill } from '@lifeos/skill-workout';
import { createWellnessSkill } from '@lifeos/skill-wellness';
import { createFinanceSkill } from '@lifeos/skill-finance';
import { createMealPlanningSkill } from '@lifeos/skill-meal-planning';
import { createHabitSkill } from '@lifeos/skill-habit';
import { createAssistantSkill } from '@lifeos/skill-assistant';
import { blinkitConnector } from '@lifeos/connector-blinkit';
import { googleCalendarConnector } from '@lifeos/connector-google-calendar';
import { InMemoryGroceryRepository } from './adapters/in-memory-grocery.repository.js';
import { InMemoryCalendarRepository } from './adapters/in-memory-calendar.repository.js';
import { PgGroceryListRepository } from './adapters/pg-grocery-list.repository.js';
import { PgGroceryPriceCacheAdapter } from './adapters/pg-grocery-price-cache.adapter.js';
import { PgGroceryPreferenceAdapter } from './adapters/pg-grocery-preference.adapter.js';
import { PgWorkoutSessionRepository } from './adapters/pg-workout-session.repository.js';
import { PgWorkoutSetRepository } from './adapters/pg-workout-set.repository.js';
import { PgWorkoutPrRepository } from './adapters/pg-workout-pr.repository.js';
import { PgWorkoutProfileRepository } from './adapters/pg-workout-profile.repository.js';
import { PgWorkoutExerciseCatalogAdapter } from './adapters/pg-workout-exercise-catalog.adapter.js';
import { PgWellnessCycleEntryRepository } from './adapters/pg-wellness-cycle-entry.repository.js';
import { PgWellnessProfileRepository } from './adapters/pg-wellness-profile.repository.js';
import { PgWellnessReminderRepository } from './adapters/pg-wellness-reminder.repository.js';
import { PgFinanceTransactionRepository } from './adapters/pg-finance-transaction.repository.js';
import { PgFinanceRecurringPaymentRepository } from './adapters/pg-finance-recurring-payment.repository.js';
import { PgFinanceBudgetLimitRepository } from './adapters/pg-finance-budget-limit.repository.js';
import { PgFinanceProfileRepository } from './adapters/pg-finance-profile.repository.js';
import { PgMealPlannedMealRepository } from './adapters/pg-meal-planned-meal.repository.js';
import { PgMealNutritionLogRepository } from './adapters/pg-meal-nutrition-log.repository.js';
import { PgMealProfileRepository } from './adapters/pg-meal-profile.repository.js';
import { PgMealFoodCatalogAdapter } from './adapters/pg-meal-food-catalog.adapter.js';
import { PgHabitRepository } from './adapters/pg-habit.repository.js';
import { PgHabitCheckInRepository } from './adapters/pg-habit-checkin.repository.js';
import { PgPlanCatalogAdapter } from './adapters/pg-plan-catalog.adapter.js';

export type Publish = (event: DomainEvent) => Promise<void>;

export interface BuildManifestsDeps {
  db: DatabasePort;
  /** The live Connector Registry — grocery.compare_prices fans out across every
   *  connector registered under the 'grocery' domain (Blinkit, Zepto, live Blinkit).
   *  Passing the registry itself (not a snapshot) is safe: connectors are registered
   *  into it separately in main.ts, and compare_prices reads it lazily per request. */
  connectors: ConnectorRegistryPort;
  /** Informational upgrade/pricing page link surfaced by the assistant skill — no
   *  real payment processor is wired yet, so this is a static link, not a checkout. */
  upgradeUrl: string;
}

/** Grocery is served by Blinkit, Calendar by Google Calendar (connectors are swappable
 *  via the registry — see main.ts). `publish` drives the surface projections. */
export function buildManifests(publish: Publish, deps: BuildManifestsDeps): SkillManifest[] {
  const newId = (): string => randomUUID();
  const installed: SkillManifest[] = [
    createGrocerySkill({
      repository: new InMemoryGroceryRepository(),
      provider: blinkitConnector,
      list: new PgGroceryListRepository(deps.db),
      priceCache: new PgGroceryPriceCacheAdapter(deps.db),
      preferences: new PgGroceryPreferenceAdapter(deps.db),
      connectors: deps.connectors,
      newId,
      publish,
      // Live browser scrapes take ~6-8s per store; give the per-store cap headroom so
      // Blinkit/Zepto don't get cut off before returning (falls back to cache on timeout).
      compareTimeoutMs: 15000,
    }),
    createCalendarSkill({
      repository: new InMemoryCalendarRepository(),
      provider: googleCalendarConnector,
      newId,
      publish,
      now: () => new Date().toISOString(),
    }),
    createWorkoutSkill({
      sessions: new PgWorkoutSessionRepository(deps.db),
      sets: new PgWorkoutSetRepository(deps.db),
      prs: new PgWorkoutPrRepository(deps.db),
      profiles: new PgWorkoutProfileRepository(deps.db),
      catalog: new PgWorkoutExerciseCatalogAdapter(deps.db),
      newId,
      publish,
      now: () => new Date().toISOString(),
    }),
    createWellnessSkill({
      entries: new PgWellnessCycleEntryRepository(deps.db),
      profiles: new PgWellnessProfileRepository(deps.db),
      reminders: new PgWellnessReminderRepository(deps.db),
      newId,
      publish,
      now: () => new Date().toISOString(),
    }),
    createFinanceSkill({
      transactions: new PgFinanceTransactionRepository(deps.db),
      recurringPayments: new PgFinanceRecurringPaymentRepository(deps.db),
      budgets: new PgFinanceBudgetLimitRepository(deps.db),
      profiles: new PgFinanceProfileRepository(deps.db),
      newId,
      publish,
      now: () => new Date().toISOString(),
    }),
    createMealPlanningSkill({
      plannedMeals: new PgMealPlannedMealRepository(deps.db),
      nutritionLog: new PgMealNutritionLogRepository(deps.db),
      profiles: new PgMealProfileRepository(deps.db),
      catalog: new PgMealFoodCatalogAdapter(deps.db),
      newId,
      publish,
      now: () => new Date().toISOString(),
    }),
    createHabitSkill({
      habits: new PgHabitRepository(deps.db),
      checkIns: new PgHabitCheckInRepository(deps.db),
      newId,
      publish,
      now: () => new Date().toISOString(),
    }),
  ];

  // The assistant skill introspects the OTHER installed skills' manifests (already
  // built above) to explain what the user can do and what's locked for their plan.
  installed.push(
    createAssistantSkill({
      installedSkills: installed.map((m) => ({
        key: m.key,
        title: m.title,
        description: m.description,
        capabilities: m.capabilities,
      })),
      planCatalog: new PgPlanCatalogAdapter(deps.db),
      upgradeUrl: deps.upgradeUrl,
    }),
  );

  return installed;
}
