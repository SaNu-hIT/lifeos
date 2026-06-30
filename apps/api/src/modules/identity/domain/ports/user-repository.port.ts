/** DI token for the UserRepositoryPort. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRecord {
  id: string;
  email: string;
  locale: string;
  timezone: string;
}

export interface UserRepositoryPort {
  findById(id: string): Promise<UserRecord | null>;
  /** Provision a user (idempotent). Runs in service context — provisioning is a
   *  trusted system operation, not an RLS-scoped one (docs/11 §2). */
  provision(input: { id: string; email: string }): Promise<UserRecord>;
}
