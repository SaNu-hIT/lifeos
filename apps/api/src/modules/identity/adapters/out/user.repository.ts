import type { DatabasePort } from '../../../../shared/database/database.port.js';
import type {
  UserRecord,
  UserRepositoryPort,
} from '../../domain/ports/user-repository.port.js';

export class PgUserRepository implements UserRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>(
      'select id, email, locale, timezone from platform.users where id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async provision(input: { id: string; email: string }): Promise<UserRecord> {
    // Service context: provisioning is a trusted system write (bypasses RLS).
    await this.db.transaction(async (tx) => {
      await tx.query(
        'insert into platform.users (id, email) values ($1, $2) on conflict (id) do nothing',
        [input.id, input.email],
      );
    });
    const record = await this.findById(input.id);
    if (!record) throw new Error(`Failed to provision user ${input.id}`);
    return record;
  }
}
