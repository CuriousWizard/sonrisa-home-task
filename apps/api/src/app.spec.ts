import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from './app';
import { createChannelRegistry } from './channels/registry';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { targets } from './db/schema';

const WEBHOOK_URL = 'https://hooks.slack.com/services/T0/B0/app-test-secret';

describe('app error handler', () => {
  let app: FastifyInstance;
  let pool: Pool;
  const errorLog = vi.fn();

  beforeAll(async () => {
    const config = loadConfig(process.env);
    const created = createDb(config.TEST_DATABASE_URL);
    pool = created.pool;
    const { db } = created;
    app = await buildApp(config, {
      db,
      channels: createChannelRegistry(config),
    });
    // The app logger is silent in tests, so this route records its request logger's error calls.
    app.post(
      '/test/failing-insert',
      {
        childLoggerFactory: (logger, bindings, options) => {
          const child = logger.child(bindings, options);
          child.error = errorLog;
          return child;
        },
      },
      // No user has this id, so the insert fails on the foreign key.
      async () =>
        db.insert(targets).values({
          userId: randomUUID(),
          name: 'Team channel',
          channel: 'slack',
          config: { webhookUrl: WEBHOOK_URL },
        }),
    );
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it('logs a failed insert without the query text or the parameter values', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/failing-insert',
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain(WEBHOOK_URL);
    expect(errorLog).toHaveBeenCalledWith(
      {
        error: {
          name: 'Error',
          code: '23503',
          constraint: 'targets_user_id_users_id_fk',
        },
      },
      'request failed',
    );
    // inspect also prints non-enumerable fields such as message and stack.
    const logged = inspect(errorLog.mock.calls, { depth: null });
    expect(logged).not.toContain(WEBHOOK_URL);
    expect(logged).not.toMatch(/insert into/i);
  });
});
