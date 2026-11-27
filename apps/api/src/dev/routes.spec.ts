import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { ChannelId } from '@alerts/shared';
import { buildApp } from '../app';
import { createChannelRegistry } from '../channels/registry';
import { loadConfig, type Config } from '../config';
import { createDb, type Db } from '../db/client';
import { syncRegistryRows } from '../db/registry-sync';
import {
  alerts,
  alertTargets,
  deliveries,
  events,
  targets,
  users,
} from '../db/schema';
import { MOCK_SLACK_MAX_MESSAGES } from './routes';

const marketEvent = {
  category: 'market',
  title: 'TSLA falls 12%',
  severity: 4,
  data: { symbol: 'TSLA', price: 220, changePct: -12 },
};

describe('dev routes', () => {
  let config: Config;
  let app: FastifyInstance;
  let db: Db;
  let pool: Pool;
  let userIds: string[] = [];
  let eventIds: string[] = [];

  async function newApp(nodeEnv: Config['NODE_ENV']): Promise<FastifyInstance> {
    const instance = await buildApp(
      { ...config, NODE_ENV: nodeEnv },
      { db, channels: createChannelRegistry(config) },
    );
    await instance.ready();
    return instance;
  }

  beforeAll(async () => {
    config = loadConfig(process.env);
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    await syncRegistryRows(db, { channelIds: ChannelId.options, sources: [] });
  });

  beforeEach(async () => {
    app = await newApp('test');
  });

  afterEach(async () => {
    await app?.close();
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
    userIds = [];
    if (eventIds.length > 0) {
      await db.delete(events).where(inArray(events.id, eventIds));
    }
    eventIds = [];
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function newMarketAlert(): Promise<string> {
    const [user] = await db
      .insert(users)
      .values({
        email: `dev-test-${randomUUID()}@example.com`,
        passwordHash: 'not used',
        role: 'user',
      })
      .returning();
    userIds.push(user.id);
    const [target] = await db
      .insert(targets)
      .values({
        userId: user.id,
        name: 'Inbox',
        channel: 'email',
        config: { address: 'someone@example.com' },
      })
      .returning();
    const [alert] = await db
      .insert(alerts)
      .values({
        userId: user.id,
        name: 'Tesla drops',
        category: 'market',
        filters: { symbols: ['TSLA'], direction: 'down', minChangePct: 5 },
        minSeverity: 3,
        enabled: true,
      })
      .returning();
    await db
      .insert(alertTargets)
      .values({ alertId: alert.id, targetId: target.id });
    return alert.id;
  }

  function postSlack(hookId: string, text: string) {
    return app.inject({
      method: 'POST',
      url: `/api/dev/mock-slack/${hookId}`,
      payload: { text },
    });
  }

  async function slackMessages() {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dev/mock-slack/messages',
    });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  it('POST /api/dev/events returns 201 with the event and the delivery count', async () => {
    const alertId = await newMarketAlert();

    const response = await app.inject({
      method: 'POST',
      url: '/api/dev/events',
      payload: marketEvent,
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    eventIds.push(body.event.id);
    expect(body.event).toEqual({
      ...marketEvent,
      id: expect.any(String),
      sourceId: 'dev',
      summary: '',
      occurredAt: expect.any(String),
      createdAt: expect.any(String),
    });

    const rows = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.eventId, body.event.id));
    expect(body.deliveriesCreated).toBe(rows.length);
    expect(rows.filter((row) => row.alertId === alertId)).toHaveLength(1);
  });

  it('POST /api/dev/events rejects data of another category with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/dev/events',
      payload: { ...marketEvent, category: 'news' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('every dev route returns 404 when NODE_ENV is production', async () => {
    const production = await newApp('production');
    // buildApp logs at info level in production.
    production.log.level = 'silent';
    try {
      const requests = [
        { method: 'POST', url: '/api/dev/events', payload: marketEvent },
        {
          method: 'POST',
          url: '/api/dev/mock-slack/hook',
          payload: { text: 'hi' },
        },
        { method: 'GET', url: '/api/dev/mock-slack/messages' },
        { method: 'DELETE', url: '/api/dev/mock-slack/messages' },
        {
          method: 'PUT',
          url: '/api/dev/mock-slack/mode',
          payload: { fail: true },
        },
      ] as const;
      for (const request of requests) {
        const response = await production.inject(request);
        expect(response.statusCode, `${request.method} ${request.url}`).toBe(
          404,
        );
      }
    } finally {
      await production.close();
    }
  });

  it('the mock Slack receiver stores messages, fails on demand and clears', async () => {
    const ok = await postSlack('team-a', 'first');
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe('ok');

    const mode = await app.inject({
      method: 'PUT',
      url: '/api/dev/mock-slack/mode',
      payload: { fail: true },
    });
    expect(mode.statusCode).toBe(200);
    expect(mode.json()).toEqual({ fail: true });
    expect((await postSlack('team-a', 'second')).statusCode).toBe(500);

    await app.inject({
      method: 'PUT',
      url: '/api/dev/mock-slack/mode',
      payload: { fail: false },
    });
    expect((await postSlack('team-b', 'third')).statusCode).toBe(200);

    const stored = await slackMessages();
    expect(stored).toEqual([
      { hookId: 'team-b', text: 'third', receivedAt: expect.any(String) },
      { hookId: 'team-a', text: 'second', receivedAt: expect.any(String) },
      { hookId: 'team-a', text: 'first', receivedAt: expect.any(String) },
    ]);

    const cleared = await app.inject({
      method: 'DELETE',
      url: '/api/dev/mock-slack/messages',
    });
    expect(cleared.statusCode).toBe(204);
    expect(await slackMessages()).toEqual([]);
  });

  it('the mock Slack receiver rejects a bad hook id with 400', async () => {
    expect((await postSlack('bad.hook', 'hi')).statusCode).toBe(400);
    expect(await slackMessages()).toEqual([]);
  });

  it(`the mock Slack store keeps only the newest ${MOCK_SLACK_MAX_MESSAGES} messages`, async () => {
    for (let i = 0; i <= MOCK_SLACK_MAX_MESSAGES; i++) {
      expect((await postSlack('hook', `message ${i}`)).statusCode).toBe(200);
    }

    const stored = await slackMessages();
    expect(stored).toHaveLength(MOCK_SLACK_MAX_MESSAGES);
    expect(stored[0].text).toBe(`message ${MOCK_SLACK_MAX_MESSAGES}`);
    expect(stored.at(-1).text).toBe('message 1');
  });
});
