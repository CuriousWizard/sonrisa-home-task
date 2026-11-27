import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { LoginInput, RegisterInput, type UserDto } from '@alerts/shared';
import type { Config } from '../config';
import { users, type UserRow } from '../db/schema';
import { HttpError } from '../http-error';
import { currentUser, requireUser } from './guards';
import { hashPassword, verifyPassword } from './password';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './session';

function toUserDto(user: UserRow): UserDto {
  return { id: user.id, email: user.email, role: user.role };
}

export async function authRoutes(
  app: FastifyInstance,
  options: { config: Config },
): Promise<void> {
  const { config } = options;
  const rateLimit = {
    max: config.AUTH_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  };
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: config.NODE_ENV === 'production',
  } as const;
  // Login checks a password even for an unknown email, so timing does not reveal accounts.
  const dummyHash = hashPassword('dummy password for unknown emails');

  async function startSession(
    reply: FastifyReply,
    user: UserRow,
  ): Promise<UserDto> {
    const token = await app.sessions.sign(user);
    reply.setCookie(SESSION_COOKIE, token, {
      ...cookieOptions,
      maxAge: SESSION_TTL_SECONDS,
    });
    return toUserDto(user);
  }

  app.post('/register', { config: { rateLimit } }, async (request, reply) => {
    const input = RegisterInput.parse(request.body);
    const [user] = await app.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'user',
      })
      .returning();
    reply.code(201);
    return startSession(reply, user);
  });

  app.post('/login', { config: { rateLimit } }, async (request, reply) => {
    const input = LoginInput.parse(request.body);
    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    const valid = await verifyPassword(
      input.password,
      user ? user.passwordHash : await dummyHash,
    );
    if (!user || !valid) {
      throw new HttpError(401, 'Invalid email or password');
    }
    return startSession(reply, user);
  });

  app.post('/logout', { preHandler: requireUser }, async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: requireUser }, async (request) =>
    toUserDto(currentUser(request)),
  );
}
