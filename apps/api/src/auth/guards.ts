import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { users, type UserRow } from '../db/schema';
import { HttpError } from '../http-error';
import { SESSION_COOKIE } from './session';

declare module 'fastify' {
  interface FastifyRequest {
    // Set by requireUser from the database row, never from token claims.
    currentUser: UserRow | null;
  }
}

export async function requireUser(request: FastifyRequest): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  const userId = token ? await request.server.sessions.verify(token) : null;
  if (!userId) {
    throw new HttpError(401, 'Authentication required');
  }
  const [user] = await request.server.db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new HttpError(401, 'Authentication required');
  }
  request.currentUser = user;
}

export async function requireAdmin(request: FastifyRequest): Promise<void> {
  await requireUser(request);
  if (request.currentUser?.role !== 'admin') {
    throw new HttpError(403, 'Admin role required');
  }
}

export function currentUser(request: FastifyRequest): UserRow {
  if (!request.currentUser) {
    throw new Error('requireUser must run before this handler');
  }
  return request.currentUser;
}
