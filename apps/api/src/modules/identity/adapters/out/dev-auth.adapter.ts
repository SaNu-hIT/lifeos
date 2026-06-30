// Local development auth adapter: HS256 JWTs signed with a config secret.
// This is the LOCAL stand-in for Supabase Auth (KI-003). The real Supabase adapter
// implements the same AuthPort and drops in without changing guards/controllers.

import jwt from 'jsonwebtoken';
import type { AuthUser } from '@lifeos/contracts';
import type { AuthPort } from '../../domain/ports/auth.port.js';

interface DevTokenClaims {
  sub: string;
  email?: string;
}

export class DevAuthAdapter implements AuthPort {
  constructor(private readonly secret: string) {}

  async verifyToken(token: string): Promise<AuthUser> {
    const claims = jwt.verify(token, this.secret) as DevTokenClaims;
    return { id: claims.sub, email: claims.email ?? '' };
  }

  /** DEV-ONLY: mint a token for local testing / the dev session endpoint. */
  mintToken(user: { id: string; email: string }, expiresIn: string = '1h'): string {
    return jwt.sign({ sub: user.id, email: user.email }, this.secret, {
      expiresIn,
    } as jwt.SignOptions);
  }
}
