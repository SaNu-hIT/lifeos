import type { AuthUser } from '@lifeos/contracts';

/** DI token for the AuthPort. */
export const AUTH_PORT = Symbol('AUTH_PORT');

/**
 * Verifies a credential (a bearer token) and resolves the authenticated principal.
 * Implemented locally by the dev JWT adapter; in deployment by a Supabase adapter
 * (docs/adr/adr-0010-supabase-baas.md, KI-003). Throws on an invalid/expired token.
 */
export interface AuthPort {
  verifyToken(token: string): Promise<AuthUser>;
}
