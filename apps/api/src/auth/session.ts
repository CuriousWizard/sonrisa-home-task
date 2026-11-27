import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { Role } from '@alerts/shared';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ALGORITHM = 'HS256';
const UserId = z.uuid();

export interface SessionTokens {
  sign(user: { id: string; role: Role }): Promise<string>;
  // Returns the user id from a valid token, or null for any invalid token.
  verify(token: string): Promise<string | null>;
}

export function createSessionTokens(secret: string): SessionTokens {
  const key = new TextEncoder().encode(secret);
  return {
    sign: (user) =>
      new SignJWT({ role: user.role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
        .sign(key),
    verify: async (token) => {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: [ALGORITHM],
          requiredClaims: ['exp', 'sub'],
        });
        const userId = UserId.safeParse(payload.sub);
        return userId.success ? userId.data : null;
      } catch {
        return null;
      }
    },
  };
}
