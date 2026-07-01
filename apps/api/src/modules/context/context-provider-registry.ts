import type { ContextProvider } from '@lifeos/contracts';

/** DI token for the ContextProviderRegistry. */
export const CONTEXT_PROVIDER_REGISTRY = Symbol('CONTEXT_PROVIDER_REGISTRY');

/** Holds Skill-contributed Context Providers. Skills register these at boot; the
 *  Context Engine composes the ones matching a request's scope (docs/adr/adr-0007). */
export class ContextProviderRegistry {
  private readonly providers: ContextProvider[] = [];

  register(provider: ContextProvider): void {
    this.providers.push(provider);
  }

  providersFor(scope: string): ContextProvider[] {
    return this.providers.filter((p) => p.scope === scope || p.scope === 'global');
  }
}
