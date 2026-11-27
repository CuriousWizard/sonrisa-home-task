import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import Fastify, {
  type FastifyInstance,
  type InjectOptions,
  type LightMyRequestResponse,
} from 'fastify';
import type { Pool } from 'pg';
import {
  ChannelId,
  type AdminUserDto,
  type Category,
  type DeliveryDto,
  type EventDto,
  type EventInput,
  type MetricsDto,
  type Role,
} from '@alerts/shared';
import { buildApp } from '../app';
import { SESSION_COOKIE } from '../auth/session';
import { createChannelRegistry } from '../channels/registry';
import { loadConfig } from '../config';
import { createDb, type Db } from '../db/client';
import { syncRegistryRows } from '../db/registry-sync';
import {
  alerts,
  alertTargets,
  channels,
  deliveries,
  events,
  sources,
  targets,
  users,
} from '../db/schema';
import { adminRoutes } from './routes';

const EVENT_SOURCE_ID = 'admin-test';
const TEST_SOURCE_ID = 'admin-test-source';
const WEBHOOK_URL = 'https://hooks.slack.com/services/T0/B0/admin-test-secret';
const HOUR_MS = 60 * 60 * 1000;
// Room for the gap between the database clock and Date.now().
const CLOCK_SLACK_MS = 250;

const EVENT_DATA = {
  news: {},
  market: { symbol: 'TSLA', price: 182.5, changePct: -7 },
  disaster: { type: 'flood', region: 'europe' },
} satisfies Record<Category, EventInput['data']>;

type Method = InjectOptions['method'];
type DeliveryInsert = typeof deliveries.$inferInsert;

interface Owner {
  id: string;
  email: string;
  alertId: string;
  targetIds: Record<ChannelId, string>;
}

// Every key of every object in a parsed JSON value, at any depth.
function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysDeep);
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [
      key,
      ...keysDeep(child),
    ]);
  }
  return [];
}

// Reads the routes from the plugin itself, so a route added later is checked without editing the test.
async function adminRouteList(): Promise<{ method: Method; url: string }[]> {
  const probe = Fastify();
  const routes: { method: Method; url: string }[] = [];
  probe.addHook('onRoute', (route) => {
    for (const method of [route.method].flat()) {
      routes.push({ method: method as Method, url: route.url });
    }
  });
  await probe.register(adminRoutes, { prefix: '/api/admin' });
  await probe.close();
  return routes;
}

describe('admin routes', () => {
  let app: FastifyInstance;
  let db: Db;
  let pool: Pool;
  let adminSession: string;
  let userSession: string;
  let userAsAdminSession: string;
  let sessionUserIds: string[] = [];
  let userIds: string[] = [];

  beforeAll(async () => {
    const config = loadConfig(process.env);
    ({ db, pool } = createDb(config.TEST_DATABASE_URL));
    app = await buildApp(config, {
      db,
      channels: createChannelRegistry(config),
    });
    await app.ready();
    await syncRegistryRows(db, {
      channelIds: ChannelId.options,
      sources: [{ id: TEST_SOURCE_ID, category: 'news' }],
    });
    const admin = await insertUser('admin');
    const user = await insertUser('user');
    sessionUserIds = [admin.id, user.id];
    adminSession = await app.sessions.sign(admin);
    userSession = await app.sessions.sign(user);
    // A guard that read the role claim would let this token through.
    userAsAdminSession = await app.sessions.sign({
      id: user.id,
      role: 'admin',
    });
  });

  afterEach(async () => {
    // Deleting the users and events cascades to targets, alerts and deliveries.
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
    userIds = [];
    await db.delete(events).where(eq(events.sourceId, EVENT_SOURCE_ID));
  });

  afterAll(async () => {
    if (sessionUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, sessionUserIds));
    }
    await db?.delete(sources).where(eq(sources.id, TEST_SOURCE_ID));
    await app?.close();
    await pool?.end();
  });

  async function insertUser(role: Role) {
    const [user] = await db
      .insert(users)
      .values({
        email: `admin-test-${randomUUID()}@example.com`,
        passwordHash: `scrypt$test$${randomUUID()}`,
        role,
      })
      .returning();
    return user;
  }

  async function newUser() {
    const user = await insertUser('user');
    userIds.push(user.id);
    return user;
  }

  // One user with an email and a Slack target, both used by one news alert.
  async function newOwner(): Promise<Owner> {
    const user = await newUser();
    const [emailTarget, slackTarget] = await db
      .insert(targets)
      .values([
        {
          userId: user.id,
          name: 'Inbox',
          channel: 'email',
          config: { address: user.email },
        },
        {
          userId: user.id,
          name: 'Team channel',
          channel: 'slack',
          config: { webhookUrl: WEBHOOK_URL },
        },
      ])
      .returning();
    const [alert] = await db
      .insert(alerts)
      .values({
        userId: user.id,
        name: 'Oil news',
        category: 'news',
        filters: { keywords: ['oil'] },
        minSeverity: 1,
        enabled: true,
      })
      .returning();
    await db.insert(alertTargets).values([
      { alertId: alert.id, targetId: emailTarget.id },
      { alertId: alert.id, targetId: slackTarget.id },
    ]);
    return {
      id: user.id,
      email: user.email,
      alertId: alert.id,
      targetIds: { email: emailTarget.id, slack: slackTarget.id },
    };
  }

  async function newEvent(
    category: Category,
    createdAt = new Date(),
    occurredAt = createdAt,
  ): Promise<string> {
    const [event] = await db
      .insert(events)
      .values({
        sourceId: EVENT_SOURCE_ID,
        externalId: randomUUID(),
        category,
        title: `Test ${category} event`,
        summary: '',
        severity: 3,
        data: EVENT_DATA[category],
        occurredAt,
        createdAt,
      })
      .returning();
    return event.id;
  }

  // Each delivery gets its own event, so one owner can hold many rows for one target.
  async function newDelivery(
    owner: Owner,
    channel: ChannelId,
    fields: Partial<DeliveryInsert> = {},
  ): Promise<string> {
    const eventId = await newEvent('news', fields.createdAt);
    const [delivery] = await db
      .insert(deliveries)
      .values({
        alertId: owner.alertId,
        eventId,
        targetId: owner.targetIds[channel],
        channel,
        status: 'pending',
        ...fields,
      })
      .returning();
    return delivery.id;
  }

  async function load(id: string) {
    const [row] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, id));
    return row;
  }

  function call(
    session: string | undefined,
    method: Method,
    url: string,
    payload?: object,
  ): Promise<LightMyRequestResponse> {
    return app.inject({
      method,
      url,
      ...(session ? { cookies: { [SESSION_COOKIE]: session } } : {}),
      ...(payload ? { payload } : {}),
    });
  }

  function asAdmin(
    method: Method,
    url: string,
    payload?: object,
  ): Promise<LightMyRequestResponse> {
    return call(adminSession, method, url, payload);
  }

  async function listDeliveries(query: string): Promise<DeliveryDto[]> {
    const response = await asAdmin(
      'GET',
      `/api/admin/deliveries?${query}&limit=200`,
    );
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  it('every admin route returns 401 without a session and 403 for a user session', async () => {
    const routes = await adminRouteList();
    expect(routes).toContainEqual({
      method: 'POST',
      url: '/api/admin/deliveries/:id/retry',
    });

    for (const { method, url } of routes) {
      // The guard runs before the handler parses params, so any id will do.
      const path = url.replace(/:\w+/g, randomUUID());
      const anonymous = await call(undefined, method, path);
      expect(anonymous.statusCode, `${method} ${url} without a session`).toBe(
        401,
      );
      const asUser = await call(userSession, method, path);
      expect(asUser.statusCode, `${method} ${url} as a user`).toBe(403);
      const asClaimedAdmin = await call(userAsAdminSession, method, path);
      expect(
        asClaimedAdmin.statusCode,
        `${method} ${url} as a user row with an admin role claim`,
      ).toBe(403);
    }
  });

  it('lists users newest first with alert counts and no password hash', async () => {
    const withAlerts = await newUser();
    await db.insert(alerts).values(
      ['First', 'Second'].map((name) => ({
        userId: withAlerts.id,
        name,
        category: 'news' as const,
        filters: { keywords: [] },
        minSeverity: 1,
        enabled: true,
      })),
    );
    const newest = await newUser();

    const response = await asAdmin('GET', '/api/admin/users?limit=200');
    expect(response.statusCode).toBe(200);
    const body: AdminUserDto[] = response.json();
    expect(body).toEqual(
      expect.arrayContaining([
        {
          id: withAlerts.id,
          email: withAlerts.email,
          role: 'user',
          createdAt: withAlerts.createdAt.toISOString(),
          alertCount: 2,
        },
        {
          id: newest.id,
          email: newest.email,
          role: 'user',
          createdAt: newest.createdAt.toISOString(),
          alertCount: 0,
        },
      ]),
    );
    expect(keysDeep(body).filter((key) => /password/i.test(key))).toEqual([]);
    expect(response.body).not.toContain(withAlerts.passwordHash);

    const limited = await asAdmin('GET', '/api/admin/users?limit=1');
    expect(limited.json()).toEqual([
      expect.objectContaining({ id: newest.id }),
    ]);
  });

  it("lists one user's alerts with their target ids, cut at limit", async () => {
    const owner = await newOwner();
    await newOwner();

    const response = await asAdmin(
      'GET',
      `/api/admin/alerts?userId=${owner.id}`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: owner.alertId,
        name: 'Oil news',
        targetIds: expect.arrayContaining(Object.values(owner.targetIds)),
      }),
    ]);
    expect((await asAdmin('GET', '/api/admin/alerts')).statusCode).toBe(400);

    const [newer] = await db
      .insert(alerts)
      .values({
        userId: owner.id,
        name: 'Newer',
        category: 'news',
        filters: { keywords: [] },
        minSeverity: 1,
        enabled: true,
      })
      .returning();
    const limited = await asAdmin(
      'GET',
      `/api/admin/alerts?userId=${owner.id}&limit=1`,
    );
    expect(limited.statusCode).toBe(200);
    expect(limited.json()).toEqual([expect.objectContaining({ id: newer.id })]);
  });

  it('lists events newest first, filtered by category and cut at limit', async () => {
    const now = Date.now();
    const olderNews = await newEvent('news', new Date(now - 2000));
    const market = await newEvent('market', new Date(now - 1000));
    const newerNews = await newEvent('news', new Date(now));

    const response = await asAdmin(
      'GET',
      '/api/admin/events?category=news&limit=200',
    );
    expect(response.statusCode).toBe(200);
    const news: EventDto[] = response.json();
    expect(news.every((event) => event.category === 'news')).toBe(true);
    const ids = news.map((event) => event.id);
    expect(ids).not.toContain(market);
    expect(ids.indexOf(newerNews)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(newerNews)).toBeLessThan(ids.indexOf(olderNews));

    const limited: EventDto[] = (
      await asAdmin('GET', '/api/admin/events?limit=2')
    ).json();
    expect(limited.map((event) => event.id)).toEqual([newerNews, market]);

    const unknown = await asAdmin('GET', '/api/admin/events?category=sports');
    expect(unknown.statusCode).toBe(400);
  });

  it('lists deliveries with names but no target config, filtered by status and channel', async () => {
    const owner = await newOwner();
    const emailFailed = await newDelivery(owner, 'email', { status: 'failed' });
    const emailSent = await newDelivery(owner, 'email', { status: 'sent' });
    const slackFailed = await newDelivery(owner, 'slack', {
      status: 'failed',
      attempts: 2,
      lastError: 'Slack responded 500',
    });
    const slackDead = await newDelivery(owner, 'slack', { status: 'dead' });

    const response = await asAdmin('GET', '/api/admin/deliveries?limit=200');
    expect(response.statusCode).toBe(200);
    const all: DeliveryDto[] = response.json();
    expect(all).toEqual(
      expect.arrayContaining([
        {
          id: slackFailed,
          alertId: owner.alertId,
          eventId: expect.any(String),
          targetId: owner.targetIds.slack,
          channel: 'slack',
          status: 'failed',
          attempts: 2,
          nextAttemptAt: expect.any(String),
          lastError: 'Slack responded 500',
          sentAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          eventTitle: 'Test news event',
          alertName: 'Oil news',
          targetName: 'Team channel',
          userEmail: owner.email,
        },
      ]),
    );
    expect(keysDeep(all)).not.toContain('config');
    expect(keysDeep(all)).not.toContain('webhookUrl');
    expect(response.body).not.toContain(WEBHOOK_URL);

    const failedSlack = await listDeliveries('status=failed&channel=slack');
    expect(
      failedSlack.every(
        (row) => row.status === 'failed' && row.channel === 'slack',
      ),
    ).toBe(true);
    expect(failedSlack.map((row) => row.id)).toContain(slackFailed);

    const failed = (await listDeliveries('status=failed')).map((row) => row.id);
    expect(failed).toEqual(expect.arrayContaining([emailFailed, slackFailed]));
    expect(failed).not.toContain(emailSent);
    expect(failed).not.toContain(slackDead);

    const email = await listDeliveries('channel=email');
    expect(email.every((row) => row.channel === 'email')).toBe(true);
    expect(email.map((row) => row.id)).toEqual(
      expect.arrayContaining([emailFailed, emailSent]),
    );

    const limited = await asAdmin('GET', '/api/admin/deliveries?limit=1');
    expect(limited.json()).toEqual([
      expect.objectContaining({ id: slackDead }),
    ]);

    const unknown = await asAdmin('GET', '/api/admin/deliveries?status=lost');
    expect(unknown.statusCode).toBe(400);
  });

  it('retry turns failed, dead and skipped rows into pending with attempts 0', async () => {
    const owner = await newOwner();
    const later = new Date(Date.now() + HOUR_MS);

    for (const status of ['failed', 'dead', 'skipped'] as const) {
      const id = await newDelivery(owner, 'slack', {
        status,
        attempts: status === 'skipped' ? 0 : 3,
        nextAttemptAt: later,
        lastError: 'Slack responded 500',
        claimToken: status === 'skipped' ? null : randomUUID(),
      });

      const response = await asAdmin(
        'POST',
        `/api/admin/deliveries/${id}/retry`,
      );
      expect(response.statusCode, status).toBe(200);
      expect(response.json()).toMatchObject({
        id,
        status: 'pending',
        attempts: 0,
        lastError: null,
      });
      const row = await load(id);
      expect(row, status).toMatchObject({
        status: 'pending',
        attempts: 0,
        lastError: null,
        claimToken: null,
      });
      expect(row.nextAttemptAt.getTime()).toBeLessThanOrEqual(
        Date.now() + CLOCK_SLACK_MS,
      );
    }
  });

  it('retry returns 409 for sent, pending and sending rows and 404 for an unknown id', async () => {
    const owner = await newOwner();

    for (const status of ['sent', 'pending', 'sending'] as const) {
      const id = await newDelivery(owner, 'email', { status, attempts: 1 });

      const response = await asAdmin(
        'POST',
        `/api/admin/deliveries/${id}/retry`,
      );
      expect(response.statusCode, status).toBe(409);
      expect(await load(id), status).toMatchObject({ status, attempts: 1 });
    }

    const unknown = await asAdmin(
      'POST',
      `/api/admin/deliveries/${randomUUID()}/retry`,
    );
    expect(unknown.statusCode).toBe(404);
  });

  it('PATCH disables a channel and GET shows it disabled', async () => {
    try {
      const patched = await asAdmin('PATCH', '/api/admin/channels/slack', {
        enabled: false,
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json()).toEqual({
        id: 'slack',
        enabled: false,
        updatedAt: expect.any(String),
      });

      const list = await asAdmin('GET', '/api/admin/channels');
      expect(list.statusCode).toBe(200);
      expect(list.json()).toContainEqual(
        expect.objectContaining({ id: 'slack', enabled: false }),
      );
    } finally {
      await db
        .update(channels)
        .set({ enabled: true })
        .where(eq(channels.id, 'slack'));
    }

    const badBody = await asAdmin('PATCH', '/api/admin/channels/slack', {
      enabled: 'no',
    });
    expect(badBody.statusCode).toBe(400);
    const unknown = await asAdmin('PATCH', '/api/admin/channels/sms', {
      enabled: false,
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('PATCH disables a source and GET shows it disabled', async () => {
    const patched = await asAdmin(
      'PATCH',
      `/api/admin/sources/${TEST_SOURCE_ID}`,
      { enabled: false },
    );
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toEqual({
      id: TEST_SOURCE_ID,
      category: 'news',
      enabled: false,
      updatedAt: expect.any(String),
    });

    const list = await asAdmin('GET', '/api/admin/sources');
    expect(list.statusCode).toBe(200);
    expect(list.json()).toContainEqual(
      expect.objectContaining({ id: TEST_SOURCE_ID, enabled: false }),
    );

    const unknown = await asAdmin(
      'PATCH',
      '/api/admin/sources/no-such-source',
      {
        enabled: true,
      },
    );
    expect(unknown.statusCode).toBe(404);
  });

  it('metrics count rows from the last 24 hours and compute the failure rate per channel', async () => {
    // Spec files run one at a time on the test database, so this test can own the whole window.
    await db.delete(events);
    const owner = await newOwner();
    await newDelivery(owner, 'email', { status: 'sent' });
    await newDelivery(owner, 'email', { status: 'sent' });
    await newDelivery(owner, 'email', { status: 'dead' });
    await newDelivery(owner, 'slack', { status: 'failed' });
    await newDelivery(owner, 'slack', { status: 'pending' });
    const old = new Date(Date.now() - 25 * HOUR_MS);
    // Only created_at decides the window: this event is counted, the disaster event is not.
    await newEvent('market', new Date(), old);
    // Counted, these would change every total and both failure rates.
    await newDelivery(owner, 'email', { status: 'dead', createdAt: old });
    await newDelivery(owner, 'slack', { status: 'dead', createdAt: old });
    await newEvent('disaster', old, new Date());

    const before = Date.now();
    const response = await asAdmin('GET', '/api/admin/metrics');
    const after = Date.now();

    expect(response.statusCode).toBe(200);
    const body: MetricsDto = response.json();
    expect(body).toEqual({
      since: expect.any(String),
      eventsByCategory: { news: 5, market: 1, disaster: 0 },
      deliveriesByStatus: {
        pending: 1,
        sending: 0,
        sent: 2,
        failed: 1,
        dead: 1,
        skipped: 0,
      },
      failureRateByChannel: { email: expect.closeTo(1 / 3), slack: 0 },
    });
    const since = new Date(body.since).getTime();
    expect(since).toBeGreaterThanOrEqual(before - 24 * HOUR_MS);
    expect(since).toBeLessThanOrEqual(after - 24 * HOUR_MS);
  });
});
