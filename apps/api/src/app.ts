import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { DatabaseError } from 'pg';
import { ZodError } from 'zod';
import { alertRoutes } from './alerts/routes';
import { authRoutes } from './auth/routes';
import { createSessionTokens, type SessionTokens } from './auth/session';
import type { ChannelRegistry } from './channels/registry';
import type { Config } from './config';
import type { Db } from './db/client';
import { devRoutes } from './dev/routes';
import { targetRoutes } from './targets/routes';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    sessions: SessionTokens;
    channels: ChannelRegistry;
  }
}

export interface AppDeps {
  db: Db;
  channels: ChannelRegistry;
}

// Drizzle wraps driver errors in DrizzleQueryError and keeps the original as cause.
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const dbError =
    error instanceof DatabaseError
      ? error
      : error instanceof Error && error.cause instanceof DatabaseError
        ? error.cause
        : undefined;
  return dbError?.code === '23505' && dbError.constraint === constraint;
}

function isClientError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

export async function buildApp(
  config: Config,
  deps: AppDeps,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.NODE_ENV === 'test' ? 'silent' : 'info' },
  });

  app.decorate('db', deps.db);
  app.decorate('sessions', createSessionTokens(config.JWT_SECRET));
  app.decorate('channels', deps.channels);
  app.decorateRequest('currentUser', null);

  // Routes with a body accept only application/json (CSRF measure in the design).
  app.removeContentTypeParser('text/plain');

  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const message = error.issues
        .map((issue) =>
          issue.path.length > 0
            ? `${issue.path.join('.')}: ${issue.message}`
            : issue.message,
        )
        .join('; ');
      return reply
        .code(400)
        .send({ statusCode: 400, error: 'Bad Request', message });
    }
    if (isUniqueViolation(error, 'users_email_unique')) {
      return reply.code(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'Email is already registered',
      });
    }
    if (isClientError(error)) {
      // Rethrowing hands the error to Fastify's default handler.
      throw error;
    }
    // A 500 message can hold SQL and parameters, so only the log gets it.
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal Server Error',
    });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  await app.register(authRoutes, { prefix: '/api/auth', config });
  await app.register(targetRoutes, { prefix: '/api/targets' });
  await app.register(alertRoutes, { prefix: '/api/alerts' });
  if (config.NODE_ENV !== 'production') {
    await app.register(devRoutes, { prefix: '/api/dev' });
  }

  return app;
}
