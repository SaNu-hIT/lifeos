/** DI token for the BillingPort. */
export const BILLING_PORT = Symbol('BILLING_PORT');

export interface BillingStatus {
  active: boolean;
  planKey?: string;
}

/**
 * Seam for a payment provider. Phase 08 ships a DB-backed stub; a real PSP
 * (Stripe, etc.) implements this later without touching the grant logic.
 */
export interface BillingPort {
  getStatus(userId: string): Promise<BillingStatus>;
}
