import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '@lifeos/contracts';
import {
  USER_REPOSITORY,
  type UserRecord,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port.js';

@Injectable()
export class ProvisionUserService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  /** Returns the user record, provisioning it on first authenticated access. */
  async ensure(user: AuthUser): Promise<UserRecord> {
    const existing = await this.users.findById(user.id);
    if (existing) return existing;
    return this.users.provision({ id: user.id, email: user.email });
  }
}
