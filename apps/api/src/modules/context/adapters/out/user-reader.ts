import type { DatabasePort } from '../../../../shared/database/database.port.js';

export interface UserProfile {
  id: string;
  locale: string;
  timezone: string;
}

/** Reads the base user profile for context assembly. */
export class UserReader {
  constructor(private readonly db: DatabasePort) {}

  async get(userId: string): Promise<UserProfile> {
    const result = await this.db.query<UserProfile>(
      'select id, locale, timezone from platform.users where id = $1',
      [userId],
    );
    return result.rows[0] ?? { id: userId, locale: 'en-IN', timezone: 'Asia/Kolkata' };
  }
}
